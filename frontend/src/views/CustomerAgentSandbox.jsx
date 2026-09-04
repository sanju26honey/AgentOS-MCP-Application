import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Send, Bot, User, ShoppingBag, ShieldCheck, 
  ShieldAlert, CheckCircle2, ArrowRight, Zap, RefreshCw, 
  Check, Tag, Cpu, CreditCard, PackageCheck, FileText, Download,
  SlidersHorizontal, ChevronDown, CornerDownLeft, Sparkle, AlertCircle
} from 'lucide-react';
import { StepUpApprovalDrawer } from '../components/StepUpApprovalDrawer';
import { CustomerOrderHistoryDrawer } from '../components/CustomerOrderHistoryDrawer';

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

export function CustomerAgentSandbox({ initialPrompt, initialMaxPrice }) {
  const [query, setQuery] = useState(initialPrompt || '');
  const [buyerEmail, setBuyerEmail] = useState('customer_agent@ai.com');
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice || 10000);
  const [includeUpsell, setIncludeUpsell] = useState(true);
  const [autoApproveStepup, setAutoApproveStepup] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [orderHistory, setOrderHistory] = useState([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState(null);
  const [messages, setMessages] = useState(() => {
    try {
      const savedMsgs = localStorage.getItem('agent_chat_messages');
      if (savedMsgs) {
        const parsed = JSON.parse(savedMsgs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to restore chat messages:', e);
    }
    return [
      {
        id: 1,
        sender: 'agent',
        type: 'welcome',
        text: 'Hello! I am your Autonomous Customer AI Buyer Agent. I can search merchant catalogs, evaluate smart cross-sell upsells, pre-flight policy guardrails, and execute Razorpay transactions. Enter a goal below or pick a suggestion.'
      }
    ];
  });

  useEffect(() => {
    if (initialPrompt) setQuery(initialPrompt);
    if (initialMaxPrice) setMaxPrice(initialMaxPrice);
  }, [initialPrompt, initialMaxPrice]);

  // Load persistent order history from backend DB on mount
  useEffect(() => {
    fetchOrdersFromDB();
  }, []);

  // Persist chat messages to localStorage when updated
  useEffect(() => {
    try {
      localStorage.setItem('agent_chat_messages', JSON.stringify(messages.slice(-30)));
    } catch (e) {}
  }, [messages]);

  const handleClearHistory = () => {
    try {
      localStorage.removeItem('agent_chat_messages');
    } catch (e) {}
    setMessages([
      {
        id: Date.now(),
        sender: 'agent',
        type: 'welcome',
        text: 'Hello! I am your Autonomous Customer AI Buyer Agent. Chat history has been reset. Enter a new shopping goal below.'
      }
    ]);
  };

  const fetchOrdersFromDB = async () => {
    try {
      const res = await fetch('/api/orders?limit=50');
      if (res.ok) {
        const data = await res.json();
        if (data && data.orders) {
          setOrderHistory(data.orders);
        }
      }
    } catch (err) {
      console.error('Failed to fetch persistent orders:', err);
    }
  };

  const presets = [
    {
      title: 'Leather Biker Jacket (₹8,998)',
      prompt: 'Buy a Vintage Leather Biker Jacket under INR 10,000',
      budget: 10000
    },
    {
      title: 'ANC Earbuds Pro (₹3,499)',
      prompt: 'Find ANC Wireless Earbuds Pro under INR 5,000',
      budget: 5000
    },
    {
      title: 'Fitness Band & Accessory Bundle',
      prompt: 'Buy an AMOLED Smart Fitness Band with cross-sell accessories',
      budget: 8000
    }
  ];

  const handleRunGoal = async (promptToRun, overrideBudget = null) => {
    const activePrompt = promptToRun || query;
    if (!activePrompt.trim() || isLoading) return;

    const budgetToUse = overrideBudget !== null ? overrideBudget : maxPrice;

    // Add User Message
    const userMsgId = Date.now();
    const newUserMsg = {
      id: userMsgId,
      sender: 'user',
      text: activePrompt
    };
    setMessages((prev) => [...prev, newUserMsg]);
    if (!promptToRun) setQuery('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/mcp/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search_query: activePrompt,
          prompt: activePrompt,
          buyer_email: buyerEmail,
          max_price: budgetToUse,
          include_upsell: includeUpsell,
          auto_approve_stepup: autoApproveStepup
        })
      });

      const data = await response.json();
      
      if (!response.ok || data.detail) {
        throw new Error(data.detail?.message || data.detail || 'Agent execution failed.');
      }
      
      const agentMsgId = Date.now() + 1;
      const newAgentMsg = {
        id: agentMsgId,
        sender: 'agent',
        type: 'execution_result',
        data: data
      };

      setMessages((prev) => [...prev, newAgentMsg]);

      // If execution completed, save order to local order history state
      if (data.status === 'COMPLETED' && data.order_id) {
        const createStep = data.execution_log?.find(s => s.tool === 'create_order');
        const purchasedItems = createStep?.response?.result?.items || data.purchased_items || [];
        const newOrder = {
          order_id: data.order_id,
          total_amount: data.total_amount || (createStep?.response?.result?.total_amount),
          currency: 'INR',
          status: 'RAZORPAY_CAPTURED',
          razorpay_order_id: data.razorpay_order_id,
          razorpay_payment_id: data.razorpay_payment_id || 'pay_demo_captured',
          buyer_email: buyerEmail,
          items: purchasedItems,
          timestamp: new Date().toLocaleTimeString()
        };

        setOrderHistory(prev => [newOrder, ...prev]);
      }

      // Handle Step-Up Authorization Required Pause
      if (data.status === 'PAUSED_AWAITING_HUMAN_AUTH') {
        const orderId = data.order_id;
        const createStep = data.execution_log?.find(s => s.tool === 'create_order');
        const totalAmt = createStep?.response?.result?.total_amount || 8998;
        
        setPendingOrderData({
          order_id: orderId,
          total_amount: totalAmt,
          purchased_items: createStep?.response?.result?.items || []
        });

        setIsDrawerOpen(true);
      }

    } catch (err) {
      console.error('Failed to run agent sandbox goal:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'agent',
          type: 'error',
          text: 'Error contacting MCP Buyer Agent service. Please ensure FastAPI backend is running.'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStepupSuccess = (approvedOrder) => {
    setIsDrawerOpen(false);
    fetchOrdersFromDB();
    
    const targetOrderId = approvedOrder?.order_id || pendingOrderData?.order_id;
    const paymentId = approvedOrder?.razorpay_payment_id || `pay_stepup_${Date.now().toString(36)}`;

    // Add completed order to local order history
    setOrderHistory(prev => {
      const exists = prev.some(o => (o.order_id || o.id) === targetOrderId);
      if (exists) {
        return prev.map(o => (o.order_id || o.id) === targetOrderId ? { ...o, status: 'RAZORPAY_CAPTURED', razorpay_payment_id: paymentId } : o);
      }
      return [{
        order_id: targetOrderId,
        total_amount: approvedOrder?.total_amount || pendingOrderData?.total_amount || 0,
        currency: 'INR',
        status: 'RAZORPAY_CAPTURED',
        razorpay_payment_id: paymentId,
        buyer_email: buyerEmail,
        items: approvedOrder?.purchased_items || pendingOrderData?.purchased_items || [],
        timestamp: new Date().toLocaleTimeString()
      }, ...prev];
    });

    // Update execution status in conversation message thread
    setMessages(prev => prev.map(msg => {
      if (msg.type === 'execution_result' && (msg.data?.order_id === targetOrderId || msg.data?.status === 'PAUSED_AWAITING_HUMAN_AUTH')) {
        return {
          ...msg,
          data: {
            ...msg.data,
            order_id: targetOrderId,
            status: 'COMPLETED',
            message: `Step-Up Authorization Verified! Order ${targetOrderId} approved and captured via Razorpay.`,
            razorpay_payment_id: paymentId
          }
        };
      }
      return msg;
    }));
  };

  return (
    <div className="lumina-canvas min-h-screen text-[#191c1e] font-sans relative flex flex-col justify-between">
      
      {/* Top AI Agent Navigation Bar (ChatGPT / Gemini Header) */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-6 py-3.5 shadow-2xs">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          
          {/* Agent Identity */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#4648d4] to-[#8127cf] text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base text-[#191c1e]">Gemini AI Commerce Agent</span>
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-700 text-[10px] font-mono font-bold rounded-full border border-emerald-500/20">
                  MCP ENABLED
                </span>
              </div>
              <span className="text-xs text-[#767586] block">Autonomous Commerce & Razorpay Checkout</span>
            </div>
          </div>

          {/* Header Controls */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`px-3 py-1.5 text-xs font-mono rounded-xl border transition flex items-center space-x-1.5 ${
                showConfig 
                  ? 'bg-[#4648d4] text-white border-[#4648d4]' 
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Agent Settings</span>
            </button>

            <button
              onClick={() => setIsHistoryDrawerOpen(true)}
              className="px-3.5 py-1.5 bg-[#4648d4]/10 hover:bg-[#4648d4]/20 text-[#4648d4] text-xs font-semibold rounded-xl border border-[#4648d4]/20 flex items-center space-x-1.5 transition font-mono"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Orders ({orderHistory.length})</span>
            </button>
          </div>

        </div>

        {/* Collapsible Agent Settings Drawer Panel */}
        {showConfig && (
          <div className="max-w-3xl mx-auto pt-3 pb-1 border-t border-slate-200/80 mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-200">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
              <span className="text-[#767586] font-mono">Buyer Email:</span>
              <input
                type="email"
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-[#191c1e] font-mono focus:outline-none w-40"
              />
            </div>

            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
              <span className="text-[#767586] font-mono">Max Budget:</span>
              <div className="flex items-center space-x-1">
                <span className="font-mono text-[#4648d4] font-bold">₹</span>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-[#191c1e] font-mono focus:outline-none w-24"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs sm:col-span-3">
              <span className="text-[#767586] font-mono">Chat Memory:</span>
              <button
                onClick={handleClearHistory}
                className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs rounded-lg border border-rose-200 font-mono font-semibold transition"
              >
                Reset Chat History
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Conversation Container (Centered Claude/ChatGPT style) */}
      <main className="max-w-3xl mx-auto w-full flex-1 px-4 py-8 flex flex-col justify-between space-y-6">
        
        {/* Messages Feed */}
        <div className="space-y-6 flex-1">
          {messages.map((msg) => (
            <div key={msg.id} className="space-y-4">
              
              {/* User Prompt Bubble */}
              {msg.sender === 'user' && (
                <div className="flex items-start justify-end space-x-3 animate-in fade-in">
                  <div className="bg-[#4648d4] text-white px-4 py-3 rounded-2xl rounded-tr-xs max-w-xl shadow-sm text-xs sm:text-[13px] font-medium leading-relaxed">
                    {msg.text}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-[#191c1e] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <User className="w-4 h-4" />
                  </div>
                </div>
              )}

              {/* Welcome Banner */}
              {msg.type === 'welcome' && (
                <div className="flex items-start space-x-3.5 animate-in fade-in">
                  <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-[#4648d4] to-[#8127cf] text-white flex items-center justify-center shrink-0 shadow-md">
                    <Sparkles className="w-4 h-4 text-amber-300" />
                  </div>
                  <div className="bg-white border border-slate-200 p-4.5 sm:p-5 rounded-2xl rounded-tl-xs w-full text-[#191c1e] text-xs sm:text-[13px] leading-relaxed shadow-sm space-y-3">
                    <p className="font-medium">{msg.text}</p>
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
                      <span className="text-[11px] font-mono text-[#767586] uppercase block w-full mb-1">Suggested Prompts:</span>
                      {presets.map((p, pIdx) => (
                        <button
                          key={pIdx}
                          onClick={() => {
                            setMaxPrice(p.budget);
                            handleRunGoal(p.prompt, p.budget);
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-[#4648d4]/10 hover:text-[#4648d4] text-slate-700 text-xs rounded-full border border-slate-200 transition font-sans text-left"
                        >
                          + {p.title}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* AI Agent Execution Result */}
              {msg.type === 'execution_result' && (
                <div className="flex items-start space-x-3.5 animate-in fade-in">
                  <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-[#4648d4] to-[#8127cf] text-white flex items-center justify-center shrink-0 shadow-md">
                    <Sparkles className="w-4 h-4 text-amber-300" />
                  </div>

                  <div className="flex-1 w-full bg-white border border-slate-200/90 p-5 sm:p-6 rounded-2xl rounded-tl-xs space-y-4 text-[#191c1e] shadow-md">
                    
                    {/* Natural Language Agent Speech */}
                    {msg.data.message && (
                      <div className="p-3.5 bg-indigo-50/80 border border-indigo-200/80 rounded-xl flex items-start space-x-3 text-xs sm:text-[13px] text-[#191c1e]">
                        <Sparkles className="w-4 h-4 text-[#4648d4] shrink-0 mt-0.5" />
                        <p className="leading-relaxed font-medium">{msg.data.message}</p>
                      </div>
                    )}

                    {/* Execution Status Badge Header */}
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <div className="flex items-center space-x-2">
                        <Cpu className="w-4 h-4 text-[#4648d4]" />
                        <span className="font-bold text-xs text-[#191c1e] font-mono">MCP TOOL DISPATCH TRACE</span>
                      </div>

                      {msg.data.status === 'COMPLETED' && (
                        <span className="bg-emerald-500/10 text-emerald-700 text-xs px-3 py-1 rounded-full font-mono font-bold border border-emerald-500/20 flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>ORDER COMPLETED</span>
                        </span>
                      )}

                      {msg.data.status === 'PAUSED_AWAITING_HUMAN_AUTH' && (
                        <span className="bg-amber-500/10 text-amber-700 text-xs px-3 py-1 rounded-full font-mono font-bold border border-amber-500/20 flex items-center space-x-1 animate-pulse">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                          <span>PAUSED (HUMAN AUTH)</span>
                        </span>
                      )}

                      {msg.data.status === 'FAILED' && (
                        <span className="bg-amber-500/10 text-amber-700 text-xs px-2.5 py-1 rounded-full font-mono border border-amber-500/20">
                          NO MATCH FOUND
                        </span>
                      )}
                    </div>

                    {/* Step-by-Step MCP Tool Trace */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-mono text-[#767586] block">Trace ID: {msg.data.trace_id}</span>
                      <div className="space-y-1.5 font-mono text-xs">
                        {msg.data.execution_log?.map((step, sIdx) => (
                          <div key={sIdx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                            <span className="text-[#191c1e] flex items-center space-x-2">
                              <span className="text-[#4648d4] font-bold">Step {step.step}:</span>
                              <span className="text-slate-800 font-semibold">{step.tool}</span>
                            </span>
                            <span className="text-emerald-600 text-[11px] font-bold">OK (200)</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* HITL Pause Action Banner */}
                    {msg.data.status === 'PAUSED_AWAITING_HUMAN_AUTH' && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
                        <div className="flex items-start space-x-2 text-amber-900 text-xs">
                          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-amber-900">High-value order requires approval</p>
                            <p className="text-slate-700 mt-0.5">Order ID: {msg.data.order_id}. Policy limit was exceeded.</p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            const orderId = msg.data.order_id;
                            const createStep = msg.data.execution_log?.find((s) => s.tool === 'create_order');
                            const totalAmt = createStep?.response?.result?.total_amount || 8998;
                            setPendingOrderData({
                              order_id: orderId,
                              total_amount: totalAmt,
                              purchased_items: createStep?.response?.result?.items || []
                            });
                            setIsDrawerOpen(true);
                          }}
                          className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center justify-center space-x-2 transition"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>Open Approval Drawer</span>
                        </button>
                      </div>
                    )}

                    {/* Verified Purchase Receipt Card */}
                    {msg.data.status === 'COMPLETED' && (
                      <div className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3 font-sans shadow-2xs">
                        <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                          <div className="flex items-center space-x-2">
                            <PackageCheck className="w-4 h-4 text-emerald-600" />
                            <span className="font-bold text-xs text-emerald-900 uppercase tracking-wider">Verified Razorpay Purchase</span>
                          </div>
                          <span className="font-mono text-xs text-emerald-700 font-bold">{msg.data.order_id}</span>
                        </div>

                        {/* Items Purchased List */}
                        <div className="space-y-2">
                          {((msg.data.execution_log?.find(s => s.tool === 'create_order')?.response?.result?.items) || msg.data.purchased_items || []).map((item, iIdx) => {
                            const qty = item.quantity || 1;
                            const unitPrice = item.unit_price || item.price || (item.claimed_unit_price) || ((msg.data?.total_amount || 0) / qty);
                            const lineTotal = item.line_total || (unitPrice * qty);
                            return (
                              <div key={iIdx} className="flex items-center justify-between text-xs py-2 px-3 bg-white rounded-xl border border-slate-200">
                                <div>
                                  <span className="font-bold text-[#191c1e]">{getItemName(item)}</span>
                                  <span className="text-[11px] text-[#767586] font-mono block">SKU: {item.sku} &bull; Qty: {qty} @ ₹{unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <span className="font-mono font-bold text-emerald-700 text-sm">
                                  ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs border-t border-emerald-200 font-mono">
                          <span className="text-slate-600">Razorpay Ref: <strong className="text-[#4648d4]">{msg.data.razorpay_payment_id || 'pay_demo_captured'}</strong></span>
                          {msg.data.order_id && (
                            <a
                              href={`/api/orders/${msg.data.order_id}/receipt`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3.5 py-1.5 bg-[#4648d4] hover:bg-[#393bb3] text-white font-semibold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-2xs"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>View PDF Receipt</span>
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              )}

              {/* Error Message */}
              {msg.type === 'error' && (
                <div className="flex items-start space-x-3.5 animate-in fade-in">
                  <div className="w-8 h-8 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-md">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div className="bg-rose-50 border border-rose-200 p-4 rounded-3xl rounded-tl-xs max-w-2xl text-rose-900 text-xs font-mono leading-relaxed shadow-sm">
                    {msg.text}
                  </div>
                </div>
              )}

            </div>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-start space-x-3.5 animate-in fade-in">
              <div className="w-8 h-8 rounded-2xl bg-[#4648d4] text-white flex items-center justify-center shrink-0 shadow-md animate-pulse">
                <Sparkles className="w-4 h-4 text-amber-300" />
              </div>
              <div className="p-4 bg-white border border-slate-200 rounded-2xl text-xs font-mono text-[#767586] flex items-center space-x-2 shadow-sm">
                <RefreshCw className="w-4 h-4 text-[#4648d4] animate-spin" />
                <span>Evaluating request, pre-flighting policy engine & executing MCP tools...</span>
              </div>
            </div>
          )}
        </div>

        {/* Floating Interactive Prompt Box (ChatGPT / Claude / Gemini Style) */}
        <div className="pt-4 sticky bottom-6 z-20">
          <div className="bg-white border-2 border-[#4648d4]/30 focus-within:border-[#4648d4] shadow-2xl rounded-3xl p-3.5 transition-all space-y-3">
            
            {/* Quick Suggestion Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden border-b border-slate-100 pb-2">
              <span className="text-[11px] font-mono text-[#767586] shrink-0 pr-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#4648d4]" />
                <span>Quick Prompts:</span>
              </span>
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setMaxPrice(p.budget);
                    handleRunGoal(p.prompt, p.budget);
                  }}
                  disabled={isLoading}
                  className="px-3 py-1 bg-slate-100 hover:bg-[#4648d4]/10 hover:text-[#4648d4] text-slate-700 text-xs rounded-full border border-slate-200 transition shrink-0 font-sans"
                >
                  + {p.title}
                </button>
              ))}
            </div>

            {/* Input Form & Buttons */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRunGoal();
              }}
              className="flex items-end gap-3"
            >
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleRunGoal();
                  }
                }}
                placeholder="Ask Gemini AI Agent to buy a product (e.g. 'Buy a Vintage Leather Biker Jacket under INR 10,000')..."
                rows="2"
                className="flex-1 bg-transparent px-2 text-xs sm:text-[13px] text-[#191c1e] placeholder-slate-400 focus:outline-none resize-none font-sans leading-relaxed"
                disabled={isLoading}
              />

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="submit"
                  disabled={isLoading || !query.trim()}
                  className="px-5 py-2.5 bg-[#4648d4] hover:bg-[#393bb3] disabled:opacity-40 text-white text-xs font-semibold rounded-2xl shadow-md flex items-center space-x-1.5 transition"
                >
                  <span>Send Goal</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>

            {/* Bottom Config Indicator */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] font-mono text-[#767586]">
              <div className="flex items-center space-x-3">
                <span>Email: <strong className="text-slate-800">{buyerEmail}</strong></span>
                <span>Max Cap: <strong className="text-[#4648d4]">₹{maxPrice.toLocaleString('en-IN')}</strong></span>
              </div>
              <span className="text-[#767586]">Press Enter to send</span>
            </div>

          </div>
        </div>

      </main>

      {/* HITL Step-Up Authorization Approval Drawer */}
      <StepUpApprovalDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        orderData={pendingOrderData}
        buyerEmail={buyerEmail}
        onApproveSuccess={handleStepupSuccess}
      />

      {/* Customer Purchase History Drawer */}
      <CustomerOrderHistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        orders={orderHistory}
      />

    </div>
  );
}
