import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Play, Plus, X, Copy, Trash2, ChevronDown, ChevronUp, Clock, FileJson, List, Gauge, Zap, Terminal, Layers, Folder, Database, Layout, Maximize2, Minimize2, Save, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { RequestConfig, CurlResult } from '../server/modules/curl-engine';
import { BatchConfig, ProgressUpdate } from '../server/modules/runner';

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'];

interface SavedRequest extends RequestConfig {
  id: string;
  name: string;
  headersList: { id: string, key: string, value: string }[];
}

interface Collection {
  id: string;
  name: string;
  requests: SavedRequest[];
}

interface Tab {
  id: string;
  name: string;
  config: RequestConfig;
  headersList: { id: string, key: string, value: string }[];
  result: CurlResult | null;
  batchResults: CurlResult[];
  batchMode: boolean;
  loading: boolean;
  progress: ProgressUpdate | null;
}

export function ApiTester({ variables = {} }: { variables?: Record<string, string> }) {
  // Persistence Keys
  const TABS_KEY = 'curl_commander_tabs';
  const ACTIVE_TAB_KEY = 'curl_commander_active_tab';
  const COLLECTIONS_KEY = 'curl_commander_collections';
  const SIDEBAR_KEY = 'curl_commander_sidebar_collapsed';

  // State
  const [tabs, setTabs] = useState<Tab[]>(() => {
    const saved = localStorage.getItem(TABS_KEY);
    if (saved) return JSON.parse(saved);
    const initialId = uuidv4();
    return [{
      id: initialId,
      name: 'NEW_REQUEST',
      config: { method: 'GET', url: 'https://jsonplaceholder.typicode.com/todos/1', headers: {}, body: '' },
      headersList: [{ id: '1', key: 'Content-Type', value: 'application/json' }],
      result: null,
      batchResults: [],
      batchMode: false,
      loading: false,
      progress: null
    }];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    return localStorage.getItem(ACTIVE_TAB_KEY) || tabs[0].id;
  });

  const [collections, setCollections] = useState<Collection[]>(() => {
    const saved = localStorage.getItem(COLLECTIONS_KEY);
    if (saved) return JSON.parse(saved);
    return [{ id: 'default', name: 'MY_COLLECTION', requests: [] }];
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem(SIDEBAR_KEY) === 'true';
  });

  const [ws, setWs] = useState<WebSocket | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) || tabs[0], [tabs, activeTabId]);

  // Sync Persistence
  useEffect(() => localStorage.setItem(TABS_KEY, JSON.stringify(tabs)), [tabs]);
  useEffect(() => localStorage.setItem(ACTIVE_TAB_KEY, activeTabId), [activeTabId]);
  useEffect(() => localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections)), [collections]);
  useEffect(() => localStorage.setItem(SIDEBAR_KEY, String(isSidebarCollapsed)), [isSidebarCollapsed]);

  // WebSocket Initialization
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'progress') {
        const tabId = data.tabId || activeTabId; // Fallback if server doesn't send tabId
        setTabs(prev => prev.map(t => {
          if (t.id === tabId) {
            return {
              ...t,
              progress: data,
              batchResults: data.lastResult ? [...t.batchResults, data.lastResult] : t.batchResults
            };
          }
          return t;
        }));
      } else if (data.type === 'complete') {
        const tabId = data.tabId || activeTabId;
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, progress: null, loading: false } : t));
      }
    };

    setWs(socket);
    return () => socket.close();
  }, [activeTabId]);

  const updateActiveTab = (updates: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, ...updates } : t));
  };

  const updateActiveConfig = (updates: Partial<RequestConfig>) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { 
      ...t, 
      config: { ...t.config, ...updates } 
    } : t));
  };

  const resolveVars = (text: string) => {
    if (!text) return '';
    let resolved = text;
    Object.entries(variables).forEach(([key, value]) => {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      resolved = resolved.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g'), value);
    });
    return resolved;
  };

  const getResolvedConfig = (tab: Tab): RequestConfig => ({
    ...tab.config,
    url: resolveVars(tab.config.url),
    headers: tab.headersList.reduce((acc, h) => {
      const resolvedKey = resolveVars(h.key).trim();
      const resolvedValue = resolveVars(h.value).trim();
      if (resolvedKey) acc[resolvedKey] = resolvedValue;
      return acc;
    }, {} as Record<string, string>),
    body: resolveVars(tab.config.body || '')
  });

  const handleAbort = useCallback(() => {
    if (activeTab.batchMode) {
      ws?.send(JSON.stringify({ type: 'abort-batch', tabId: activeTabId }));
    } else {
      abortController?.abort();
    }
    updateActiveTab({ loading: false });
  }, [activeTab, ws, abortController, activeTabId]);

  const handleRun = async () => {
    if (activeTab.loading) return;
    const resolvedConfig = getResolvedConfig(activeTab);
    const controller = new AbortController();
    setAbortController(controller);

    if (activeTab.batchMode) {
      if (!ws) return;
      updateActiveTab({ loading: true, batchResults: [] });
      ws.send(JSON.stringify({
        type: 'run-batch',
        tabId: activeTabId,
        payload: {
          request: resolvedConfig,
          iterations: 10, // Default batch
          concurrency: 5
        }
      }));
    } else {
      updateActiveTab({ loading: true });
      try {
        const response = await fetch('/api/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(resolvedConfig),
          signal: controller.signal
        });
        const data = await response.json();
        updateActiveTab({ result: data });
      } catch (err: any) {
        if (err.name !== 'AbortError') console.error(err);
      } finally {
        updateActiveTab({ loading: false });
      }
    }
  };

  const createTab = (savedReq?: SavedRequest) => {
    const newId = uuidv4();
    const newTab: Tab = {
      id: newId,
      name: savedReq?.name || 'NEW_REQUEST',
      config: savedReq ? { method: savedReq.method, url: savedReq.url, headers: savedReq.headers, body: savedReq.body } : { method: 'GET', url: '', headers: {}, body: '' },
      headersList: savedReq?.headersList || [{ id: '1', key: 'Content-Type', value: 'application/json' }],
      result: null,
      batchResults: [],
      batchMode: false,
      loading: false,
      progress: null
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const closeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) setActiveTabId(newTabs[0].id);
  };

  const saveToCollection = () => {
    const name = prompt('ENTER_REQUEST_IDENTIFIER:', activeTab.name);
    if (!name) return;
    
    const savedReq: SavedRequest = {
      id: uuidv4(),
      name,
      ...activeTab.config,
      headersList: activeTab.headersList
    };

    setCollections(prev => prev.map(c => 
      c.id === 'default' ? { ...c, requests: [...c.requests, savedReq] } : c
    ));
    updateActiveTab({ name });
  };

  return (
    <div className="flex bg-[#0B0D11] h-screen text-slate-300 overflow-hidden font-sans">
      {/* Collapsible Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarCollapsed ? '48px' : '260px' }}
        className="border-r border-[#1E293B] bg-[#0F1115] flex flex-col shrink-0 overflow-hidden relative z-20 shadow-2xl shadow-black/50"
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-[#1E293B] shrink-0">
          {!isSidebarCollapsed && (
            <span className="text-[10px] font-black tracking-[0.3em] text-emerald-500 uppercase flex items-center gap-2">
              <Terminal size={14} /> Curl_Commander
            </span>
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="text-slate-500 hover:text-white transition-colors"
          >
            {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <div className="p-2 space-y-4">
            {!isSidebarCollapsed && (
              <section>
                <div className="flex items-center justify-between px-2 mb-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Folder size={10} /> Collections
                  </span>
                  <button className="text-slate-600 hover:text-emerald-500 transition-colors">
                    <Plus size={12} />
                  </button>
                </div>
                {collections.map(col => (
                  <div key={col.id} className="space-y-1">
                    <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-mono text-slate-400 group cursor-default">
                      <ChevronDown size={10} className="text-slate-600" />
                      {col.name}
                    </div>
                    <div className="pl-4 space-y-0.5">
                      {col.requests.map(req => (
                        <div key={req.id} className="group flex items-center">
                          <button
                            onClick={() => createTab(req)}
                            className="flex-1 text-left px-2 py-1.5 text-[9px] font-mono text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/5 transition-all flex items-center gap-2 truncate"
                          >
                            <span className={cn(
                              "w-8 text-[7px] font-bold text-center rounded shrink-0",
                              req.method === 'GET' ? "text-emerald-500 bg-emerald-500/10" :
                              req.method === 'POST' ? "text-blue-500 bg-blue-500/10" : "text-amber-500 bg-amber-500/10"
                            )}>
                              {req.method}
                            </span>
                            <span className="truncate">{req.name}</span>
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setCollections(prev => prev.map(c => 
                                c.id === col.id ? { ...c, requests: c.requests.filter(r => r.id !== req.id) } : c
                              ));
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-600 hover:text-rose-500 transition-all mr-1"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}
            
            {/* Minimal Icons for Collapsed State */}
            {isSidebarCollapsed && (
              <div className="flex flex-col items-center gap-4 py-4">
                <button className="text-slate-600 hover:text-emerald-500" title="Collections"><Folder size={18} /></button>
                <button className="text-slate-600 hover:text-blue-500" title="History"><Clock size={18} /></button>
                <div className="w-6 h-px bg-slate-800"></div>
                <button onClick={() => createTab()} className="text-emerald-500 hover:scale-110 transition-transform" title="New Request"><Plus size={18} /></button>
              </div>
            )}
          </div>
        </div>

        {!isSidebarCollapsed && (
          <div className="p-3 border-t border-[#1E293B] bg-[#0B0D11]">
            <button 
              onClick={() => createTab()}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Plus size={14} /> NEW_TELEMETRY
            </button>
          </div>
        )}
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0B0D11] relative">
        {/* Tab System */}
        <div className="h-10 flex border-b border-[#1E293B] bg-[#0F1115] shrink-0 overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <div 
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={cn(
                "group flex items-center gap-3 px-4 min-w-[140px] max-w-[200px] border-r border-[#1E293B] cursor-pointer transition-all relative select-none",
                tab.id === activeTabId ? "bg-[#0B0D11] after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-[1px] after:bg-[#0B0D11]" : "hover:bg-black/20"
              )}
            >
              <FileJson size={12} className={tab.id === activeTabId ? 'text-emerald-500' : 'text-slate-600'} />
              <span className={cn(
                "text-[10px] font-mono truncate uppercase flex-1",
                tab.id === activeTabId ? "text-slate-200 font-bold" : "text-slate-500"
              )}>
                {tab.name}
              </span>
              <button 
                onClick={(e) => closeTab(e, tab.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/5 rounded text-slate-500 hover:text-rose-500 transition-all"
              >
                <X size={10} />
              </button>
            </div>
          ))}
          <button 
            onClick={() => createTab()}
            className="flex items-center justify-center px-4 hover:bg-white/5 text-slate-500 transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Workspace Panels */}
        <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">
          {/* Active Tab Panel */}
          <div className="w-full lg:w-1/2 border-r border-[#1E293B] flex flex-col bg-[#0B0D11]">
            <div className="p-4 border-b border-slate-800 flex flex-col gap-3 shrink-0">
              <div className="flex gap-0 shadow-lg shadow-black/20">
                <select
                  value={activeTab.config.method}
                  onChange={(e) => updateActiveConfig({ method: e.target.value as any })}
                  className="bg-slate-800 border border-slate-700 text-amber-500 font-bold text-sm px-4 rounded-l outline-none focus:border-emerald-500/50 cursor-pointer h-12"
                >
                  {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input
                  type="text"
                  value={activeTab.config.url}
                  onChange={(e) => updateActiveConfig({ url: e.target.value })}
                  placeholder="URL_TELEMETRY_ENDPOINT"
                  className="flex-1 bg-slate-900 border-y border-slate-700 px-4 text-sm font-mono text-emerald-400 focus:border-emerald-500 outline-none h-12 tracking-tight"
                />
                <button
                  onClick={activeTab.loading ? handleAbort : handleRun}
                  className={cn(
                    "px-8 rounded-r text-sm font-black transition-all text-white active:scale-95 h-12 flex items-center justify-center gap-2",
                    activeTab.loading ? "bg-rose-600 hover:bg-rose-500" : "bg-emerald-600 hover:bg-emerald-500"
                  )}
                >
                  {activeTab.loading ? 'ABORT' : 'EXEC_RUN'}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={saveToCollection}
                    className="p-1 px-2 border border-slate-800 rounded text-[9px] font-mono text-slate-500 hover:text-emerald-400 flex items-center gap-1.5 uppercase transition-colors"
                  >
                    <Save size={10} /> Save_To_Collection
                  </button>
                  {[1, 10, 50].map(count => (
                    <button
                      key={count}
                      onClick={() => updateActiveTab({ batchMode: count > 1 })}
                      className={cn(
                        "px-2 py-0.5 rounded text-[9px] font-mono border transition-all uppercase",
                        (count === 1 && !activeTab.batchMode) || (activeTab.batchMode) // Simple toggle for demo
                          ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
                          : "bg-slate-800/40 border-slate-700 text-slate-500"
                      )}
                    >
                      {count === 1 ? 'Single' : 'Batch'}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={() => {
                    const resolved = getResolvedConfig(activeTab);
                    const curl = `curl -X ${resolved.method} "${resolved.url}" ${Object.entries(resolved.headers).map(([k,v]) => `-H "${k}: ${v}"`).join(' ')} ${resolved.body ? `-d '${resolved.body}'` : ''}`;
                    navigator.clipboard.writeText(curl);
                  }}
                  className="text-[9px] font-mono text-slate-500 hover:text-emerald-400 flex items-center gap-1 uppercase tracking-widest"
                >
                  <Copy size={10} /> Copy_Curl
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
               {/* Parameters and Body implementation from original ApiTester */}
               <section className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest flex items-center gap-2">
                     <List size={10} /> Headers_Matrix
                  </label>
                  <button 
                    onClick={() => updateActiveTab({ headersList: [...activeTab.headersList, { id: uuidv4(), key: '', value: '' }] })}
                    className="text-emerald-500"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {activeTab.headersList.map((h) => (
                    <div key={h.id} className="flex gap-1 group">
                      <input
                        value={h.key}
                        onChange={(e) => {
                          const newList = activeTab.headersList.map(item => item.id === h.id ? { ...item, key: e.target.value } : item);
                          updateActiveTab({ headersList: newList });
                        }}
                        placeholder="Key"
                        className="flex-1 bg-slate-900 border border-slate-800/80 rounded px-2 py-1.5 text-[11px] font-mono outline-none"
                      />
                      <input
                        value={h.value}
                        onChange={(e) => {
                          const newList = activeTab.headersList.map(item => item.id === h.id ? { ...item, value: e.target.value } : item);
                          updateActiveTab({ headersList: newList });
                        }}
                        placeholder="Value"
                        className="flex-1 bg-slate-900 border border-slate-800/80 rounded px-2 py-1.5 text-[11px] font-mono outline-none"
                      />
                      <button 
                        onClick={() => {
                          const newList = activeTab.headersList.filter(item => item.id !== h.id);
                          updateActiveTab({ headersList: newList });
                        }}
                        className="text-slate-600 hover:text-rose-500 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
               </section>

               {['POST', 'PUT', 'PATCH'].includes(activeTab.config.method) && (
                <section>
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-3 flex items-center gap-2">
                     <FileJson size={10} /> Payload_JSON
                  </label>
                  <textarea
                    value={activeTab.config.body}
                    onChange={(e) => updateActiveConfig({ body: e.target.value })}
                    className="w-full bg-black border border-slate-800 rounded p-3 font-mono text-[11px] text-emerald-400/80 outline-none h-40 resize-none"
                  />
                </section>
               )}
            </div>
          </div>

          <div className="w-full lg:w-1/2 flex flex-col bg-black overflow-hidden">
            {activeTab.batchMode ? (
              <BatchViewer 
                results={activeTab.batchResults} 
                progress={activeTab.progress} 
                concurrency={5} 
                onAbort={handleAbort} 
              />
            ) : (
              <ResponseViewer 
                result={activeTab.result} 
                loading={activeTab.loading} 
                onAbort={handleAbort} 
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// Keep original sub-components below with minor tweaks for tabs if needed...

// Sub-components
function ResponseViewer({ result, loading, onAbort }: { result: CurlResult | null, loading: boolean, onAbort: () => void }) {
  const [activeResTab, setActiveResTab] = useState<'body' | 'headers' | 'raw'>('body');

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden bg-black/50 space-y-6">
        <div className="text-center space-y-4">
          <div className="relative mx-auto">
            <Zap size={32} className="text-emerald-500 animate-pulse" />
            <div className="absolute inset-0 bg-emerald-500/20 blur-xl animate-pulse"></div>
          </div>
          <p className="text-emerald-500/60 font-mono text-[10px] tracking-widest uppercase animate-pulse">Initializing_Curl_Telemetry...</p>
        </div>
        <button 
          onClick={onAbort}
          className="px-6 py-2 border border-rose-500/30 text-rose-500 font-mono text-[10px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all rounded"
        >
          FORCE_ABORT_TELEMETRY
        </button>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-600 bg-black/20">
        <Terminal size={48} className="mb-4 opacity-5" />
        <h3 className="font-bold text-slate-500 text-xs tracking-widest">AWAITING_STREAM_INPUT</h3>
        <p className="text-[10px] mt-2 max-w-xs font-mono uppercase leading-relaxed">
          Configure headers and payload instrumentation on the left panel to begin telemetry capture.
        </p>
      </div>
    );
  }

  const isSuccess = result.status >= 200 && result.status < 300;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-2 px-4 border-b border-slate-800 bg-[#0F1115] shrink-0">
         <div className="flex items-center gap-4">
           <span className={cn("text-[10px] font-bold tracking-widest uppercase", isSuccess ? "text-emerald-500" : "text-rose-500")}>
             Status: {result.status} {isSuccess ? 'OK' : 'ERR'}
           </span>
           <span className="text-[10px] font-bold text-slate-500 font-mono uppercase">
             Time: {result.responseTime}ms
           </span>
         </div>
         <div className="flex gap-2">
           <button 
             onClick={() => setActiveResTab('body')}
             className={cn("text-[10px] px-2 py-0.5 rounded font-bold transition-all", activeResTab === 'body' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-slate-500")}
           >
             PRETTY
           </button>
           <button 
             onClick={() => setActiveResTab('headers')}
             className={cn("text-[10px] px-2 py-0.5 rounded font-bold transition-all", activeResTab === 'headers' ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "text-slate-500")}
           >
             HEADERS
           </button>
           <button 
             onClick={() => setActiveResTab('raw')}
             className={cn("text-[10px] px-2 py-0.5 rounded font-bold transition-all", activeResTab === 'raw' ? "bg-slate-800 text-slate-300 border border-slate-700" : "text-slate-500")}
           >
             RAW
           </button>
         </div>
      </div>

      <div className="flex-1 overflow-auto p-6 font-mono text-[11px] leading-relaxed custom-scrollbar selection:bg-emerald-500/40">
        {result.error && activeResTab === 'body' ? (
           <div className="text-rose-400 bg-rose-500/5 p-4 rounded border border-rose-500/20">
             <div className="text-[10px] font-bold mb-2 uppercase tracking-widest opacity-70">Crit_Process_Failure</div>
             {result.error}
           </div>
        ) : (
           <div className="space-y-0 text-emerald-400/90 whitespace-pre-wrap break-all">
             {activeResTab === 'body' && (() => {
               try {
                 const json = JSON.parse(result.body);
                 return <JsonPretty data={json} />;
               } catch {
                 return result.body;
               }
             })()}
             
             {activeResTab === 'headers' && (
               <div className="space-y-1">
                 {(Object.entries(result.headers) as [string, string][]).map(([k, v]) => (
                   <div key={k} className="flex gap-3 border-b border-slate-900 pb-1 mb-1">
                      <span className="text-blue-400 font-bold w-1/3 shrink-0">{k}:</span>
                      <span className="text-slate-400 flex-1">{v}</span>
                   </div>
                 ))}
               </div>
             )}

             {activeResTab === 'raw' && (
               <div className="text-slate-500 text-[10px]">
                 {result.rawOutput}
               </div>
             )}
           </div>
        )}
      </div>
    </div>
  );
}

function JsonPretty({ data, level = 0 }: { data: any, level?: number }) {
   if (data === null) return <span className="text-slate-500">null</span>;
   if (typeof data === 'string') return <span className="text-emerald-400 break-words overflow-hidden">"{data}"</span>;
   if (typeof data === 'number') return <span className="text-amber-400">{data}</span>;
   if (typeof data === 'boolean') return <span className="text-blue-400">{data.toString()}</span>;
   
   const indent = "  ".repeat(level);
   const nextIndent = "  ".repeat(level + 1);

   if (Array.isArray(data)) {
     if (data.length === 0) return <span>[]</span>;
     return (
       <span>
         [<br />
         {data.map((item, i) => (
           <span key={i}>
             {nextIndent}<JsonPretty data={item} level={level + 1} />{i < data.length - 1 ? ',' : ''}<br />
           </span>
         ))}
         {indent}]
       </span>
     );
   }

   if (typeof data === 'object') {
     const entries = Object.entries(data);
     if (entries.length === 0) return <span>{"{}"}</span>;
     return (
       <span>
         {"{"}<br />
         {entries.map(([key, value], i) => (
           <span key={key}>
             {nextIndent}<span className="text-blue-400">"{key}"</span>: <JsonPretty data={value} level={level + 1} />{i < entries.length - 1 ? ',' : ''}<br />
           </span>
         ))}
         {indent}{"}"}
       </span>
     );
   }
   return <span>{String(data)}</span>;
}

function BatchViewer({ results, progress, concurrency, onAbort }: { results: CurlResult[], progress: ProgressUpdate | null, concurrency: number, onAbort: () => void }) {
  const [selectedResult, setSelectedResult] = useState<CurlResult | null>(null);
  const successCount = results.filter(r => r.status >= 200 && r.status < 300).length;
  const failureCount = results.length - successCount;
  const avgResponseTime = results.length > 0 
    ? (results.reduce((acc, r) => acc + r.responseTime, 0) / results.length).toFixed(0) 
    : 0;

  if (selectedResult) {
    return (
      <div className="flex flex-col h-full bg-black relative">
        <div className="p-3 px-4 border-b border-slate-800 bg-[#0F1115] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
             <button 
               onClick={() => setSelectedResult(null)}
               className="text-[9px] font-mono text-emerald-500 hover:text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1.5"
             >
               <Layers size={12} /> BACK_TO_STREAM
             </button>
             <span className="w-px h-3 bg-slate-800 mx-1"></span>
             <span className="text-[10px] font-mono text-slate-500 uppercase">RESULT_DETAIL_VIEW</span>
          </div>
          <button 
            onClick={() => setSelectedResult(null)}
            className="text-slate-500 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <ResponseViewer result={selectedResult} loading={false} onAbort={() => {}} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black">
      <div className="p-4 border-b border-slate-800 bg-[#0F1115] space-y-4 shrink-0">
        <div className="flex items-center justify-between">
           <h3 className="font-bold text-amber-500 text-[10px] flex items-center gap-2 uppercase tracking-widest">
             <Layers size={14} className="text-amber-500" /> CONCURRENCY_STREAM_ORCHESTRATOR
           </h3>
           {progress && (
             <div className="flex items-center gap-2">
               <div className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                 ACTIVE_EXECUTION
               </div>
               <button 
                 onClick={onAbort}
                 className="text-[9px] font-mono text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all"
               >
                 ABORT_STREAM
               </button>
             </div>
           )}
        </div>
        
        <div className="relative pt-1">
          <div className="flex mb-2 items-center justify-between">
            <div>
              <span className="text-[9px] font-mono font-bold inline-block py-1 px-2 uppercase rounded text-slate-500 bg-slate-800/40">
                Job_Progress: {progress ? progress.completed : results.length} / {progress ? progress.total : results.length}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-mono font-bold inline-block text-emerald-500">
                {progress ? ((progress.completed / progress.total) * 100).toFixed(1) : '100'}%
              </span>
            </div>
          </div>
          <div className="overflow-hidden h-1 mb-4 text-xs flex rounded bg-slate-900 border border-slate-800/40">
            <motion.div 
               style={{ width: `${progress ? (progress.completed / progress.total) * 100 : 100}%` }}
               className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
               initial={{ width: 0 }}
               animate={{ width: `${progress ? (progress.completed / progress.total) * 100 : 100}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
           <div className="p-2 bg-slate-950 border border-slate-800/60 rounded text-center">
             <div className="text-[9px] text-slate-500 uppercase font-mono mb-1">Passed</div>
             <div className="text-sm font-bold text-emerald-500 font-mono tracking-tighter">{successCount}</div>
           </div>
           <div className="p-2 bg-slate-950 border border-slate-800/60 rounded text-center">
             <div className="text-[9px] text-slate-500 uppercase font-mono mb-1">Failed</div>
             <div className="text-sm font-bold text-rose-500 font-mono tracking-tighter">{failureCount}</div>
           </div>
           <div className="p-2 bg-slate-950 border border-slate-800/60 rounded text-center">
             <div className="text-[9px] text-slate-500 uppercase font-mono mb-1">Avg_MS</div>
             <div className="text-sm font-bold text-blue-400 font-mono tracking-tighter">{avgResponseTime}ms</div>
           </div>
           <div className="p-2 bg-slate-950 border border-slate-800/60 rounded text-center relative overflow-hidden group">
             <div className="text-[9px] text-slate-500 uppercase font-mono mb-1">Concurrency</div>
             <div className="text-sm font-bold text-amber-400 font-mono tracking-tighter">{progress ? concurrency : 0}</div>
             {progress && (
                <div className="absolute inset-0 bg-amber-500/5 animate-pulse pointer-events-none"></div>
             )}
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col bg-black">
        <div className="p-2 px-4 border-b border-slate-800 bg-[#0F1115] flex items-center justify-between shrink-0">
           <span className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-widest">Live_Result_Telemetry</span>
           <button onClick={() => {}} className="text-[9px] font-mono text-slate-500 hover:text-white flex items-center gap-1">
              <Trash2 size={10} /> RESET_STREAM
           </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-1 bg-black">
          <AnimatePresence initial={false}>
            {[...results].slice(-50).reverse().map((res, i) => (
              <motion.div 
                key={res.id}
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                onClick={() => setSelectedResult(res)}
                className="flex items-center gap-3 p-1.5 hover:bg-emerald-500/5 bg-slate-950/20 border border-slate-900 hover:border-emerald-500/30 transition-all rounded cursor-pointer group"
              >
                <div className={`w-1 h-6 rounded-full shrink-0 transition-all group-hover:h-8 ${res.status >= 200 && res.status < 300 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                <div className="flex-1 min-w-0">
                   <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[9px] font-mono text-slate-600 group-hover:text-emerald-500/70 transition-colors">SEQ__{results.length - i}</span>
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-tighter group-hover:text-slate-300 transition-colors">{res.responseTime}MS_LAT</span>
                   </div>
                   <div className="flex items-center gap-2">
                      <span className={cn("text-[10px] font-bold font-mono tracking-widest", res.status >= 200 && res.status < 300 ? "text-emerald-500" : "text-rose-500")}>
                        {res.status}
                      </span>
                      <span className="text-[9px] font-mono text-slate-600 truncate opacity-60 uppercase group-hover:opacity-100 transition-opacity">{res.id}</span>
                   </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {results.length === 0 && !progress && (
            <div className="h-full flex items-center justify-center p-20 text-center">
               <div className="space-y-3">
                 <div className="w-10 h-10 border border-slate-800 rounded-full mx-auto flex items-center justify-center animate-pulse">
                    <div className="w-1 h-1 bg-slate-700 rounded-full"></div>
                 </div>
                 <p className="text-[10px] text-slate-600 font-mono uppercase tracking-[0.2em]">Awaiting_Stream_Init</p>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
