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
  ArrowRight,
  Menu,
  X
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  BarChart, 
  Bar, 
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
  
  // Custom pricing edit state
  const [editPriceMap, setEditPriceMap] = useState<Record<number, string>>({});

  // Initialize dates: default to current month
  useEffect(() => {
    setIsMounted(true);
    const now = new Date();
    // Start of current month
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Format YYYY-MM-DD
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
        // Pre-fill pricing input state
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
    } else if (activeTab === "sales") {
      fetchSales(1);
    } else if (activeTab === "agents") {
      fetchSummary();
    } else if (activeTab === "pricing") {
      fetchPricing();
    }
  }, [activeTab, startDate, endDate, selectedAgent, selectedValidity, selectedRouter, isMounted]);

  // Handle Search Input (Debounced or manual trigger)
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
        // Toast message or alert
      }
    } catch (err) {
      console.error("Failed to update price:", err);
    } finally {
      setSavingPrice(null);
    }
  };

  // Add new validity price mapping row
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
      // Fetch all records by omitting page pagination limits
      params.append("limit", "100000"); // Retrieve all matching records
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

  // Helper colors for charts
  const COLORS = ["#6366f1", "#a855f7", "#ec4899", "#f43f5e", "#e11d48", "#10b981", "#f59e0b"];

  if (!isMounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-10 w-10 animate-spin text-indigo-500" />
          <p className="text-zinc-400">Loading HotSpot Pro Sales...</p>
        </div>
      </div>
    );
  }

  // Generate distinct agent dropdown options from summary database state
  const agentOptions = salesData?.filters?.agents || [];
  const routerOptions = salesData?.filters?.routers || [];
  const planOptions = salesData?.filters?.plans || [];

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      
      {/* ── SIDEBAR NAVIGATION (Desktop) ─────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 bg-zinc-900 border-r border-zinc-800 p-6 shrink-0">
        <div className="flex items-center gap-3 mb-10">
          <div className="bg-indigo-600/10 p-2.5 rounded-xl border border-indigo-500/20 text-indigo-400">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-wide">HotSpot Pro</h1>
            <span className="text-xs text-zinc-400 font-medium tracking-wider uppercase">Sales Analytics</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5">
          <button 
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              activeTab === "dashboard" 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/10" 
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Dashboard
          </button>
          
          <button 
            onClick={() => setActiveTab("sales")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              activeTab === "sales" 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/10" 
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <FileText className="h-4 w-4" />
            Detailed Sales Log
          </button>

          <button 
            onClick={() => setActiveTab("agents")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              activeTab === "agents" 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/10" 
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <Users className="h-4 w-4" />
            Agent Leaderboard
          </button>

          <button 
            onClick={() => setActiveTab("pricing")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              activeTab === "pricing" 
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/10" 
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <Settings className="h-4 w-4" />
            Pricing Settings
          </button>
        </nav>

        <div className="pt-6 border-t border-zinc-800">
          <div className="bg-zinc-950/50 rounded-xl p-4 border border-zinc-800/50 text-xs">
            <span className="text-zinc-500 block mb-1">Database Connected</span>
            <span className="font-mono text-zinc-300 break-all select-all">vouchers.db</span>
          </div>
        </div>
      </aside>

      {/* ── MOBILE MENU TRIGGER ─────────────────────────────────────────── */}
      <div className="md:hidden fixed top-4 right-4 z-50">
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="bg-zinc-900 border border-zinc-800 p-2 rounded-xl text-zinc-300 hover:text-white shadow-lg shadow-black/50"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-zinc-950/95 backdrop-blur-md flex flex-col p-8 pt-20">
          <div className="space-y-4 flex-1">
            <button 
              onClick={() => { setActiveTab("dashboard"); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-xl text-base font-semibold ${
                activeTab === "dashboard" ? "bg-indigo-600 text-white" : "text-zinc-400"
              }`}
            >
              <TrendingUp className="h-5 w-5" />
              Dashboard
            </button>
            <button 
              onClick={() => { setActiveTab("sales"); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-xl text-base font-semibold ${
                activeTab === "sales" ? "bg-indigo-600 text-white" : "text-zinc-400"
              }`}
            >
              <FileText className="h-5 w-5" />
              Detailed Sales Log
            </button>
            <button 
              onClick={() => { setActiveTab("agents"); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-xl text-base font-semibold ${
                activeTab === "agents" ? "bg-indigo-600 text-white" : "text-zinc-400"
              }`}
            >
              <Users className="h-5 w-5" />
              Agent Leaderboard
            </button>
            <button 
              onClick={() => { setActiveTab("pricing"); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-xl text-base font-semibold ${
                activeTab === "pricing" ? "bg-indigo-600 text-white" : "text-zinc-400"
              }`}
            >
              <Settings className="h-5 w-5" />
              Pricing Settings
            </button>
          </div>
          <div className="pt-6 border-t border-zinc-800 text-center">
            <span className="text-xs text-zinc-500 font-mono">vouchers.db active</span>
          </div>
        </div>
      )}

      {/* ── MAIN WORKSPACE CONTENT ─────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 p-4 md:p-8 overflow-y-auto">
        
        {/* Top bar header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              {activeTab === "dashboard" && "Dashboard Overview"}
              {activeTab === "sales" && "Detailed Sales Records"}
              {activeTab === "agents" && "Agent Performance Leaderboard"}
              {activeTab === "pricing" && "Plan Pricing Settings"}
            </h2>
            <p className="text-zinc-400 text-sm mt-1">
              {activeTab === "dashboard" && "Track real-time sales metrics, performance indices and trends."}
              {activeTab === "sales" && "Search, filter, and audit individual voucher sales transactions."}
              {activeTab === "agents" && "View sales leaderboards, activity times and volume summaries."}
              {activeTab === "pricing" && "Manage validity-to-price mapping to compute dynamic revenues."}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                if (activeTab === "dashboard" || activeTab === "agents") fetchSummary();
                else if (activeTab === "sales") fetchSales(salesPage);
                else if (activeTab === "pricing") fetchPricing();
              }}
              className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 text-zinc-300 transition-all"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Data
            </button>
            {activeTab === "sales" && (
              <button 
                onClick={handleExportCSV}
                className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 text-white shadow-lg shadow-indigo-600/20 transition-all"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
            )}
          </div>
        </header>

        {/* ── CONTROLS & FILTER BAR ────────────────────────────────────── */}
        {activeTab !== "pricing" && (
          <section className="bg-zinc-900/50 backdrop-blur-md rounded-2xl border border-zinc-800/80 p-5 md:p-6 mb-8 shadow-xl">
            <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              
              {/* Date Filters */}
              <div className="md:col-span-5 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">Start Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800/85 focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/50 pl-10 pr-3 py-2.5 rounded-xl text-sm font-medium outline-none text-zinc-200 transition-all [color-scheme:dark]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">End Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800/85 focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/50 pl-10 pr-3 py-2.5 rounded-xl text-sm font-medium outline-none text-zinc-200 transition-all [color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>

              {/* Agent Filter */}
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">Agent</label>
                <select 
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800/85 focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/50 px-3 py-2.5 rounded-xl text-sm font-medium outline-none text-zinc-300 transition-all"
                >
                  <option value="all">All Agents</option>
                  {agentOptions.map(agent => (
                    <option key={agent} value={agent}>{agent}</option>
                  ))}
                  {/* Fallback agent names if options aren't loaded yet */}
                  {agentOptions.length === 0 && summaryData?.agents.map(a => (
                    <option key={a.name} value={a.name}>{a.name}</option>
                  ))}
                </select>
              </div>

              {/* Plan Filter */}
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">Plan (Days)</label>
                <select 
                  value={selectedValidity}
                  onChange={(e) => setSelectedValidity(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800/85 focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/50 px-3 py-2.5 rounded-xl text-sm font-medium outline-none text-zinc-300 transition-all"
                >
                  <option value="all">All Plans</option>
                  {planOptions.map(days => (
                    <option key={days} value={days}>{days} Days</option>
                  ))}
                  {/* Fallback if options aren't loaded */}
                  {planOptions.length === 0 && [7, 10, 15, 30].map(days => (
                    <option key={days} value={days}>{days} Days</option>
                  ))}
                </select>
              </div>

              {/* Search input */}
              <div className="md:col-span-3">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">Search Customer</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input 
                      type="text" 
                      placeholder="Code or Mobile..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800/85 focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/50 pl-10 pr-3 py-2.5 rounded-xl text-sm font-medium outline-none text-zinc-200 placeholder-zinc-500 transition-all"
                    />
                  </div>
                  
                  <button 
                    type="submit" 
                    className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 text-white font-bold p-2.5 rounded-xl flex items-center justify-center transition-all"
                  >
                    <Filter className="h-4 w-4" />
                  </button>
                  
                  <button 
                    type="button"
                    onClick={resetFilters}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 px-3.5 rounded-xl text-xs font-semibold transition-all"
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
          <div className="space-y-8 flex-1">
            
            {/* Top Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Card 1: Total Revenue */}
              <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-6 shadow-lg hover:border-zinc-700/60 transition-all duration-300 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:scale-110 transition-transform duration-300">
                  <DollarSign className="h-28 w-28 text-indigo-400" />
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 text-indigo-400">
                    <DollarSign className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block">Total Estimated Revenue</span>
                    <h3 className="text-2xl md:text-3xl font-extrabold mt-0.5 tracking-tight text-white">
                      AED {summaryData?.summary.totalRevenue.toLocaleString() || "0"}
                    </h3>
                  </div>
                </div>
                <div className="pt-4 border-t border-zinc-800/80 flex justify-between items-center text-xs text-zinc-400">
                  <span>Today's Income:</span>
                  <span className="font-bold text-indigo-400">AED {summaryData?.comparison.today.revenue.toLocaleString() || "0"}</span>
                </div>
              </div>

              {/* Card 2: Total Vouchers Sold */}
              <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-6 shadow-lg hover:border-zinc-700/60 transition-all duration-300 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:scale-110 transition-transform duration-300">
                  <FileText className="h-28 w-28 text-purple-400" />
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-purple-500/10 p-3 rounded-xl border border-purple-500/20 text-purple-400">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block">Vouchers Sold</span>
                    <h3 className="text-2xl md:text-3xl font-extrabold mt-0.5 tracking-tight text-white">
                      {summaryData?.summary.totalSales.toLocaleString() || "0"}
                    </h3>
                  </div>
                </div>
                <div className="pt-4 border-t border-zinc-800/80 flex justify-between items-center text-xs text-zinc-400">
                  <span>Today's Sales Count:</span>
                  <span className="font-bold text-purple-400">{summaryData?.comparison.today.sales || "0"} codes</span>
                </div>
              </div>

              {/* Card 3: Active Agents */}
              <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-6 shadow-lg hover:border-zinc-700/60 transition-all duration-300 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:scale-110 transition-transform duration-300">
                  <Users className="h-28 w-28 text-emerald-400" />
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-emerald-400">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-zinc-400 text-xs font-semibold uppercase tracking-wider block">Active Salespersons</span>
                    <h3 className="text-2xl md:text-3xl font-extrabold mt-0.5 tracking-tight text-white">
                      {summaryData?.summary.activeAgentsCount || "0"}
                    </h3>
                  </div>
                </div>
                <div className="pt-4 border-t border-zinc-800/80 flex justify-between items-center text-xs text-zinc-400">
                  <span>Yesterday's Sales Count:</span>
                  <span className="font-bold text-zinc-300">{summaryData?.comparison.yesterday.sales || "0"} codes</span>
                </div>
              </div>

            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Sales trend chart (7 cols) */}
              <div className="lg:col-span-8 bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-6 shadow-lg flex flex-col h-[400px]">
                <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-6 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-indigo-400" />
                  Revenue & Sales Trend
                </h4>
                <div className="flex-1 min-h-0">
                  {loadingSummary ? (
                    <div className="h-full flex items-center justify-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-zinc-600" />
                    </div>
                  ) : summaryData?.trends && summaryData.trends.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={summaryData.trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis dataKey="date" stroke="#71717a" fontSize={11} tickLine={false} />
                        <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "#18181b", borderColor: "#3f3f46", borderRadius: "12px", color: "#f4f4f5" }} 
                          labelStyle={{ fontWeight: "bold", color: "#818cf8" }}
                        />
                        <Area type="monotone" dataKey="revenue" name="Revenue (AED)" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                        <Area type="monotone" dataKey="sales" name="Sales (Volume)" stroke="#a855f7" strokeWidth={1} fillOpacity={0} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                      No trend data available for this range.
                    </div>
                  )}
                </div>
              </div>

              {/* Plan distribution chart (4 cols) */}
              <div className="lg:col-span-4 bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-6 shadow-lg flex flex-col h-[400px]">
                <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-6 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-purple-400" />
                  Plan Share
                </h4>
                <div className="flex-1 min-h-0 flex flex-col justify-center">
                  {loadingSummary ? (
                    <div className="h-full flex items-center justify-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-zinc-600" />
                    </div>
                  ) : summaryData?.plans && summaryData.plans.length > 0 ? (
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={summaryData.plans}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={4}
                              dataKey="count"
                              nameKey="planName"
                            >
                              {summaryData.plans.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ backgroundColor: "#18181b", borderColor: "#3f3f46", borderRadius: "12px", color: "#f4f4f5" }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      
                      {/* Legends */}
                      <div className="grid grid-cols-2 gap-2 text-xs w-full px-4">
                        {summaryData.plans.map((entry, index) => (
                          <div key={entry.planName} className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                            <span className="text-zinc-400 truncate">{entry.planName} ({entry.count})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                      No plan distribution data.
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Bottom splits - Top Performing Agents */}
            <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-6 shadow-lg">
              <div className="flex justify-between items-center mb-6">
                <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-400" />
                  Top Agents Leaderboard
                </h4>
                <button 
                  onClick={() => setActiveTab("agents")} 
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 hover:underline"
                >
                  Full Leaderboard <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Agent Performance Chart */}
                <div className="h-64">
                  {summaryData?.agents && summaryData.agents.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={summaryData.agents.slice(0, 5)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} />
                        <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "#18181b", borderColor: "#3f3f46", borderRadius: "12px", color: "#f4f4f5" }}
                        />
                        <Bar dataKey="revenue" name="Revenue (AED)" fill="#6366f1" radius={[4, 4, 0, 0]}>
                          {summaryData.agents.slice(0, 5).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                      No agent charts available.
                    </div>
                  )}
                </div>

                {/* Agent List Summary */}
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                  {summaryData?.agents && summaryData.agents.length > 0 ? (
                    summaryData.agents.slice(0, 5).map((agent, index) => (
                      <div 
                        key={agent.name} 
                        className="bg-zinc-950/40 border border-zinc-800/40 rounded-xl p-3 flex items-center justify-between hover:border-zinc-700/40 transition-all cursor-pointer"
                        onClick={() => {
                          setSelectedAgent(agent.name);
                          setActiveTab("sales");
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-zinc-500 w-5">#{index + 1}</span>
                          <div className="h-8 w-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs uppercase">
                            {agent.name.substring(0, 2)}
                          </div>
                          <div>
                            <span className="font-semibold text-sm text-zinc-200 block">{agent.name}</span>
                            <span className="text-xs text-zinc-400 font-medium">{agent.salesCount} codes sold</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-sm text-indigo-400 block">AED {agent.revenue.toLocaleString()}</span>
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Revenue</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                      No sales recorded by any agents.
                    </div>
                  )}
                </div>

              </div>
            </div>

          </div>
        )}

        {/* ── TAB CONTENT: SALES LOGS ────────────────────────────────────── */}
        {activeTab === "sales" && (
          <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl shadow-lg flex-1 flex flex-col min-h-0 overflow-hidden">
            
            {/* Table Container */}
            <div className="flex-1 overflow-x-auto min-h-0">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/40">
                    <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Date & Time</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Voucher Code</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Plan Duration</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Sold By (Agent)</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Customer Mobile</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Router ID</th>
                    <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {loadingSales ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-3 justify-center">
                          <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
                          <span className="text-zinc-500 text-sm">Loading transactions...</span>
                        </div>
                      </td>
                    </tr>
                  ) : salesData?.sales && salesData.sales.length > 0 ? (
                    salesData.sales.map((record) => (
                      <tr key={record.code} className="hover:bg-zinc-800/25 transition-all">
                        <td className="px-6 py-3.5 text-sm text-zinc-300 font-medium whitespace-nowrap">
                          {record.timestamp}
                        </td>
                        <td className="px-6 py-3.5 text-sm font-mono text-indigo-400 font-bold tracking-wider select-all whitespace-nowrap">
                          {record.code}
                        </td>
                        <td className="px-6 py-3.5 text-sm font-semibold whitespace-nowrap">
                          <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-md text-xs">
                            {record.validity} Days
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-sm font-semibold whitespace-nowrap">
                          {record.seller ? (
                            <span className="text-zinc-200">{record.seller}</span>
                          ) : (
                            <span className="text-zinc-500 italic">Direct / System</span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-sm font-mono text-zinc-300 select-all whitespace-nowrap">
                          {record.mobile || "—"}
                        </td>
                        <td className="px-6 py-3.5 text-xs text-zinc-400 font-mono whitespace-nowrap">
                          {record.routerId}
                        </td>
                        <td className="px-6 py-3.5 text-sm font-bold text-indigo-400 text-right whitespace-nowrap">
                          AED {record.price}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center text-zinc-500 text-sm">
                        No sales transactions match the filtered criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {salesData?.pagination && salesData.pagination.totalPages > 1 && (
              <div className="bg-zinc-950/40 px-6 py-4 border-t border-zinc-800 flex items-center justify-between">
                <span className="text-xs text-zinc-400">
                  Showing Page <strong className="text-zinc-200">{salesData.pagination.page}</strong> of <strong className="text-zinc-200">{salesData.pagination.totalPages}</strong> ({salesData.pagination.totalCount} total sales)
                </span>
                
                <div className="flex gap-2">
                  <button 
                    disabled={salesPage === 1 || loadingSales}
                    onClick={() => fetchSales(salesPage - 1)}
                    className="bg-zinc-900 border border-zinc-800 disabled:opacity-40 px-3.5 py-1.5 rounded-xl text-xs font-semibold hover:bg-zinc-800 text-zinc-300 flex items-center gap-1.5 transition-all"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Previous
                  </button>
                  <button 
                    disabled={salesPage === salesData.pagination.totalPages || loadingSales}
                    onClick={() => fetchSales(salesPage + 1)}
                    className="bg-zinc-900 border border-zinc-800 disabled:opacity-40 px-3.5 py-1.5 rounded-xl text-xs font-semibold hover:bg-zinc-800 text-zinc-300 flex items-center gap-1.5 transition-all"
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
          <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl shadow-lg flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/40">
                    <th className="px-8 py-5 text-xs font-bold text-zinc-400 uppercase tracking-wider w-20">Rank</th>
                    <th className="px-8 py-5 text-xs font-bold text-zinc-400 uppercase tracking-wider">Agent Details</th>
                    <th className="px-8 py-5 text-xs font-bold text-zinc-400 uppercase tracking-wider text-center">Vouchers Sold</th>
                    <th className="px-8 py-5 text-xs font-bold text-zinc-400 uppercase tracking-wider text-right">Revenue Generated</th>
                    <th className="px-8 py-5 text-xs font-bold text-zinc-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {loadingSummary ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-3 justify-center">
                          <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
                          <span className="text-zinc-500 text-sm">Loading agents...</span>
                        </div>
                      </td>
                    </tr>
                  ) : summaryData?.agents && summaryData.agents.length > 0 ? (
                    summaryData.agents.map((agent, index) => (
                      <tr key={agent.name} className="hover:bg-zinc-800/25 transition-all">
                        <td className="px-8 py-4.5 text-sm font-bold text-zinc-400">
                          #{index + 1}
                        </td>
                        <td className="px-8 py-4.5">
                          <div className="flex items-center gap-3.5">
                            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm uppercase">
                              {agent.name.substring(0, 2)}
                            </div>
                            <div>
                              <span className="font-bold text-sm text-zinc-200 block">{agent.name}</span>
                              <span className="text-[10px] text-indigo-400 uppercase tracking-wider font-semibold">Active Agent</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-4.5 text-sm font-semibold text-center text-zinc-300">
                          {agent.salesCount} vouchers
                        </td>
                        <td className="px-8 py-4.5 text-sm font-bold text-indigo-400 text-right">
                          AED {agent.revenue.toLocaleString()}
                        </td>
                        <td className="px-8 py-4.5 text-sm text-right">
                          <button 
                            onClick={() => {
                              setSelectedAgent(agent.name);
                              setActiveTab("sales");
                            }}
                            className="bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 hover:border-indigo-500/35 px-4.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
                          >
                            View Sales Logs
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-8 py-16 text-center text-zinc-500 text-sm">
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
          <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-6 md:p-8 shadow-lg max-w-3xl">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h4 className="text-base font-bold text-zinc-200 tracking-wide">Voucher Pricing Rules</h4>
                <p className="text-xs text-zinc-400 mt-1">Configure pricing values for each plan duration. These are used dynamically to compute agent revenues.</p>
              </div>
              <button 
                onClick={handleAddPricingRow}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/10"
              >
                Add Custom Plan
              </button>
            </div>

            {loadingPricing ? (
              <div className="py-16 flex items-center justify-center">
                <RefreshCw className="h-6 w-6 animate-spin text-zinc-600" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider pb-3 border-b border-zinc-800">
                  <div>Plan Validity</div>
                  <div>Price (AED / Currency)</div>
                  <div className="text-right">Action</div>
                </div>

                {Object.keys(editPriceMap).length > 0 ? (
                  Object.keys(editPriceMap)
                    .map(Number)
                    .sort((a, b) => a - b)
                    .map((days) => (
                      <div key={days} className="grid grid-cols-3 items-center py-2.5 border-b border-zinc-800/40">
                        <div className="text-sm font-semibold text-zinc-200">
                          {days} Days Plan
                        </div>
                        <div className="relative max-w-[160px]">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">AED</span>
                          <input 
                            type="number"
                            value={editPriceMap[days] || "0"}
                            onChange={(e) => setEditPriceMap(prev => ({ ...prev, [days]: e.target.value }))}
                            className="bg-zinc-950 border border-zinc-800 focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/50 pl-11 pr-3 py-2 rounded-xl text-sm font-semibold outline-none text-zinc-200 w-full transition-all"
                          />
                        </div>
                        <div className="text-right">
                          <button 
                            disabled={savingPrice === days}
                            onClick={() => handlePriceUpdate(days)}
                            className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-xl border border-zinc-700/50 transition-all inline-flex items-center gap-1.5"
                          >
                            {savingPrice === days ? (
                              <RefreshCw className="h-3 w-3 animate-spin text-indigo-400" />
                            ) : "Save"}
                          </button>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="py-12 text-center text-zinc-500 text-sm">
                    No pricing configurations loaded.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
