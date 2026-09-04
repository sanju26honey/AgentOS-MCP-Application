import React, { useState, useEffect } from 'react';
import { Sliders, ShieldCheck, Check, Save, AlertCircle } from 'lucide-react';

export function PolicyCapManager({ currentCap = 5000, onPolicyUpdate }) {
  const [capValue, setCapValue] = useState(currentCap);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setCapValue(currentCap);
  }, [currentCap]);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const response = await fetch('/api/dashboard/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_autonomous_txn_limit: parseFloat(capValue) }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setSuccessMessage(data.message);
        if (onPolicyUpdate) onPolicyUpdate(data.max_autonomous_txn_limit);
        setTimeout(() => setSuccessMessage(''), 4000);
      } else {
        setErrorMessage(data.detail || 'Failed to update policy limit.');
      }
    } catch (err) {
      setErrorMessage('Network error while updating policy threshold.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-merchant-blueLight text-merchant-blue rounded-lg">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Policy Guardrail & Autonomous Limit Manager</h3>
            <p className="text-xs text-slate-500">Configure financial spending limits for AI Buyer agent purchases</p>
          </div>
        </div>
        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-3 py-1 rounded-full font-medium flex items-center">
          <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Active Policy Enforced
        </span>
      </div>

      <form onSubmit={handleSave} className="mt-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          
          {/* Autonomous Cap Threshold Slider & Input */}
          <div className="md:col-span-2 space-y-3">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Autonomous Spend Threshold (Max Transaction Limit)
            </label>
            
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold text-sm">₹</span>
                <input
                  type="number"
                  min="500"
                  max="100000"
                  step="500"
                  value={capValue}
                  onChange={(e) => setCapValue(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-merchant-blue focus:bg-white text-sm"
                />
              </div>
              <input
                type="range"
                min="500"
                max="50000"
                step="500"
                value={capValue}
                onChange={(e) => setCapValue(e.target.value)}
                className="w-48 accent-merchant-blue cursor-pointer"
              />
            </div>
            <p className="text-xs text-slate-500">
              Purchases ≤ <strong className="text-slate-800">₹{parseFloat(capValue || 0).toLocaleString('en-IN')}</strong> execute autonomously. Orders exceeding this cap pause for <strong className="text-amber-700 font-medium">Human Step-Up Authorization</strong>.
            </p>
          </div>

          {/* Action Button */}
          <div className="flex justify-end items-center">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto px-5 py-2.5 bg-merchant-blue hover:bg-merchant-blueHover text-white text-sm font-semibold rounded-lg shadow-md transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Updating...' : 'Save Policy Settings'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Success / Error Feedback Banners */}
      {successMessage && (
        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center space-x-2">
          <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

    </div>
  );
}
