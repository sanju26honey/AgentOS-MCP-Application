import React from 'react';
import { ShoppingBag, CheckCircle2, X, ArrowRight, ShieldCheck, CreditCard, Clock, FileText } from 'lucide-react';

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

export function CustomerOrderHistoryDrawer({ isOpen, onClose, orders = [] }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end font-sans">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity duration-300 animate-fade-in"
        onClick={onClose}
      />

      {/* Lumina Light Glass Panel */}
      <div className="relative w-full max-w-lg bg-white/95 backdrop-blur-xl border-l border-slate-200 shadow-2xl text-[#191c1e] flex flex-col h-full z-10 transition-transform duration-300">
        
        {/* Top Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-700 rounded-xl border border-emerald-500/20">
              <ShoppingBag className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#191c1e] flex items-center space-x-2">
                <span>Customer Purchase History</span>
                <span className="bg-emerald-500/10 text-emerald-700 text-xs px-2.5 py-0.5 rounded-full font-mono border border-emerald-500/20 font-bold">
                  {orders.length} {orders.length === 1 ? 'ORDER' : 'ORDERS'}
                </span>
              </h3>
              <p className="text-xs text-[#464554]">Completed Razorpay Transactions by AI Buyer Agent</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-[#191c1e] hover:bg-slate-200/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Orders List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {orders.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <ShoppingBag className="w-12 h-12 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-[#191c1e]">No completed purchases yet.</p>
              <p className="text-xs text-[#767586] max-w-xs mx-auto">
                Run an AI Buyer Agent shopping goal in the sandbox to generate verified Razorpay orders.
              </p>
            </div>
          ) : (
            orders.map((order, idx) => (
              <div key={idx} className="glass-panel-lumina-light p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm hover:border-emerald-500/40 transition">
                
                {/* Order Top Bar */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-mono text-[#767586] block">ORDER ID</span>
                    <span className="font-mono font-bold text-sm text-[#191c1e]">{order.order_id || order.id}</span>
                  </div>

                  <span className="bg-emerald-500/10 text-emerald-700 text-xs px-2.5 py-1 rounded-full font-mono border border-emerald-500/20 flex items-center space-x-1 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>RAZORPAY CAPTURED</span>
                  </span>
                </div>

                {/* Purchased Items List */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-[#767586] uppercase tracking-wider block">Items Purchased</span>
                  {(order.purchased_items || order.items || []).map((item, iIdx) => {
                    const qty = item.quantity || 1;
                    const unitPrice = item.unit_price || item.price || (item.claimed_unit_price) || ((order.total_amount || 0) / qty);
                    const lineTotal = item.line_total || (unitPrice * qty);
                    return (
                      <div key={iIdx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-[#191c1e]">{getItemName(item)}</p>
                          <p className="text-[11px] text-[#767586] font-mono">SKU: {item.sku} &bull; Qty: {qty} @ ₹{unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <span className="font-mono font-bold text-emerald-700">
                          ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Payment Breakdown & References */}
                <div className="pt-2 border-t border-slate-200 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between text-[#767586]">
                    <span className="flex items-center space-x-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-[#4648d4]" />
                      <span>Payment Ref ID:</span>
                    </span>
                    <span className="text-[#4648d4] font-bold">{order.razorpay_payment_id || 'pay_demo_captured'}</span>
                  </div>

                  <div className="flex items-center justify-between text-[#767586]">
                    <span className="flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Buyer Email:</span>
                    </span>
                    <span className="text-[#191c1e]">{order.buyer_email || 'customer_agent@ai.com'}</span>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-sm font-bold text-[#191c1e] border-t border-slate-200 font-sans">
                    <span>Total Amount Paid</span>
                    <span className="text-emerald-700 text-base font-mono">
                      ₹{(order.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} INR
                    </span>
                  </div>

                  <div className="pt-2 flex justify-end font-sans">
                    <a
                      href={`/api/orders/${order.order_id || order.id}/receipt`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 bg-[#4648d4] hover:bg-[#393bb3] text-white rounded-xl flex items-center justify-center space-x-2 text-xs transition shadow-2xs font-semibold"
                    >
                      <FileText className="w-4 h-4 text-white" />
                      <span>View / Download PDF Receipt</span>
                    </a>
                  </div>
                </div>

              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 text-center text-xs text-[#767586] font-mono">
          Razorpay Immutable Audit Trail &bull; Verified Receipts
        </div>

      </div>
    </div>
  );
}
