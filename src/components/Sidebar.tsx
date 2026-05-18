import React from 'react';
import { Terminal, History, Layers, Menu, X, LucideIcon, Box } from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  isOpen: boolean;
  activeTab: string;
  onTabChange: (tab: any) => void;
}

export function Sidebar({ isOpen, activeTab, onTabChange }: SidebarProps) {
  const items = [
    { id: 'tester', label: 'API Tester', icon: Terminal },
    { id: 'collections', label: 'Collections', icon: Layers },
    { id: 'variables', label: 'Environments', icon: Box },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <aside className={cn(
      "w-60 border-r border-[#1E293B] bg-[#0F1115] flex flex-col transition-all duration-300",
      !isOpen && "w-16"
    )}>
      <div className="p-4 border-b border-[#1E293B] flex items-center justify-between">
        <span className={cn("text-[10px] font-bold text-slate-500 uppercase tracking-widest transition-opacity", !isOpen && "opacity-0")}>
          MENU_SYSTEM
        </span>
        <button className="text-slate-500 hover:text-slate-200 p-1">
          <Menu size={16} />
        </button>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded transition-all group font-mono text-[11px]",
              activeTab === item.id 
                ? "bg-slate-800/50 text-emerald-400 border-l-2 border-emerald-500" 
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            )}
          >
            <item.icon size={16} className={cn(
              "transition-transform",
              activeTab === item.id ? "text-emerald-500" : "group-hover:scale-110"
            )} />
            {isOpen && <span className="font-bold tracking-tight">{item.label.toUpperCase()}</span>}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800 mt-auto">
        <div className={cn("flex items-center gap-2", !isOpen && "justify-center")}>
           <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold">
             DEV
           </div>
           {isOpen && (
             <div className="flex flex-col">
               <span className="text-xs font-bold text-slate-200 leading-none">HyperRoot</span>
               <span className="text-[10px] text-slate-500 font-mono">localhost:3000</span>
             </div>
           )}
        </div>
      </div>
    </aside>
  );
}
