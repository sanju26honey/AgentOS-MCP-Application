import React, { useState, useEffect } from 'react';

export function LiveAuditTable({ onSelectOrder }) {
  const [logs, setLogs] = useState(() => {
    try {
      const cached = localStorage.getItem('live_audit_logs');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load cached audit logs:', e);
    }
    return [];
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(() => logs.length === 0);

  // Persist logs to localStorage when updated
  useEffect(() => {
    if (logs.length > 0) {
      try {
        localStorage.setItem('live_audit_logs', JSON.stringify(logs.slice(0, 50)));
      } catch (e) {}
    }
  }, [logs]);

  // Fetch real logs from database
  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/telemetry/logs?limit=50');
      if (res.ok) {
        const data = await res.json();
        if (data && data.events && data.events.length > 0) {
          const formatted = data.events.map((e) => {
            const payload = e.payload || e.payload_json || {};
            const isPassed = payload.approved === true || payload.status === 'APPROVED_AUTONOMOUS' || payload.target_state === 'RAZORPAY_CAPTURED';
            const resultTag = isPassed ? 'PASSED' : (payload.policy_result || e.policy_result || 'PASSED');
            const timeStr = e.created_at ? (e.created_at.includes('T') ? e.created_at.split('T')[1]?.substring(0, 8) : e.created_at.split(' ')[1] || e.created_at) : 'NOW';

            const amountStr = (() => {
              const rawVal = payload.total_amount || payload.calculated_total || payload.claimed_total || payload.amount || payload.price || payload.arguments?.total_amount || payload.arguments?.max_price || payload.arguments?.price;
              if (rawVal !== undefined && rawVal !== null && !isNaN(Number(rawVal)) && Number(rawVal) > 0) {
                return `₹${Number(rawVal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              }
              const items = payload.items || payload.arguments?.items || [];
              if (Array.isArray(items) && items.length > 0) {
                const sum = items.reduce((acc, item) => acc + (Number(item.unit_price || item.price || 0) * Number(item.quantity || 1)), 0);
                if (sum > 0) return `₹${sum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              }
              return null;
            })();

            return {
              id: e.id,
              order_id: e.order_id || 'N/A',
              user_email: e.user_email || payload.buyer_email || payload.user_email || payload.email || payload.arguments?.buyer_email || 'N/A',
              actor: e.actor || 'AI_BUYER',
              action: e.event_type || e.tool_name || 'POLICY_CHECK',
              amount: amountStr,
              result: resultTag,
              latency: `${e.execution_time_ms ? e.execution_time_ms.toFixed(1) : '1.2'}ms`,
              timestamp: timeStr
            };
          });
          setLogs(formatted);
        }
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    let eventSource = new EventSource('/api/telemetry/stream');
    eventSource.onmessage = (event) => {
      try {
        if (!event.data || event.data.trim() === ': heartbeat') return;
        const data = JSON.parse(event.data);
        if (data.event_type === 'SSE_CONNECTED') return;

        const payload = data.payload || data.payload_json || data.input_payload || {};
        const isPassed = payload.approved === true || payload.status === 'APPROVED_AUTONOMOUS' || payload.target_state === 'RAZORPAY_CAPTURED';
        const resultTag = isPassed ? 'PASSED' : (payload.policy_result || data.policy_result || 'PASSED');
        const timeStr = data.timestamp || data.created_at ? ((data.timestamp || data.created_at).includes('T') ? (data.timestamp || data.created_at).split('T')[1]?.substring(0, 8) : (data.timestamp || data.created_at).split(' ')[1]) : 'NOW';

        const amountStr = (() => {
          const rawVal = payload.total_amount || payload.calculated_total || payload.claimed_total || payload.amount || payload.price || payload.arguments?.total_amount || payload.arguments?.max_price || payload.arguments?.price;
          if (rawVal !== undefined && rawVal !== null && !isNaN(Number(rawVal)) && Number(rawVal) > 0) {
            return `₹${Number(rawVal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          }
          const items = payload.items || payload.arguments?.items || [];
          if (Array.isArray(items) && items.length > 0) {
            const sum = items.reduce((acc, item) => acc + (Number(item.unit_price || item.price || 0) * Number(item.quantity || 1)), 0);
            if (sum > 0) return `₹${sum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          }
          return null;
        })();

        const newLog = {
          id: data.id || Date.now(),
          order_id: data.order_id || 'N/A',
          user_email: data.user_email || payload.buyer_email || payload.user_email || payload.email || payload.arguments?.buyer_email || 'N/A',
          actor: data.actor || 'AI_BUYER',
          action: data.event_type || data.tool_name || 'POLICY_CHECK',
          amount: amountStr,
          result: resultTag,
          latency: `${data.execution_time_ms ? data.execution_time_ms.toFixed(1) : '1.2'}ms`,
          timestamp: timeStr
        };

        setLogs((prev) => [newLog, ...prev].slice(0, 50));
      } catch (e) {
        console.error('Failed to parse SSE payload:', e);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const filteredLogs = logs.filter((l) =>
    l.order_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.actor?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="glass-panel rounded-xl overflow-hidden flex flex-col mt-4">
      {/* Table Header */}
      <div className="p-5 border-b border-white/10 flex justify-between items-center bg-surface-container-low/30">
        <div>
          <h3 className="text-base font-bold text-white mb-0.5">Live AI Audit Trace</h3>
          <p className="text-[11px] text-on-surface-variant">Real-time log of agent activities and policy enforcements.</p>
        </div>

        <div className="relative group">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors text-[16px]">
            search
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search traces..."
            className="bg-surface-container/50 border border-white/10 rounded-lg py-1 pl-8 pr-3 text-[11px] font-sans text-on-surface focus:outline-none focus:border-primary w-44 transition-all duration-300"
          />
        </div>
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="font-mono text-[11px] text-on-surface-variant border-b border-white/5 bg-surface/30">
              <th className="py-3 px-5 font-medium tracking-wider">ORDER ID</th>
              <th className="py-3 px-5 font-medium tracking-wider">USER EMAIL</th>
              <th className="py-3 px-5 font-medium tracking-wider">ACTOR</th>
              <th className="py-3 px-5 font-medium tracking-wider">ACTION</th>
              <th className="py-3 px-5 font-medium tracking-wider">AMOUNT</th>
              <th className="py-3 px-5 font-medium tracking-wider">RESULT</th>
              <th className="py-3 px-5 font-medium tracking-wider">LATENCY</th>
              <th className="py-3 px-5 font-medium tracking-wider text-right">TIMESTAMP</th>
            </tr>
          </thead>
          <tbody className="text-[11px] font-sans divide-y divide-white/5">
            {isLoading ? (
              <tr>
                <td colSpan="8" className="py-8 text-center text-on-surface-variant font-mono">
                  Loading telemetry audit logs...
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="8" className="py-8 text-center text-on-surface-variant font-mono">
                  No AI audit traces recorded in database yet.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log, idx) => (
                <tr
                  key={log.id || idx}
                  onClick={() => log.order_id && log.order_id !== 'N/A' && onSelectOrder(log.order_id)}
                  className="hover:bg-white/[0.04] transition-colors group cursor-pointer"
                >
                  <td className="py-4 px-6 font-mono text-xs text-primary font-medium">
                    {log.order_id}
                  </td>
                  <td className="py-4 px-6 font-mono text-xs text-on-surface-variant truncate max-w-[200px]">
                    {log.user_email && log.user_email !== 'N/A' ? (
                      <span className="text-slate-300 flex items-center gap-1.5" title={log.user_email}>
                        <span className="material-symbols-outlined text-[14px] text-primary/70">alternate_email</span>
                        {log.user_email}
                      </span>
                    ) : (
                      <span className="text-on-surface-variant/50">N/A</span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary-container/20 flex items-center justify-center border border-primary/20">
                        <span className="material-symbols-outlined text-primary text-[14px]">smart_toy</span>
                      </div>
                      <span className="text-white font-medium">{log.actor}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-on-surface-variant font-mono text-xs">
                    {log.action}
                  </td>
                  <td className="py-4 px-6 font-mono text-xs font-semibold">
                    {log.amount ? (
                      <span className="text-emerald-400 font-bold">{log.amount}</span>
                    ) : (
                      <span className="text-slate-500 font-normal">-</span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <span className="px-2.5 py-1 rounded-full bg-[#10B981]/10 text-[#10B981] text-xs font-medium border border-[#10B981]/20 inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span> {log.result}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-mono text-xs text-on-surface-variant">
                    {log.latency}
                  </td>
                  <td className="py-4 px-6 text-right font-mono text-on-surface-variant text-xs">
                    {log.timestamp}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
