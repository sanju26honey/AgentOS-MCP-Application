import React from 'react';

export function MetricsOverview({ stats = {}, isLoading = false }) {
  const {
    total_revenue = 0,
    currency = 'INR',
    captured_orders = 0,
    telemetry_events_count = 0,
    autonomous_percentage = 100
  } = stats;

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      
      {/* Stat Card 1: Total Authorized Revenue */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between hover-lift">
        <div className="flex justify-between items-start mb-4">
          <div className="w-9 h-9 rounded-xl bg-primary-container/20 flex items-center justify-center border border-primary/30 text-primary">
            <span className="material-symbols-outlined text-lg">account_balance</span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981] font-mono text-[11px] border border-[#10B981]/30 flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">trending_up</span> Razorpay Live
          </span>
        </div>
        <div>
          <p className="text-[11px] text-on-surface-variant mb-0.5 font-sans">Total Authorized Revenue</p>
          <h2 className="text-xl md:text-2xl text-white font-bold tracking-tight font-sans">
            {isLoading ? '...' : formatCurrency(total_revenue)}
          </h2>
        </div>
      </div>

      {/* Stat Card 2: Active Audit Traces */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between hover-lift">
        <div className="flex justify-between items-start mb-4">
          <div className="w-9 h-9 rounded-xl bg-secondary-container/20 flex items-center justify-center border border-secondary-container/30 text-secondary">
            <span className="material-symbols-outlined text-lg">receipt_long</span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-white/5 text-on-surface-variant font-mono text-[11px] border border-white/10">Real-Time Ledger</span>
        </div>
        <div>
          <p className="text-[11px] text-on-surface-variant mb-0.5 font-sans">Active Audit Traces</p>
          <h2 className="text-xl md:text-2xl text-white font-bold tracking-tight font-mono">
            {isLoading ? '...' : telemetry_events_count.toLocaleString('en-IN')}
          </h2>
        </div>
      </div>

      {/* Stat Card 3: Autonomous Orders */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between hover-lift relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-container/10 to-transparent pointer-events-none"></div>
        <div className="flex justify-between items-start mb-4 relative z-10">
          <div className="w-9 h-9 rounded-xl bg-tertiary-container/20 flex items-center justify-center border border-tertiary-container/30 text-tertiary">
            <span className="material-symbols-outlined text-lg">smart_toy</span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-primary-container/20 text-primary font-mono text-[11px] border border-primary/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span> {autonomous_percentage}% Auto
          </span>
        </div>
        <div className="relative z-10">
          <p className="text-[11px] text-on-surface-variant mb-0.5 font-sans">Autonomous Orders</p>
          <div className="flex items-baseline gap-1.5">
            <h2 className="text-xl md:text-2xl text-white font-bold tracking-tight font-mono">
              {isLoading ? '...' : captured_orders.toLocaleString('en-IN')}
            </h2>
            <span className="text-on-surface-variant text-[11px] font-mono">orders</span>
          </div>
        </div>
      </div>

    </div>
  );
}
