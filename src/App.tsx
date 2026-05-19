/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Terminal, Send, History, Layers, Sliders, Play, Github, Info, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ApiTester } from './components/ApiTester';
import { Sidebar } from './components/Sidebar';
import { VariablesManager } from './components/VariablesManager';

function HistoryList() {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/history')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP_${r.status}`);
        return r.json();
      })
      .then(setHistory)
      .catch(err => {
        console.error('History fetch failed:', err);
        setHistory([]);
      });
  }, []);

  return (
    <div className="flex-1 card-slate overflow-hidden flex flex-col bg-black">
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {history.length === 0 && (
          <div className="text-center p-12 text-slate-600 font-mono text-xs italic">
            NO_PREVIOUS_REPORTS_FOUND_IN_CACHE
          </div>
        )}
        {history.map((item, idx) => (
          <div key={idx} className="p-3 bg-slate-900/40 border border-slate-800/60 rounded group hover:border-emerald-500/30 transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                  item.batch ? 'border-amber-500/30 text-amber-500 bg-amber-500/5' : 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5'
                }`}>
                  {item.batch ? 'CONCURRENCY_SET' : item.request.method}
                </span>
                <span className="text-[11px] font-mono text-slate-300 truncate max-w-[400px]">
                  {item.request.url}
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-600">
                {new Date(item.timestamp).toLocaleTimeString([], { hour12: false })}
              </span>
            </div>
            
            {item.batch ? (
              <div className="grid grid-cols-4 gap-2 mt-2 p-2 bg-black/40 rounded border border-slate-800/40">
                <div className="text-center">
                   <div className="text-[9px] text-slate-500 uppercase font-mono">REQ_CNT</div>
                   <div className="text-[11px] font-bold font-mono text-white tracking-widest">{item.batch.iterations}</div>
                </div>
                <div className="text-center">
                   <div className="text-[9px] text-slate-500 uppercase font-mono">PARAL_WK</div>
                   <div className="text-[11px] font-bold font-mono text-amber-500">{item.batch.concurrency}</div>
                </div>
                <div className="text-center">
                   <div className="text-[9px] text-slate-500 uppercase font-mono">OK_RESP</div>
                   <div className="text-[11px] font-bold font-mono text-emerald-500">{item.batch.successCount}</div>
                </div>
                <div className="text-center">
                   <div className="text-[9px] text-slate-500 uppercase font-mono">AVG_LAT</div>
                   <div className="text-[11px] font-bold font-mono text-blue-400">{item.batch.avgResponseTime?.toFixed(0)}ms</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500 pl-1">
                <span className={item.result.status < 300 ? 'text-emerald-500' : 'text-rose-500'}>
                  STATUS__{item.result.status}
                </span>
                <span className="opacity-50">|</span>
                <span>TIME__{item.result.responseTime}MS</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab ] = useState<'tester' | 'history' | 'collections' | 'variables'>('tester');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [variables, setVariables] = useState<Record<string, string>>({
    'BASE_URL': 'https://jsonplaceholder.typicode.com',
    'TOKEN': 'sk_test_5123456789'
  });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0F1115] text-[#E2E8F0] font-sans">
      {/* Sidebar Navigation */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#0B0D11]">
        <nav className="flex items-center justify-between px-4 h-12 border-b border-[#1E293B] bg-[#0F1115]">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-emerald-500 rounded flex items-center justify-center text-black font-bold text-xs">C</div>
              <span className="font-mono font-bold tracking-tighter text-sm uppercase">Curler_Pro</span>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
              <span className="text-emerald-400">Projects</span>
              <span>/</span>
              <span>Backend_Telemetry</span>
              <span>/</span>
              <span className="text-slate-200">{activeTab.toUpperCase()}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-2 py-1 bg-slate-800 rounded border border-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-mono">REDIS: CONNECTED</span>
            </div>
            <div className="flex items-center gap-2 px-2 py-1 bg-slate-800 rounded border border-slate-700">
              <span className="text-[10px] font-mono text-slate-400 uppercase">Workers: 12 Active</span>
            </div>
          </div>
        </nav>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === 'tester' && (
              <motion.div
                key="tester"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <ApiTester variables={variables} />
              </motion.div>
            )}

            {activeTab === 'variables' && (
              <motion.div
                key="variables"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="h-full"
              >
                <VariablesManager variables={variables} onVariablesChange={setVariables} />
              </motion.div>
            )}
            
            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="h-full flex flex-col gap-4 overflow-hidden"
              >
                <div className="flex items-center justify-between mb-2">
                   <h2 className="text-sm font-bold text-slate-300 font-mono tracking-widest flex items-center gap-2 uppercase">
                      <History size={14} className="text-emerald-500" /> System_History_Logs
                   </h2>
                   <div className="text-[9px] text-slate-500 font-mono bg-slate-800 px-2 py-1 rounded">RETENTION: 100_ENTRIES</div>
                </div>
                <HistoryList />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <footer className="h-8 border-t border-[#1E293B] bg-[#0F1115] flex items-center justify-between px-4 text-[10px] font-mono text-slate-500 shrink-0">
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> SYSTEM: NOMINAL</span>
            <span>LATENCY: 12ms</span>
            <span>THREADS: 24/64</span>
          </div>
          <div className="flex gap-4">
            <span>v0.4.2-alpha</span>
            <span className="text-slate-300 underline cursor-pointer hover:text-emerald-400">VIEW_RAW_LOGS</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

