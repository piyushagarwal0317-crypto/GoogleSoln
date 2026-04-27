# CloudScale RL2 - Google Solutions Challenge 2026

## 🌍 The Problem (UN SDG #9 & #13)
Cloud data centers consume enormous amounts of global electricity, much of it wasted on over-provisioned idle servers. We built **CloudScale RL2** to address **SDG 9** (Industry, Innovation & Infrastructure) and **SDG 13** (Climate Action) by using AI to autonomously scale cloud resources, preventing SLA violations while slashing server waste and carbon emissions.

## 💡 The Solution
An Agentic SRE (Site Reliability Engineer) Prototype powered by **Google Gemini 3.1 Pro**. It ingests live cluster telemetry (CPU, Latency, Queue Length) and makes autonomous Kubernetes Pod scaling decisions in real-time with SRE-level reasoning. 

## 🛠️ Technology Stack (Google Focus)
* **AI Agent:** Google GenAI SDK (Gemini 3.1 Pro)
* **Frontend:** React, TypeScript, Vite
* **Styling:** Tailwind CSS + Lucide Icons

## 🚀 How to Run Locally
1. Clone this repository: `git clone https://github.com/yourusername/cloudscale-rl2.git`
2. Install dependencies: `npm install`
3. Create a `.env` file and add your key: `GEMINI_API_KEY="your_api_key"`
4. Run locally: `npm run dev`

## 🔮 Future Roadmap (Production Implementation)
1. **Kubernetes Integration:** Bind AI decisions directly to K8s Horizontal Pod Autoscaler.
2. **Firebase:** Add Firebase Auth for SRE identity and Firestore to log historical scaling events.
3. **Live Metrics:** Replace mock sandbox inputs with live GCP/Datadog data ingestion.
