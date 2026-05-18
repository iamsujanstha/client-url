import React from 'react';
import { Plus, X, Box, Info } from 'lucide-react';
import { cn } from '../lib/utils';

export interface EnvVar {
  key: string;
  value: string;
}

interface VariablesManagerProps {
  variables: Record<string, string>;
  onVariablesChange: (variables: Record<string, string>) => void;
}

export function VariablesManager({ variables, onVariablesChange }: VariablesManagerProps) {
  const addVar = () => {
    onVariablesChange({ ...variables, '': '' });
  };

  const updateVar = (oldKey: string, newKey: string, value: string) => {
    const next = { ...variables };
    if (oldKey !== newKey) {
      delete next[oldKey];
    }
    next[newKey] = value;
    onVariablesChange(next);
  };

  const removeVar = (key: string) => {
    const next = { ...variables };
    delete next[key];
    onVariablesChange(next);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-sm font-bold text-slate-100 font-mono tracking-widest uppercase flex items-center gap-2">
            <Box size={14} className="text-emerald-500" /> Global_Environments
          </h2>
          <span className="text-[9px] text-slate-500 font-mono uppercase mt-1">Reference variables using {"{{KEY}}"} syntax</span>
        </div>
        <button onClick={addVar} className="button-primary py-1 px-3">
          <Plus size={14} /> Add_Var
        </button>
      </div>

      <div className="flex-1 card-slate p-4 overflow-y-auto space-y-2 custom-scrollbar bg-black/20">
        {Object.entries(variables).length === 0 && (
          <div className="text-center py-20 text-slate-700 font-mono text-xs italic">
            NO_VARIABLES_DEFINED
          </div>
        )}
        {(Object.entries(variables) as [string, string][]).map(([key, value], idx) => (
          <div key={idx} className="flex gap-2">
            <input
              value={key}
              onChange={(e) => updateVar(key, e.target.value, value)}
              placeholder="VARIABLE_NAME"
              className="flex-1 input-accent mono-editor border-slate-800/60 bg-slate-900/40"
            />
            <input
              value={value}
              onChange={(e) => updateVar(key, key, e.target.value)}
              placeholder="Value"
              className="flex-1 input-accent mono-editor border-slate-800/60 bg-slate-900/40"
            />
            <button 
              onClick={() => removeVar(key)}
              className="text-slate-600 hover:text-rose-500 transition-colors p-2"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded flex gap-3">
         <Info size={16} className="text-blue-500 shrink-0" />
         <p className="text-[10px] text-slate-500 font-mono leading-relaxed">
            Variables are resolved client-side before submission. Supports URL, Headers, and JSON Payload. 
            Example: <span className="text-emerald-500">{"{{BASE_URL}}"}</span>/v1/users
         </p>
      </div>
    </div>
  );
}
