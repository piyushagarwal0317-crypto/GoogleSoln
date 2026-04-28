import { Activity, AlertTriangle, ArrowRight, CheckCircle2, ChevronRight, Cpu, Save, Server, ServerCrash, Settings, Terminal, Zap } from "lucide-react";
import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface MetricsPayload {
  cpu_utilization: number;
  latency_ms: number;
  request_rate: number;
  active_pods: number;
}

const DEFAULT_METRICS: MetricsPayload = {
  cpu_utilization: 0.5,
  latency_ms: 120.0,
  request_rate: 300.0,
  active_pods: 3,
};

interface AdviceResponse {
  scale_delta: number;
  rationale: string;
  cost_impact_usd: number;
  bottleneck_warning: string;
}

const GEMINI_MODEL = "gemini-2.5-flash";

interface AdviceApiResponse {
  advice?: AdviceResponse;
  fallback?: boolean;
  error?: string;
  model?: string;
}

const createFallbackAdvice = (metrics: MetricsPayload): AdviceResponse => ({
  scale_delta: metrics.cpu_utilization > 0.8 ? 2 : metrics.cpu_utilization < 0.2 ? -1 : 0,
  rationale: `[FALLBACK] Based on the CPU utilization of ${(metrics.cpu_utilization * 100).toFixed(0)}% and latency of ${metrics.latency_ms}ms, the system indicates a ${metrics.cpu_utilization > 0.8 ? 'scale-up' : metrics.cpu_utilization < 0.2 ? 'scale-down' : 'hold'} operation is optimal to meet SLA targets while optimizing cost.`,
  cost_impact_usd: metrics.cpu_utilization > 0.8 ? 2.50 : metrics.cpu_utilization < 0.2 ? -1.25 : 0.00,
  bottleneck_warning: metrics.latency_ms > 500 ? "High Latency Detected: Requests may be dropping." : metrics.cpu_utilization > 0.9 ? "CPU Saturation Imminent." : "None",
});

export default function App() {
  const [metrics, setMetrics] = useState<MetricsPayload>(DEFAULT_METRICS);
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<AdviceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let finalValue: string | number = value;
    
    if (type === 'number') {
      finalValue = value === "" ? "" : Number(value);
    }
    
    setMetrics(prev => ({ ...prev, [name]: finalValue }));
  };

  const getAdvice = async () => {
    setLoading(true);
    setError(null);
    setAdvice(null);
    try {
      const response = await fetch("/api/advice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metrics),
      });

      const data = (await response.json()) as AdviceApiResponse;

      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      if (!data.advice) {
        throw new Error("Received an empty advice payload.");
      }

      setAdvice({
        scale_delta: Math.max(-2, Math.min(2, Number(data.advice.scale_delta) || 0)),
        rationale: data.advice.rationale || "No rationale provided by model.",
        cost_impact_usd: Number(data.advice.cost_impact_usd) || 0,
        bottleneck_warning: data.advice.bottleneck_warning || "None"
      });
      
    } catch (err: any) {
      console.error(err);
      const errorMessage = err?.message || "";
      if ((errorMessage.includes("429")) || err?.status === "RESOURCE_EXHAUSTED" || errorMessage.toLowerCase().includes("quota")) {
        setAdvice(createFallbackAdvice(metrics));
        setError(null);
      } else if (errorMessage.toLowerCase().includes("network") || errorMessage.toLowerCase().includes("fetch")) {
        setAdvice(createFallbackAdvice(metrics));
        setError(null);
      } else {
        setError(errorMessage || "Failed to generate scaling advice.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Pre-fill sets for quick demo
  const loadScenario = (type: 'spike' | 'idle' | 'stable') => {
    switch (type) {
      case 'spike':
        setMetrics({
          cpu_utilization: 0.95,
          latency_ms: 850.0,
          request_rate: 1200.0,
          active_pods: 3,
        });
        break;
      case 'idle':
        setMetrics({
          cpu_utilization: 0.12,
          latency_ms: 45.0,
          request_rate: 15.0,
          active_pods: 5,
        });
        break;
      case 'stable':
        setMetrics(DEFAULT_METRICS);
        break;
    }
    setAdvice(null);
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 space-y-8 bg-slate-50 w-full max-w-7xl mx-auto font-sans text-slate-900 box-border">
      <header className="flex justify-between items-center mb-4 px-6 py-6 md:px-8 bg-white rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
            <div className="w-4 h-4 border-2 border-white rounded-sm"></div>
          </div>
          <span className="font-bold text-xl tracking-tight uppercase text-slate-900">CloudScale <span className="text-indigo-600">RL2</span></span>
        </div>
        <div className="hidden sm:flex gap-3">
          <button onClick={() => loadScenario('stable')} className="px-5 py-2.5 border border-slate-200 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors uppercase tracking-wide">Stable Load</button>
          <button onClick={() => loadScenario('spike')} className="px-5 py-2.5 border border-slate-200 rounded-full text-xs font-bold text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-colors uppercase tracking-wide shadow-sm">Traffic Spike</button>
          <button onClick={() => loadScenario('idle')} className="px-5 py-2.5 border border-slate-200 rounded-full text-xs font-bold text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 transition-colors uppercase tracking-wide">Idle Load</button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 w-full items-start">
        {/* Left Col: Config / State */}
        <div className="lg:col-span-7 bg-white p-8 md:p-10 rounded-[40px] shadow-2xl shadow-slate-200/50 border border-slate-100 flex flex-col relative h-full">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
              <Settings className="w-4 h-4 text-indigo-400" /> System Telemetry Input
            </span>
            <span className="text-[10px] font-mono text-indigo-600 font-bold tracking-widest bg-indigo-50 px-3 py-1.5 rounded-full uppercase">Cluster: us-central1-c</span>
          </div>

          <div className="flex flex-col flex-1 mb-10">
            <p className="text-sm text-slate-500 mb-6 font-medium">Input your core infrastructure telemetry to simulate an environment. The AI agent will process these metrics and output an optimal scaling decision.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <MetricInput label="CPU Util (0-1)" name="cpu_utilization" type="number" step="0.01" value={metrics.cpu_utilization} onChange={handleInputChange} icon={<Cpu className="w-4 h-4 text-slate-400" />} />
              <MetricInput label="Latency (ms)" name="latency_ms" type="number" value={metrics.latency_ms} onChange={handleInputChange} icon={<Zap className="w-4 h-4 text-slate-400" />} />
              <MetricInput label="Req Rate (/s)" name="request_rate" type="number" value={metrics.request_rate} onChange={handleInputChange} icon={<Activity className="w-4 h-4 text-slate-400" />} />
              <MetricInput label="Active Pods" name="active_pods" type="number" value={metrics.active_pods} onChange={handleInputChange} icon={<Server className="w-4 h-4 text-slate-400" />} />
            </div>
          </div>

          <div className="mt-auto">
             <button
              onClick={getAdvice}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold uppercase tracking-wide rounded-2xl transition-all shadow-xl shadow-slate-300"
             >
               {loading ? (
                 <span className="flex items-center gap-2">
                   <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                   ANALYZING TELEMETRY...
                 </span>
               ) : (
                 <span className="flex items-center gap-2">
                    <Terminal className="w-4 h-4" />
                    GET SCALING ADVICE <ArrowRight className="w-4 h-4 ml-1" />
                 </span>
               )}
             </button>
          </div>
        </div>

        {/* Right Col: AI Output */}
        <div className="lg:col-span-5 bg-white p-8 md:p-10 rounded-[40px] shadow-2xl shadow-slate-200/50 border border-slate-100 flex flex-col relative h-full min-h-[500px]">
           <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-400" /> AI Operations Copilot
            </span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center relative w-full">
             <AnimatePresence mode="wait">
               {loading ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center text-center w-full">
                     <div className="w-20 h-20 border border-indigo-100 rounded-full flex items-center justify-center relative before:absolute before:inset-0 before:border-2 before:border-t-indigo-600 before:rounded-full before:animate-spin shadow-lg bg-white z-10">
                        <Cpu className="w-8 h-8 text-indigo-600" />
                     </div>
                     <p className="mt-8 text-[10px] text-indigo-600 font-mono font-bold tracking-[0.2em] uppercase animate-pulse">RUNNING INFERENCE...</p>
                    <p className="text-xs text-slate-400 font-medium mt-2">Model: {GEMINI_MODEL} via Firebase</p>
                  </motion.div>
               ) : error ? (
                 <motion.div key="error" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center w-full p-6 bg-red-50 rounded-3xl border border-red-100">
                    <div className="w-12 h-12 bg-white text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-red-100">
                      <ServerCrash className="w-6 h-6" />
                    </div>
                    <h3 className="text-red-700 font-bold text-sm uppercase tracking-widest mb-3">Operation Failed</h3>
                    <div className="p-4 bg-white border border-red-100 rounded-xl text-xs font-mono text-red-500 text-left overflow-x-auto shadow-sm">
                      {error}
                    </div>
                 </motion.div>
               ) : advice ? (
                 <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full flex justify-start flex-col h-full">
                    <div className="mb-6 flex flex-col items-start w-full relative z-10">
                       <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Recommended Action</span>
                       <h2 className="text-2xl font-bold text-slate-800 mb-8">Agent Learning Rate</h2>
                       
                       <div className="w-full flex justify-start items-center gap-6 mb-8 pt-4 pb-8 border-b border-slate-100">
                          <span className="text-[80px] leading-none font-light tracking-tighter text-indigo-600">
                            {advice.scale_delta > 0 ? `+${advice.scale_delta}` : advice.scale_delta}
                          </span>
                          <div className="flex flex-col items-start gap-2">
                             <span className="text-lg font-bold text-slate-900 tracking-tight uppercase">PODS</span>
                             {advice.scale_delta > 0 ? (
                               <span className="text-[10px] px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-bold uppercase tracking-widest border border-indigo-100 shadow-sm">SCALE UP</span>
                             ) : advice.scale_delta < 0 ? (
                               <span className="text-[10px] px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold uppercase tracking-widest border border-emerald-100 shadow-sm">SCALE DOWN</span>
                             ) : (
                               <span className="text-[10px] px-3 py-1 rounded-full bg-slate-100 text-slate-600 font-bold uppercase tracking-widest border border-slate-200">MAINTAIN STATE</span>
                             )}
                          </div>
                       </div>
                    </div>
                    
                    <div className="mt-auto relative z-0 flex flex-col gap-4">
                      
                      {advice.bottleneck_warning && advice.bottleneck_warning !== "None" && (
                        <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-start gap-3 w-full">
                          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-[10px] text-red-500 font-bold uppercase tracking-widest block mb-1">Issue Detected</span>
                            <p className="text-xs text-red-700 font-medium">{advice.bottleneck_warning}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-4">
                        <div className="flex-1">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-2">Autoscaler Rationale</span>
                          <p className="text-[14px] leading-relaxed text-slate-600 bg-slate-50 p-6 rounded-3xl border border-slate-100 font-medium whitespace-pre-wrap min-h-[100px]">
                            {advice.rationale}
                          </p>
                        </div>
                        <div className="w-1/3 flex flex-col justify-start">
                           <div className="bg-indigo-50 p-5 rounded-3xl border border-indigo-100 h-full flex flex-col justify-center items-center text-center">
                             <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest block mb-2">Est. Hourly Impact</span>
                             <span className={`text-2xl font-bold ${advice.cost_impact_usd > 0 ? 'text-red-500' : advice.cost_impact_usd < 0 ? 'text-emerald-500' : 'text-slate-500'}`}>
                               {advice.cost_impact_usd > 0 ? '+ ' : advice.cost_impact_usd < 0 ? '- ' : ''}${Math.abs(advice.cost_impact_usd).toFixed(2)}
                             </span>
                           </div>
                        </div>
                      </div>

                    </div>
                 </motion.div>
               ) : (
                 <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col justify-center items-center h-full text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-100 shadow-inner">
                      <Activity className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="font-bold text-[10px] tracking-[0.2em] text-slate-400 uppercase">AWAITING TELEMETRY</p>
                 </motion.div>
               )}
             </AnimatePresence>
          </div>
        </div>
      </div>
      
      {/* Bottom section matching the Future Implementations requirement */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm mt-4">
        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-600" />
          Google Solutions 2026: Future Implementations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col items-start transition-colors hover:bg-slate-100 cursor-default">
            <span className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mb-4"><Server className="w-4 h-4" /></span>
            <span className="text-sm font-bold text-slate-800 mb-2">Kubernetes Webhooks</span>
            <span className="text-xs text-slate-500 font-medium leading-relaxed">Connect output directly to K8s HPA to make scaling fully autonomous in production.</span>
          </div>
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col items-start transition-colors hover:bg-slate-100 cursor-default">
            <span className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center mb-4"><Cpu className="w-4 h-4" /></span>
            <span className="text-sm font-bold text-slate-800 mb-2">Firebase Auth & DB</span>
            <span className="text-xs text-slate-500 font-medium leading-relaxed">Secure role-based access for SRE teams and store historical metric logs on Firestore.</span>
          </div>
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col items-start transition-colors hover:bg-slate-100 cursor-default">
            <span className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center mb-4"><Activity className="w-4 h-4" /></span>
            <span className="text-sm font-bold text-slate-800 mb-2">Live Cloud Monitoring</span>
            <span className="text-xs text-slate-500 font-medium leading-relaxed">Ingest live telemetry from Datadog or Prometheus instead of manual sandbox inputs.</span>
          </div>
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col items-start transition-colors hover:bg-slate-100 cursor-default">
            <span className="w-8 h-8 bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center mb-4"><CheckCircle2 className="w-4 h-4" /></span>
            <span className="text-sm font-bold text-slate-800 mb-2">Model Fine-Tuning</span>
            <span className="text-xs text-slate-500 font-medium leading-relaxed">Implement actual RL logic to tune Gemini outputs against localized cost metrics.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Component for UI
function MetricInput({ label, name, type, value, onChange, icon, step, className = "" }: any) {
  return (
    <div className="flex flex-col gap-2 focus-within:text-indigo-600 group">
       <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-focus-within:text-indigo-600 transition-colors flex items-center gap-1.5">
         {icon} {label}
       </label>
       <input 
         type={type} 
         name={name} 
         value={value} 
         onChange={onChange} 
         step={step}
         className={`bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:bg-white transition-all shadow-sm ${className}`}
       />
    </div>
  );
}


