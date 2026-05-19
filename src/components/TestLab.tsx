import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, Shield, Repeat, Target, Flame, AlertTriangle, Cpu, Activity, 
  Play, Info, Settings2, BarChart4, Terminal, X, RefreshCw, Layout, 
  Beaker, ChevronDown, Copy, Code2, Globe, Server, Hash, Clock
} from 'lucide-react';
import { cn } from '../lib/utils';
import { RequestConfig, CurlResult } from '../server/modules/curl-engine';
import { ProgressUpdate } from '../server/modules/runner';

export type TestModuleId = 'blast' | 'race' | 'replay' | 'load' | 'chaos' | 'rate' | 'fuzzer' | 'scenario';

interface TestModule {
  id: TestModuleId;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  strategy: string;
  settingsTitle: string;
  primaryMetric: string;
  theory: string;
}

const TEST_MODULES: TestModule[] = [
  {
    id: 'blast',
    name: 'CONCURRENT_BLAST',
    description: 'High-density concurrent execution to verify endpoint saturation limits.',
    icon: <Zap size={18} />,
    color: 'text-amber-500',
    strategy: 'PARALLEL_STORM',
    settingsTitle: 'STRESS_LEVEL',
    primaryMetric: 'THROUGHPUT',
    theory: 'Saturation testing identifies the peak capacity of a service. By saturating the CPU and I/O wait queues, we can observe the Point of Failure (PoF) where latency degrades exponentially.'
  },
  {
    id: 'race',
    name: 'RACE_DETECTOR',
    description: 'Injects micro-delays to trigger race conditions in shared-state backend logic.',
    icon: <Shield size={18} />,
    color: 'text-emerald-500',
    strategy: 'ATOMIC_INTEGRITY',
    settingsTitle: 'COLLISION_WINDOW',
    primaryMetric: 'STATE_DRIFT',
    theory: 'Race conditions occur when the outcome of a process depends on the timing of other events. Tight clustering of requests forces the backend to handle overlapping Read-Modify-Write cycles simultaneously.'
  },
  {
    id: 'replay',
    name: 'REPLAY_GUARD',
    description: 'Tests idempotency by replaying identical transaction IDs to verify deduplication.',
    icon: <Repeat size={18} />,
    color: 'text-blue-500',
    strategy: 'IDEMPOTENCY_PROBE',
    settingsTitle: 'CLONE_INTENSITY',
    primaryMetric: 'DEDUPE_RATIO',
    theory: 'Idempotency ensures that multiple identical requests have the same effect as a single request. This is critical for network reliability and payment processors.'
  },
  {
    id: 'load',
    name: 'LOAD_CANNON',
    description: 'Sustained throughput testing with adaptive worker queue management.',
    icon: <Target size={18} />,
    color: 'text-orange-500',
    strategy: 'SUSTAINED_PRESSURE',
    settingsTitle: 'QUEUE_DEPTH',
    primaryMetric: 'LATENCY_P99',
    theory: 'Load testing measures performance under a specific, expected load. Unlike stress testing, this focuses on maintaining SLAs (P99 < 200ms) over extended periods.'
  },
  {
    id: 'chaos',
    name: 'CHAOS_MODE',
    description: 'Simulates network instability, packet loss, and jitter patterns.',
    icon: <Flame size={18} />,
    color: 'text-rose-500',
    strategy: 'ENTROPY_ENGINE',
    settingsTitle: 'ENTROPY_LEVEL',
    primaryMetric: 'ERROR_RATE',
    theory: 'Resilience engineering acknowledges that failures are inevitable. Chaos mode proactively injects entropy to verify that your system fails gracefully rather than catastrophically.'
  },
  {
    id: 'rate',
    name: 'RATE_BREAKER',
    description: 'Iterative frequency scaling to identify exact IP-based rate-limiting thresholds.',
    icon: <AlertTriangle size={18} />,
    color: 'text-violet-500',
    strategy: 'THRESHOLD_PROBE',
    settingsTitle: 'BURST_LIMIT',
    primaryMetric: 'LIMIT_HIT_TIME',
    theory: 'Rate limiting protects infrastructure from abuse. The Rate Breaker identifies the exact point where a WAF or API Gateway starts returning 429 Too Many Requests.'
  },
  {
    id: 'fuzzer',
    name: 'PAYLOAD_FUZZER',
    description: 'Mutates JSON keys/values to probe schema vulnerabilities and type handling.',
    icon: <Cpu size={18} />,
    color: 'text-cyan-500',
    strategy: 'MUTATION_STRESS',
    settingsTitle: 'MUTATION_DEPTH',
    primaryMetric: 'VULN_DISCOVERY',
    theory: 'Fuzzing is the art of sending malformed data to an application. It reveals unhandled exceptions, buffer overflows, and implicit type conversion bugs in your parsers.'
  },
  {
    id: 'scenario',
    name: 'SCENARIO_RUNNER',
    description: 'Chained request sequences with dynamic variable propagation.',
    icon: <Activity size={18} />,
    color: 'text-indigo-500',
    strategy: 'PIPELINE_ORCHESTRATOR',
    settingsTitle: 'STEP_CHAIN',
    primaryMetric: 'CHAIN_SUCCESS',
    theory: 'Real users don\'t hit single endpoints in isolation. Scenarios test the stateful transitions between multiple API calls, ensuring consistency across a "user journey".'
  }
];

interface TestLabProps {
  config: RequestConfig;
  headersList: { id: string, key: string, value: string }[];
  ws: WebSocket | null;
  activeTabId: string;
  loading: boolean;
  progress: ProgressUpdate | null;
  results: CurlResult[];
  onStart: (moduleId: TestModuleId, settings: any) => void;
  onAbort: () => void;
}

export function TestLab({ config, headersList, ws, activeTabId, loading, progress, results, onStart, onAbort }: TestLabProps) {
  const [selectedModule, setSelectedModule] = useState<TestModuleId | null>(null);
  const [selectedResult, setSelectedResult] = useState<CurlResult | null>(null);
  const [iterationsPerUser, setIterationsPerUser] = useState(10);
  const [concurrency, setConcurrency] = useState(10);
  const [retries, setRetries] = useState(0);
  const [labTab, setLabTab] = useState<'logs' | 'curl' | 'theory'>('logs');
  const [showLabCurl, setShowLabCurl] = useState(false);
  const [assertions, setAssertions] = useState<{ type: string, value: string }[]>([
    { type: 'STATUS_CODE', value: '200' }
  ]);

  const activeModule = TEST_MODULES.find(m => m.id === selectedModule);
  const totalIterations = iterationsPerUser * concurrency;

  // Generate strategy scripts
  const curlStrategy = useMemo(() => {
    if (!selectedModule) return '';
    const headersConfig = config.headers || {};
    const headers = Object.entries(headersConfig).map(([k, v]) => `-H "${k}: ${v}"`).join(' ');
    const body = config.body ? `-d '${config.body}'` : '';
    const baseCurl = `curl -X ${config.method} "${config.url}" ${headers} ${body}`;

    switch (selectedModule) {
      case 'blast':
        return `seq ${totalIterations} | xargs -P ${concurrency} -I {} ${baseCurl}`;
      case 'race':
        return `# Parallel Collision Script\nfor i in {1..${concurrency}}; do\n  ${baseCurl} &\ndone\nwait`;
      case 'fuzzer':
        return `# Mutation Fuzzer (Example logic)\nfor i in {1..20}; do\n  # Injected bit-flip or type-swap logic here\n  ${baseCurl}\ndone`;
      default:
        return baseCurl;
    }
  }, [selectedModule, config, totalIterations, concurrency]);

  const startTest = () => {
    if (!selectedModule) return;
    onStart(selectedModule, {
      iterations: totalIterations,
      concurrency,
      retries,
      assertions
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (selectedResult) {
    return (
      <div className="flex flex-col h-full bg-black relative">
        <div className="p-3 px-4 border-b border-slate-800 bg-[#0F1115] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
             <button 
               onClick={() => setSelectedResult(null)}
               className="text-[9px] font-mono text-emerald-500 hover:text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1.5"
             >
               <Activity size={12} /> BACK_TO_LOGS
             </button>
             <span className="w-px h-3 bg-slate-800 mx-1"></span>
             <span className="text-[10px] font-mono text-slate-500 uppercase">TELEMETRY_DETAIL_VIEW</span>
          </div>
          <button 
            onClick={() => setSelectedResult(null)}
            className="text-slate-500 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="p-6 font-mono text-[11px] text-emerald-400 overflow-auto h-full custom-scrollbar">
            <div className="mb-6 flex gap-10">
               <div>
                  <div className="text-slate-600 text-[8px] uppercase tracking-widest mb-1 font-black">Status</div>
                  <div className={cn("text-lg font-black", selectedResult.status < 300 ? "text-emerald-500" : "text-rose-500")}>
                    {selectedResult.status}
                  </div>
               </div>
               <div>
                  <div className="text-slate-600 text-[8px] uppercase tracking-widest mb-1 font-black">Latency</div>
                  <div className="text-lg font-black text-blue-400">{selectedResult.responseTime}ms</div>
               </div>
            </div>
            
            <div className="space-y-6">
              <div>
                <div className="text-slate-600 text-[8px] uppercase tracking-widest mb-2 font-black">Response_Headers</div>
                <div className="bg-slate-900/50 p-4 rounded border border-slate-800 space-y-1">
                  {Object.entries(selectedResult.headers).map(([k, v]) => (
                    <div key={k} className="flex gap-4">
                      <span className="text-blue-500 font-bold min-w-[140px] uppercase text-[9px]">{k}:</span>
                      <span className="text-slate-400 break-all">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-slate-600 text-[8px] uppercase tracking-widest mb-2 font-black">Response_Payload</div>
                <pre className="bg-black p-4 rounded border border-slate-800 text-[10px] whitespace-pre-wrap overflow-x-hidden text-emerald-500/80">
                  {selectedResult.body}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0B0D11] overflow-hidden text-slate-300">
      {/* HUD Header */}
      <div className="p-4 border-b border-[#1E293B] bg-[#0F1115] shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-500/10 rounded border border-blue-500/20">
              <Beaker size={16} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-[11px] font-black tracking-[0.3em] text-white uppercase leading-none">ANALYTICAL_LAB</h2>
              <p className="text-[8px] text-slate-500 font-mono mt-1 uppercase tracking-widest">v2.0_ENGINEER_Instrumentation</p>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-800"></div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-[7px] font-black text-slate-600 uppercase tracking-tighter">ENDPOINT_UNDER_TEST</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn(
                  "px-1.5 py-0.5 rounded-[2px] text-[8px] font-black",
                  config.method === 'GET' ? "bg-emerald-500/10 text-emerald-500" :
                  config.method === 'POST' ? "bg-blue-500/10 text-blue-500" : "bg-amber-500/10 text-amber-500"
                )}>
                  {config.method}
                </span>
                <span className="text-[10px] font-mono text-slate-400 truncate max-w-[300px]">{config.url || 'NULL_PTR'}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {selectedModule && (
            <button 
              onClick={() => setSelectedModule(null)}
              className="text-[9px] font-mono text-slate-500 hover:text-white flex items-center gap-2 uppercase tracking-widest px-3 py-1.5 rounded transition-all hover:bg-slate-800 border border-slate-800"
            >
              <Layout size={12} /> RESET_MODULE
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {!selectedModule ? (
            <motion.div 
              key="selection"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="absolute inset-0 overflow-y-auto custom-scrollbar p-8 bg-[#0B0D11]"
            >
              <div className="max-w-6xl mx-auto">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
                  <Terminal size={14} className="text-emerald-500" /> SYSTEM_MODULE_SELECT
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {TEST_MODULES.map(module => (
                    <button
                      key={module.id}
                      onClick={() => setSelectedModule(module.id)}
                      className="text-left p-6 rounded-lg border border-slate-800/60 bg-slate-900/10 hover:bg-slate-900/40 hover:border-emerald-500/30 transition-all group h-[200px] flex flex-col justify-between relative overflow-hidden"
                    >
                      <div className="relative z-10">
                        <div className={cn("w-10 h-10 rounded-lg bg-black/40 flex items-center justify-center mb-4 transition-transform group-hover:scale-110 border border-white/5", module.color)}>
                          {module.icon}
                        </div>
                        <div className="text-[12px] font-black tracking-tight mb-2 group-hover:text-white transition-colors uppercase">
                          {module.name}
                        </div>
                        <p className="text-[9px] font-mono text-slate-500 leading-relaxed uppercase group-hover:text-slate-400 transition-colors line-clamp-3">
                          {module.description}
                        </p>
                      </div>
                      <div className="text-[8px] font-bold text-slate-700 font-mono tracking-widest uppercase relative z-10 group-hover:text-emerald-500/50 transition-colors">
                        STRATEGY::{module.strategy}
                      </div>

                      {/* Subtle hover background accent */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="module"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute inset-0 flex flex-col bg-black overflow-hidden"
            >
              <div className="w-full flex-1 flex flex-col lg:flex-row overflow-hidden">
                 {/* Left Panel: Optimized Config */}
                 <div className="w-full lg:w-[400px] border-r border-[#1E293B] bg-[#0F1115] overflow-y-auto custom-scrollbar flex flex-col">
                    <div className="p-6 space-y-8 flex-1">
                       <div>
                          <div className={cn("text-[9px] font-black uppercase tracking-widest mb-1", activeModule?.color)}>
                            ACTIVE_MODULE_INFO
                          </div>
                          <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
                             {activeModule?.name}
                          </h3>
                       </div>

                       <div className="space-y-6">
                          {/* Specialized Settings per Module */}
                          <div className="space-y-4">
                            <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest border-b border-slate-800 pb-2">
                              {activeModule?.settingsTitle}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                  <label className="text-[8px] font-mono text-slate-500 uppercase flex items-center gap-2">
                                     <Zap size={10} className="text-amber-500" /> VU_CONCURRENCY
                                  </label>
                                  <input 
                                    type="number" 
                                    value={concurrency}
                                    onChange={(e) => setConcurrency(Math.max(1, parseInt(e.target.value)))}
                                    className="w-full bg-black border border-slate-700 rounded px-3 py-2.5 text-xs font-mono text-white focus:border-emerald-500 outline-none transition-all hover:border-slate-600"
                                  />
                               </div>
                               <div className="space-y-2">
                                  <label className="text-[8px] font-mono text-slate-500 uppercase flex items-center gap-2">
                                     <Repeat size={10} className="text-blue-500" /> ITER_PER_VU
                                  </label>
                                  <input 
                                    type="number" 
                                    value={iterationsPerUser}
                                    onChange={(e) => setIterationsPerUser(Math.max(1, parseInt(e.target.value)))}
                                    className="w-full bg-black border border-slate-700 rounded px-3 py-2.5 text-xs font-mono text-white focus:border-emerald-500 outline-none transition-all hover:border-slate-600"
                                  />
                               </div>
                            </div>

                            <div className="space-y-2">
                               <label className="text-[8px] font-mono text-slate-500 uppercase flex items-center gap-2">
                                  <Settings2 size={10} className="text-violet-500" /> ERROR_TOLERANCE
                               </label>
                               <select 
                                 value={retries}
                                 onChange={(e) => setRetries(parseInt(e.target.value))}
                                 className="w-full bg-black border border-slate-700 rounded px-3 py-2.5 text-xs font-mono text-white focus:border-emerald-500 outline-none cursor-pointer appearance-none hover:border-slate-600"
                               >
                                 <option value={0}>NO_RETRY (FAIL_FAST)</option>
                                 <option value={1}>1X (RAPID_REATTEMPT)</option>
                                 <option value={2}>2X (LINEAR_BACKOFF)</option>
                               </select>
                            </div>
                          </div>

                          {/* Dynamic Module Logic */}
                          {selectedModule === 'fuzzer' && (
                            <div className="space-y-3 p-4 bg-cyan-500/5 rounded border border-cyan-500/10">
                               <div className="text-[8px] font-black text-cyan-400 uppercase tracking-widest">Fuzzer_Profile</div>
                               <div className="grid grid-cols-1 gap-2">
                                  <label className="flex items-center gap-3 text-[9px] font-mono text-slate-400 cursor-pointer">
                                     <input type="checkbox" defaultChecked className="accent-cyan-500" /> KEY_DELETIONS
                                  </label>
                                  <label className="flex items-center gap-3 text-[9px] font-mono text-slate-400 cursor-pointer">
                                     <input type="checkbox" defaultChecked className="accent-cyan-500" /> TYPE_MUTATIONS
                                  </label>
                                  <label className="flex items-center gap-3 text-[9px] font-mono text-slate-400 cursor-pointer">
                                     <input type="checkbox" className="accent-cyan-500" /> BUFFER_OVERFLOW
                                  </label>
                               </div>
                            </div>
                          )}

                          {selectedModule === 'chaos' && (
                             <div className="space-y-3 p-4 bg-rose-500/5 rounded border border-rose-500/10">
                                <div className="text-[8px] font-black text-rose-400 uppercase tracking-widest">Chaos_Engine_Config</div>
                                <div className="space-y-4">
                                   <div>
                                      <div className="flex justify-between text-[8px] font-mono text-slate-500 uppercase mb-1">
                                         <span>Jitter_Amplitude</span>
                                         <span>800ms</span>
                                      </div>
                                      <div className="h-1 bg-slate-800 rounded overflow-hidden">
                                         <div className="h-full bg-rose-500 w-[60%]"></div>
                                      </div>
                                   </div>
                                </div>
                             </div>
                          )}
                       </div>

                       {/* Repositioned Curl Preview */}
                       <div className="space-y-4 pt-6 border-t border-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">TRANSMISSION_SCRIPT</span>
                            <button 
                              onClick={() => setShowLabCurl(!showLabCurl)}
                              className={cn(
                                "text-[8px] font-mono flex items-center gap-1 uppercase transition-colors px-1.5 py-0.5 rounded border transition-all",
                                showLabCurl ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : "bg-white/5 border-white/10 text-slate-500 hover:text-slate-300"
                              )}
                            >
                              <Terminal size={10} /> {showLabCurl ? 'CONTRACT_VIEW' : 'EXPAND_PREVIEW'}
                            </button>
                          </div>
                          
                          <AnimatePresence>
                            {showLabCurl && (
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="p-4 bg-black border border-slate-800 rounded font-mono text-xs text-emerald-500 leading-relaxed whitespace-pre-wrap break-all shadow-inner">
                                   {curlStrategy}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                       </div>
                    </div>

                    <div className="p-6 bg-black/40 border-t border-[#1E293B] space-y-4">
                       <div className="flex items-center justify-between text-[10px] font-black text-slate-500 px-1">
                          <span className="uppercase tracking-widest">EXECUTION_LOAD</span>
                          <span className="font-mono text-white">{totalIterations} REQS</span>
                       </div>

                       <button
                         onClick={loading ? onAbort : startTest}
                         disabled={!config.url}
                         className={cn(
                           "w-full py-4 rounded font-black text-[11px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 active:scale-95 shadow-lg",
                           loading 
                             ? "bg-rose-600 text-white shadow-rose-900/30 animate-pulse" 
                             : "bg-emerald-600 text-white shadow-emerald-900/30 hover:bg-emerald-500 disabled:opacity-20 ring-1 ring-emerald-500/50"
                         )}
                       >
                         {loading ? (
                           <>
                             <RefreshCw size={14} className="animate-spin" /> ABORT_INSTRUMENTATION
                           </>
                         ) : (
                           <>
                             <Play size={14} fill="currentColor" /> INITIALIZE_TEST_FLOW
                           </>
                         )}
                       </button>
                    </div>
                 </div>

                 {/* Right Panel: Execution & Telemetry */}
                 <div className="flex-1 flex flex-col bg-[#07080A] overflow-hidden lg:min-w-0">
                    {/* Telemetry HUD */}
                    <div className="p-6 border-b border-[#1E293B] bg-black/60 grid grid-cols-2 md:grid-cols-4 gap-8">
                       <div className="space-y-1">
                          <div className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                             <Activity size={10} className="text-emerald-500" /> {activeModule?.primaryMetric}
                          </div>
                          <div className="text-xl font-black text-white font-mono leading-none">
                             {progress ? ((progress.completed / ((Date.now() - (progress as any).startTime || 1) / 1000)).toFixed(1)) : '0.0'}
                             <span className="text-[10px] text-slate-600 ml-1">/s</span>
                          </div>
                       </div>
                       <div className="space-y-1">
                          <div className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                             <Clock size={10} className="text-blue-500" /> P99_LATENCY
                          </div>
                          <div className="text-xl font-black text-white font-mono leading-none">
                             {results.length > 0 ? results[Math.floor(results.length * 0.95)]?.responseTime || '0' : '0'}
                             <span className="text-[10px] text-slate-600 ml-1">ms</span>
                          </div>
                       </div>
                       <div className="space-y-1">
                          <div className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                             <Server size={10} className="text-amber-500" /> SUCCESS_RATE
                          </div>
                          <div className="text-xl font-black text-white font-mono leading-none">
                             {results.length > 0 ? Math.round((results.filter(r => r.status < 400).length / results.length) * 100) : '0'}
                             <span className="text-[10px] text-slate-600 ml-1">%</span>
                          </div>
                       </div>
                       <div className="space-y-1">
                          <div className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                             <Shield size={10} className="text-rose-500" /> ERROR_COUNT
                          </div>
                          <div className="text-xl font-black text-rose-500 font-mono leading-none">
                             {results.filter(r => r.status >= 400).length}
                          </div>
                       </div>
                    </div>

                    {/* Dashboard Tabs */}
                    <div className="flex border-b border-[#1E293B] bg-[#0B0D11] px-4">
                       {[
                         { id: 'logs', label: 'TELEMETRY_LOGS' },
                         { id: 'curl', label: 'CURL_ORCHESTRATION' },
                         { id: 'theory', label: 'THEORETICAL_FRAMEWORK' }
                       ].map(tab => (
                         <button 
                           key={tab.id}
                           onClick={() => setLabTab(tab.id as any)}
                           className={cn(
                             "px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2",
                             labTab === tab.id ? "border-emerald-500 text-white" : "border-transparent text-slate-500 hover:text-slate-300"
                           )}
                         >
                           {tab.label}
                         </button>
                       ))}
                    </div>

                    <div className="flex-1 overflow-hidden relative">
                       <AnimatePresence mode="wait">
                          {labTab === 'curl' && (
                            <motion.div 
                              key="curl"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="absolute inset-0 p-8 overflow-y-auto custom-scrollbar bg-black"
                            >
                               <div className="max-w-4xl space-y-8">
                                  <div className="space-y-4">
                                     <div className="flex items-center justify-between">
                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
                                          <Globe size={14} className="text-blue-500" /> Standard_Curl_Command
                                        </div>
                                        <button 
                                          onClick={() => copyToClipboard(`curl -X ${config.method} "${config.url}"`)}
                                          className="text-slate-500 hover:text-white transition-colors"
                                        >
                                          <Copy size={14} />
                                        </button>
                                     </div>
                                     <pre className="bg-[#0F1115] p-4 rounded border border-slate-800 text-[11px] font-mono text-blue-400 break-all whitespace-pre-wrap">
                                        {`curl -X ${config.method} "${config.url}" \\\n  ${Object.entries(config.headers).map(([k, v]) => `-H "${k}: ${v}"`).join(' \\\n  ')}${config.body ? ` \\\n  -d '${config.body}'` : ''}`}
                                     </pre>
                                  </div>

                                  <div className="space-y-4">
                                     <div className="flex items-center justify-between">
                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-3">
                                          <Code2 size={14} className="text-emerald-500" /> BASH_Strategy_Script
                                        </div>
                                        <button 
                                          onClick={() => copyToClipboard(curlStrategy)}
                                          className="text-slate-500 hover:text-white transition-colors"
                                        >
                                          <Copy size={14} />
                                        </button>
                                     </div>
                                     <pre className="bg-[#0F1115] p-6 rounded border border-slate-800 text-[11px] font-mono text-emerald-500/80 overflow-x-auto custom-scrollbar">
                                        {curlStrategy}
                                     </pre>
                                     <p className="text-[9px] text-slate-600 font-mono uppercase italic">
                                        Note: This script replicates the logic used by the internal runner for this module.
                                     </p>
                                  </div>
                               </div>
                            </motion.div>
                          )}
                          
                          {labTab === 'theory' && (
                             <motion.div 
                               key="theory"
                               initial={{ opacity: 0, y: 10 }}
                               animate={{ opacity: 1, y: 0 }}
                               exit={{ opacity: 0, y: -10 }}
                               className="absolute inset-0 p-10 overflow-y-auto custom-scrollbar bg-black"
                             >
                                <div className="max-w-2xl space-y-10">
                                   <section className="space-y-4">
                                      <h2 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-4">
                                         <Info size={24} className="text-emerald-500" /> PRO_PRINCIPLE
                                      </h2>
                                      <p className="text-slate-400 font-serif italic text-lg leading-relaxed border-l-2 border-emerald-500/30 pl-6">
                                         "{activeModule?.theory}"
                                      </p>
                                   </section>

                                   <section className="space-y-6">
                                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Architected_Use_Cases</h3>
                                      <div className="grid grid-cols-1 gap-4">
                                         {[
                                           { t: 'Performance Regression', d: 'Detecting if new deployments impact latency SLAs.' },
                                           { t: 'Buffer Overflow Probing', d: 'Identifying limits of upstream load balancers.' },
                                           { t: 'Cache Invalidation Verification', d: 'Ensuring real-time data consistency across distributed clusters.' }
                                         ].map(use => (
                                           <div key={use.t} className="p-4 border border-white/5 rounded hover:bg-white/5 transition-all">
                                              <div className="text-white font-bold text-[12px] mb-1">{use.t}</div>
                                              <div className="text-slate-500 text-[11px] font-mono uppercase">{use.d}</div>
                                           </div>
                                         ))}
                                      </div>
                                   </section>
                                </div>
                             </motion.div>
                          )}

                          {labTab === 'logs' && (
                            <motion.div 
                              key="logs"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="absolute inset-0 overflow-y-auto p-4 custom-scrollbar bg-black/40 space-y-1"
                            >
                               {results.length === 0 && !loading && (
                                 <div className="h-full flex flex-col items-center justify-center p-20 opacity-20 text-center space-y-6">
                                   <div className="w-16 h-16 border-2 border-dashed border-slate-700 rounded-full flex items-center justify-center animate-spin-slow">
                                      <Activity size={32} />
                                   </div>
                                   <div className="uppercase tracking-[0.4em] font-black text-sm text-white">Standby_Stream_Init</div>
                                 </div>
                               )}
                               
                               {[...results].reverse().map((res, i) => (
                                 <motion.div 
                                   key={res.id} 
                                   initial={{ opacity: 0, x: -5 }}
                                   animate={{ opacity: 1, x: 0 }}
                                   onClick={() => setSelectedResult(res)}
                                   className="group flex border-l-[3px] border-slate-800 hover:border-emerald-500 py-2 pl-4 hover:bg-emerald-500/5 transition-all cursor-pointer items-center min-h-[36px]"
                                 >
                                   <span className="text-slate-600 w-16 shrink-0 font-mono text-[9px] font-bold group-hover:text-slate-400">-{res.responseTime}ms</span>
                                   <span className={cn("w-14 font-black text-[10px]", res.status < 300 ? "text-emerald-500" : "text-rose-500")}>
                                     [{res.status}]
                                   </span>
                                   <span className="text-slate-500 flex-1 truncate uppercase tracking-tighter font-mono group-hover:text-white transition-colors text-[10px]">
                                     <span className="text-slate-700 opacity-60 mr-2 text-[8px] font-black">HASH::{(progress?.completed ?? 0) - i}</span>
                                     {selectedModule === 'fuzzer' && <span className="text-cyan-500/80 mr-2">[MUTATED]</span>}
                                     {selectedModule === 'replay' && <span className="text-blue-500/80 mr-2">[CLONED]</span>}
                                     {selectedModule === 'chaos' && <span className="text-rose-500/80 mr-2">[CORRUPT]</span>}
                                     {activeModule?.name} ➔ {res.status < 400 ? '200_OK' : 'ERR_FAIL'}
                                   </span>
                                   <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <span className="text-[8px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded tracking-widest">DETAILS</span>
                                   </div>
                                 </motion.div>
                               ))}
                            </motion.div>
                          )}
                       </AnimatePresence>
                    </div>

                    {/* Static Progress Bar */}
                    {progress && (
                      <div className="bg-[#0F1115] border-t border-[#1E293B] p-6 space-y-4">
                         <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em]">
                            <span className="text-emerald-500 flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                              TEST_IN_PROGRESS
                            </span>
                            <span className="text-white font-mono">
                               {progress.completed} <span className="text-slate-600">/</span> {progress.total}
                            </span>
                         </div>
                         <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden p-[1px] border border-slate-800">
                            <motion.div 
                              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                              initial={{ width: 0 }}
                              animate={{ width: `${(progress.completed / progress.total) * 100}%` }}
                              transition={{ type: 'spring', damping: 25, stiffness: 40 }}
                            />
                         </div>
                         <div className="flex gap-4 pt-2">
                           <div className="flex-1 bg-black/40 rounded p-2 border border-slate-800/50 flex flex-col items-center justify-center">
                              <span className="text-[7px] font-black text-slate-600 uppercase mb-1">RPS</span>
                              <span className="font-mono text-white font-bold">{((progress.completed / ((Date.now() - (progress as any).startTime || 1) / 1000)).toFixed(1))}</span>
                           </div>
                           <div className="flex-1 bg-black/40 rounded p-2 border border-slate-800/50 flex flex-col items-center justify-center">
                              <span className="text-[7px] font-black text-slate-600 uppercase mb-1">REMAINING</span>
                              <span className="font-mono text-blue-400 font-bold">~{Math.max(0, Math.round((progress.total - progress.completed) / ( (progress.completed || 1) / ((Date.now() - (progress as any).startTime || 1) / 1000) )))}s</span>
                           </div>
                           <div className="flex-1 bg-black/40 rounded p-2 border border-slate-800/50 flex flex-col items-center justify-center">
                              <span className="text-[7px] font-black text-slate-600 uppercase mb-1">P95_MS</span>
                              <span className="font-mono text-amber-500 font-bold">{results.length > 0 ? results[Math.floor(results.length * 0.95)]?.responseTime || '0' : '0'}</span>
                           </div>
                         </div>
                      </div>
                    )}
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}


