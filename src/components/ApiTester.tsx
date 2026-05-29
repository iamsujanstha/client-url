import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Play, Plus, Minus, Cpu, X, Copy, Trash2, ChevronDown, ChevronUp, Clock, FileJson, List, Gauge, Zap, Terminal, Layers, Folder, Database, Layout, Maximize2, Minimize2, Save, FileText, ChevronLeft, ChevronRight, Beaker, Activity, RefreshCw, AlertTriangle, History, Sliders } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { RequestConfig, CurlResult } from '../server/modules/curl-engine';
import { BatchConfig, ProgressUpdate } from '../server/modules/runner';
import { TestLab, TestModuleId } from './TestLab';
import { VariablesManager } from './VariablesManager';

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'GRAPHQL'];

interface SavedRequest extends RequestConfig {
  id: string;
  name: string;
  graphqlQuery?: string;
  graphqlVariables?: string;
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
  graphqlQuery?: string;
  graphqlVariables?: string;
  headersList: { id: string, key: string, value: string }[];
  result: CurlResult | null;
  batchResults: CurlResult[];
  batchMode: boolean;
  showCurl: boolean;
  loading: boolean;
  progress: ProgressUpdate | null;
}

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
    <div className="flex-1 card-slate overflow-hidden flex flex-col bg-black border border-slate-850 rounded">
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar min-h-[350px]">
        {history.length === 0 && (
          <div className="text-center p-12 text-slate-600 font-mono text-xs italic">
            NO_PREVIOUS_REPORTS_FOUND_IN_CACHE
          </div>
        )}
        {history.map((item, idx) => (
          <div key={idx} className="p-3 bg-slate-900/40 border border-slate-850 rounded group hover:border-emerald-500/30 transition-all">
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

export function ApiTester({ variables: initialVariables = {} }: { variables?: Record<string, string> }) {
  // Persistence Keys
  const TABS_KEY = 'curl_commander_tabs';
  const ACTIVE_TAB_KEY = 'curl_commander_active_tab';
  const COLLECTIONS_KEY = 'curl_commander_collections';
  const SIDEBAR_KEY = 'curl_commander_sidebar_collapsed';

  // State
  const [tabs, setTabs] = useState<Tab[]>(() => {
    try {
      const saved = localStorage.getItem(TABS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Add safety for missing properties in old state
          return parsed.map(t => ({
            ...t,
            batchResults: Array.isArray(t.batchResults) ? t.batchResults : [],
            batchMode: !!t.batchMode,
            showCurl: !!t.showCurl,
            loading: false,
            progress: null,
            headersList: Array.isArray(t.headersList) ? t.headersList : [{ id: '1', key: 'Content-Type', value: 'application/json' }]
          }));
        }
      }
    } catch (e) {
      console.error('Failed to load tabs from localStorage', e);
    }
    
    const initialId = uuidv4();
    return [{
      id: initialId,
      name: 'NEW_REQUEST',
      config: { method: 'GET', url: 'https://jsonplaceholder.typicode.com/todos/1', headers: {}, body: '' },
      headersList: [{ id: '1', key: 'Content-Type', value: 'application/json' }],
      result: null,
      batchResults: [],
      batchMode: false,
      showCurl: false,
      loading: false,
      progress: null
    }];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const saved = localStorage.getItem(ACTIVE_TAB_KEY);
    if (saved && tabs.some(t => t.id === saved)) return saved;
    return tabs[0]?.id || '';
  });

  const [collections, setCollections] = useState<Collection[]>(() => {
    try {
      const saved = localStorage.getItem(COLLECTIONS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to load collections from localStorage', e);
    }
    return [{ id: 'default', name: 'MY_COLLECTION', requests: [] }];
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem(SIDEBAR_KEY) === 'true';
  });

  const [isWorkerPoolOpen, setIsWorkerPoolOpen] = useState(false);

  // Custom terminal-styled modal state
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    type: 'ALERT' | 'CONFIRM' | 'PROMPT_TEXT' | 'SAVE_REQUEST';
    title: string;
    message: string;
    defaultValue?: string;
    inputVal?: string;
    selectedColId?: string;
    onConfirm: (val1?: string, val2?: string) => void;
  }>({
    isOpen: false,
    type: 'ALERT',
    title: '',
    message: '',
    defaultValue: '',
    inputVal: '',
    selectedColId: '',
    onConfirm: () => {}
  });

  const showCustomAlert = (title: string, message: string, onConfirm?: () => void) => {
    setDialog({
      isOpen: true,
      type: 'ALERT',
      title,
      message,
      defaultValue: '',
      inputVal: '',
      onConfirm: () => {
        setDialog(prev => ({ ...prev, isOpen: false }));
        if (onConfirm) onConfirm();
      }
    });
  };

  const showCustomConfirm = (title: string, message: string, onConfirm: () => void) => {
    setDialog({
      isOpen: true,
      type: 'CONFIRM',
      title,
      message,
      onConfirm: () => {
        setDialog(prev => ({ ...prev, isOpen: false }));
        onConfirm();
      }
    });
  };

  const showCustomPrompt = (title: string, message: string, defaultValue: string, onConfirm: (val: string) => void) => {
    setDialog({
      isOpen: true,
      type: 'PROMPT_TEXT',
      title,
      message,
      defaultValue,
      inputVal: defaultValue,
      onConfirm: (val) => {
        setDialog(prev => ({ ...prev, isOpen: false }));
        if (val) onConfirm(val);
      }
    });
  };

  const showSaveRequestDialog = (defaultRequestName: string, onConfirm: (reqName: string, colId: string) => void) => {
    setDialog({
      isOpen: true,
      type: 'SAVE_REQUEST',
      title: 'SAVE REQUEST TO COLLECTION',
      message: 'Choose a descriptive identifier for your request and select a target collection.',
      defaultValue: defaultRequestName,
      inputVal: defaultRequestName,
      selectedColId: collections[0]?.id || 'default',
      onConfirm: (reqName, colId) => {
        setDialog(prev => ({ ...prev, isOpen: false }));
        if (reqName && colId) onConfirm(reqName, colId);
      }
    });
  };

  const [telemetry, setTelemetry] = useState(() => {
    return {
      redisStatus: 'CONNECTED',
      redisLatency: 2,
      activeWorkers: 0,
      maxWorkers: 64,
      latency: '10ms',
      redisType: 'IN_MEMORY_CACHE',
      clientCount: 1,
      spawnedWorkers: [] as { id: string; name: string; status: 'IDLE' | 'ACTIVE'; task: string; activeTime: number; }[]
    };
  });

  const [ws, setWs] = useState<WebSocket | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [view, setView] = useState<'debugger' | 'lab' | 'variables' | 'history'>('debugger');

  const [variables, setVariables] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('curl_commander_variables');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      'BASE_URL': 'http://localhost:3000',
      'TOKEN': 'sk_test_5123456789',
      ...initialVariables
    };
  });

  useEffect(() => {
    localStorage.setItem('curl_commander_variables', JSON.stringify(variables));
  }, [variables]);

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) || tabs[0], [tabs, activeTabId]);
  
  // Track activeTabId in ref to avoid re-initializing WS on every tab transition
  const activeTabIdRef = React.useRef(activeTabId);
  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  if (!activeTab) return null;

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
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') {
          const tabId = data.tabId || activeTabIdRef.current;
          setTabs(prev => prev.map(t => {
            if (t.id === tabId) {
              return {
                ...t,
                progress: { ...data, startTime: data.startTime || Date.now() },
                batchResults: data.lastResult ? [...(Array.isArray(t.batchResults) ? t.batchResults : []), data.lastResult] : t.batchResults
              };
            }
            return t;
          }));
        } else if (data.type === 'complete') {
          const tabId = data.tabId || activeTabIdRef.current;
          setTabs(prev => prev.map(t => t.id === tabId ? { ...t, progress: null, loading: false } : t));
        } else if (data.type === 'telemetry') {
          setTelemetry(data.payload);
        }
      } catch (e) {
        console.error('WS Message parsing error:', e);
      }
    };

    setWs(socket);
    return () => socket.close();
  }, []);

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
      resolved = resolved.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g'), value as string);
    });
    return resolved;
  };

  const getResolvedConfig = (tab: Tab): RequestConfig => {
    let body = resolveVars(tab.config.body || '');
    
    if (tab.config.method === 'GRAPHQL') {
      let vars = {};
      try {
        if (tab.graphqlVariables) {
          vars = JSON.parse(resolveVars(tab.graphqlVariables));
        }
      } catch (e) {
        console.error('Invalid GraphQL variables JSON', e);
      }
      
      body = JSON.stringify({
        query: tab.graphqlQuery || '',
        variables: vars
      });
    }

    return {
      ...tab.config,
      url: resolveVars(tab.config.url),
      headers: tab.headersList.reduce((acc, h) => {
        const resolvedKey = resolveVars(h.key).trim();
        const resolvedValue = resolveVars(h.value).trim();
        if (resolvedKey) acc[resolvedKey] = resolvedValue;
        return acc;
      }, {} as Record<string, string>),
      body
    };
  };

  const runCollection = (colId: string) => {
    const col = collections.find(c => c.id === colId);
    if (!col || col.requests.length === 0) return;
    
    const newId = uuidv4();
    const newTab: Tab = {
      id: newId,
      name: `BATCH: ${col.name}`,
      config: col.requests[0],
      headersList: col.requests[0].headersList,
      result: null,
      batchResults: [],
      batchMode: true,
      showCurl: false,
      loading: true,
      progress: null
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);

    // Filter out invalid requests and resolve vars (vars resolution should happen here or on server)
    // For now, let's keep it simple and send them as they are
    const resolvedRequests = col.requests.map(req => {
      // Create a dummy tab to use getResolvedConfig logic
      const dummyTab: Tab = {
        ...newTab,
        config: req,
        headersList: req.headersList,
        graphqlQuery: req.graphqlQuery,
        graphqlVariables: req.graphqlVariables
      };
      return getResolvedConfig(dummyTab);
    });

    if (ws) {
      ws.send(JSON.stringify({
        type: 'run-batch',
        tabId: newId,
        payload: {
          requests: resolvedRequests,
          iterations: resolvedRequests.length,
          concurrency: 1 // Run sequentially by default for collection runs
        }
      }));
    }
  };

  const duplicateCollection = (colId: string) => {
    const col = collections.find(c => c.id === colId);
    if (!col) return;
    setCollections(prev => [...prev, { ...col, id: uuidv4(), name: `${col.name}_COPY` }]);
  };

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

        if (!response.ok) {
          const text = await response.text();
          let errorMsg = `Server error: ${response.status}`;
          try {
            const errJson = JSON.parse(text);
            errorMsg = errJson.error || errorMsg;
          } catch {
            // Not JSON, use text directly if short
            if (text.length < 100) errorMsg = text;
          }
          throw new Error(errorMsg);
        }

        const data = await response.json();
        updateActiveTab({ result: data });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error(err);
          // Create dummy result for error display
          updateActiveTab({ 
            result: {
              id: uuidv4(),
              status: 0,
              headers: {},
              body: '',
              responseTime: 0,
              rawOutput: err.message,
              error: err.message,
              curlCommand: 'N/A'
            }
          });
        }
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
      graphqlQuery: savedReq?.graphqlQuery || '',
      graphqlVariables: savedReq?.graphqlVariables || '',
      headersList: savedReq?.headersList || [{ id: '1', key: 'Content-Type', value: 'application/json' }],
      result: null,
      batchResults: [],
      batchMode: false,
      showCurl: false,
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

  const addCollection = () => {
    showCustomPrompt('CREATE COLLECTION', 'Enter a name for the new collection:', 'NEW_COLLECTION', (name) => {
      setCollections(prev => [...prev, { id: uuidv4(), name: name.toUpperCase(), requests: [] }]);
    });
  };

  const deleteRequest = (colId: string, reqId: string) => {
    setCollections(prev => prev.map(c => 
      c.id === colId ? { ...c, requests: c.requests.filter(r => r.id !== reqId) } : c
    ));
  };

  const deleteCollection = (id: string) => {
    if (id === 'default') {
      showCustomAlert('ACTION DENIED', 'The Root Collection is system-reserved and cannot be deleted.');
      return;
    }
    showCustomConfirm(
      'DELETE COLLECTION',
      'Warning: This action will permanently delete this collection and all of its compiled requests. Are you sure you want to proceed?',
      () => {
        setCollections(prev => prev.filter(c => c.id !== id));
      }
    );
  };

  const saveToCollection = () => {
    showSaveRequestDialog(activeTab.name, (name, colId) => {
      const targetCol = collections.find(c => c.id === colId) || collections[0];
      if (!targetCol) return;

      const savedReq: SavedRequest = {
        id: uuidv4(),
        name,
        ...activeTab.config,
        graphqlQuery: activeTab.graphqlQuery,
        graphqlVariables: activeTab.graphqlVariables,
        headersList: [...activeTab.headersList]
      };

      setCollections(prev => prev.map(c => c.id === targetCol.id ? { ...c, requests: [...c.requests, savedReq] } : c));
      updateActiveTab({ name });
    });
  };

  const handleStartLabTest = (moduleId: TestModuleId, settings: any) => {
    if (!ws) return;
    updateActiveTab({ loading: true, batchResults: [] });
    ws.send(JSON.stringify({
      type: 'run-batch',
      tabId: activeTabId,
      payload: {
        request: getResolvedConfig(activeTab),
        testModule: moduleId,
        iterations: settings.iterations,
        concurrency: settings.concurrency,
        retries: settings.retries,
        jitter: moduleId === 'chaos',
        fuzzing: moduleId === 'fuzzer'
      }
    }));
  };

  return (
    <div className="flex bg-[#0B0D11] h-screen text-slate-300 overflow-hidden font-sans">
      {/* Collapsible Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarCollapsed ? '52px' : '220px' }}
        className="border-r border-slate-800 bg-[#0F1115] flex flex-col shrink-0 overflow-hidden relative z-20"
      >
        <div className="h-12 flex items-center justify-between px-3 border-b border-slate-800 shrink-0">
          {!isSidebarCollapsed && (
            <span className="text-[10px] font-black tracking-[0.4em] text-white uppercase flex items-center gap-2">
              <Terminal size={14} className="text-emerald-500" /> HYPERCURL
            </span>
          )}
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="text-slate-600 hover:text-white transition-colors p-1"
          >
            {isSidebarCollapsed ? <Plus size={16} className="rotate-45" /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <div className="p-2 space-y-6">
            <div className="space-y-1">
              {!isSidebarCollapsed && <div className="text-[8px] font-black text-slate-700 uppercase tracking-[0.2em] mb-2 ml-2">NAVIGATION</div>}
              <button 
                onClick={() => setView('debugger')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded text-[11px] font-mono transition-all group",
                  view === 'debugger' 
                    ? "bg-slate-800/50 text-emerald-400 border-l-2 border-emerald-500 font-bold" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                )}
                title={isSidebarCollapsed ? "API Debugger" : ""}
              >
                <Terminal size={15} className={cn(
                  "transition-transform",
                  view === 'debugger' ? "text-emerald-500" : "group-hover:scale-110"
                )} />
                {!isSidebarCollapsed && <span className="uppercase tracking-tight">DEBUGGER</span>}
              </button>
              <button 
                onClick={() => setView('lab')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded text-[11px] font-mono transition-all group",
                  view === 'lab' 
                    ? "bg-slate-800/50 text-emerald-400 border-l-2 border-emerald-500 font-bold" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                )}
                title={isSidebarCollapsed ? "Test Lab" : ""}
              >
                <Beaker size={15} className={cn(
                  "transition-transform",
                  view === 'lab' ? "text-emerald-500" : "group-hover:scale-110"
                )} />
                {!isSidebarCollapsed && <span className="uppercase tracking-tight">TEST LAB</span>}
              </button>
              <button 
                onClick={() => setView('variables')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded text-[11px] font-mono transition-all group",
                  view === 'variables' 
                    ? "bg-slate-800/50 text-emerald-400 border-l-2 border-emerald-500 font-bold" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                )}
                title={isSidebarCollapsed ? "Environments" : ""}
              >
                <Sliders size={15} className={cn(
                  "transition-transform",
                  view === 'variables' ? "text-emerald-500" : "group-hover:scale-110"
                )} />
                {!isSidebarCollapsed && <span className="uppercase tracking-tight">ENVIRONMENTS</span>}
              </button>
              <button 
                onClick={() => setView('history')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded text-[11px] font-mono transition-all group",
                  view === 'history' 
                    ? "bg-slate-800/50 text-emerald-400 border-l-2 border-emerald-500 font-bold" 
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                )}
                title={isSidebarCollapsed ? "History Logs" : ""}
              >
                <History size={15} className={cn(
                  "transition-transform",
                  view === 'history' ? "text-emerald-500" : "group-hover:scale-110"
                )} />
                {!isSidebarCollapsed && <span className="uppercase tracking-tight">HISTORY</span>}
              </button>
            </div>

            {!isSidebarCollapsed && (
              <section className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <span className="text-[8px] font-black text-slate-700 uppercase tracking-[0.2em]">COLLECTIONS</span>
                  <button 
                    onClick={addCollection}
                    className="text-slate-600 hover:text-emerald-500 transition-colors"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <div className="space-y-4">
                  {collections.map(col => (
                    <div key={col.id} className="space-y-1">
                      <div className="text-[9px] font-mono text-slate-600 px-2 flex items-center justify-between group/col">
                        <div className="flex items-center gap-2">
                          <Folder size={10} /> {col.name}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover/col:opacity-100 transition-all">
                          <button 
                            onClick={(e) => { e.stopPropagation(); runCollection(col.id); }}
                            className="p-1 text-slate-600 hover:text-emerald-500 transition-colors"
                            title="RUN_COLLECTION"
                          >
                            <Play size={10} fill="currentColor" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); duplicateCollection(col.id); }}
                            className="p-1 text-slate-600 hover:text-blue-500 transition-colors"
                            title="DUPLICATE"
                          >
                            <Copy size={10} />
                          </button>
                          {col.id !== 'default' && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteCollection(col.id); }}
                              className="p-1 text-slate-700 hover:text-rose-500 transition-all"
                              title="DELETE"
                            >
                              <Trash2 size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-0.5 ml-1">
                        {col.requests.map(req => (
                          <div key={req.id} className="group flex items-center pr-2">
                            <button
                              onClick={() => { setView('debugger'); createTab(req); }}
                              className="flex-1 text-left px-3 py-1.5 text-[9px] font-mono text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/5 transition-all flex items-center gap-2 truncate"
                            >
                              <span className={cn(
                                "w-6 text-[7px] font-black text-center rounded-[1px] py-0.5",
                                req.method === 'GET' ? "text-emerald-500 bg-emerald-500/10" :
                                req.method === 'POST' ? "text-blue-500 bg-blue-500/10" :
                                req.method === 'GRAPHQL' ? "text-violet-500 bg-violet-500/10" : "text-amber-500 bg-amber-500/10"
                              )}>
                                {req.method === 'GRAPHQL' ? 'GQL' : req.method[0]}
                              </span>
                              <span className="truncate opacity-70">{req.name}</span>
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteRequest(col.id, req.id); }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-700 hover:text-rose-500 transition-all"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {!isSidebarCollapsed && (
          <div className="p-3 border-t border-slate-800">
            <button 
              onClick={() => createTab()}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Plus size={14} /> NEW_REQ
            </button>
          </div>
        )}
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0B0D11] relative">
        <nav className="flex items-center justify-between px-4 h-12 border-b border-[#1E293B] bg-[#0F1115] shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-emerald-500 rounded flex items-center justify-center text-black font-bold text-xs font-mono">C</div>
              <span className="font-mono font-bold tracking-tighter text-sm uppercase">Curler_Pro</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
              <span className="text-emerald-500 font-bold">PROJECTS</span>
              <span className="opacity-40">/</span>
              <span>TELEMETRY_ENGINE</span>
              <span className="opacity-40">/</span>
              <span className="text-slate-200 font-bold">{view.toUpperCase()}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2 py-1 bg-slate-900/40 rounded border border-slate-800" title={`Redis Type: ${telemetry.redisType}`}>
              <span className={cn(
                "w-1.5 h-1.5 rounded-full animate-pulse",
                telemetry.redisStatus === 'CONNECTED' ? "bg-emerald-500" : "bg-rose-500"
              )}></span>
              <span className="text-[10px] font-mono text-slate-400">
                REDIS: {telemetry.redisStatus === 'CONNECTED' ? `CONNECTED (${telemetry.redisLatency}ms)` : 'DISCONNECTED'}
              </span>
            </div>
            <div 
              onClick={() => setIsWorkerPoolOpen(!isWorkerPoolOpen)}
              className={cn(
                "flex items-center gap-2 px-2 py-1 rounded border cursor-pointer select-none transition-all active:scale-95",
                isWorkerPoolOpen 
                  ? "bg-emerald-950/40 border-emerald-500/50 hover:bg-emerald-950/60" 
                  : "bg-slate-900/40 border-slate-800 hover:bg-slate-800 hover:border-slate-700"
              )}
              title="Click to manage and spawn background worker threads"
            >
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                telemetry.activeWorkers > 0 ? "bg-amber-500 animate-pulse" : "bg-slate-500"
              )}></span>
              <span className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
                Workers: {telemetry.activeWorkers} Active <ChevronDown size={10} className={cn("transition-transform duration-200", isWorkerPoolOpen && "rotate-180")} />
              </span>
            </div>
          </div>
        </nav>

        {/* Worker Pool Popover */}
        <AnimatePresence>
          {isWorkerPoolOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute right-4 top-13 w-80 bg-[#12161E] border border-slate-800 rounded-lg shadow-2xl z-50 overflow-hidden font-mono"
            >
              <div className="p-3 border-b border-slate-800 bg-[#161B25] flex justify-between items-center">
                <span className="text-[9px] font-black text-white tracking-widest uppercase flex items-center gap-2">
                  <Cpu size={12} className="text-emerald-500" /> WORKER_THREAD_POOL
                </span>
                <button 
                  onClick={() => setIsWorkerPoolOpen(false)}
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <X size={12} />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Control Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => ws?.send(JSON.stringify({ type: 'spawn-worker' }))}
                    className="flex-1 py-1.5 bg-emerald-600/25 hover:bg-emerald-600 border border-emerald-500/30 hover:border-emerald-500 text-emerald-400 hover:text-white text-[9px] font-black rounded transition-all uppercase flex items-center justify-center gap-1 shadow-sm h-7"
                  >
                    <Plus size={10} /> Spawn Worker
                  </button>
                  <button
                    onClick={() => ws?.send(JSON.stringify({ type: 'terminate-worker' }))}
                    className="flex-1 py-1.5 bg-rose-600/25 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-500 text-rose-400 hover:text-white text-[9px] font-black rounded transition-all uppercase flex items-center justify-center gap-1 shadow-sm h-7"
                    disabled={(!telemetry.spawnedWorkers || telemetry.spawnedWorkers.length === 0)}
                  >
                    <Minus size={10} /> Kill Last
                  </button>
                </div>

                {/* Capacity Adjuster */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[8px] text-slate-500 uppercase">
                    <span>Pool max capacity</span>
                    <span className="text-white font-bold">{telemetry.maxWorkers} THREADS</span>
                  </div>
                  <input 
                    type="range"
                    min="10"
                    max="128"
                    step="5"
                    value={telemetry.maxWorkers}
                    onChange={(e) => ws?.send(JSON.stringify({ type: 'set-max-workers', limit: parseInt(e.target.value) }))}
                    className="w-full accent-emerald-500 bg-slate-800 h-1 rounded outline-none cursor-ew-resize border-none"
                  />
                </div>

                {/* Thread pool stats banner */}
                <div className="text-[8px] bg-slate-900/50 p-2 rounded border border-slate-800/40 flex justify-between text-slate-400">
                  <span>THREADS: {telemetry.activeWorkers}/{telemetry.maxWorkers}</span>
                  <span>CLIENTS: {telemetry.clientCount}</span>
                </div>

                {/* Active Worker Grid List */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                  {!telemetry.spawnedWorkers || telemetry.spawnedWorkers.length === 0 ? (
                    <div className="p-4 text-center border border-dashed border-slate-805 rounded text-slate-600 text-[9px] uppercase">
                      No background active threads.
                    </div>
                  ) : (
                    telemetry.spawnedWorkers.map((worker) => (
                      <div 
                        key={worker.id}
                        className="p-2 bg-slate-900/40 border border-slate-800/60 rounded flex items-center justify-between text-[9px]"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Cpu size={12} className={cn(
                            worker.status === 'ACTIVE' ? "text-amber-500 animate-pulse" : "text-slate-600"
                          )} />
                          <div className="min-w-0">
                            <div className="text-slate-300 font-bold truncate tracking-tight">{worker.name}</div>
                            <div className="text-[7.5px] text-slate-500 truncate flex items-center gap-1 uppercase tracking-tight">
                              <span className={cn(
                                "w-1 h-1 rounded-full",
                                worker.status === 'ACTIVE' ? "bg-amber-400 animate-pulse" : "bg-slate-500"
                              )}></span>
                              <span>{worker.task}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 ml-2 shrink-0">
                          <span className="text-[8px] text-slate-600 font-black">{worker.activeTime}s</span>
                          <button
                            onClick={() => ws?.send(JSON.stringify({ type: 'terminate-worker', id: worker.id }))}
                            className="p-0.5 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/50 rounded text-slate-600 hover:text-rose-500 transition-all"
                            title="Kill Thread"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab System */}
        {(view === 'debugger' || view === 'lab') && (
          <div className="h-10 flex border-b border-slate-800 bg-[#0F1115] shrink-0 overflow-x-auto no-scrollbar">
            {tabs.map(tab => (
              <div 
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={cn(
                  "group flex items-center gap-3 px-4 min-w-[120px] max-w-[180px] border-r border-slate-800 cursor-pointer transition-all relative select-none",
                  tab.id === activeTabId ? "bg-black" : "hover:bg-white/5"
                )}
              >
                <span className={cn(
                  "text-[10px] font-mono truncate uppercase flex-1 tracking-tight",
                  tab.id === activeTabId ? "text-white font-bold" : "text-slate-600"
                )}>
                  {tab.name}
                </span>
                <button 
                  onClick={(e) => closeTab(e, tab.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/5 rounded text-slate-600 hover:text-rose-500 transition-all"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            <button 
              onClick={() => createTab()}
              className="flex items-center justify-center px-4 border-r border-slate-800 hover:bg-white/5 text-slate-700 transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
        )}

        {/* Workspace Panels */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {view === 'debugger' && (
              <motion.div 
                key="debugger"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 flex flex-col lg:flex-row gap-0 overflow-hidden"
              >
                {/* Active Tab Panel */}
                <div className="w-full lg:w-1/2 border-r border-slate-800 flex flex-col bg-[#0B0D11] overflow-y-auto no-scrollbar">
                  <div className="p-4 border-b border-slate-800 flex flex-col gap-4 shrink-0">
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                      {[
                        { name: 'Reset', url: 'http://localhost:3000/api/race-demo/reset', method: 'POST' },
                        { name: 'Broken_Buy', url: 'http://localhost:3000/api/orders/broken/place', method: 'POST' },
                        { name: 'Fixed_Buy', url: 'http://localhost:3000/api/orders/fixed/place', method: 'POST' }
                      ].map(ep => (
                        <button 
                          key={ep.name}
                          onClick={() => updateActiveConfig({ url: ep.url, method: ep.method as any })}
                          className="text-[9px] font-mono bg-slate-900/50 border border-slate-800 px-2 py-0.5 rounded text-slate-500 hover:text-emerald-500 hover:border-emerald-500/30 transition-all uppercase whitespace-nowrap"
                        >
                          {ep.name}
                        </button>
                      ))}
                    </div>
                    
                    <div className="flex gap-0 ring-1 ring-slate-800 rounded bg-[#0F1115] overflow-hidden focus-within:ring-emerald-500/50 transition-all">
                      <select
                        value={activeTab.config.method}
                        onChange={(e) => updateActiveConfig({ method: e.target.value as any })}
                        className="bg-transparent text-amber-500 font-bold font-mono text-[11px] px-4 outline-none cursor-pointer border-r border-slate-800 h-10 appearance-none text-center"
                      >
                        {METHODS.map(m => <option key={m} value={m} className="bg-slate-900 border-none">{m}</option>)}
                      </select>
                      <input
                        type="text"
                        value={activeTab.config.url}
                        onChange={(e) => updateActiveConfig({ url: e.target.value })}
                        placeholder="URL_ENDPOINT_INPUT"
                        className="flex-1 bg-transparent px-4 text-[11px] font-mono text-emerald-400 placeholder:text-slate-700 outline-none h-10"
                      />
                      <button
                        onClick={activeTab.loading ? handleAbort : handleRun}
                        className={cn(
                          "px-6 text-[10px] font-mono font-bold transition-all text-white active:scale-95 h-10 flex items-center justify-center gap-2 border-l border-slate-800",
                          activeTab.loading ? "bg-rose-600/85 hover:bg-rose-600" : "bg-emerald-600/85 hover:bg-emerald-600"
                        )}
                      >
                        {activeTab.loading ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} fill="currentColor" />}
                        {activeTab.loading ? 'ABORT' : 'EXEC'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={saveToCollection}
                          className="p-1 px-2 border border-slate-800 rounded text-[9px] font-mono text-slate-500 hover:text-white flex items-center gap-1.5 uppercase transition-colors"
                        >
                          <Save size={10} /> SAVE
                        </button>
                        <div className="h-4 w-px bg-slate-800 mx-1"></div>
                        {['Single', 'Batch'].map(mode => (
                          <button
                            key={mode}
                            onClick={() => updateActiveTab({ batchMode: mode === 'Batch' })}
                            className={cn(
                              "px-2 py-0.5 rounded text-[9px] font-mono border transition-all uppercase",
                              (mode === 'Batch' && activeTab.batchMode) || (mode === 'Single' && !activeTab.batchMode)
                                ? "bg-white text-black border-white"
                                : "bg-transparent border-slate-800 text-slate-500"
                            )}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                      <button 
                        onClick={() => updateActiveTab({ showCurl: !activeTab.showCurl })}
                        className={cn(
                          "text-[9px] font-mono flex items-center gap-1 uppercase tracking-widest transition-colors",
                          activeTab.showCurl ? "text-emerald-400" : "text-slate-600 hover:text-slate-400"
                        )}
                      >
                        <Terminal size={10} /> {activeTab.showCurl ? 'HIDE_CURL' : 'SHOW_CURL'}
                      </button>
                      <div className="h-4 w-px bg-slate-800 mx-1"></div>
                      <button 
                        onClick={() => {
                          const resolved = getResolvedConfig(activeTab);
                          const curl = `curl -X ${resolved.method} "${resolved.url}" ${Object.entries(resolved.headers).map(([k,v]) => `-H "${k}: ${v}"`).join(' ')} ${resolved.body ? `-d '${resolved.body}'` : ''}`;
                          navigator.clipboard.writeText(curl);
                        }}
                        className="text-[9px] font-mono text-slate-600 hover:text-emerald-400 flex items-center gap-1 uppercase tracking-widest"
                      >
                        <Copy size={10} /> COPY_CURL
                      </button>
                    </div>

                    {activeTab.showCurl && (
                      <div className="p-4 bg-black border border-emerald-500/20 rounded font-mono space-y-3 relative group overflow-hidden shadow-2xl">
                        <div className="absolute top-0 left-0 w-[2px] h-full bg-emerald-500"></div>
                        <div className="flex items-center justify-between opacity-50 group-hover:opacity-100 transition-opacity">
                          <span className="text-emerald-500 font-bold text-[9px] tracking-[0.2em]">CURL_ORCHESTRATION_PREVIEW</span>
                          <span className="text-slate-700 text-[9px] font-black">{activeTab.batchMode ? 'CONCURRENT_BATCH' : 'SINGLE_THREAD'}</span>
                        </div>
                        <pre className="text-emerald-400 text-xs whitespace-pre-wrap break-all leading-relaxed max-h-60 overflow-y-auto no-scrollbar selection:bg-emerald-500/30">
                          {(() => {
                            const resolved = getResolvedConfig(activeTab);
                            const isGraphql = resolved.method === 'GRAPHQL';
                            const method = isGraphql ? 'POST' : resolved.method;
                            const finalHeaders = { ...resolved.headers };
                            if (isGraphql && !finalHeaders['Content-Type']) {
                              finalHeaders['Content-Type'] = 'application/json';
                            }
                            
                            const headerString = Object.entries(finalHeaders)
                              .map(([k,v]) => `-H "${k}: ${v}"`)
                              .join(' ');
                              
                            const baseCurl = `curl -X ${method} "${resolved.url}" ${headerString} ${resolved.body ? `-d '${resolved.body.replace(/'/g, "'\\''")}'` : ''}`;
                            
                            if (activeTab.batchMode) {
                              return `# CONCURRENT_BATCH_MODE (10 REQS / 5 THREADS)\nseq 10 | xargs -I {} -P 5 ${baseCurl}`;
                            }
                            return baseCurl;
                          })()}
                        </pre>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                     {/* Parameters and Body implementation */}
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
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest flex items-center gap-2">
                             <FileJson size={10} /> Payload_JSON
                          </label>
                          <button 
                            onClick={() => {
                               try {
                                 const obj = JSON.parse(activeTab.config.body || '');
                                 updateActiveConfig({ body: JSON.stringify(obj, null, 2) });
                               } catch (e) {
                                 showCustomAlert('INVALID JSON', 'Malformed syntax detected. Ensure keys and values are properly quoted.');
                               }
                            }}
                            className="text-[9px] font-mono text-slate-600 hover:text-emerald-500 uppercase transition-colors"
                          >
                            Prettify_JSON
                          </button>
                        </div>
                        <textarea
                          value={activeTab.config.body}
                          onChange={(e) => updateActiveConfig({ body: e.target.value })}
                          className="w-full bg-black border border-slate-850 rounded p-3 font-mono text-[11px] text-emerald-450/80 outline-none h-40 resize-none"
                        />
                      </section>
                     )}

                     {activeTab.config.method === 'GRAPHQL' && (
                      <section className="space-y-6">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-3 flex items-center gap-2">
                             <Layers size={10} className="text-violet-500" /> GraphQL_Query
                          </label>
                          <textarea
                            value={activeTab.graphqlQuery || ''}
                            onChange={(e) => updateActiveTab({ graphqlQuery: e.target.value })}
                            placeholder="query MyQuery { ... }"
                            className="w-full bg-black border border-slate-800 rounded p-3 font-mono text-[11px] text-violet-400/80 outline-none h-48 resize-none shadow-inner"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest flex items-center gap-2">
                               <Database size={10} className="text-blue-500" /> Variables_JSON
                            </label>
                            <button 
                              onClick={() => {
                                 try {
                                   const obj = JSON.parse(activeTab.graphqlVariables || '{}');
                                   updateActiveTab({ graphqlVariables: JSON.stringify(obj, null, 2) });
                                 } catch (e) {
                                   showCustomAlert('INVALID JSON', 'Malformed syntax in GraphQL variables detector. Ensure keys and values are properly quoted.');
                                 }
                              }}
                              className="text-[9px] font-mono text-slate-600 hover:text-blue-400 uppercase transition-colors"
                            >
                              Format_Vars
                            </button>
                          </div>
                          <textarea
                            value={activeTab.graphqlVariables || ''}
                            onChange={(e) => updateActiveTab({ graphqlVariables: e.target.value })}
                            placeholder='{ "id": 1 }'
                            className="w-full bg-black border border-slate-800 rounded p-3 font-mono text-[11px] text-blue-400/80 outline-none h-24 resize-none"
                          />
                        </div>
                      </section>
                     )}
                  </div>
                </div>

                <div className="w-full lg:w-1/2 flex flex-col bg-black overflow-hidden border-t lg:border-t-0 border-slate-850">
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
              </motion.div>
            )}

            {view === 'lab' && (
              <motion.div 
                key="lab"
                initial={{ opacity: 0, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.99 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 overflow-hidden"
              >
                <TestLab 
                  config={activeTab.config}
                  headersList={activeTab.headersList}
                  ws={ws}
                  activeTabId={activeTabId}
                  loading={activeTab.loading}
                  progress={activeTab.progress}
                  results={activeTab.batchResults}
                  onStart={handleStartLabTest}
                  onAbort={handleAbort}
                />
              </motion.div>
            )}

            {view === 'variables' && (
              <motion.div 
                key="variables"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 overflow-y-auto p-8 custom-scrollbar bg-[#0B0D11]"
              >
                <div className="max-w-4xl mx-auto">
                  <VariablesManager variables={variables} onVariablesChange={setVariables} />
                </div>
              </motion.div>
            )}

            {view === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 overflow-y-auto p-8 custom-scrollbar bg-[#0B0D11]"
              >
                <div className="max-w-4xl mx-auto flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between mb-4 shrink-0">
                     <h2 className="text-sm font-bold text-slate-300 font-mono tracking-widest flex items-center gap-2 uppercase">
                        <History size={14} className="text-emerald-500" /> System_History_Logs
                     </h2>
                     <div className="text-[9px] text-slate-500 font-mono bg-slate-800 px-2 py-1 rounded">RETENTION: 100_ENTRIES</div>
                  </div>
                  <HistoryList />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nominal status footer */}
        <footer className="h-8 border-t border-[#1E293B] bg-[#0F1115] flex items-center justify-between px-4 text-[10px] font-mono text-slate-500 shrink-0">
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> SYSTEM: NOMINAL
            </span>
            <span>LATENCY: {telemetry.latency}</span>
            <span>THREADS: {telemetry.activeWorkers}/{telemetry.maxWorkers}</span>
            <span className="opacity-50">|</span>
            <span>CLIENTS: {telemetry.clientCount}</span>
          </div>
          <div className="flex gap-4">
            <span>v0.4.2-alpha</span>
            <span className="text-slate-300 underline cursor-pointer hover:text-emerald-400">VIEW_RAW_LOGS</span>
          </div>
        </footer>
      </main>

      {/* Custom Terminal Dialog Modal Overlay */}
      <AnimatePresence>
        {dialog.isOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 font-mono select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="w-full max-w-sm bg-[#12161E] border border-slate-800 rounded-lg shadow-2xl overflow-hidden text-slate-300"
            >
              {/* Modal Header */}
              <div className="px-4 py-3 bg-[#161B25] border-b border-slate-800 flex justify-between items-center shrink-0">
                <span className="text-[10px] font-black tracking-widest text-emerald-400 flex items-center gap-2 uppercase">
                  <Terminal size={12} /> {dialog.title}
                </span>
                <button
                  onClick={() => setDialog(prev => ({ ...prev, isOpen: false }))}
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4">
                <p className="text-[10px] text-slate-400 leading-normal uppercase font-mono">
                  {dialog.message}
                </p>

                {/* PROMPT_TEXT Field */}
                {dialog.type === 'PROMPT_TEXT' && (
                  <input
                    type="text"
                    value={dialog.inputVal || ''}
                    onChange={(e) => setDialog(prev => ({ ...prev, inputVal: e.target.value }))}
                    className="w-full bg-black border border-slate-800 rounded p-2 text-[11px] font-mono text-emerald-400 focus:border-slate-700 outline-none uppercase"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        dialog.onConfirm(dialog.inputVal);
                      }
                    }}
                  />
                )}

                {/* SAVE_REQUEST Multi-Field layout */}
                {dialog.type === 'SAVE_REQUEST' && (
                  <div className="space-y-3 font-mono">
                    <div className="space-y-1">
                      <label className="text-[8px] text-slate-500 uppercase tracking-widest block font-bold">Request Identifier</label>
                      <input
                        type="text"
                        value={dialog.inputVal || ''}
                        onChange={(e) => setDialog(prev => ({ ...prev, inputVal: e.target.value }))}
                        className="w-full bg-black border border-slate-800 rounded p-2 text-[11px] text-emerald-400 focus:border-slate-700 outline-none"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] text-slate-500 uppercase tracking-widest block font-bold">Target Collection</label>
                      <select
                        value={dialog.selectedColId || ''}
                        onChange={(e) => setDialog(prev => ({ ...prev, selectedColId: e.target.value }))}
                        className="w-[#100%] bg-black border border-slate-800 rounded p-2 text-[11px] text-slate-300 focus:border-slate-700 outline-none"
                      >
                        {collections.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer / Interactive Buttons */}
              <div className="px-5 py-3.5 bg-[#10141C] border-t border-slate-850 flex justify-end gap-2.5">
                {dialog.type !== 'ALERT' && (
                  <button
                    onClick={() => setDialog(prev => ({ ...prev, isOpen: false }))}
                    className="px-3 py-1 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-[9px] font-bold text-slate-400 hover:text-white rounded uppercase tracking-wider transition-all"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={() => {
                    if (dialog.type === 'SAVE_REQUEST') {
                      dialog.onConfirm(dialog.inputVal, dialog.selectedColId);
                    } else if (dialog.type === 'PROMPT_TEXT') {
                      dialog.onConfirm(dialog.inputVal);
                    } else {
                      dialog.onConfirm();
                    }
                  }}
                  className="px-4 py-1 bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/30 hover:border-emerald-500 text-emerald-400 hover:text-white text-[9px] font-black uppercase tracking-wider rounded transition-all shadow-sm"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Keep original sub-components below with minor tweaks for tabs if needed...// Sub-components
function ResponseViewer({ result, loading, onAbort }: { result: CurlResult | null, loading: boolean, onAbort: () => void }) {
  const [activeResTab, setActiveResTab] = useState<'body' | 'headers' | 'raw' | 'result'>('body');

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden bg-black/80 space-y-8">
        <div className="text-center space-y-4 relative z-10">
          <div className="relative mx-auto w-12 h-12 flex items-center justify-center">
            <RefreshCw size={24} className="text-emerald-500 animate-spin" />
            <div className="absolute inset-0 bg-emerald-500/10 blur-2xl animate-pulse"></div>
          </div>
          <div className="space-y-1">
            <p className="text-emerald-500/80 font-black text-[12px] tracking-[0.3em] uppercase">EXECUTING_CALL</p>
            <p className="text-slate-600 font-mono text-[9px] uppercase tracking-widest">Awaiting_Server_Response...</p>
          </div>
        </div>
        <button 
          onClick={onAbort}
          className="px-8 py-2.5 border border-rose-500/20 text-rose-500 font-black text-[10px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all rounded active:scale-95 relative z-10"
        >
          SIGINT_ABORT
        </button>

        {/* Cinematic background scanline */}
        <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-700 bg-[#07080A]">
        <div className="p-4 rounded-full border-2 border-dashed border-slate-800/50 mb-8 opacity-20">
          <Terminal size={40} />
        </div>
        <h3 className="font-black text-slate-600 text-[11px] tracking-[0.4em] uppercase mb-3">STDIN_AWAITING</h3>
        <p className="text-[9px] max-w-[200px] font-mono uppercase leading-relaxed text-slate-700 tracking-tighter">
          Instrument your request configurations to begin automated telemetry capture.
        </p>
      </div>
    );
  }

  const isSuccess = result.status >= 200 && result.status < 300;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-black">
      <div className="flex items-center justify-between p-2 px-4 border-b border-slate-900 bg-[#0F1115] shrink-0">
         <div className="flex items-center gap-6">
           <div className="flex flex-col">
              <span className="text-[7px] font-black text-slate-600 uppercase tracking-tighter">HTTP_STATUS</span>
              <span className={cn("text-[11px] font-black tracking-tight", isSuccess ? "text-emerald-500" : "text-rose-500")}>
                {result.status} {isSuccess ? 'SUCCESS' : 'FAILURE'}
              </span>
           </div>
           <div className="flex flex-col">
              <span className="text-[7px] font-black text-slate-600 uppercase tracking-tighter">RESPONSE_TIME</span>
              <span className="text-[11px] font-black text-blue-400 font-mono">
                {result.responseTime}ms
              </span>
           </div>
         </div>
         <div className="flex gap-1 bg-black/40 p-1 rounded border border-slate-800">
           {(['body', 'headers', 'raw', 'result'] as const).map(tab => (
             <button 
               key={tab}
               onClick={() => setActiveResTab(tab)}
               className={cn(
                 "text-[9px] px-2 py-1 rounded-[1px] font-black transition-all uppercase tracking-widest", 
                 activeResTab === tab ? "bg-slate-800 text-white" : "text-slate-600 hover:text-slate-400"
               )}
             >
               {tab}
             </button>
           ))}
         </div>
      </div>

      <div className="flex-1 overflow-auto p-8 font-mono text-xs leading-relaxed custom-scrollbar selection:bg-emerald-500/20 text-emerald-500/90">
        {result.error && activeResTab === 'body' ? (
           <div className="text-rose-400 bg-rose-500/5 p-6 rounded border border-rose-500/10 backdrop-blur-sm">
             <div className="text-[11px] font-black mb-4 uppercase tracking-[0.2em] opacity-80 flex items-center gap-3">
                <AlertTriangle size={16} /> EXCEPTION_CAUGHT
             </div>
             <pre className="whitespace-pre-wrap break-all text-[11px] leading-relaxed opacity-90 font-medium">{result.error}</pre>
           </div>
        ) : (
           <div className="space-y-0 break-all">
             {activeResTab === 'body' && (() => {
               const bodyStr = (result.body || '').trim();
               try {
                 const json = JSON.parse(bodyStr);
                 return <JsonPretty data={json} />;
               } catch {
                 // Check if it looks like HTML
                 if (bodyStr.startsWith('<!DOCTYPE') || bodyStr.startsWith('<html') || bodyStr.startsWith('<div')) {
                   return (
                     <div className="space-y-4">
                       <div className="flex items-center justify-between p-2 bg-amber-500/10 border border-amber-500/20 rounded">
                         <div className="flex items-center gap-2 text-amber-500 text-[10px] uppercase font-bold tracking-widest">
                           <AlertTriangle size={12} /> HTML_DOCUMENT_DETECTED
                         </div>
                         <button 
                           onClick={() => {
                             const blob = new Blob([result.body || ''], { type: 'text/html' });
                             const url = URL.createObjectURL(blob);
                             window.open(url, '_blank');
                           }}
                           className="text-[9px] font-bold text-amber-600 hover:text-amber-500 underline uppercase"
                         >
                           Render_Page
                         </button>
                       </div>
                       <div className="opacity-60 font-sans text-[10px] bg-slate-900/50 p-4 rounded border border-slate-800 break-words whitespace-pre-wrap max-h-[400px] overflow-y-auto custom-scrollbar">
                         {result.body || ''}
                       </div>
                     </div>
                   );
                 }
                 return <span className="opacity-80 block whitespace-pre-wrap">{result.body || ''}</span>;
               }
             })()}
             
             {activeResTab === 'headers' && (
               <div className="space-y-2">
                 {(Object.entries(result.headers) as [string, string][]).map(([k, v]) => (
                   <div key={k} className="flex gap-4 border-b border-slate-900 pb-2">
                      <span className="text-blue-500 font-black w-1/3 shrink-0 uppercase text-[9px] tracking-tight">{k}</span>
                      <span className="text-slate-400 flex-1 break-all">{v}</span>
                   </div>
                 ))}
               </div>
             )}

             {activeResTab === 'raw' && (
               <div className="text-slate-600 text-[10px] leading-tight whitespace-pre-wrap break-all">
                 {result.rawOutput}
               </div>
             )}

             {activeResTab === 'result' && (
               <JsonPretty data={result} />
             )}
           </div>
        )}
      </div>
    </div>
  );
}

function JsonPretty({ data, level = 0 }: { data: any, level?: number }) {
   if (data === null) return <span className="text-slate-500 font-bold italic">null</span>;
   if (typeof data === 'string') return <span className="text-emerald-400 break-all">"{data}"</span>;
   if (typeof data === 'number') return <span className="text-amber-400 font-bold">{data}</span>;
   if (typeof data === 'boolean') return <span className="text-blue-400 font-black">{data.toString()}</span>;
   
   const indent = "  ".repeat(level);
   const nextIndent = "  ".repeat(level + 1);

   if (Array.isArray(data)) {
     if (data.length === 0) return <span className="text-slate-600">[]</span>;
     return (
       <div className="font-mono">
         <span className="text-slate-500">[</span>
         <div className="ml-4">
           {data.map((item, i) => (
             <div key={i} className="py-0.5">
               <JsonPretty data={item} level={level + 1} />{i < data.length - 1 ? <span className="text-slate-600">,</span> : ''}
             </div>
           ))}
         </div>
         <span className="text-slate-500">]</span>
       </div>
     );
   }

   if (typeof data === 'object') {
     const entries = Object.entries(data);
     if (entries.length === 0) return <span className="text-slate-600">{"{}"}</span>;
     return (
       <div className="font-mono">
         <span className="text-slate-500">{"{"}</span>
         <div className="ml-4">
           {entries.map(([key, value], i) => (
             <div key={key} className="py-0.5 flex gap-2">
               <span className="text-blue-400 shrink-0">"{key}"</span>
               <span className="text-slate-600">:</span>
               <div className="flex-1 min-w-0">
                 <JsonPretty data={value} level={level + 1} />{i < entries.length - 1 ? <span className="text-slate-600">,</span> : ''}
               </div>
             </div>
           ))}
         </div>
         <span className="text-slate-500">{"}"}</span>
       </div>
     );
   }
   return <span>{String(data)}</span>;
}

function BatchViewer({ results, progress, concurrency, onAbort }: { results: CurlResult[], progress: ProgressUpdate | null, concurrency: number, onAbort: () => void }) {
  const [selectedResult, setSelectedResult] = useState<CurlResult | null>(null);
  const successCount = results.filter(r => r.status >= 200 && r.status < 300).length;
  const failureCount = results.length - successCount;
  const avgResponseTime = results.length > 0 
    ? (results.reduce((acc, r) => acc + r.responseTime, 0) / results.length)
    : 0;
  const avgResponseTimeStr = avgResponseTime.toFixed(0);

  if (selectedResult) {
    return (
      <div className="flex flex-col h-full bg-black relative">
        <div className="p-3 px-4 border-b border-slate-900 bg-[#0F1115] flex items-center justify-between shrink-0">
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
    <div className="flex flex-col h-full bg-black text-slate-300">
      <div className="p-6 border-b border-slate-900 bg-[#0F1115] shrink-0 space-y-6">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
             <div className="p-1.5 bg-amber-500/10 rounded border border-amber-500/20">
               <Layers size={16} className="text-amber-500" />
             </div>
             <div>
               <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] leading-none">STREAM_ORCHESTRATOR</h3>
               <p className="text-[8px] text-slate-500 font-mono mt-1 uppercase tracking-widest">Multi-Threaded_Execution_Telemetry</p>
             </div>
           </div>
           {progress && (
             <div className="flex items-center gap-3">
               <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/5 border border-emerald-500/10 rounded">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></div>
                 <span className="text-[9px] font-black text-emerald-500 uppercase tracking-tighter">RUNNING</span>
               </div>
               <button 
                 onClick={onAbort}
                 className="text-[9px] font-black text-slate-400 border border-slate-800 px-3 py-1 rounded hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all uppercase tracking-widest"
               >
                 SIGINT
               </button>
             </div>
           )}
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-end">
            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
              PROGRESS <span className="text-white ml-2 font-mono">{progress ? progress.completed : results.length} / {progress ? progress.total : results.length}</span>
            </div>
            <div className="text-[11px] font-black text-emerald-500 font-mono">
              {progress && progress.total > 0 ? ((progress.completed / progress.total) * 100).toFixed(1) : (results.length > 0 ? '100.0' : '0.0')}%
            </div>
          </div>
          <div className="h-1 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <motion.div 
               className="h-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
               initial={{ width: 0 }}
               animate={{ width: `${progress && progress.total > 0 ? (progress.completed / progress.total) * 100 : (results.length > 0 ? 100 : 0)}%` }}
               transition={{ type: 'spring', damping: 20, stiffness: 40 }}
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
           {[
             { label: 'PASSED', val: successCount, color: 'text-emerald-500' },
             { label: 'FAILED', val: failureCount, color: 'text-rose-500' },
             { label: 'AVG_LAT', val: `${avgResponseTimeStr}ms`, color: 'text-blue-400' },
             { label: 'THREAD', val: progress ? concurrency : '-', color: 'text-amber-500' }
           ].map(stat => (
             <div key={stat.label} className="space-y-1">
               <div className="text-[7px] font-black text-slate-600 uppercase tracking-[0.2em]">{stat.label}</div>
               <div className={cn("text-base font-black font-mono leading-none", stat.color)}>{stat.val}</div>
             </div>
           ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-6 py-2 border-b border-slate-900 bg-black/40 flex items-center justify-between shrink-0">
           <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">TELEMETRY_LOGS</span>
           <div className="text-[8px] font-mono text-slate-700 tracking-tighter uppercase">SESSION_RETAIN: 50</div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 px-6 custom-scrollbar space-y-1 bg-black">
          <AnimatePresence initial={false}>
            {[...results].slice(-50).reverse().map((res, i) => (
              <motion.div 
                key={res.id}
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                onClick={() => setSelectedResult(res)}
                className="group flex border-l-[2px] border-slate-800 hover:border-white py-1.5 pl-4 hover:bg-white/5 transition-all cursor-pointer items-center min-h-[32px]"
              >
                <span className="text-slate-600 w-16 shrink-0 font-mono text-[9px] font-black">-{res.responseTime}ms</span>
                <span className={cn("w-14 font-black text-[10px]", res.status < 300 ? "text-emerald-500" : "text-rose-500")}>
                  [{res.status}]
                </span>
                <span className="text-slate-500 flex-1 truncate uppercase tracking-tighter font-mono group-hover:text-white transition-colors text-[9px]">
                  INSTANCE::{res.id.split('-').pop()} ➔ {res.status < 400 ? 'SUCCESS' : 'FAILURE'}
                </span>
                <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[8px] font-black text-white bg-slate-800 px-2 py-0.5 rounded tracking-widest">DRYLOAD</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {results.length === 0 && !progress && (
            <div className="h-full flex flex-col items-center justify-center opacity-20 text-center space-y-4">
              <div className="w-12 h-12 border-2 border-dashed border-slate-700 rounded-full flex items-center justify-center animate-spin-slow">
                 <Activity size={24} />
              </div>
              <div className="uppercase tracking-[0.4em] font-black text-[10px]">Standby_Stream_Init</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
