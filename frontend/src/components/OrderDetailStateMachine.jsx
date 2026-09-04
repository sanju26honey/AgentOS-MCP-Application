import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, Clock, AlertTriangle, ArrowRight, User, ShoppingBag, Terminal, FileText, ChevronLeft, CreditCard } from 'lucide-react';

export function OrderDetailStateMachine({ orderId = 'ORD-20260826-A1B2C3', onBack }) {
  const [order, setOrder] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Default demo state if backend record is loading
  const demoOrder = {
    id: orderId,
    buyer_email: 'phoenix_buyer@example.com',
    total_amount: 8500.0,
    currency: 'INR',
    status: 'DRAFT_AWAITING_AUTH',
    razorpay_order_id: 'rzp_test_NkjhY8gHjl2kL0',
    razorpay_payment_id: 'pay_NkjhY9kLmn3pQ4',
    created_at: new Date().toISOString(),
    items: [
      { sku: 'SKU_AUDIO_01', name: 'Wireless Noise-Canceling Headphones', quantity: 1, unit_price: 4999.0, category: 'Electronics' },
      { sku: 'SKU_ACC_CASE', name: 'Protective Travel Carrying Case (Growth Upsell)', quantity: 1, unit_price: 499.0, category: 'Accessories' },
      { sku: 'SKU_SMART_WATCH', name: 'Fitness Smartwatch', quantity: 1, unit_price: 3002.0, category: 'Wearables' }
    ]
  };

  const fetchOrderDetails = async () => {
    try {
      const [orderRes, logsRes] = await Promise.all([
        fetch(`/api/orders/${orderId}`),
        fetch(`/api/telemetry/logs?order_id=${orderId}`)
      ]);

      if (orderRes.ok) {
        const orderData = await orderRes.json();
        setOrder(orderData);
      } else {
        setOrder(demoOrder);
      }

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setAuditLogs(logsData.events || []);
      }
    } catch (err) {
      setOrder(demoOrder);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const activeOrder = order || demoOrder;

  // 5-State Machine Definitions
  const states = [
    { key: 'INITIALIZED', label: '1. INITIALIZED', desc: 'AI Buyer initiated order draft', icon: CheckCircle2 },
    { key: 'POLICY_CHECK', label: '2. POLICY_CHECK', desc: 'Spending cap & integrity passed', icon: ShieldCheck },
    { key: 'DRAFT_AWAITING_AUTH', label: '3. DRAFT_AWAITING_AUTH', desc: 'Paused for Step-Up Auth (>₹5k cap)', icon: AlertTriangle },
    { key: 'AUTHORIZED_FOR_PAYMENT', label: '4. AUTHORIZED_FOR_PAYMENT', desc: 'Human OTP/HMAC verified', icon: Clock },
    { key: 'RAZORPAY_CAPTURED', label: '5. RAZORPAY_CAPTURED', desc: 'Razorpay funds captured & stock committed', icon: CheckCircle2 }
  ];

  const getStepStatus = (stepKey, currentStatus) => {
    const orderFlow = ['INITIALIZED', 'POLICY_CHECK', 'DRAFT_AWAITING_AUTH', 'AUTHORIZED_FOR_PAYMENT', 'RAZORPAY_CAPTURED'];
    const currentIndex = orderFlow.indexOf(currentStatus);
    const stepIndex = orderFlow.indexOf(stepKey);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 font-sans">
      
      {/* Navigation & Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg shadow-sm transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                AgentOS Order Detail: <span className="font-mono text-merchant-blue">{activeOrder.id}</span>
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 font-mono">
                {activeOrder.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Customer: <span className="font-medium text-slate-800">{activeOrder.buyer_email}</span> | Razorpay Ref: <span className="font-mono text-slate-700">{activeOrder.razorpay_order_id || 'rzp_test_pending'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* 5-Step Financial State Machine Visualizer */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center">
            <ShieldCheck className="w-5 h-5 text-merchant-blue mr-2" />
            5-Step Financial State Machine Pipeline
          </h2>
          <span className="text-xs font-mono text-slate-500">Autonomous Gating Protocol</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
          {states.map((st, idx) => {
            const stepStatus = getStepStatus(st.key, activeOrder.status);
            const Icon = st.icon;

            let cardStyles = 'bg-slate-50 border-slate-200 text-slate-400';
            let badgeStyles = 'bg-slate-200 text-slate-600';

            if (stepStatus === 'completed') {
              cardStyles = 'bg-emerald-50/50 border-emerald-300 text-emerald-900';
              badgeStyles = 'bg-emerald-500 text-white';
            } else if (stepStatus === 'active') {
              cardStyles = 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/50 text-amber-900 shadow-sm';
              badgeStyles = 'bg-amber-500 text-white animate-pulse';
            }

            return (
              <div key={st.key} className={`p-4 rounded-xl border transition-all relative ${cardStyles}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${badgeStyles}`}>
                    {idx + 1}
                  </span>
                  <Icon className="w-4 h-4 opacity-75" />
                </div>
                <div className="font-mono text-xs font-bold tracking-tight mb-1 truncate" title={st.key}>
                  {st.key}
                </div>
                <p className="text-[11px] text-slate-600 leading-tight">
                  {st.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid: Itemized Product Table & Real-Time Audit Log Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Itemized Product Table (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-base flex items-center">
              <ShoppingBag className="w-4 h-4 mr-2 text-merchant-blue" />
              Itemized Product Breakdown
            </h3>
            <span className="text-xs font-mono text-slate-500">{activeOrder.items?.length || 0} Line Items</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Item / SKU</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {activeOrder.items?.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="py-3 px-3 font-medium text-slate-900">
                      <div>{item.name}</div>
                      <div className="font-mono text-[11px] text-slate-400">{item.sku}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded font-mono">
                        {item.category || 'General'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono">{item.quantity}</td>
                    <td className="py-3 px-3 text-right font-mono">₹{item.unit_price?.toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900">
                      ₹{(item.quantity * item.unit_price)?.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-col items-end space-y-1.5 text-xs font-sans">
            <div className="flex justify-between w-48 text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono">₹{activeOrder.total_amount?.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between w-48 text-slate-600">
              <span>Taxes & Shipping:</span>
              <span className="font-mono">₹0.00</span>
            </div>
            <div className="flex justify-between w-48 font-bold text-slate-900 text-sm pt-2 border-t border-slate-200">
              <span>Total Amount:</span>
              <span className="font-mono text-merchant-blue">₹{activeOrder.total_amount?.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Audit Event Log Trail */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-base flex items-center">
              <Terminal className="w-4 h-4 mr-2 text-slate-700" />
              Audit Event Log Trail
            </h3>
            <span className="text-xs font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Immutable
            </span>
          </div>

          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {auditLogs.length === 0 ? (
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between items-center text-slate-500 font-mono text-[10px]">
                    <span>INITIALIZED</span>
                    <span>15:50 PM</span>
                  </div>
                  <div className="font-medium text-slate-800">Order payload created by AI Buyer Agent</div>
                  <div className="text-[11px] text-slate-500 font-mono">trace: 8a912b3c-4d5e-6f7a...</div>
                </div>

                <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200 text-xs space-y-1">
                  <div className="flex justify-between items-center text-emerald-700 font-mono text-[10px]">
                    <span>POLICY_CHECK</span>
                    <span>15:51 PM</span>
                  </div>
                  <div className="font-medium text-emerald-900">Deterministic policy check PASSED</div>
                  <div className="text-[11px] text-emerald-700 font-mono">Risk score: 0.02 (Low)</div>
                </div>

                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs space-y-1">
                  <div className="flex justify-between items-center text-amber-700 font-mono text-[10px]">
                    <span>DRAFT_AWAITING_AUTH</span>
                    <span>15:52 PM</span>
                  </div>
                  <div className="font-medium text-amber-900">Order ₹8,500 exceeds ₹5,000 cap</div>
                  <div className="text-[11px] text-amber-800">Paused for Step-Up Authorization</div>
                </div>
              </div>
            ) : (
              auditLogs.map((log, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1 font-mono">
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span className="text-merchant-blue font-bold">{log.event_type || log.tool_name}</span>
                    <span>{log.created_at?.split('T')[1]?.substring(0, 8) || 'NOW'}</span>
                  </div>
                  <div className="text-slate-800 font-sans font-medium">{log.actor || 'AI_BUYER_AGENT'}</div>
                  <div className="text-[10px] text-slate-500">trace: {log.trace_id?.substring(0, 16)}...</div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
