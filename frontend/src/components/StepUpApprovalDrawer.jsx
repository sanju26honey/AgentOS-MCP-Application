import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, Lock, ArrowRight, X, AlertTriangle, Sparkles } from 'lucide-react';

const SKU_PRODUCT_NAMES = {
  'APEX-JKT-001': 'Vintage Leather Biker Jacket',
  'APEX-JKT-002': 'Urban Denim Trucker Jacket',
  'APEX-JKT-003': 'Techwear Waterproof Windbreaker',
  'APEX-APP-001': 'Organic Cotton Oversized Tee',
  'APEX-APP-002': 'Merino Wool Crewneck Sweater',
  'APEX-APP-003': 'Linen Blend Summer Shirt',
  'APEX-FTP-001': 'Classic Low-Top White Leather Sneakers',
  'APEX-FTP-002': 'Waterproof Trail Running Shoes',
  'APEX-FTP-003': 'Suede Chelsea Boots',
  'APEX-ACC-001': 'Minimalist Matte Black Chronograph Watch',
  'APEX-ACC-002': 'RFID Blocking Slim Leather Wallet',
  'APEX-ACC-003': 'Polarized Aviator Sunglasses',
  'APEX-ACC-004': 'Water-Resistant Canvas Crossbody Bag',
  'APEX-GDG-001': 'ANC Wireless Earbuds Pro',
  'APEX-GDG-002': 'AMOLED Smart Fitness Band',
  'APEX-GDG-003': 'MagSafe Fast Charging Power Bank 10000mAh'
};

const getItemName = (item) => {
  if (item?.name && item.name !== item.sku) return item.name;
  if (item?.sku && SKU_PRODUCT_NAMES[item.sku]) return SKU_PRODUCT_NAMES[item.sku];
  return item?.name || item?.sku || 'Purchased Product';
};

export function StepUpApprovalDrawer({
  isOpen,
  onClose,
  orderData,
  buyerEmail,
  onApproveSuccess
}) {
  const [authToken, setAuthToken] = useState('STEPUP_APPROVED_123456');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successState, setSuccessState] = useState(false);

  if (!isOpen || !orderData) return null;

  const orderId = orderData.order_id || orderData.id || 'N/A';
  const totalAmount = orderData.total_amount || orderData.amount || 0;
  const items = orderData.purchased_items || orderData.items || [];

  const handleAuthorize = async (e) => {
    e.preventDefault();
    if (!authToken.trim()) {
      setErrorMsg('Please enter a valid authorization token or OTP.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/mcp/stepup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          order_id: orderId,
          auth_token: authToken.trim(),
          buyer_email: buyerEmail || 'customer_agent@ai.com'
        })
      });

      const data = await response.json();

      const resObj = data.result || data;

      if (!response.ok || data.isError || resObj.authorization_successful === false) {
        throw new Error(resObj.message || data.detail?.message || data.error || 'Step-up authorization failed.');
      }

      setSuccessState(true);
      setTimeout(() => {
        setIsSubmitting(false);
        setSuccessState(false);
        if (onApproveSuccess) {
          onApproveSuccess({
            order_id: resObj.order_id || orderId,
            status: 'COMPLETED',
            total_amount: totalAmount,
            purchased_items: items,
            buyer_email: buyerEmail,
            razorpay_payment_id: resObj.razorpay_payment_id || `pay_stepup_${orderId.replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`,
            stepup_result: data
          });
        }
        onClose();
      }, 1000);
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Authorization failed. Please check the token and try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end font-sans">
      {/* Semi-transparent backdrop with blur */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity duration-300 animate-fade-in"
        onClick={onClose}
      />

      {/* Lumina Light Slide-over Panel */}
      <div className="relative w-full max-w-lg bg-white/95 backdrop-blur-xl border-l border-slate-200 shadow-2xl text-[#191c1e] flex flex-col h-full z-10 transition-transform duration-300">
        
        {/* Top Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-amber-50/70">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-700 rounded-xl border border-amber-500/20">
              <ShieldAlert className="w-6 h-6 text-amber-600 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#191c1e] flex items-center space-x-2">
                <span>Human Approval Required</span>
                <span className="bg-amber-500/10 text-amber-800 text-xs px-2 py-0.5 rounded-md font-mono border border-amber-500/20 font-semibold">
                  STEP-UP AUTH
                </span>
              </h3>
              <p className="text-xs text-[#464554]">Order Paused: Exceeds Autonomous Limit</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-[#191c1e] hover:bg-slate-200/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Policy Breach Alert Box */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start space-x-3 text-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-amber-900 block text-sm">Autonomous Spending Cap Exceeded</span>
              <p className="text-slate-700 leading-relaxed">
                The Customer AI Agent requested a total checkout of{' '}
                <strong className="text-[#191c1e] font-mono">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>, which exceeds the active policy spending limit.
              </p>
            </div>
          </div>

          {/* Order Details Card */}
          <div className="glass-panel-lumina-light p-5 rounded-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between text-xs text-[#464554] border-b border-slate-200 pb-3 font-mono">
              <span>ORDER ID: <strong className="text-[#191c1e]">{orderId}</strong></span>
              <span>BUYER: <strong className="text-[#191c1e]">{buyerEmail}</strong></span>
            </div>

            {/* Items Table */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-[#767586] uppercase tracking-wider block">Itemized Cart Summary</span>
              {items.length > 0 ? (
                items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm py-2 px-3 bg-slate-50 rounded-xl border border-slate-200 font-sans">
                    <div>
                      <p className="font-bold text-[#191c1e]">{getItemName(item)}</p>
                      <p className="text-xs text-[#767586] font-mono">SKU: {item.sku} | Qty: {item.quantity || 1}</p>
                    </div>
                    <span className="font-mono font-bold text-[#4648d4]">
                      ₹{((item.unit_price || item.price || totalAmount) * (item.quantity || 1)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-500 py-2">Standard high-value catalog items</div>
              )}
            </div>

            {/* Grand Total */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs font-mono text-[#767586] uppercase">Total Razorpay Charge</span>
              <span className="text-xl font-extrabold font-mono text-[#4648d4]">
                ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} INR
              </span>
            </div>
          </div>

          {/* Authorization Form */}
          {successState ? (
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3 font-mono animate-in zoom-in-95">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto animate-bounce" />
              <h4 className="text-base font-bold text-emerald-900">HITL Authorization Verified!</h4>
              <p className="text-xs text-slate-600">Re-submitting step-up token to Razorpay API gateway...</p>
            </div>
          ) : (
            <form onSubmit={handleAuthorize} className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-mono font-semibold text-[#191c1e] flex items-center justify-between">
                  <span>Enter Security Token or Step-Up OTP:</span>
                  <span className="text-[11px] text-[#4648d4]">Demo Auto-filled</span>
                </label>

                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={authToken}
                    onChange={(e) => setAuthToken(e.target.value)}
                    placeholder="Enter STEPUP_APPROVED_123456"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-[#191c1e] font-mono focus:outline-none focus:border-[#4648d4]"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-mono">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-[#4648d4] hover:bg-[#393bb3] text-white font-mono font-semibold text-xs rounded-xl shadow-md flex items-center justify-center space-x-2 transition disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Verifying Token...</span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Authorize Transaction & Complete Purchase</span>
                  </>
                )}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
