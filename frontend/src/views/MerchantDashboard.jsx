import React, { useState, useEffect } from 'react';
import { MetricsOverview } from '../components/MetricsOverview';
import { PolicyEngineCard } from '../components/PolicyEngineCard';
import { PerformanceChart } from '../components/PerformanceChart';
import { LiveAuditTable } from '../components/LiveAuditTable';
import { OrderDetailsModal } from '../components/OrderDetailsModal';

export function MerchantDashboard({ onSseStatusChange, onDbEngineChange }) {
  const [stats, setStats] = useState(() => {
    try {
      const cached = localStorage.getItem('dashboard_metrics_stats');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {}
    return null;
  });
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [isLoading, setIsLoading] = useState(() => !stats);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/dashboard/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        try {
          localStorage.setItem('dashboard_metrics_stats', JSON.stringify(data));
        } catch (e) {}
        if (onDbEngineChange && data.db_engine) {
          onDbEngineChange(data.db_engine);
        }
      }
    } catch (e) {
      console.error('Failed to fetch dashboard stats:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const handlePolicyUpdate = (newCap) => {
    fetchStats();
  };

  return (
    <div className="relative z-10 flex flex-col min-h-screen">
      
      {/* Ambient Nebulas Background */}
      <div className="fixed top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-[#8b5cf6] opacity-[0.08] blur-[120px] pointer-events-none z-0"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#3395ff] opacity-[0.06] blur-[100px] pointer-events-none z-0"></div>

      <main className="flex-1 w-full max-w-[1180px] mx-auto px-margin-mobile md:px-margin-desktop py-8 md:py-10 flex flex-col gap-6 md:gap-8 relative z-10">
        
        {/* Dashboard Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-2 animate-fade-in">
          <div>
            <h1 className="text-lg md:text-xl text-white font-bold tracking-tight mb-1">
              Organization Overview
            </h1>
            <p className="text-[11px] md:text-xs text-on-surface-variant max-w-2xl font-sans opacity-80">
              Real-time telemetry and financial traces for all autonomous vendor operations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchStats}
              className="glass-panel px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-[11px] font-sans text-on-surface hover:bg-white/5 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Refresh Metrics
            </button>
          </div>
        </div>

        {/* Top Row: Financial & System Stats */}
        <MetricsOverview stats={stats || {}} isLoading={isLoading} />

        {/* Middle Row: Bento Box (Policy Engine & Performance Chart) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
          <PolicyEngineCard
            currentCap={stats?.active_policy?.max_autonomous_txn_limit || 5000}
            onPolicyUpdate={handlePolicyUpdate}
          />
          <PerformanceChart performanceMetrics={stats?.performance_metrics} />
        </div>

        {/* Bottom Row: Live AI Audit Trace Table */}
        <LiveAuditTable onSelectOrder={(orderId) => setSelectedOrderId(orderId)} />

      </main>

      {/* Order Details Modal Overlay */}
      {selectedOrderId && (
        <OrderDetailsModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
        />
      )}

    </div>
  );
}
