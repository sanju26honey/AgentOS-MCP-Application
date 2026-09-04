import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, Search, Sparkles, Filter, CheckCircle2, 
  AlertTriangle, XCircle, ArrowRight, Eye, Tag, Cpu, 
  Layers, Package, ChevronRight, RefreshCw, X, SlidersHorizontal,
  PlusCircle, ShieldCheck, Box, User, ArrowUpRight, ChevronDown,
  TrendingUp, Plus
} from 'lucide-react';

export function CustomerStorefront({ onNavigateToAgent }) {
  const [activeTab, setActiveTab] = useState('home'); // 'home' (Screen 1) | 'shop' (Screen 2) | 'inventory' (Stock)
  
  // Catalog & Filter States
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['All']);
  const [catalogStats, setCatalogStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('price-low');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [maxPriceFilter, setMaxPriceFilter] = useState(10000);
  
  // Product Detail Drawer (Screen 3) State
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedSize, setSelectedSize] = useState('M');
  const [upsellProducts, setUpsellProducts] = useState([]);
  const [isUpsellLoading, setIsUpsellLoading] = useState(false);

  // Inventory Management Sub-View State
  const [inventoryItems, setInventoryItems] = useState([]);
  const [isInventoryLoading, setIsInventoryLoading] = useState(false);
  const [restockSku, setRestockSku] = useState(null);
  const [restockAmount, setRestockAmount] = useState(10);
  const [restockMsg, setRestockMsg] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, searchQuery, sortBy, inStockOnly, maxPriceFilter]);

  const fetchInitialData = async () => {
    try {
      // 1. Fetch Categories
      const catRes = await fetch('/api/catalog/categories');
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(['All', ...(catData.categories || [])]);
      }

      // 2. Fetch Catalog Stats
      const statsRes = await fetch('/api/catalog/stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setCatalogStats(statsData);
      }
    } catch (err) {
      console.error('Failed to load initial storefront metadata:', err);
    }
  };

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      let url = `/api/catalog/search?limit=50&sort_by=${encodeURIComponent(sortBy)}`;
      if (selectedCategory && selectedCategory !== 'All') {
        url += `&category=${encodeURIComponent(selectedCategory)}`;
      }
      if (searchQuery.trim()) {
        url += `&query=${encodeURIComponent(searchQuery.trim())}`;
      }
      if (inStockOnly) {
        url += `&in_stock_only=true`;
      }
      if (maxPriceFilter < 10000) {
        url += `&max_price=${maxPriceFilter}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (err) {
      console.error('Failed to search storefront catalog:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInventory = async () => {
    setIsInventoryLoading(true);
    try {
      const res = await fetch('/api/catalog/inventory');
      if (res.ok) {
        const data = await res.json();
        setInventoryItems(data.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    } finally {
      setIsInventoryLoading(false);
    }
  };

  const fetchUpsells = async (sku) => {
    setIsUpsellLoading(true);
    try {
      const res = await fetch(`/api/catalog/upsell?sku=${encodeURIComponent(sku)}&limit=3`);
      if (res.ok) {
        const data = await res.json();
        setUpsellProducts(data || []);
      } else {
        setUpsellProducts([]);
      }
    } catch (err) {
      console.error('Failed to fetch upsells:', err);
      setUpsellProducts([]);
    } finally {
      setIsUpsellLoading(false);
    }
  };

  const handleOpenDetails = (product) => {
    setSelectedProduct(product);
    setSelectedSize('M');
    fetchUpsells(product.sku);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'inventory') {
      fetchInventory();
    }
  };

  const handleRestockSubmit = async (sku) => {
    try {
      const res = await fetch('/api/catalog/inventory/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, stock_delta: parseInt(restockAmount) })
      });
      if (res.ok) {
        setRestockMsg(`Successfully added +${restockAmount} units to ${sku}`);
        setRestockSku(null);
        fetchInventory();
        fetchProducts();
        fetchInitialData();
        setTimeout(() => setRestockMsg(''), 4000);
      }
    } catch (err) {
      console.error('Failed to update inventory:', err);
    }
  };

  const getStockBadge = (avail) => {
    if (avail <= 0) {
      return (
        <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 text-[11px] font-mono border border-rose-500/20 flex items-center gap-1">
          <XCircle className="w-3 h-3 text-rose-500" />
          <span>OUT OF STOCK</span>
        </span>
      );
    }
    if (avail <= 5) {
      return (
        <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 text-[11px] font-mono border border-amber-500/20 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          <span>LOW STOCK ({avail})</span>
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 text-[11px] font-mono border border-emerald-500/20 flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
        <span>IN STOCK ({avail})</span>
      </span>
    );
  };

  const featuredProduct = products.length > 0 ? products[0] : null;
  const secondaryProducts = products.slice(1, 3);

  return (
    <div className="lumina-canvas min-h-screen text-[#191c1e] font-sans relative pb-24 border-t border-slate-200/50">
      
      {/* LUMINA Light Top Header Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-6 py-4 transition-all">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          
          {/* Brand Logo */}
          <div className="flex items-center space-x-3">
            <span className="font-extrabold text-2xl tracking-tighter text-[#191c1e] font-sans">
              LUMINA
            </span>
            <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-700 text-[11px] rounded-full font-mono border border-emerald-500/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>LIVE INVENTORY</span>
            </span>
          </div>

          {/* Center Navigation Links (Tabs) */}
          <nav className="flex items-center space-x-8">
            <button
              onClick={() => handleTabChange('home')}
              className={`text-xs font-mono uppercase tracking-widest transition-colors ${
                activeTab === 'home'
                  ? 'text-[#4648d4] font-bold border-b-2 border-[#4648d4] pb-1'
                  : 'text-[#464554] hover:text-[#191c1e]'
              }`}
            >
              Home
            </button>

            <button
              onClick={() => handleTabChange('shop')}
              className={`text-xs font-mono uppercase tracking-widest transition-colors ${
                activeTab === 'shop'
                  ? 'text-[#4648d4] font-bold border-b-2 border-[#4648d4] pb-1'
                  : 'text-[#464554] hover:text-[#191c1e]'
              }`}
            >
              Shop
            </button>

            <button
              onClick={() => handleTabChange('inventory')}
              className={`text-xs font-mono uppercase tracking-widest transition-colors ${
                activeTab === 'inventory'
                  ? 'text-[#4648d4] font-bold border-b-2 border-[#4648d4] pb-1'
                  : 'text-[#464554] hover:text-[#191c1e]'
              }`}
            >
              Stock Inventory
            </button>
          </nav>

          {/* Right Header Action Icons */}
          <div className="flex items-center space-x-4 text-[#464554]">
            <button 
              onClick={() => handleTabChange('shop')}
              className="p-1.5 hover:text-[#191c1e] transition"
              title="Search Catalog"
            >
              <Search className="w-4 h-4" />
            </button>

            <button 
              onClick={() => setActiveTab('shop')}
              className="p-1.5 hover:text-[#191c1e] transition relative"
              title="Shopping Bag"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#4648d4] text-white text-[9px] font-mono font-bold rounded-full flex items-center justify-center">
                0
              </span>
            </button>

            <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-700">
              <User className="w-4 h-4" />
            </div>
          </div>

        </div>
      </header>

      {/* SCREEN 1: HERO SHOWCASE (HOME VIEW) */}
      {activeTab === 'home' && (
        <main className="max-w-6xl mx-auto px-6 pt-16 space-y-24 animate-in fade-in duration-300">
          
          {/* Hero Headline Section */}
          <section className="flex flex-col items-center justify-center text-center space-y-6 min-h-[50vh] relative pt-8">
            <h1 className="text-5xl md:text-7xl font-extralight tracking-tighter text-[#191c1e] max-w-4xl leading-tight font-sans">
              AETHERIC ESSENTIALS
            </h1>
            <p className="text-base text-[#464554] max-w-xl leading-relaxed font-sans opacity-90">
              Transcend ordinary aesthetics. Curated technology and fashion designed for the modern purist. Form follows refraction.
            </p>

            <div className="pt-4">
              <button
                onClick={() => handleTabChange('shop')}
                className="group relative px-8 py-3.5 bg-white text-[#191c1e] font-mono text-xs uppercase tracking-widest rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(70,72,212,0.15)] border border-slate-200/80 transition-all duration-300 flex items-center gap-2"
              >
                <span>Shop Now</span>
                <ArrowRight className="w-4 h-4 text-[#4648d4] group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Scroll Discover Indicator */}
            <div className="pt-12 flex flex-col items-center space-y-1 opacity-60">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#464554]">Discover</span>
              <ChevronDown className="w-4 h-4 text-[#464554] animate-bounce" />
            </div>
          </section>

          {/* Curated Artifacts Bento Grid Section */}
          <section className="space-y-8">
            <div className="flex items-end justify-between border-b border-slate-200/80 pb-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-normal text-[#191c1e] tracking-tight">
                  Curated Artifacts
                </h2>
                <p className="text-sm text-[#464554] mt-1">
                  Precision meets ethereal design.
                </p>
              </div>
              <button
                onClick={() => handleTabChange('shop')}
                className="text-xs font-mono text-[#4648d4] hover:text-[#8127cf] uppercase tracking-widest flex items-center space-x-1 transition-colors"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Bento Grid */}
            {featuredProduct && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                
                {/* Large Featured Card (8 Columns) */}
                <div className="md:col-span-8 glass-panel-lumina-light rounded-3xl overflow-hidden relative min-h-[460px] p-8 flex flex-col justify-between group hover-lift">
                  <div className="absolute inset-0 bg-gradient-to-tr from-slate-100/80 via-transparent to-indigo-50/30"></div>
                  
                  {/* Floating Product Image */}
                  <div className="absolute inset-0 p-8 flex items-center justify-center z-0">
                    <img
                      src={featuredProduct.image_url}
                      alt={featuredProduct.name}
                      className="w-full h-full object-contain max-h-[340px] group-hover:scale-105 transition-transform duration-700 ease-out drop-shadow-xl"
                    />
                  </div>

                  {/* Top Category Tag */}
                  <div className="relative z-10 flex justify-between items-start">
                    <span className="px-3 py-1 bg-white/80 backdrop-blur-md text-[11px] font-mono text-[#4648d4] rounded-full border border-slate-200 uppercase tracking-wider">
                      {featuredProduct.category} • NEW
                    </span>
                    {getStockBadge(featuredProduct.available_stock)}
                  </div>

                  {/* Bottom Glass Overlay Box */}
                  <div className="relative z-10 bg-white/75 backdrop-blur-xl p-6 rounded-2xl border border-white/90 shadow-lg flex items-center justify-between mt-auto">
                    <div className="space-y-1 max-w-lg">
                      <h3 className="text-xl font-bold text-[#191c1e]">{featuredProduct.name}</h3>
                      <p className="text-xs text-[#464554] line-clamp-1">{featuredProduct.description}</p>
                      <div className="text-base font-extrabold text-[#4648d4] font-mono pt-1">
                        ₹{featuredProduct.price.toLocaleString('en-IN')} INR
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenDetails(featuredProduct)}
                      className="w-12 h-12 rounded-full bg-[#191c1e] hover:bg-[#4648d4] text-white flex items-center justify-center transition-colors shadow-md shrink-0 ml-4"
                      title="Quick View & AI Buy"
                    >
                      <Plus className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Right Stacked Cards (4 Columns) */}
                <div className="md:col-span-4 flex flex-col gap-6">
                  {secondaryProducts.map((p) => (
                    <div
                      key={p.sku}
                      className="glass-panel-lumina-light rounded-3xl p-6 relative flex flex-col justify-between h-[218px] group hover-lift overflow-hidden"
                    >
                      <div className="absolute inset-0 z-0 p-4 flex items-center justify-end opacity-90">
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="h-full object-contain group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>

                      <div className="relative z-10">
                        <span className="text-[10px] font-mono text-[#767586] uppercase tracking-wider">{p.category}</span>
                        <h4 className="text-base font-bold text-[#191c1e] line-clamp-1 mt-0.5">{p.name}</h4>
                        <div className="text-sm font-bold text-[#4648d4] font-mono mt-1">
                          ₹{p.price.toLocaleString('en-IN')}
                        </div>
                      </div>

                      <div className="relative z-10 flex justify-end">
                        <button
                          onClick={() => handleOpenDetails(p)}
                          className="w-9 h-9 rounded-full bg-white text-[#191c1e] hover:bg-[#4648d4] hover:text-white border border-slate-200 flex items-center justify-center transition-colors shadow-sm"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            )}
          </section>

        </main>
      )}

      {/* SCREEN 2: PRODUCT DISCOVERY & CATALOG GRID (SHOP VIEW) */}
      {activeTab === 'shop' && (
        <main className="max-w-6xl mx-auto px-6 pt-12 space-y-10 animate-in fade-in duration-300">
          
          {/* Search Area */}
          <section className="w-full flex justify-center">
            <div className="glass-panel-lumina-light rounded-full px-6 py-3 flex items-center gap-4 w-full max-w-2xl border border-slate-200/80 shadow-sm">
              <Search className="w-5 h-5 text-[#767586]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search the catalog..."
                className="w-full bg-transparent font-mono text-xs text-[#191c1e] placeholder-[#767586] focus:outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-[#767586] hover:text-[#191c1e]">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </section>

          {/* 12-Column Catalog Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Sidebar Filters (Col 1-3) */}
            <aside className="lg:col-span-3 glass-panel-lumina-light rounded-3xl p-6 sticky top-28 space-y-8 border border-slate-200/80">
              
              {/* Category Filter */}
              <div>
                <h3 className="font-mono text-xs text-[#767586] mb-4 uppercase tracking-widest">
                  Categories
                </h3>
                <ul className="space-y-1.5 font-sans">
                  {categories.map((cat) => (
                    <li key={cat}>
                      <button
                        onClick={() => setSelectedCategory(cat)}
                        className={`w-full text-left py-2 px-3.5 rounded-xl text-xs transition-colors font-medium ${
                          selectedCategory === cat
                            ? 'text-[#4648d4] bg-[#4648d4]/10 font-bold'
                            : 'text-[#464554] hover:bg-slate-100 hover:text-[#191c1e]'
                        }`}
                      >
                        {cat}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Price Range Filter */}
              <div>
                <h3 className="font-mono text-xs text-[#767586] mb-4 uppercase tracking-widest">
                  Price Range (INR)
                </h3>
                <div className="space-y-3">
                  <input
                    type="range"
                    min="500"
                    max="10000"
                    step="500"
                    value={maxPriceFilter}
                    onChange={(e) => setMaxPriceFilter(Number(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-full appearance-none accent-[#4648d4] cursor-pointer"
                  />
                  <div className="flex justify-between font-mono text-xs text-[#464554]">
                    <span>₹0</span>
                    <span className="font-bold text-[#4648d4]">₹{maxPriceFilter.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Availability Toggle */}
              <div>
                <h3 className="font-mono text-xs text-[#767586] mb-3 uppercase tracking-widest">
                  Availability
                </h3>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                    className="rounded bg-white border-slate-300 text-[#4648d4] focus:ring-[#4648d4] h-4 w-4"
                  />
                  <span className="text-xs text-[#464554] font-medium">In Stock Only</span>
                </label>
              </div>

            </aside>

            {/* Product Grid Area (Col 4-12) */}
            <section className="lg:col-span-9 space-y-6">
              
              {/* Header Info */}
              <div className="flex justify-between items-end border-b border-slate-200/80 pb-4">
                <div>
                  <h1 className="text-2xl font-bold text-[#191c1e] tracking-tight">
                    {selectedCategory === 'All' ? 'Discover All Products' : `Discover ${selectedCategory}`}
                  </h1>
                  <p className="font-mono text-xs text-[#464554] mt-1">
                    Showing {products.length} catalog items
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs text-[#767586]">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-white border border-slate-300 rounded-xl py-1.5 px-3 text-xs text-[#191c1e] focus:outline-none focus:border-[#4648d4] font-sans"
                  >
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="name-asc">Name: A-Z</option>
                    <option value="stock-high">Stock: High to Low</option>
                  </select>
                </div>
              </div>

              {/* Product Grid */}
              {isLoading ? (
                <div className="py-20 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-[#4648d4] animate-spin mx-auto" />
                  <p className="text-sm font-mono text-[#767586]">Loading Lumina catalog...</p>
                </div>
              ) : products.length === 0 ? (
                <div className="glass-panel-lumina-light p-12 rounded-3xl text-center space-y-3 border border-slate-200/80">
                  <Layers className="w-10 h-10 text-slate-400 mx-auto" />
                  <h3 className="text-base font-bold text-[#191c1e]">No products match filter</h3>
                  <button
                    onClick={() => {
                      setSelectedCategory('All');
                      setSearchQuery('');
                      setMaxPriceFilter(10000);
                      setInStockOnly(false);
                    }}
                    className="px-4 py-2 bg-[#4648d4] text-white text-xs font-semibold rounded-full shadow-sm"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {products.map((product) => (
                    <div
                      key={product.sku}
                      className="glass-panel-lumina-light rounded-3xl p-4 border border-slate-200/80 hover:border-[#4648d4]/40 transition-all duration-300 flex flex-col justify-between hover-lift group"
                    >
                      {/* Product Image Container */}
                      <div className="bg-slate-50/80 rounded-2xl h-48 flex items-center justify-center p-4 relative overflow-hidden">
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-3 left-3">
                          <span className="px-2.5 py-1 rounded-full bg-white/90 text-[10px] font-mono text-[#191c1e] border border-slate-200 shadow-2xs">
                            {product.category}
                          </span>
                        </div>
                        <div className="absolute top-3 right-3">
                          {getStockBadge(product.available_stock)}
                        </div>
                      </div>

                      {/* Details */}
                      <div className="pt-4 space-y-2 flex-1 flex flex-col justify-between">
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono text-[#767586] tracking-wider uppercase">SKU: {product.sku}</span>
                          <h3 className="font-bold text-sm text-[#191c1e] line-clamp-1 group-hover:text-[#4648d4] transition">
                            {product.name}
                          </h3>
                          <p className="text-xs text-[#464554] line-clamp-2 leading-relaxed">
                            {product.description}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-slate-200/60 space-y-2">
                          <div className="flex items-center justify-between font-mono">
                            <span className="text-xs text-[#767586]">Price</span>
                            <span className="text-base font-extrabold text-[#4648d4]">
                              ₹{product.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleOpenDetails(product)}
                              className="w-full py-2 px-3 bg-white hover:bg-slate-100 text-[#191c1e] text-xs font-semibold rounded-xl border border-slate-300 flex items-center justify-center space-x-1 transition"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-600" />
                              <span>Quick View</span>
                            </button>

                            <button
                              onClick={() => {
                                const prompt = `Buy a ${product.name} under INR ${Math.ceil(product.price * 1.25)}`;
                                onNavigateToAgent(prompt, Math.ceil(product.price * 1.25));
                              }}
                              className="w-full py-2 px-3 bg-[#4648d4] hover:bg-[#393bb3] text-white text-xs font-semibold rounded-xl shadow-sm flex items-center justify-center space-x-1 transition"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                              <span>Buy with AI</span>
                            </button>
                          </div>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}

            </section>

          </div>

        </main>
      )}

      {/* SCREEN 3: PRODUCT DETAIL & AI SMART UPSELL DRAWER / MODAL */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel-lumina-light w-full max-w-3xl rounded-[32px] border border-white overflow-hidden shadow-2xl space-y-0 relative animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-6 bg-white/90 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <ShoppingBag className="w-5 h-5 text-[#4648d4]" />
                <div>
                  <h3 className="text-base font-bold text-[#191c1e]">{selectedProduct.name}</h3>
                  <span className="text-xs text-[#767586] font-mono">SKU: {selectedProduct.sku}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8 max-h-[80vh] overflow-y-auto space-y-8">
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                {/* Hero Image Panel */}
                <div className="md:col-span-6 bg-slate-50 rounded-2xl p-6 flex items-center justify-center h-72 border border-slate-200/80 relative">
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    className="w-full h-full object-contain drop-shadow-md"
                  />
                  <div className="absolute top-3 left-3">
                    <span className="px-3 py-1 rounded-full bg-[#4648d4]/10 text-[#4648d4] text-[10px] font-mono font-bold">
                      NEW ARRIVAL
                    </span>
                  </div>
                </div>

                {/* Details & Specs */}
                <div className="md:col-span-6 space-y-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-semibold text-[#464554]">
                        {selectedProduct.category}
                      </span>
                      {getStockBadge(selectedProduct.available_stock)}
                    </div>

                    <div className="text-3xl font-extrabold text-[#4648d4] font-mono pt-1">
                      ₹{selectedProduct.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })} INR
                    </div>

                    <p className="text-xs text-[#464554] leading-relaxed">
                      {selectedProduct.description}
                    </p>
                  </div>

                  {/* Size Selection */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-mono text-[#767586] uppercase">Select Size Variant:</span>
                    <div className="flex items-center space-x-2">
                      {['S', 'M', 'L', 'XL'].map((size) => (
                        <button
                          key={size}
                          onClick={() => setSelectedSize(size)}
                          className={`w-9 h-9 rounded-xl text-xs font-mono font-bold transition ${
                            selectedSize === size
                              ? 'bg-[#4648d4] text-white shadow-md'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* AI Purchase Action */}
                  <button
                    onClick={() => {
                      const prompt = `Buy a ${selectedProduct.name} (Size: ${selectedSize}) under INR ${Math.ceil(selectedProduct.price * 1.25)}`;
                      const targetMaxPrice = Math.ceil(selectedProduct.price * 1.25);
                      setSelectedProduct(null);
                      onNavigateToAgent(prompt, targetMaxPrice);
                    }}
                    className="w-full py-3.5 px-4 bg-[#4648d4] hover:bg-[#393bb3] text-white font-mono font-semibold text-xs rounded-xl shadow-md flex items-center justify-center space-x-2 transition"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>DELEGATE TO AI AGENT</span>
                  </button>
                </div>
              </div>

              {/* AI Smart Upsell Recommendations: "Enhance Your Experience" */}
              <div className="pt-6 border-t border-slate-200 space-y-4">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-[#4648d4]" />
                  <h4 className="text-xs font-mono font-bold text-[#191c1e] uppercase tracking-wider">
                    Enhance Your Experience • AI Smart Upsell Recommendations
                  </h4>
                </div>

                {isUpsellLoading ? (
                  <div className="py-4 text-center text-xs text-[#767586] font-mono">
                    Evaluating cross-sell recommendation graph...
                  </div>
                ) : upsellProducts.length === 0 ? (
                  <p className="text-xs text-[#767586]">No complementary products mapped for this item.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {upsellProducts.map((rec) => (
                      <div key={rec.sku} className="p-3 bg-white rounded-2xl border border-slate-200/80 space-y-2 shadow-2xs">
                        <div className="h-20 bg-slate-50 rounded-xl overflow-hidden p-2 flex items-center justify-center">
                          <img src={rec.image_url} alt={rec.name} className="h-full object-contain" />
                        </div>
                        <div className="text-xs font-bold text-[#191c1e] line-clamp-1">{rec.name}</div>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs font-mono text-[#4648d4] font-bold">
                            ₹{rec.price.toLocaleString('en-IN')}
                          </span>
                          <button
                            onClick={() => {
                              setSelectedProduct(rec);
                              fetchUpsells(rec.sku);
                            }}
                            className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono rounded"
                          >
                            View
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

      {/* STOCK INVENTORY MANAGEMENT SUB-VIEW */}
      {activeTab === 'inventory' && (
        <main className="max-w-6xl mx-auto px-6 pt-12 space-y-6 animate-in fade-in duration-300">
          
          <div className="glass-panel-lumina-light p-6 rounded-3xl border border-slate-200/80 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#191c1e] flex items-center space-x-2">
                  <Box className="w-5 h-5 text-[#4648d4]" />
                  <span>Real-Time Merchant Stock Inventory</span>
                </h3>
                <p className="text-xs text-[#464554]">Monitor stock levels, reserved units, and restock products in real-time.</p>
              </div>

              <button
                onClick={fetchInventory}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-[#191c1e] text-xs font-semibold rounded-xl border border-slate-300 flex items-center space-x-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isInventoryLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {restockMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center space-x-2 font-mono">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{restockMsg}</span>
              </div>
            )}

            {isInventoryLoading ? (
              <div className="py-12 text-center text-xs text-[#767586] font-mono">
                Loading inventory status database...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-[#767586] font-mono text-[11px] uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-3">SKU</th>
                      <th className="p-3">Product Name</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Price</th>
                      <th className="p-3">Available Stock</th>
                      <th className="p-3">Reserved Stock</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Quick Restock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 font-sans">
                    {inventoryItems.map((item) => (
                      <tr key={item.sku} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-mono font-semibold text-[#191c1e]">{item.sku}</td>
                        <td className="p-3 font-bold text-[#191c1e]">{item.name}</td>
                        <td className="p-3 text-[#464554]">{item.category}</td>
                        <td className="p-3 font-mono text-[#191c1e]">₹{item.price.toLocaleString('en-IN')}</td>
                        <td className="p-3 font-mono font-bold text-emerald-600">{item.available_stock}</td>
                        <td className="p-3 font-mono text-amber-600">{item.reserved_stock}</td>
                        <td className="p-3">{getStockBadge(item.available_stock)}</td>
                        <td className="p-3">
                          {restockSku === item.sku ? (
                            <div className="flex items-center space-x-1">
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={restockAmount}
                                onChange={(e) => setRestockAmount(e.target.value)}
                                className="w-16 px-2 py-1 bg-white border border-slate-300 rounded text-xs text-[#191c1e] font-mono"
                              />
                              <button
                                onClick={() => handleRestockSubmit(item.sku)}
                                className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[11px] font-semibold"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setRestockSku(null)}
                                className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[11px]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setRestockSku(item.sku);
                                setRestockAmount(10);
                              }}
                              className="px-2.5 py-1 bg-[#4648d4]/10 hover:bg-[#4648d4]/20 text-[#4648d4] rounded-lg border border-[#4648d4]/20 text-[11px] font-semibold flex items-center space-x-1"
                            >
                              <PlusCircle className="w-3 h-3" />
                              <span>+ Restock</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>

        </main>
      )}

      {/* LUMINA Minimalist Footer */}
      <footer className="w-full py-12 border-t border-slate-200/80 mt-20 relative z-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start gap-1">
            <span className="font-extrabold text-xl text-[#191c1e] tracking-tighter">
              LUMINA
            </span>
            <span className="font-mono text-[10px] text-[#767586]">
              © 2026 LUMINA AESTHETICS. ALL RIGHTS RESERVED.
            </span>
          </div>

          <div className="flex items-center space-x-6 font-mono text-[11px] text-[#464554] uppercase tracking-widest">
            <a href="#" className="hover:text-[#191c1e] transition-colors">Privacy</a>
            <a href="#" className="hover:text-[#191c1e] transition-colors">Terms</a>
            <a href="#" className="hover:text-[#191c1e] transition-colors">Sustainability</a>
            <a href="#" className="hover:text-[#191c1e] transition-colors">Press</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
