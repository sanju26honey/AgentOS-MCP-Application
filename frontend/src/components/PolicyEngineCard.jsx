import React, { useState, useEffect } from 'react';

export function PolicyEngineCard({ currentCap = 5000, onPolicyUpdate }) {
  const [capValue, setCapValue] = useState(currentCap);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentCap) {
      setCapValue(currentCap);
    }
  }, [currentCap]);

  const min = 500;
  const max = 100000;
  const fillPercentage = Math.min(Math.max(((capValue - min) / (max - min)) * 100, 0), 100);

  const handleSliderChange = (e) => {
    setCapValue(parseInt(e.target.value, 10));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/dashboard/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_autonomous_txn_limit: parseFloat(capValue) }),
      });
      if (res.ok && onPolicyUpdate) {
        onPolicyUpdate(capValue);
      }
    } catch (e) {
      console.error('Failed to update policy limit:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  return (
    <div className="glass-panel rounded-2xl p-5 lg:col-span-1 flex flex-col min-h-[380px]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-bold text-white">Policy Engine</h3>
        <button className="text-on-surface-variant hover:text-white transition-colors">
          <span className="material-symbols-outlined text-[18px]">more_vert</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <div className="bg-surface-container/50 rounded-lg border border-white/5 mb-4 p-3.5">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs text-on-surface-variant">Global Autonomous Cap</span>
            <span className="font-mono text-[11px] text-primary bg-primary-container/10 px-2 py-0.5 rounded border border-primary/20">
              {formatCurrency(capValue)}
            </span>
          </div>

          <p className="text-[11px] text-on-surface-variant opacity-70 mb-3 leading-relaxed">
            Transactions ≤ <strong className="text-white">{formatCurrency(capValue)}</strong> execute autonomously. Orders exceeding this limit pause for Human Step-Up Authorization.
          </p>

          {/* Slider */}
          <div className="relative w-full h-12 flex items-center">
            <input
              type="range"
              min={min}
              max={max}
              step={500}
              value={capValue}
              onChange={handleSliderChange}
              onMouseUp={handleSave}
              onTouchEnd={handleSave}
              className="w-full h-1 bg-surface-variant rounded-lg appearance-none cursor-pointer z-10 relative focus:outline-none"
            />
            <div
              className="absolute left-0 h-1 bg-gradient-to-r from-primary-container to-secondary-container rounded-lg z-0"
              style={{ width: `${fillPercentage}%` }}
            ></div>
          </div>

          <div className="flex justify-between text-xs font-mono text-outline mt-2">
            <span>₹500</span>
            <span>₹100K</span>
          </div>
        </div>

        {/* Dynamic Status Indicator */}
        <div className="flex items-center justify-between p-3 bg-surface-container-low/40 rounded-lg border border-white/5 text-xs text-on-surface-variant">
          <span>Non-LLM Guardrail Engine:</span>
          <span className="text-emerald-400 font-mono font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> ACTIVE
          </span>
        </div>
      </div>
    </div>
  );
}
