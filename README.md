# AutoScaleOps AI — Google Solutions Challenge 2026

## 🌍 UN Sustainable Development Goals (SDGs) Addressed
* **Goal 9: Industry, Innovation, and Infrastructure:** Building intelligent, resilient, and autonomous cloud infrastructure.
* **Goal 13: Climate Action:** Reducing carbon footprints by minimizing idle server runtime through AI-driven right-sizing and autoscaling.

## 🚀 Overview
AutoScaleOps AI is an agentic Site Reliability Engineering (SRE) prototype that leverages the **Gemini 2.5 Flash** model to autonomously manage cloud scaling decisions. By analyzing real-time server telemetry (CPU utilization, latency, traffic rates, and active pods), the AI acts as a copilot to recommend precise scale-up or scale-down actions. 

This prototype replaces traditional, rigid threshold-based scaling with intelligent, context-aware decision-making—reducing infrastructure costs and preventing Service Level Agreement (SLA) violations.

## ⚙️ How It Works (Input -> AI -> Output)
1. **Input (Telemetry):** The system ingests current cluster metrics including CPU usage, active pods, latency, and queue lengths.
2. **AI Processing:** Gemini API analyzes this state against standard operational playbooks to determine the optimal resource allocation.
3. **Output (Action & Rationale):** The model outputs a strict JSON payload containing:
   - `scale_delta`: How many pods to add/remove.
   - `rationale`: The logical SRE explanation for the action.
   - `cost_impact_usd`: Hourly financial impact.
   - `bottleneck_warning`: Early detection of saturation or anomalies.

## 🛠 Tech Stack
* **Frontend:** React 19, Vite, Tailwind CSS v4, Framer Motion
* **AI Integration:** Google AI Studio Gemini API through a Firebase Function
* **Backend:** Firebase Hosting, Firebase Functions, Firestore
* **Design System:** Custom "Clean Minimalism" UI

## 💻 Running the Project Locally
1. Clone this repository.
2. Run `npm install` to install dependencies.
3. Create a Firebase project in the Google Cloud Console.
4. Set your Gemini API key as a Firebase secret:
   `firebase functions:secrets:set GEMINI_API_KEY`
5. Run `npm run dev` to start the local development server.

### Deploying to Firebase Hosting
1. Install the Firebase CLI if needed: `npm install -g firebase-tools`
2. Log in: `firebase login`
3. Select or create your Firebase project: `firebase use <your-project-id>`
4. Install function dependencies: `cd functions && npm install`
5. Deploy the app: `npm run deploy`

The frontend calls the Firebase HTTPS function at `/api/advice`. The function stores each request in Firestore under `advice_requests` and returns the scaling decision to the UI.

## 🔧 Configuration & API Usage

### Changing the Gemini Model
By default, the Firebase Function is configured to use the `gemini-2.5-flash` model for fast, cost-effective inference.
To change the model:
1. Open `/functions/index.js`.
2. Update the `MODEL` constant.
3. Redeploy with `npm run deploy`.

### Handling API Quota Limits (Error 429)
The Gemini API provides limited quota for free tiers, which may occasionally result in a `RESOURCE_EXHAUSTED` (Error 429) message. 
To ensure uninterrupted presentation and testing, the application includes a **graceful fallback mechanism**. 
If the API quota is exhausted, the system automatically swallows the error and generates a deterministic mock response based on fundamental heuristics (e.g., CPU > 80% = Scale Up). 

You can view, customize, or disable this safety net inside the `catch (error)` block of `/functions/index.js`.

## 🔮 Future Implementations (Next Steps)
* **Kubernetes Webhooks:** Connect the AI output directly to the Kubernetes HPA (Horizontal Pod Autoscaler) to make the scaling fully autonomous.
* **Firebase Auth & Database:** Store historical scaling logs in Firestore and secure the dashboard with Google Auth.
* **Live Cloud Monitoring:** Ingest live telemetry from GCP/Prometheus instead of manual sandbox inputs.
* **Model Fine-Tuning:** Implement RL (Reinforcement Learning) logic to tune Gemini outputs against localized cost constraints.
