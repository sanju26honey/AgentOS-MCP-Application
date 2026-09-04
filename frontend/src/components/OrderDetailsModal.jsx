import React, { useState, useEffect } from 'react';

export function OrderDetailsModal({ orderId, onClose }) {
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;
    setIsLoading(true);

    fetch(`/api/orders/${orderId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setOrder(data);
        }
      })
      .catch((err) => console.error('Failed to fetch order details:', err))
      .finally(() => setIsLoading(false));
  }, [orderId]);

  if (!orderId) return null;

  const currentOrder = order || {};
  const itemsList = currentOrder.items_json || currentOrder.items || [];

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      // Clean ISO timestamp strings like 2026-08-26T16:41:48.551838+00:00 -> 2026-08-26 16:41:48 UTC
      const formatted = dateStr.replace('T', ' ').split('.')[0];
      return `${formatted} UTC`;
    } catch (e) {
      return dateStr;
    }
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'RAZORPAY_CAPTURED':
        return 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20';
      case 'DRAFT_AWAITING_AUTH':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'AUTHORIZED_FOR_PAYMENT':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'BLOCKED_BY_POLICY':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop overlay */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl z-10">
        <div className="glass-panel rounded-2xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
          
          {/* Modal Header */}
          <div className="p-6 border-b border-white/10 flex justify-between items-center bg-surface-container-lowest/50">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Order Details</h2>
              <p className="font-mono text-xs text-primary">{orderId}</p>
            </div>
            <button
              className="text-on-surface-variant hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
              onClick={onClose}
            >
              <span className="material-symbols-outlined text-[24px]">close</span>
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-6">
            {isLoading ? (
              <div className="py-12 text-center text-on-surface-variant font-mono text-sm">
                Fetching order details from database...
              </div>
            ) : (
              <>
                {/* Top Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface-container/30 rounded-lg p-4 border border-white/5">
                    <span className="font-mono text-xs text-on-surface-variant block mb-1">STATUS</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border inline-flex items-center gap-1 font-mono ${getStatusBadgeStyle(currentOrder.status)}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span> {currentOrder.status || 'PROCESSING'}
                    </span>
                  </div>
                  <div className="bg-surface-container/30 rounded-lg p-4 border border-white/5">
                    <span className="font-mono text-xs text-on-surface-variant block mb-1">TOTAL AMOUNT</span>
                    <span className="text-2xl font-bold text-white font-mono">
                      {formatCurrency(currentOrder.total_amount)}
                    </span>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-xs font-sans">
                  <div>
                    <span className="text-on-surface-variant block mb-1">Buyer Email</span>
                    <span className="text-white font-medium">{currentOrder.buyer_email || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-on-surface-variant block mb-1">Razorpay Order ID</span>
                    <span className="font-mono text-white">
                      {currentOrder.razorpay_order_id ? (
                        <span className="text-emerald-400 font-semibold">{currentOrder.razorpay_order_id}</span>
                      ) : (
                        <span className="text-amber-400/80 italic">Awaiting Auth / Pending</span>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-on-surface-variant block mb-1">Created At</span>
                    <span className="font-mono text-white">{formatDate(currentOrder.created_at)}</span>
                  </div>
                  <div>
                    <span className="text-on-surface-variant block mb-1">Payment ID</span>
                    <span className="font-mono text-white">
                      {currentOrder.razorpay_payment_id ? (
                        <span className="text-emerald-400 font-semibold">{currentOrder.razorpay_payment_id}</span>
                      ) : (
                        <span className="text-amber-400/80 italic">Payment Pending</span>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-on-surface-variant block mb-1">Updated At</span>
                    <span className="font-mono text-white">{formatDate(currentOrder.updated_at || currentOrder.created_at)}</span>
                  </div>
                </div>

                {/* Itemized List */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3">Itemized List</h3>
                  <div className="bg-surface-container/30 rounded-lg border border-white/5 overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="font-mono text-on-surface-variant border-b border-white/5 bg-surface/20">
                          <th className="py-3 px-4 font-medium tracking-wider">SKU</th>
                          <th className="py-3 px-4 font-medium tracking-wider">NAME</th>
                          <th className="py-3 px-4 font-medium tracking-wider text-right">QTY</th>
                          <th className="py-3 px-4 font-medium tracking-wider text-right">UNIT PRICE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-sans">
                        {itemsList.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="py-4 text-center text-on-surface-variant font-mono">
                              No line items found for this order.
                            </td>
                          </tr>
                        ) : (
                          itemsList.map((item, idx) => (
                            <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-3 px-4 font-mono text-xs text-primary">{item.sku}</td>
                              <td className="py-3 px-4 text-white font-medium">{item.name}</td>
                              <td className="py-3 px-4 text-right text-on-surface-variant font-mono">{item.quantity}</td>
                              <td className="py-3 px-4 text-right text-white font-mono">{formatCurrency(item.unit_price)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t border-white/10 flex items-center justify-between bg-surface-container-lowest/50">
            {orderId && (
              <a
                href={`/api/orders/${orderId}/receipt`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-emerald-400 hover:text-white bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 transition-colors flex items-center gap-1.5 font-sans"
              >
                <span className="material-symbols-outlined text-[16px]">description</span>
                <span>View / Download PDF Receipt</span>
              </a>
            )}
            <button
              className="px-4 py-2 rounded-lg text-xs font-medium text-on-surface-variant hover:text-white hover:bg-white/5 transition-colors ml-auto"
              onClick={onClose}
            >
              Close
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
