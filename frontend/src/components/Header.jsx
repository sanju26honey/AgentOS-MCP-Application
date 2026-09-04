import React from 'react';
import { Activity, Sparkles, ShoppingBag } from 'lucide-react';

export function Header({ currentView, onViewChange }) {
  const isLight = currentView === 'storefront' || currentView === 'agent';

  return (
    <header className={`sticky top-0 z-50 h-20 w-full flex items-center justify-center px-margin-mobile md:px-margin-desktop font-sans backdrop-blur-xl transition-colors duration-300 ${
      isLight 
        ? 'bg-white/90 border-b border-slate-200 text-slate-900 shadow-xs' 
        : 'bg-slate-950/80 border-b border-white/10 text-white'
    }`}>
      <div className="w-full max-w-[1180px] flex items-center justify-between">
        {/* Brand & View Switcher */}
        <div className="flex items-center gap-6">
          <span className={`font-sans text-2xl md:text-3xl font-bold tracking-tighter transition-colors duration-300 ${
            isLight ? 'text-[#191c1e]' : 'text-primary glow-text'
          }`}>
            AgentOS
          </span>

          {/* View Navigation Switcher */}
          <div className={`flex items-center p-1 rounded-xl border transition-colors duration-300 ${
            isLight ? 'bg-slate-100 border-slate-200/90' : 'bg-surface-container-low/80 border-white/10'
          }`}>
            <button
              onClick={() => onViewChange('merchant')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                currentView === 'merchant'
                  ? 'bg-primary-container text-white shadow-md font-bold'
                  : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                    : 'text-on-surface-variant hover:text-white hover:bg-white/5'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Merchant Dashboard</span>
            </button>

            <button
              onClick={() => onViewChange('storefront')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                currentView === 'storefront'
                  ? 'bg-sky-600 text-white shadow-md font-bold'
                  : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                    : 'text-on-surface-variant hover:text-white hover:bg-white/5'
              }`}
            >
              <ShoppingBag className={`w-3.5 h-3.5 ${currentView === 'storefront' ? 'text-white' : isLight ? 'text-[#4648d4]' : 'text-sky-300'}`} />
              <span>Store</span>
            </button>

            <button
              onClick={() => onViewChange('agent')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                currentView === 'agent'
                  ? 'bg-gradient-to-r from-agent-violet to-agent-indigo text-white shadow-md font-bold'
                  : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                    : 'text-on-surface-variant hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${currentView === 'agent' ? 'text-amber-300' : isLight ? 'text-purple-600' : 'text-amber-300'}`} />
              <span>Customer AI Agent</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
