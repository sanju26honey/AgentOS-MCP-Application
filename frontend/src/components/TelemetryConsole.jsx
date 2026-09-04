import React, { useState, useEffect } from 'react';
import { Terminal, RefreshCw, Trash2, Pause, Play, ChevronRight, ChevronDown, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export function TelemetryConsole({ onSseStatusChange }) {
  const [logs, setLogs] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [expandedTraceId, setExpandedTraceId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // Initial fetch of historical logs
  const fetchHistoricalLogs = async () => {
    try {
      const res = await fetch('/api/telemetry/logs?limit=50');
      if (res.ok) {
        const data = await res.json();
        if (data && data.events) {
          // Map DB logs to UI structure
          const formatted = data.events.map((e) => ({
            id: e.id,
            trace_id: e.trace_id,
            order_id: e.order_id,
            tool_name: e.event_type || e.tool_name || 'MCP_TOOL_CALL',
            actor: e.actor || 'AI_BUYER_AGENT',
            policy_result: e.payload_json?.policy_result || 'PASSED',
            state_after: e.payload_json?.state_after || 'EXECUTED',
            execution_time_ms: e.execution_time_ms || 1.2,
            input_payload: e.payload_json || {},
            timestamp: e.created_at || new Date().toISOString(),
          }));
          setLogs(formatted);
        }
      }
    } catch (err) {
      console.error('Failed to fetch historical audit logs:', err);
    }
  };

  useEffect(() => {
    fetchHistoricalLogs();
  }, []);

  useEffect(() => {
    let eventSource = null;

    const connectSse = () => {
      eventSource = new EventSource('/api/telemetry/stream');

      eventSource.onopen = () => {
        setIsConnected(true);
        if (onSseStatusChange) onSseStatusChange(true);
      };

      eventSource.onmessage = (event) => {
        if (isPaused) return;

        try {
          // Ignore heartbeat ping comments
          if (!event.data || event.data.trim() === ': heartbeat') return;

          const data = JSON.parse(event.data);
          if (data.event_type === 'SSE_CONNECTED') {
            setIsConnected(true);
            if (onSseStatusChange) onSseStatusChange(true);
            return;
          }

          setLogs((prev) => [data, ...prev].slice(0, 100)); // Keep latest 100 logs
        } catch (e) {
          console.error('Failed to parse SSE payload:', e);
        }
      };

      eventSource.onerror = (err) => {
        setIsConnected(false);
        if (onSseStatusChange) onSseStatusChange(false);
        if (eventSource) eventSource.close();
        setTimeout(connectSse, 4000);
      };
    };

    connectSse();

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [isPaused, onSseStatusChange]);

  const clearLogs = () => {
    setLogs([]);
    setExpandedTraceId(null);
  };

  const getPolicyBadge = (result) => {
    switch (result) {
      case 'PASSED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle className="w-3 h-3 mr-1 text-emerald-400" /> PASSED
          </span>
        );
      case 'BLOCKED':
      case 'BLOCKED_BY_POLICY':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3 h-3 mr-1 text-rose-400" /> BLOCKED
          </span>
        );
      case 'DRAFT_AWAITING_AUTH':
      case 'REQUIRES_HUMAN_AUTH':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3 mr-1 text-amber-400" /> STEP-UP GATED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
            {result || 'INFO'}
          </span>
        );
    }
  };

  return (
    <div className="bg-[#0F172A] rounded-xl border border-slate-800 shadow-xl overflow-hidden font-mono text-xs">
      
      {/* Console Header */}
      <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-slate-800 text-sky-400 rounded-md">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-white font-semibold text-sm font-sans">Live Audit Telemetry Log</span>
              <span className="flex h-2 w-2 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans">Real-time audit log event stream (`GET /api/telemetry/stream`)</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={fetchHistoricalLogs}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 flex items-center space-x-1 text-xs transition"
            title="Refresh logs"
          >
            <RefreshCw className="w-3 h-3 text-slate-400" />
            <span>Reload</span>
          </button>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 flex items-center space-x-1 text-xs transition"
            title={isPaused ? 'Resume stream' : 'Pause stream'}
          >
            {isPaused ? <Play className="w-3 h-3 text-emerald-400" /> : <Pause className="w-3 h-3 text-amber-400" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>
          
          <button
            onClick={clearLogs}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 flex items-center space-x-1 text-xs transition"
            title="Clear view"
          >
            <Trash2 className="w-3 h-3 text-slate-400" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Console Log Feed */}
      <div className="h-96 overflow-y-auto custom-scrollbar p-4 space-y-2 bg-[#0F172A]">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 font-sans space-y-2">
            <Terminal className="w-8 h-8 opacity-40 text-slate-400" />
            <p className="text-sm">Listening for AI Agent tool invocations and policy evaluations...</p>
            <p className="text-xs text-slate-600 font-mono">Trigger MCP tool calls or run `python backend/tests/run_agent_demo.py`</p>
          </div>
        ) : (
          logs.map((log, index) => {
            const isExpanded = expandedTraceId === (log.trace_id || index);
            const timeStr = log.timestamp ? log.timestamp.split('T')[1]?.substring(0, 8) || log.timestamp : 'NOW';

            return (
              <div key={log.id || index} className="border border-slate-800/80 rounded bg-slate-900/60 hover:bg-slate-900 transition">
                <div
                  onClick={() => setExpandedTraceId(isExpanded ? null : (log.trace_id || index))}
                  className="p-2.5 flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <span className="text-slate-500 text-[11px]">{timeStr}</span>
                    
                    <span className="text-indigo-400 font-bold bg-indigo-950/60 px-1.5 py-0.5 rounded text-[11px] border border-indigo-800/40">
                      {log.tool_name || log.event_type}
                    </span>

                    <span className="text-slate-400 truncate max-w-xs text-[11px]">
                      trace: <span className="text-slate-300 font-mono">{log.trace_id?.substring(0, 18)}...</span>
                    </span>
                  </div>

                  <div className="flex items-center space-x-3 flex-shrink-0">
                    {getPolicyBadge(log.policy_result)}
                    
                    {log.execution_time_ms && (
                      <span className="text-slate-500 text-[11px]">{log.execution_time_ms.toFixed(1)}ms</span>
                    )}

                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Payload Details */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-slate-800 bg-slate-950/80 text-[11px] space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-slate-400 block mb-1">Input Payload:</span>
                        <pre className="bg-slate-900 p-2 rounded text-emerald-400 overflow-x-auto border border-slate-800">
                          {JSON.stringify(log.input_payload, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-1">Execution Details:</span>
                        <div className="bg-slate-900 p-2 rounded text-slate-300 space-y-1 border border-slate-800 font-mono">
                          <div><span className="text-slate-500">Actor:</span> {log.actor || 'AI_BUYER_AGENT'}</div>
                          <div><span className="text-slate-500">State After:</span> <span className="text-amber-400">{log.state_after}</span></div>
                          {log.order_id && (
                            <div><span className="text-slate-500">Order Ref:</span> <span className="text-sky-400">{log.order_id}</span></div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
