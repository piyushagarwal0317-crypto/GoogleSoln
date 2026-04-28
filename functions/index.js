import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

initializeApp();

const db = getFirestore();
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const MODEL = "gemini-2.5-flash";

function normalizeMetrics(body) {
  const payload = body && typeof body === "object" ? body : {};

  return {
    cpu_utilization: Number(payload.cpu_utilization) || 0,
    latency_ms: Number(payload.latency_ms) || 0,
    request_rate: Number(payload.request_rate) || 0,
    active_pods: Number(payload.active_pods) || 0,
  };
}

function createFallbackAdvice(metrics) {
  return {
    scale_delta: metrics.cpu_utilization > 0.8 ? 2 : metrics.cpu_utilization < 0.2 ? -1 : 0,
    rationale: `[FALLBACK] Based on the CPU utilization of ${(metrics.cpu_utilization * 100).toFixed(0)}% and latency of ${metrics.latency_ms}ms, the system indicates a ${metrics.cpu_utilization > 0.8 ? "scale-up" : metrics.cpu_utilization < 0.2 ? "scale-down" : "hold"} operation is optimal to meet SLA targets while optimizing cost.`,
    cost_impact_usd: metrics.cpu_utilization > 0.8 ? 2.5 : metrics.cpu_utilization < 0.2 ? -1.25 : 0,
    bottleneck_warning: metrics.latency_ms > 500 ? "High Latency Detected: Requests may be dropping." : metrics.cpu_utilization > 0.9 ? "CPU Saturation Imminent." : "None",
  };
}

function parseModelResponse(text) {
  if (!text) {
    throw new Error("Received empty response from AI model.");
  }

  let rawJson = text.trim();
  if (rawJson.startsWith("```")) {
    rawJson = rawJson.replace(/^```(json)?\n?/i, "").replace(/\n?```$/i, "");
  }

  const result = JSON.parse(rawJson);

  return {
    scale_delta: Math.max(-2, Math.min(2, Number(result.scale_delta) || 0)),
    rationale: result.rationale || "No rationale provided by model.",
    cost_impact_usd: Number(result.cost_impact_usd) || 0,
    bottleneck_warning: result.bottleneck_warning || "None",
  };
}

export const adviceApi = onRequest({ cors: true, secrets: [geminiApiKey] }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const metrics = normalizeMetrics(req.body);

  try {
    const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: `Autoscaling state JSON:\n${JSON.stringify(metrics, null, 2)}`,
      config: {
        systemInstruction: "You are an SRE autoscaling copilot. Your task is to analyze the cloud infrastructure metrics provided in JSON and decide exactly ONE action for pod scaling. Always respond in JSON format with keys 'scale_delta', 'rationale', 'cost_impact_usd', and 'bottleneck_warning'. The 'scale_delta' must be an integer indicating how many pods to add or remove, clamped strictly within [-2, -1, 0, 1, 2]. Evaluate the financial impact of this decision and provide a short warning if any metric indicates an impending bottleneck.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scale_delta: {
              type: Type.INTEGER,
              description: "The number of pods to scale up or down. Values allowed: -2, -1, 0, 1, 2",
            },
            rationale: {
              type: Type.STRING,
              description: "A short, professional SRE-style explanation for this operational scaling action.",
            },
            cost_impact_usd: {
              type: Type.NUMBER,
              description: "The estimated hourly cost change in USD (e.g., +2.50 for scaling up, -1.25 for scaling down).",
            },
            bottleneck_warning: {
              type: Type.STRING,
              description: "A brief warning about potential bottlenecks. If metrics are healthy, return 'None'.",
            },
          },
          required: ["scale_delta", "rationale", "cost_impact_usd", "bottleneck_warning"],
        },
      },
    });

    const advice = parseModelResponse(response.text);

    await db.collection("advice_requests").add({
      metrics,
      advice,
      model: MODEL,
      createdAt: new Date().toISOString(),
      status: "success",
    });

    res.status(200).json({ advice, model: MODEL });
  } catch (error) {
    const message = error?.message || "Failed to generate scaling advice.";
    const fallback = createFallbackAdvice(metrics);

    try {
      await db.collection("advice_requests").add({
        metrics,
        error: message,
        fallback,
        model: MODEL,
        createdAt: new Date().toISOString(),
        status: "error",
      });
    } catch (logError) {
      console.error("Firestore logging failed", logError);
    }

    if (message.toLowerCase().includes("quota") || message.includes("429")) {
      res.status(200).json({ advice: fallback, model: MODEL, fallback: true });
      return;
    }

    res.status(500).json({ error: message });
  }
});