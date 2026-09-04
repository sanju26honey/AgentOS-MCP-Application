import React from 'react';

export function PerformanceChart({ performanceMetrics }) {
  const metrics = performanceMetrics || {
    average_latency_ms: 1.2,
    peak_throughput_rpm: 1,
    time_series: [
      { time: "00:00", throughput: 10, latency: 1.0 },
      { time: "04:00", throughput: 15, latency: 0.9 },
      { time: "08:00", throughput: 28, latency: 1.3 },
      { time: "12:00", throughput: 42, latency: 1.5 },
      { time: "16:00", throughput: 35, latency: 1.1 },
      { time: "20:00", throughput: 22, latency: 1.2 }
    ]
  };

  const { average_latency_ms, peak_throughput_rpm, time_series = [] } = metrics;

  // Maximum value for scaling (default max 50 or peak throughput)
  const maxVal = Math.max(
    ...time_series.map(t => Math.max(Number(t.throughput || 0), Number(t.latency || 0))),
    peak_throughput_rpm || 1,
    50
  );

  // Compute (x, y) coordinates for points inside viewBox="0 0 1000 100"
  // Baseline y = 90 (0 value), Top y = 10 (max value)
  const getPoints = (key) => {
    if (!time_series || time_series.length === 0) return [];
    return time_series.map((t, idx) => {
      const x = (idx / (time_series.length - 1)) * 1000;
      const rawVal = Number(t[key] || 0);
      const normalized = Math.min(Math.max(rawVal, 0), maxVal) / maxVal;
      const y = 90 - (normalized * 75); // Bounded strictly between 15 and 90 (never below 0)
      return { x, y, val: rawVal, time: t.time };
    });
  };

  const tpPoints = getPoints('throughput');
  const latPoints = getPoints('latency');

  // Build smooth cubic Bezier curve path string
  const createPathD = (pts) => {
    if (!pts || pts.length === 0) return '';
    if (pts.length === 1) return `M 0,${pts[0].y} L 1000,${pts[0].y}`;
    
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpx1 = prev.x + (curr.x - prev.x) / 2;
      const cpy1 = prev.y;
      const cpx2 = prev.x + (curr.x - prev.x) / 2;
      const cpy2 = curr.y;
      d += ` C ${cpx1},${cpy1} ${cpx2},${cpy2} ${curr.x},${curr.y}`;
    }
    return d;
  };

  const tpPathD = createPathD(tpPoints);
  const tpFillD = tpPathD ? `${tpPathD} L 1000,90 L 0,90 Z` : '';
  const latPathD = createPathD(latPoints);

  const peakPoint = tpPoints.reduce((max, p) => (p.val > max.val ? p : max), tpPoints[0] || { x: 500, y: 50 });

  return (
    <div className="glass-panel rounded-2xl p-5 lg:col-span-2 flex flex-col min-h-[380px]">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-base font-bold text-white">Performance Metrics</h3>
          <p className="text-xs text-on-surface-variant">System latency vs Throughput (24h)</p>
        </div>
        
        {/* Real Backend Measured Latency & Throughput Badges */}
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <div className="flex items-center gap-1.5 bg-surface-container/60 px-2.5 py-1 rounded-lg border border-white/5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3395ff] animate-pulse"></span>
            <span className="text-on-surface-variant">Peak Throughput:</span>
            <span className="text-[#3395ff] font-bold">{peak_throughput_rpm} rpm</span>
          </div>

          <div className="flex items-center gap-1.5 bg-surface-container/60 px-2.5 py-1 rounded-lg border border-white/5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d0bcff]"></span>
            <span className="text-on-surface-variant">Avg Latency:</span>
            <span className="text-[#d0bcff] font-bold">{average_latency_ms}ms</span>
          </div>
        </div>
      </div>

      {/* Dynamic 24h Chart Canvas */}
      <div className="flex-1 relative w-full flex items-end pt-4 pb-8 pl-8 border-l border-b border-white/10">
        {/* Y Axis labels */}
        <div className="absolute left-[-24px] top-0 bottom-8 flex flex-col justify-between text-xs font-mono text-outline py-2">
          <span>{Math.round(maxVal)}</span>
          <span>{Math.round(maxVal * 0.75)}</span>
          <span>{Math.round(maxVal * 0.5)}</span>
          <span>{Math.round(maxVal * 0.25)}</span>
          <span>0</span>
        </div>

        {/* Grid lines */}
        <div className="absolute left-0 right-0 top-[10%] border-t border-white/5"></div>
        <div className="absolute left-0 right-0 top-[35%] border-t border-white/5"></div>
        <div className="absolute left-0 right-0 top-[60%] border-t border-white/5"></div>
        <div className="absolute left-0 right-0 top-[85%] border-t border-white/5"></div>

        {/* Throughput SVG Area & Curve */}
        <svg className="absolute left-0 right-0 bottom-8 top-0 w-full h-full overflow-visible" viewBox="0 0 1000 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="tp-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3395ff" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#3395ff" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Area fill under curve */}
          {tpFillD && <path d={tpFillD} fill="url(#tp-grad)" />}

          {/* Throughput Line Path */}
          {tpPathD && (
            <path
              d={tpPathD}
              fill="none"
              stroke="#3395ff"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Latency Line Path */}
          {latPathD && (
            <path
              d={latPathD}
              fill="none"
              stroke="#d0bcff"
              strokeWidth="2"
              strokeDasharray="4 4"
              opacity="0.8"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Peak Throughput Point Indicator */}
          {peakPoint && (
            <circle
              cx={peakPoint.x}
              cy={peakPoint.y}
              r="4"
              fill="#3395ff"
              className="animate-pulse"
            />
          )}
        </svg>

        {/* X Axis time labels from backend time_series data */}
        <div className="absolute left-0 right-0 bottom-[-24px] flex justify-between text-xs font-mono text-outline px-4">
          {time_series.map((t, idx) => (
            <span key={idx}>{t.time}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
