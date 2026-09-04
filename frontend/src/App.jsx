import React, { useState } from 'react';
import { Header } from './components/Header';
import { MerchantDashboard } from './views/MerchantDashboard';
import { CustomerAgentSandbox } from './views/CustomerAgentSandbox';
import { CustomerStorefront } from './views/CustomerStorefront';

export default function App() {
  const [currentView, setCurrentView] = useState('agent');
  const [isSseConnected, setIsSseConnected] = useState(true);
  const [dbEngine, setDbEngine] = useState('POSTGRESQL');
  const [agentPrompt, setAgentPrompt] = useState('');
  const [agentMaxPrice, setAgentMaxPrice] = useState(10000);

  const handleNavigateToAgent = (prompt, maxPrice) => {
    if (prompt) setAgentPrompt(prompt);
    if (maxPrice) setAgentMaxPrice(maxPrice);
    setCurrentView('agent');
  };

  const isLightView = currentView === 'storefront' || currentView === 'agent';

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${
      isLightView ? 'bg-white text-slate-900' : 'bg-merchant-bg text-slate-100'
    }`}>
      {/* Header Bar */}
      <Header
        currentView={currentView}
        onViewChange={setCurrentView}
        isSseConnected={isSseConnected}
        dbEngine={dbEngine}
      />

      {/* View Switcher Content */}
      <main className="flex-1">
        {currentView === 'merchant' && (
          <MerchantDashboard
            onSseStatusChange={setIsSseConnected}
            onDbEngineChange={setDbEngine}
          />
        )}
        {currentView === 'storefront' && (
          <CustomerStorefront
            onNavigateToAgent={handleNavigateToAgent}
          />
        )}
        {currentView === 'agent' && (
          <CustomerAgentSandbox
            initialPrompt={agentPrompt}
            initialMaxPrice={agentMaxPrice}
          />
        )}
      </main>

      {/* Dynamic Theme Footer */}
      <footer className={`py-4 text-center text-xs font-sans transition-colors duration-300 border-t ${
        isLightView 
          ? 'bg-white border-slate-200 text-slate-500' 
          : 'bg-[#0b0f19] border-white/10 text-slate-400'
      }`}>
        Razorpay AI-Commerce Adapter &copy; 2026 | Track 1: AI Growth & Agentic Commerce
      </footer>
    </div>
  );
}
