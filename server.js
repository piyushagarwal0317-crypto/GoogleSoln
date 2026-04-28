import 'dotenv/config';
import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
app.use(express.json());

const PORT = process.env.LOCAL_API_PORT || 5001;
const MODEL = 'gemini-2.5-flash';

function createFallbackAdvice(metrics) {
  const cpu = Number(metrics.cpu_utilization) || 0;
  const latency = Number(metrics.latency_ms) || 0;
  return {
    scale_delta: cpu > 0.8 ? 2 : cpu < 0.2 ? -1 : 0,
    rationale: `[FALLBACK] Based on CPU ${(cpu * 100).toFixed(0)}% and latency ${latency}ms, take a ${cpu > 0.8 ? 'scale-up' : cpu < 0.2 ? 'scale-down' : 'hold'} action.`,
    cost_impact_usd: cpu > 0.8 ? 2.5 : cpu < 0.2 ? -1.25 : 0,
    bottleneck_warning: latency > 500 ? 'High Latency Detected' : cpu > 0.9 ? 'CPU Saturation Imminent' : 'None',
  };
}

function parseModelResponse(text) {
  if (!text) throw new Error('Empty response from model');
  let raw = text.trim();
  if (raw.startsWith('```')) raw = raw.replace(/^```(json)?\n?/i, '').replace(/\n?```$/i, '');
  const r = JSON.parse(raw);
  return {
    scale_delta: Math.max(-2, Math.min(2, Number(r.scale_delta) || 0)),
    rationale: r.rationale || 'No rationale provided by model.',
    cost_impact_usd: Number(r.cost_impact_usd) || 0,
    bottleneck_warning: r.bottleneck_warning || 'None',
  };
}

app.post('/api/advice', async (req, res) => {
  const metrics = req.body || {};
  const key = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'Missing GEMINI API key in .env (VITE_GEMINI_API_KEY)' });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: `Autoscaling state JSON:\n${JSON.stringify(metrics, null, 2)}`,
      config: {
        systemInstruction: "You are an SRE autoscaling copilot. Provide a JSON response with keys 'scale_delta', 'rationale', 'cost_impact_usd', 'bottleneck_warning'.",
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
        },
      },
    });

    const rawText = response.text;
    let advice;
    try {
      advice = parseModelResponse(rawText);
      // If model returned an empty/default payload (all zeros/empty), treat as invalid and fall back
      const looksEmpty = (advice.scale_delta === 0 && (!advice.rationale || advice.rationale === 'No rationale provided by model.') && advice.cost_impact_usd === 0 && (!advice.bottleneck_warning || advice.bottleneck_warning === 'None'));
      if (looksEmpty) {
        throw new Error('Model returned empty/default payload: ' + (rawText || '<empty>'));
      }
    } catch (e) {
      console.error('Model parse error, using fallback. Raw model response:', rawText);
      const fallback = createFallbackAdvice(metrics);
      await db.collection("advice_requests").add({
        metrics,
        rawModelResponse: rawText,
        advice: fallback,
        model: MODEL,
        createdAt: new Date().toISOString(),
        status: "fallback",
      }).catch(() => {});
      res.status(200).json({ advice: fallback, fallback: true, error: String(e?.message || e) });
      return;
    }

    res.json({ advice, model: MODEL });
  } catch (err) {
    console.error('API error', err?.message || err);
    const fallback = createFallbackAdvice(metrics);
    res.status(200).json({ advice: fallback, fallback: true, error: String(err?.message || err) });
  }
});

app.listen(PORT, () => console.log(`Local API server listening on http://localhost:${PORT}`));
