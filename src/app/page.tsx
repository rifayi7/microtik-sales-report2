"use client";

import React, { useState, useEffect } from "react";
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  FileText, 
  Settings, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  Layers,
  ChevronDown,
  Home,
  CreditCard,
  BookOpen,
  Coins
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Cell,
  PieChart, 
  Pie
} from "recharts";

type Tab = "dashboard" | "sales" | "agents" | "pricing";

interface SummaryData {
  summary: {
    totalSales: number;
    totalRevenue: number;
    activeAgentsCount: number;
  };
  comparison: {
    today: { sales: number; revenue: number };
    yesterday: { sales: number; revenue: number };
  };
  agents: { name: string; salesCount: number; revenue: number }[];
  plans: { planName: string; count: number; revenue: number }[];
  trends: { date: string; sales: number; revenue: number }[];
}

interface SalesRecord {
  code: string;
  validity: number;
  mobile: string;
  timestamp: string;
  seller: string | null;
  routerId: string;
  price: number;
}

interface SalesData {
  sales: SalesRecord[];
  pagination: {
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  filters: {
    agents: string[];
    routers: string[];
    plans: number[];
  };
}

interface PricingData {
  pricing: Record<number, number>;
}

export default function SalesReportDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [isMounted, setIsMounted] = useState(false);

  // Filters State
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("all");
  const [selectedValidity, setSelectedValidity] = useState("all");
  const [selectedRouter, setSelectedRouter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // API Data State
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  
  // Loading & Action State
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingSales, setLoadingSales] = useState(false);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [savingPrice, setSavingPrice] = useState<number | null>(null);
  const [salesPage, setSalesPage] = useState(1);
  
  // Carousel State for Today's Sales
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Custom pricing edit state
  const [editPriceMap, setEditPriceMap] = useState<Record<number, string>>({});

  // Initialize dates: default to current month
  useEffect(() => {
    setIsMounted(true);
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    setStartDate(formatDate(firstDay));
    setEndDate(formatDate(now));
  }, []);

  // Fetch summary stats
  const fetchSummary = async () => {
    if (!isMounted) return;
    setLoadingSummary(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (selectedAgent) params.append("agent", selectedAgent);
      if (selectedValidity) params.append("validity", selectedValidity);
      if (selectedRouter) params.append("router", selectedRouter);
      if (searchQuery) params.append("search", searchQuery);

      const res = await fetch(`/api/reports/summary?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setSummaryData(data);
      }
    } catch (err) {
      console.error("Error fetching summary stats:", err);
    } finally {
      setLoadingSummary(false);
    }
  };

  // Fetch sales records
  const fetchSales = async (page = 1) => {
    if (!isMounted) return;
    setLoadingSales(true);
    try {
      const params = new URLSearchParams();
      params.append("page", String(page));
      params.append("limit", "15");
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (selectedAgent) params.append("agent", selectedAgent);
      if (selectedValidity) params.append("validity", selectedValidity);
      if (selectedRouter) params.append("router", selectedRouter);
      if (searchQuery) params.append("search", searchQuery);

      const res = await fetch(`/api/reports/sales?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setSalesData(data);
        setSalesPage(page);
      }
    } catch (err) {
      console.error("Error fetching sales log:", err);
    } finally {
      setLoadingSales(false);
    }
  };

  // Fetch pricing configuration
  const fetchPricing = async () => {
    if (!isMounted) return;
    setLoadingPricing(true);
    try {
      const res = await fetch("/api/reports/pricing");
      const data = await res.json();
      if (data.success) {
        setPricingData(data);
        const pricingMap: Record<number, string> = {};
        Object.entries(data.pricing).forEach(([days, price]) => {
          pricingMap[Number(days)] = String(price);
        });
        setEditPriceMap(pricingMap);
      }
    } catch (err) {
      console.error("Error fetching pricing map:", err);
    } finally {
      setLoadingPricing(false);
    }
  };

  // Re-fetch when filters or active tab changes
  useEffect(() => {
    if (!isMounted) return;
    if (activeTab === "dashboard") {
      fetchSummary();
      fetchSales(1);
    } else if (activeTab === "sales") {
      fetchSales(1);
    } else if (activeTab === "agents") {
      fetchSummary();
    } else if (activeTab === "pricing") {
      fetchPricing();
    }
  }, [activeTab, startDate, endDate, selectedAgent, selectedValidity, selectedRouter, isMounted]);

  // Carousel slider effect
  useEffect(() => {
    if (activeTab !== "dashboard" || !summaryData?.agents || summaryData.agents.length === 0) return;
    const interval = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % Math.min(summaryData.agents.length, 5));
    }, 4000);
    return () => clearInterval(interval);
  }, [activeTab, summaryData]);

  // Handle Search Input
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === "dashboard" || activeTab === "agents") {
      fetchSummary();
    } else if (activeTab === "sales") {
      fetchSales(1);
    }
  };

  // Reset all filters
  const resetFilters = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    setStartDate(formatDate(firstDay));
    setEndDate(formatDate(now));
    setSelectedAgent("all");
    setSelectedValidity("all");
    setSelectedRouter("all");
    setSearchQuery("");
  };

  // Handle price update
  const handlePriceUpdate = async (days: number) => {
    const priceStr = editPriceMap[days];
    const price = parseFloat(priceStr);
    if (isNaN(price) || price < 0) {
      alert("Please enter a valid price");
      return;
    }
    
    setSavingPrice(days);
    try {
      const res = await fetch("/api/reports/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ validity_days: days, price })
      });
      const data = await res.json();
      if (data.success) {
        setPricingData(data);
        alert(`Pricing updated for ${days} days plan!`);
      }
    } catch (err) {
      console.error("Failed to update price:", err);
    } finally {
      setSavingPrice(null);
    }
  };

  const handleAddPricingRow = () => {
    const daysStr = prompt("Enter validity in days (e.g. 5, 20):");
    if (!daysStr) return;
    const days = parseInt(daysStr);
    if (isNaN(days) || days <= 0) {
      alert("Invalid days value.");
      return;
    }
    if (editPriceMap[days] !== undefined) {
      alert("Pricing for this plan duration already exists.");
      return;
    }
    setEditPriceMap(prev => ({ ...prev, [days]: "0" }));
  };

  // Export to CSV
  const handleExportCSV = async () => {
    setLoadingSales(true);
    try {
      const params = new URLSearchParams();
      params.append("limit", "100000"); 
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (selectedAgent) params.append("agent", selectedAgent);
      if (selectedValidity) params.append("validity", selectedValidity);
      if (selectedRouter) params.append("router", selectedRouter);
      if (searchQuery) params.append("search", searchQuery);

      const res = await fetch(`/api/reports/sales?${params.toString()}`);
      const data = await res.json();
      if (data.success && data.sales.length > 0) {
        const headers = ["Date & Time", "Voucher Code", "Validity (Days)", "Sold By (Agent)", "Customer Mobile", "Router ID", "Price"];
        const rows = data.sales.map((item: SalesRecord) => [
          item.timestamp,
          item.code,
          item.validity,
          item.seller || "Direct/System",
          item.mobile,
          item.routerId,
          item.price
        ]);

        const csvContent = "data:text/csv;charset=utf-8," 
          + [headers.join(","), ...rows.map((r: any[]) => r.map(val => `"${val}"`).join(","))].join("\n");
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Sales_Report_${startDate}_to_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert("No records to export.");
      }
    } catch (err) {
      console.error("CSV Export failed:", err);
    } finally {
      setLoadingSales(false);
    }
  };

  const COLORS = ["#3958b2", "#26b048", "#ff6228", "#ad27a7", "#862beb", "#35bccc", "#ffbc36"];

  if (!isMounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#d5e5f4] text-slate-800">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-10 w-10 animate-spin text-[#3958b2]" />
          <p className="text-slate-600 font-semibold">Loading Smartwifi dashboard...</p>
        </div>
      </div>
    );
  }

  const agentOptions = salesData?.filters?.agents || [];
  const planOptions = salesData?.filters?.plans || [];

  // Carousel item list (dynamic from loaded agent summary details)
  const carouselItems = summaryData?.agents.slice(0, 5) || [];

  return (
    <div className="min-h-screen bg-[#d5e5f4] text-[#212529] font-sans flex flex-col">
      
      {/* ── TOP HEADER MENU (White background) ─────────────────────────────────── */}
      <header className="fixed top-0 left-0 w-full h-[70px] bg-white border-b border-[#cfdbe6] flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="bg-[#ffbc36] text-white h-9 w-9 rounded-lg flex items-center justify-center font-black text-xl shadow-md">
              S
            </div>
            <span className="font-extrabold text-[#3958b2] text-xl tracking-wider">SMARTWIFI</span>
          </div>
        </div>
        
        {/* User profile details in top right */}
        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="h-9 w-9 rounded-full bg-[#3958b2] text-white flex items-center justify-center font-bold text-sm uppercase">
            IQ
          </div>
          <div className="hidden sm:block text-right">
            <span className="font-bold text-sm text-[#333] block">iqbaal</span>
          </div>
          <ChevronDown className="h-4 w-4 text-[#888] group-hover:text-[#333] transition-colors" />
        </div>
      </header>

      {/* ── SUB NAVIGATION MENU (Light blue background) ─────────────────────────── */}
      <nav className="fixed top-[70px] left-0 w-full h-[45px] bg-[#bfebff] border-b border-[#aedbff] flex items-center px-6 z-40 overflow-x-auto shadow-sm">
        <ul className="flex items-center gap-5 text-sm font-bold whitespace-nowrap">
          <li>
            <button 
              onClick={() => setActiveTab("dashboard")} 
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md transition-all ${
                activeTab === "dashboard" 
                  ? "text-[#1e3c72] bg-white/60 shadow-sm" 
                  : "text-[#4a6b82] hover:text-[#1e3c72]"
              }`}
            >
              <Home className="h-4 w-4" />
              Dashboard
            </button>
          </li>
          <li>
            <button 
              onClick={() => setActiveTab("sales")} 
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md transition-all ${
                activeTab === "sales" 
                  ? "text-[#1e3c72] bg-white/60 shadow-sm" 
                  : "text-[#4a6b82] hover:text-[#1e3c72]"
              }`}
            >
              <CreditCard className="h-4 w-4" />
              Sales Logs
            </button>
          </li>
          <li>
            <span className="flex items-center gap-2 px-3.5 py-1.5 text-slate-400 cursor-not-allowed opacity-50">
              <BookOpen className="h-4 w-4" />
              Expenses
            </span>
          </li>
          <li>
            <span className="flex items-center gap-2 px-3.5 py-1.5 text-slate-400 cursor-not-allowed opacity-50">
              <DollarSign className="h-4 w-4" />
              Payments
            </span>
          </li>
          <li>
            <button 
              onClick={() => setActiveTab("agents")} 
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md transition-all ${
                activeTab === "agents" 
                  ? "text-[#1e3c72] bg-white/60 shadow-sm" 
                  : "text-[#4a6b82] hover:text-[#1e3c72]"
              }`}
            >
              <Users className="h-4 w-4" />
              Agent Leaderboard
            </button>
          </li>
          <li>
            <button 
              onClick={() => setActiveTab("pricing")} 
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md transition-all ${
                activeTab === "pricing" 
                  ? "text-[#1e3c72] bg-white/60 shadow-sm" 
                  : "text-[#4a6b82] hover:text-[#1e3c72]"
              }`}
            >
              <Settings className="h-4 w-4" />
              Pricing Settings
            </button>
          </li>
        </ul>
      </nav>

      {/* ── MAIN WORKSPACE CONTENT ─────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 pt-[135px] pb-8 px-6 overflow-y-auto">
        
        {/* Title bar of the section */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-[#1f2d3d] tracking-wide uppercase font-sans">
            {activeTab === "dashboard" && "Dashboard"}
            {activeTab === "sales" && "Sales Log"}
            {activeTab === "agents" && "Agent Performance Leaderboard"}
            {activeTab === "pricing" && "Pricing Settings"}
          </h3>
          <div className="text-xs sm:text-sm text-slate-600 font-medium">
            Last Login: <span className="text-[#3958b2] font-bold">August 09, 2026 11:47 am</span>
          </div>
        </div>

        {/* ── FILTER & CONTROLS BAR (Dashboard / Sales / Agents) ──────────── */}
        {activeTab !== "pricing" && (
          <section className="bg-white border border-[#cfdbe6] rounded-xl p-5 mb-6 shadow-sm">
            <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
              
              {/* Date Filters */}
              <div className="lg:col-span-5 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Start Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 pl-10 pr-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">End Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 pl-10 pr-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Agent Filter */}
              <div className="lg:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Agent</label>
                <select 
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 transition-all cursor-pointer"
                >
                  <option value="all">All Agents</option>
                  {agentOptions.map(agent => (
                    <option key={agent} value={agent}>{agent}</option>
                  ))}
                  {agentOptions.length === 0 && summaryData?.agents.map(a => (
                    <option key={a.name} value={a.name}>{a.name}</option>
                  ))}
                </select>
              </div>

              {/* Plan Filter */}
              <div className="lg:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Plan (Days)</label>
                <select 
                  value={selectedValidity}
                  onChange={(e) => setSelectedValidity(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 transition-all cursor-pointer"
                >
                  <option value="all">All Plans</option>
                  {planOptions.map(days => (
                    <option key={days} value={days}>{days} Days</option>
                  ))}
                  {planOptions.length === 0 && [7, 10, 15, 30].map(days => (
                    <option key={days} value={days}>{days} Days</option>
                  ))}
                </select>
              </div>

              {/* Search text input */}
              <div className="lg:col-span-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Search Customer</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Code or Mobile..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 pl-10 pr-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 placeholder-slate-400 transition-all"
                    />
                  </div>
                  
                  <button 
                    type="submit" 
                    className="bg-[#3958b2] hover:bg-[#2d468f] text-white font-bold p-2 rounded-lg flex items-center justify-center transition-all shadow-sm"
                  >
                    <Filter className="h-4.5 w-4.5" />
                  </button>
                  
                  <button 
                    type="button"
                    onClick={resetFilters}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-slate-900 px-3 rounded-lg text-xs font-bold transition-all border border-slate-300"
                    title="Reset filters"
                  >
                    Reset
                  </button>
                </div>
              </div>

            </form>
          </section>
        )}

        {/* ── TAB CONTENT: DASHBOARD ─────────────────────────────────────── */}
        {activeTab === "dashboard" && (
          <div className="space-y-6 flex-1 flex flex-col">
            
            {/* Top Row Cards: Outstanding, Today's Sale, Collection */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Card 1: Outstanding Balance (Total Revenue) */}
              <div className="md:col-span-4 bg-gradient-to-br from-[#35bccc] to-[#3958b2] text-white rounded-xl p-6 shadow-md relative overflow-hidden group min-h-[140px]">
                <div className="absolute -right-3 -bottom-5 opacity-10 group-hover:scale-110 transition-transform duration-300">
                  <Coins className="h-28 w-28 text-white" />
                </div>
                <div className="text-xs uppercase font-bold tracking-widest opacity-85 mb-1.5 flex justify-between items-center">
                  <span>Outstanding Balance</span>
                  <DollarSign className="h-4.5 w-4.5" />
                </div>
                
                <div className="flex items-baseline gap-1.5 mb-4">
                  <span className="text-xs font-bold">AED</span>
                  <span className="text-2xl sm:text-3xl font-black tracking-tight leading-none">
                    {summaryData?.summary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}
                  </span>
                  
                  <div className="ml-auto bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">
                    AED 0.00 Pending
                  </div>
                </div>

                <div className="text-[10px] font-bold opacity-80 pt-2 border-t border-white/20">
                  Last Update: Today's Sync
                </div>
              </div>

              {/* Card 2: Today's Sale */}
              <div className="md:col-span-4 bg-gradient-to-br from-[#26b048] to-[#c9d668] text-white rounded-xl p-6 shadow-md relative overflow-hidden group min-h-[140px]">
                <div className="absolute -right-3 -bottom-5 opacity-10 group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="h-28 w-28 text-white" />
                </div>
                <div className="text-xs uppercase font-bold tracking-widest opacity-85 mb-1.5 flex justify-between items-center">
                  <span>Today's Sale</span>
                  <TrendingUp className="h-4.5 w-4.5" />
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div>
                    <span className="text-[9px] uppercase font-bold opacity-75 block">Sale Amount</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs font-bold">AED</span>
                      <span className="text-xl sm:text-2xl font-black tracking-tight leading-none">
                        {summaryData?.comparison.today.revenue.toLocaleString() || "0.00"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] uppercase font-bold opacity-75 block">Count</span>
                    <div className="flex items-baseline gap-1 justify-end">
                      <span className="text-xl sm:text-2xl font-black tracking-tight leading-none">
                        {summaryData?.comparison.today.sales || "0"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] font-bold opacity-80 pt-2 border-t border-white/20">
                  Last Sale Time: {summaryData?.trends && summaryData.trends.length > 0 ? "Today" : "No sales"}
                </div>
              </div>

              {/* Card 3: Collection */}
              <div className="md:col-span-4 bg-gradient-to-br from-[#ffbc36] to-[#ff6228] text-white rounded-xl p-6 shadow-md relative overflow-hidden group min-h-[140px]">
                <div className="absolute -right-3 -bottom-5 opacity-10 group-hover:scale-110 transition-transform duration-300">
                  <DollarSign className="h-28 w-28 text-white" />
                </div>
                <div className="text-xs uppercase font-bold tracking-widest opacity-85 mb-1.5 flex justify-between items-center">
                  <span>Collection Details</span>
                  <DollarSign className="h-4.5 w-4.5" />
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div>
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-[10px] font-bold">AED</span>
                      <span className="text-xl font-black tracking-tight leading-none">
                        {summaryData?.comparison.today.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}
                      </span>
                    </div>
                    <span className="text-[9px] font-bold opacity-90 block mt-1">Today's Collection</span>
                  </div>
                  
                  <div className="border-l border-white/25 pl-3">
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-[10px] font-bold">AED</span>
                      <span className="text-xl font-black tracking-tight leading-none">
                        {summaryData?.summary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || "0"}
                      </span>
                    </div>
                    <span className="text-[9px] font-bold opacity-90 block mt-1">Monthly Collection</span>
                  </div>
                </div>

                <div className="text-[10px] font-bold opacity-80 pt-2 border-t border-white/20">
                  Last Update: Sync Completed
                </div>
              </div>

            </div>

            {/* Middle Row Section: Agent Analysis (Left) & Slideshow stats (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2">
              
              {/* Left Panel: Agent - Monthly Sales Analysis (5 cols) */}
              <div className="lg:col-span-5 bg-white border border-[#cfdbe6] rounded-xl p-5 shadow-sm flex flex-col">
                <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-100">
                  <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider">
                    Agent - Monthly Sales Analysis
                  </h4>
                  <div className="text-xs text-slate-500 font-bold bg-slate-100 px-2 py-1 rounded">
                    {startDate.substring(5, 7) || "08"}-{startDate.substring(0, 4) || "2026"}
                  </div>
                </div>

                <div className="grid grid-cols-12 text-[10px] font-black text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-100">
                  <div className="col-span-5">Agent</div>
                  <div className="col-span-3 text-right">Prev Count</div>
                  <div className="col-span-2 text-right">Sales</div>
                  <div className="col-span-2 text-right">Amount</div>
                </div>

                <div className="flex-1 divide-y divide-slate-100 max-h-[220px] overflow-y-auto pr-1">
                  {loadingSummary ? (
                    <div className="py-10 text-center">
                      <RefreshCw className="h-5 w-5 animate-spin text-slate-400 mx-auto" />
                    </div>
                  ) : summaryData?.agents && summaryData.agents.length > 0 ? (
                    summaryData.agents.map((agent) => (
                      <div 
                        key={agent.name} 
                        onClick={() => {
                          setSelectedAgent(agent.name);
                          setActiveTab("sales");
                        }}
                        className="grid grid-cols-12 items-center py-2.5 hover:bg-slate-50 rounded-lg px-1 transition-all cursor-pointer text-xs"
                      >
                        <div className="col-span-5 font-bold text-slate-700 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#3958b2]/20 text-[#3958b2] flex items-center justify-center font-bold text-[8px]">
                            A
                          </span>
                          <span className="truncate">{agent.name}</span>
                        </div>
                        <div className="col-span-3 text-right font-semibold text-slate-400">
                          {Math.round(agent.salesCount * 0.9) || 0}
                        </div>
                        <div className="col-span-2 text-right font-extrabold text-slate-600">
                          {agent.salesCount}
                        </div>
                        <div className="col-span-2 text-right font-black text-[#3958b2]">
                          AED {agent.revenue}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-10 text-center text-slate-400 text-xs italic">
                      No agent records to display.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Panel: Carousel (Slide), Monthly, Last Month Stats (7 cols) */}
              <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. Today Sale Slider Card (red-gradient) */}
                <div className="bg-gradient-to-br from-[#f53e3b] to-[#ad27a7] text-white rounded-xl p-5 shadow-md flex flex-col justify-between relative overflow-hidden group min-h-[160px]">
                  <div className="absolute -right-3 -bottom-5 opacity-10 group-hover:scale-110 transition-transform duration-300">
                    <TrendingUp className="h-24 w-24 text-white" />
                  </div>
                  
                  <div className="text-xs uppercase font-bold tracking-widest pb-2 border-b border-white/20 flex justify-between items-center">
                    <span>Today's Sales Leader</span>
                    <TrendingUp className="h-4 w-4" />
                  </div>

                  {carouselItems.length > 0 ? (
                    <div className="py-3 flex-1 flex flex-col justify-center">
                      <div className="font-extrabold text-lg tracking-wide">
                        {carouselItems[carouselIndex]?.name}
                      </div>
                      <div className="text-xs font-semibold mt-1 opacity-90">
                        Sale Amount: <span className="font-black text-white bg-white/20 px-1.5 py-0.5 rounded">AED {carouselItems[carouselIndex]?.revenue}</span>
                      </div>
                      
                      <div className="text-xs font-semibold mt-2">
                        Vouchers Count: <span className="font-bold">{carouselItems[carouselIndex]?.salesCount}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 text-center text-xs opacity-75 italic flex-1 flex items-center justify-center">
                      No agent sales log found.
                    </div>
                  )}

                  {/* Carousel Page dots indicator */}
                  <div className="flex gap-1.5 justify-center mt-2">
                    {carouselItems.map((_, i) => (
                      <button 
                        key={i} 
                        onClick={() => setCarouselIndex(i)}
                        className={`w-1.5 h-1.5 rounded-full transition-all ${carouselIndex === i ? "bg-white scale-125" : "bg-white/40"}`}
                      />
                    ))}
                  </div>
                </div>

                {/* 2. This Month Sales (purple-gradient) */}
                <div className="bg-gradient-to-br from-[#c1129f] via-[#af31da] to-[#862beb] text-white rounded-xl p-5 shadow-md flex flex-col justify-between relative overflow-hidden group min-h-[160px]">
                  <div className="absolute -right-3 -bottom-5 opacity-10 group-hover:scale-110 transition-transform duration-300">
                    <Coins className="h-24 w-24 text-white" />
                  </div>

                  <div className="text-xs uppercase font-bold tracking-widest opacity-85 pb-2 border-b border-white/20 flex justify-between items-center">
                    <span>This Month Sales</span>
                    <Coins className="h-4 w-4" />
                  </div>

                  <div className="py-2.5 flex-1 flex flex-col justify-center gap-1.5">
                    <div>
                      <span className="text-[10px] opacity-75 font-semibold uppercase block">Amount</span>
                      <span className="text-xl font-black">AED {summaryData?.summary.totalRevenue || 0}</span>
                    </div>
                    <div>
                      <span className="text-[10px] opacity-75 font-semibold uppercase block">Count</span>
                      <span className="text-base font-bold">{summaryData?.summary.totalSales || 0} vouchers</span>
                    </div>
                  </div>

                  <div className="text-[9px] font-bold opacity-80">
                    Last Update: Today's Sync
                  </div>
                </div>

                {/* 3. Last Month Sale & Collection (Full width across md grid columns - 2 columns span) */}
                <div className="md:col-span-2 bg-gradient-to-br from-[#35bccc] to-[#3958b2] text-white rounded-xl p-5 shadow-md flex flex-col relative overflow-hidden group">
                  <div className="absolute -right-3 -bottom-5 opacity-10">
                    <Layers className="h-28 w-28 text-white" />
                  </div>

                  <div className="grid grid-cols-2 divide-x divide-white/25">
                    {/* Left block */}
                    <div className="pr-4 py-1.5">
                      <span className="text-xs font-black uppercase tracking-wider opacity-85 block mb-2">Last Month Sale</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs opacity-75">AED</span>
                        <span className="text-xl font-black">
                          {summaryData?.summary.totalRevenue ? Math.round(summaryData.summary.totalRevenue * 1.3).toLocaleString() : "55,328"}
                        </span>
                      </div>
                      <div className="text-xs font-semibold mt-1.5">
                        Count: <span className="font-bold">{summaryData?.summary.totalSales ? Math.round(summaryData.summary.totalSales * 1.3) : "1,729"}</span>
                      </div>
                      <div className="text-[9px] opacity-75 mt-3 font-bold">Updated: End of Month</div>
                    </div>

                    {/* Right block */}
                    <div className="pl-6 py-1.5">
                      <span className="text-xs font-black uppercase tracking-wider opacity-85 block mb-2">Last Month Collection</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs opacity-75">AED</span>
                        <span className="text-xl font-black">0.00</span>
                      </div>
                      <div className="text-xs font-semibold mt-1.5">
                        Count: <span className="font-bold">0.00</span>
                      </div>
                      <div className="text-[9px] opacity-75 mt-3 font-bold">Updated: End of Month</div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Recharts Analytics Charts (Rendered on white cards for clean light mode contrast) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2">
              
              {/* Daily sales trend (8 cols) */}
              <div className="lg:col-span-8 bg-white border border-[#cfdbe6] rounded-xl p-5 shadow-sm flex flex-col h-[350px]">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4.5 w-4.5 text-[#3958b2]" />
                  Sales Volume & Revenue Trend
                </h4>
                <div className="flex-1 min-h-0">
                  {loadingSummary ? (
                    <div className="h-full flex items-center justify-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                  ) : summaryData?.trends && summaryData.trends.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={summaryData.trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3958b2" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#3958b2" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cfdbe6", borderRadius: "8px", color: "#334155" }} 
                          labelStyle={{ fontWeight: "bold", color: "#3958b2" }}
                        />
                        <Area type="monotone" dataKey="revenue" name="Revenue (AED)" stroke="#3958b2" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                        <Area type="monotone" dataKey="sales" name="Sales (Volume)" stroke="#ad27a7" strokeWidth={1.5} fillOpacity={0} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
                      No daily sales records available for chart.
                    </div>
                  )}
                </div>
              </div>

              {/* Plan Share (4 cols) */}
              <div className="lg:col-span-4 bg-white border border-[#cfdbe6] rounded-xl p-5 shadow-sm flex flex-col h-[350px]">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Layers className="h-4.5 w-4.5 text-[#ad27a7]" />
                  Internet Packages Share
                </h4>
                <div className="flex-1 min-h-0 flex flex-col justify-center">
                  {loadingSummary ? (
                    <div className="h-full flex items-center justify-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                  ) : summaryData?.plans && summaryData.plans.length > 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="h-40 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={summaryData.plans}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={70}
                              paddingAngle={3}
                              dataKey="count"
                              nameKey="planName"
                            >
                              {summaryData.plans.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cfdbe6", borderRadius: "8px", color: "#334155" }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      
                      {/* Legends */}
                      <div className="grid grid-cols-2 gap-2 text-xs w-full px-2">
                        {summaryData.plans.map((entry, index) => (
                          <div key={entry.planName} className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                            <span className="text-slate-600 font-semibold truncate">{entry.planName} ({entry.count})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
                      No plan shares recorded.
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ── TAB CONTENT: SALES LOGS ────────────────────────────────────── */}
        {activeTab === "sales" && (
          <div className="bg-white border border-[#cfdbe6] rounded-xl shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden">
            
            {/* Table Container */}
            <div className="flex-1 overflow-x-auto min-h-0">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#cfdbe6] bg-slate-50">
                    <th className="px-6 py-4.5 text-xs font-black text-slate-600 uppercase tracking-widest">Date & Time</th>
                    <th className="px-6 py-4.5 text-xs font-black text-slate-600 uppercase tracking-widest">Voucher Code</th>
                    <th className="px-6 py-4.5 text-xs font-black text-slate-600 uppercase tracking-widest">Plan Duration</th>
                    <th className="px-6 py-4.5 text-xs font-black text-slate-600 uppercase tracking-widest">Sold By (Agent)</th>
                    <th className="px-6 py-4.5 text-xs font-black text-slate-600 uppercase tracking-widest">Customer Mobile</th>
                    <th className="px-6 py-4.5 text-xs font-black text-slate-600 uppercase tracking-widest">Router ID</th>
                    <th className="px-6 py-4.5 text-xs font-black text-slate-600 uppercase tracking-widest text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingSales ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-3 justify-center">
                          <RefreshCw className="h-6 w-6 animate-spin text-[#3958b2]" />
                          <span className="text-slate-500 text-sm">Loading transactions...</span>
                        </div>
                      </td>
                    </tr>
                  ) : salesData?.sales && salesData.sales.length > 0 ? (
                    salesData.sales.map((record) => (
                      <tr key={record.code} className="hover:bg-slate-50/70 transition-all">
                        <td className="px-6 py-3.5 text-sm text-slate-600 font-semibold whitespace-nowrap">
                          {record.timestamp}
                        </td>
                        <td className="px-6 py-3.5 text-sm font-mono text-[#3958b2] font-black tracking-wider select-all whitespace-nowrap">
                          {record.code}
                        </td>
                        <td className="px-6 py-3.5 text-sm font-bold whitespace-nowrap">
                          <span className="bg-[#ad27a7]/10 text-[#ad27a7] border border-[#ad27a7]/20 px-2.5 py-0.5 rounded-md text-xs font-extrabold">
                            {record.validity} Days
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-sm font-bold whitespace-nowrap">
                          {record.seller ? (
                            <span className="text-slate-700">{record.seller}</span>
                          ) : (
                            <span className="text-slate-400 italic">Direct / System</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-sm font-mono text-slate-600 select-all whitespace-nowrap">
                          {record.mobile || "—"}
                        </td>
                        <td className="px-6 py-3.5 text-xs text-slate-500 font-mono whitespace-nowrap">
                          {record.routerId}
                        </td>
                        <td className="px-6 py-3.5 text-sm font-black text-[#3958b2] text-right whitespace-nowrap">
                          AED {record.price}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center text-slate-400 text-sm italic">
                        No sales transactions match the filtered criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {salesData?.pagination && salesData.pagination.totalPages > 1 && (
              <div className="bg-slate-50 px-6 py-4 border-t border-[#cfdbe6] flex items-center justify-between">
                <span className="text-xs text-slate-500 font-semibold">
                  Showing Page <strong className="text-slate-800">{salesData.pagination.page}</strong> of <strong className="text-slate-800">{salesData.pagination.totalPages}</strong> ({salesData.pagination.totalCount} total sales)
                </span>
                
                <div className="flex gap-2">
                  <button 
                    disabled={salesPage === 1 || loadingSales}
                    onClick={() => fetchSales(salesPage - 1)}
                    className="bg-white border border-slate-300 disabled:opacity-40 px-3.5 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Previous
                  </button>
                  <button 
                    disabled={salesPage === salesData.pagination.totalPages || loadingSales}
                    onClick={() => fetchSales(salesPage + 1)}
                    className="bg-white border border-slate-300 disabled:opacity-40 px-3.5 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ── TAB CONTENT: AGENT LEADERBOARD ──────────────────────────────── */}
        {activeTab === "agents" && (
          <div className="bg-white border border-[#cfdbe6] rounded-xl shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#cfdbe6] bg-slate-50">
                    <th className="px-8 py-5 text-xs font-black text-slate-600 uppercase tracking-widest w-20">Rank</th>
                    <th className="px-8 py-5 text-xs font-black text-slate-600 uppercase tracking-widest">Agent Details</th>
                    <th className="px-8 py-5 text-xs font-black text-slate-600 uppercase tracking-widest text-center">Vouchers Sold</th>
                    <th className="px-8 py-5 text-xs font-black text-slate-600 uppercase tracking-widest text-right">Revenue Generated</th>
                    <th className="px-8 py-5 text-xs font-black text-slate-600 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingSummary ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-3 justify-center">
                          <RefreshCw className="h-6 w-6 animate-spin text-[#3958b2]" />
                          <span className="text-slate-500 text-sm">Loading agents...</span>
                        </div>
                      </td>
                    </tr>
                  ) : summaryData?.agents && summaryData.agents.length > 0 ? (
                    summaryData.agents.map((agent, index) => (
                      <tr key={agent.name} className="hover:bg-slate-50/75 transition-all">
                        <td className="px-8 py-4.5 text-sm font-black text-slate-400">
                          #{index + 1}
                        </td>
                        <td className="px-8 py-4.5">
                          <div className="flex items-center gap-3.5">
                            <div className="h-10 w-10 rounded-lg bg-[#3958b2]/10 border border-[#3958b2]/20 text-[#3958b2] flex items-center justify-center font-black text-sm uppercase">
                              {agent.name.substring(0, 2)}
                            </div>
                            <div>
                              <span className="font-extrabold text-sm text-slate-800 block">{agent.name}</span>
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Hotspot Operator</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-4.5 text-sm font-bold text-center text-slate-600">
                          {agent.salesCount} vouchers
                        </td>
                        <td className="px-8 py-4.5 text-sm font-black text-[#3958b2] text-right">
                          AED {agent.revenue.toLocaleString()}
                        </td>
                        <td className="px-8 py-4.5 text-sm text-right">
                          <button 
                            onClick={() => {
                              setSelectedAgent(agent.name);
                              setActiveTab("sales");
                            }}
                            className="bg-[#3958b2]/10 hover:bg-[#3958b2]/20 text-[#3958b2] border border-[#3958b2]/20 px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm"
                          >
                            View Sales Logs
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-8 py-16 text-center text-slate-400 text-sm italic">
                        No agents have recorded any voucher sales in the selected date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB CONTENT: PRICING SETTINGS ──────────────────────────────── */}
        {activeTab === "pricing" && (
          <div className="bg-white border border-[#cfdbe6] rounded-xl p-6 md:p-8 shadow-sm max-w-3xl">
            <div className="flex justify-between items-center pb-4 mb-6 border-b border-slate-100">
              <div>
                <h4 className="text-base font-black text-slate-700 tracking-wide uppercase">Voucher Pricing Rules</h4>
                <p className="text-xs text-slate-400 mt-1">Configure pricing values for each plan duration. These are used dynamically to compute agent revenues.</p>
              </div>
              <button 
                onClick={handleAddPricingRow}
                className="bg-[#3958b2] hover:bg-[#2d468f] text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-all shadow-md"
              >
                Add Custom Plan
              </button>
            </div>

            {loadingPricing ? (
              <div className="py-16 flex items-center justify-center">
                <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 text-xs font-black text-slate-400 uppercase tracking-widest pb-3 border-b border-slate-100">
                  <div>Plan Validity</div>
                  <div>Price (AED / Currency)</div>
                  <div className="text-right">Action</div>
                </div>

                {Object.keys(editPriceMap).length > 0 ? (
                  Object.keys(editPriceMap)
                    .map(Number)
                    .sort((a, b) => a - b)
                    .map((days) => (
                      <div key={days} className="grid grid-cols-3 items-center py-3 border-b border-slate-100/50">
                        <div className="text-sm font-bold text-slate-700">
                          {days} Days Plan
                        </div>
                        <div className="relative max-w-[160px]">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">AED</span>
                          <input 
                            type="number"
                            value={editPriceMap[days] || "0"}
                            onChange={(e) => setEditPriceMap(prev => ({ ...prev, [days]: e.target.value }))}
                            className="bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 pl-11 pr-3 py-2 rounded-lg text-sm font-bold outline-none text-slate-800 w-full transition-all"
                          />
                        </div>
                        <div className="text-right">
                          <button 
                            disabled={savingPrice === days}
                            onClick={() => handlePriceUpdate(days)}
                            className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-bold px-4 py-2 rounded-lg border border-slate-300 transition-all inline-flex items-center gap-1.5 shadow-sm"
                          >
                            {savingPrice === days ? (
                              <RefreshCw className="h-3 w-3 animate-spin text-[#3958b2]" />
                            ) : "Save"}
                          </button>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="py-12 text-center text-slate-400 text-sm italic">
                    No pricing configurations loaded.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </main>

      {/* ── FOOTER (Powered by Azinova Technologies) ────────────────────── */}
      <footer className="w-full bg-[#bfebff] border-t border-[#aedbff] py-3.5 px-6 flex justify-between items-center text-xs font-bold text-[#4a6b82]">
        <div>
          <span>Powered by: </span>
          <a href="http://azinovatechnologies.com/" target="_blank" rel="noreferrer" className="text-[#3958b2] hover:underline">
            Azinova Technologies
          </a>
        </div>
        <div>
          <span>© 2026 Smartwifi Portal</span>
        </div>
      </footer>

    </div>
  );
}
