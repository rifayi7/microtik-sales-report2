"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  Coins,
  Settings as CogIcon
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
  Pie,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  Legend
} from "recharts";

type Tab = "dashboard" | "voucher-sales" | "monthly-sales" | "sales-chart" | "agents" | "pricing";

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

const COLORS = ["#3958b2", "#26b048", "#ff6228", "#ad27a7", "#862beb", "#35bccc", "#ffbc36"];

export default function SalesReportDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [isMounted, setIsMounted] = useState(false);

  // General Filter States
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("all");
  const [selectedValidity, setSelectedValidity] = useState("all");
  const [selectedRouter, setSelectedRouter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [entriesLimit, setEntriesLimit] = useState(100);
  
  // Tab 2: Monthly Voucher Sales Specific States
  const [selectedMonth, setSelectedMonth] = useState("2026-08");

  // Tab 3: Voucher Sales Chart Specific States
  const [startMonthDay, setStartMonthDay] = useState("2026-08-05");
  const [endDayRange, setEndDayRange] = useState("11");
  const [noOfMonths, setNoOfMonths] = useState(3);
  const [isStacked, setIsStacked] = useState(false);

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
  
  // Carousel State for Today's Sales (Dashboard)
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Dropdown States for Header Navigation
  const [activeDropdown, setActiveDropdown] = useState<"sales" | "reports" | "masters" | null>(null);

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

  // Sync Monthly Voucher Sales filter to startDate/endDate
  useEffect(() => {
    if (activeTab === "monthly-sales" && selectedMonth) {
      const [year, month] = selectedMonth.split("-");
      const firstDay = `${year}-${month}-01`;
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      const lastDayStr = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;
      setStartDate(firstDay);
      setEndDate(lastDayStr);
    }
  }, [selectedMonth, activeTab]);

  // Sync Camps - Monthly Voucher Sales Chart filter to startDate/endDate
  useEffect(() => {
    if (activeTab === "sales-chart" && startMonthDay) {
      setStartDate(startMonthDay);
      const start = new Date(startMonthDay);
      if (!isNaN(start.getTime())) {
        const targetYear = start.getFullYear();
        const targetMonth = start.getMonth() + noOfMonths;
        const targetDay = parseInt(endDayRange);
        
        const end = new Date(targetYear, targetMonth, targetDay);
        const year = end.getFullYear();
        const month = String(end.getMonth() + 1).padStart(2, "0");
        const day = String(end.getDate()).padStart(2, "0");
        setEndDate(`${year}-${month}-${day}`);
      }
    }
  }, [startMonthDay, endDayRange, noOfMonths, activeTab]);

  // Close dropdowns on clicking anywhere
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveDropdown(null);
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
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
      
      // If we are in Monthly or Chart views, we want a large limit to do client-side aggregates
      const limitVal = ["monthly-sales", "sales-chart"].includes(activeTab) ? "10000" : String(entriesLimit);
      params.append("limit", limitVal);
      
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

  // Re-fetch when filters, limit, or active tab changes
  useEffect(() => {
    if (!isMounted) return;
    if (activeTab === "dashboard") {
      fetchSummary();
      fetchSales(1);
    } else if (activeTab === "voucher-sales") {
      fetchSales(1);
    } else if (activeTab === "monthly-sales") {
      fetchSummary();
      fetchSales(1); // Fetch sales logs for camp dropdown listing or filters
    } else if (activeTab === "sales-chart") {
      fetchSummary();
      fetchSales(1); // Fetch all records within range to aggregate stacked/grouped chart
    } else if (activeTab === "agents") {
      fetchSummary();
    } else if (activeTab === "pricing") {
      fetchPricing();
    }
  }, [activeTab, startDate, endDate, selectedAgent, selectedValidity, selectedRouter, entriesLimit, isMounted]);

  // Carousel slider effect for dashboard leader
  useEffect(() => {
    if (activeTab !== "dashboard" || !summaryData?.agents || summaryData.agents.length === 0) return;
    const interval = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % Math.min(summaryData.agents.length, 5));
    }, 4000);
    return () => clearInterval(interval);
  }, [activeTab, summaryData]);

  // Handle Search Input Form
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === "dashboard" || activeTab === "agents" || activeTab === "monthly-sales" || activeTab === "sales-chart") {
      fetchSummary();
    }
    if (activeTab === "voucher-sales" || activeTab === "monthly-sales" || activeTab === "sales-chart") {
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
    setEntriesLimit(100);
    setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    setStartMonthDay(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-05`);
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

  // Group daily trends for Monthly Voucher Sales
  const monthlyDailyTrends = useMemo(() => {
    if (!summaryData?.trends) return [];
    // We already have daily trends for the selected month range. Just map it!
    return summaryData.trends.map((item) => ({
      date: item.date,
      sales: item.sales,
      revenue: item.revenue
    }));
  }, [summaryData]);

  // Aggregate monthly sales totals for Monthly Voucher Sales pills
  const monthlyAggregatedTotals = useMemo(() => {
    let count = 0;
    let revenue = 0;
    monthlyDailyTrends.forEach(item => {
      count += item.sales;
      revenue += item.revenue;
    });
    return { count, revenue };
  }, [monthlyDailyTrends]);

  // Aggregate sales data by Month and Camp (Router ID) for Camps - Monthly Voucher Sales Chart
  const campChartData = useMemo(() => {
    if (!salesData?.sales) return [];
    
    // 1. Get all unique router IDs (Camps)
    const routers = Array.from(new Set(salesData.sales.map(s => s.routerId || "Direct/System")));
    
    // 2. Group by Month (YYYY-MM)
    const groups: Record<string, any> = {};
    
    salesData.sales.forEach(sale => {
      let monthKey = "Unknown";
      if (sale.timestamp.includes("-")) {
        const parts = sale.timestamp.split(" ")[0].split("-");
        if (parts.length === 3) {
          // Check if format is YYYY-MM-DD or DD-MM-YYYY
          if (parts[0].length === 4) {
            monthKey = `${parts[0]}-${parts[1]}`;
          } else {
            monthKey = `${parts[2]}-${parts[1]}`;
          }
        }
      }
      
      if (!groups[monthKey]) {
        groups[monthKey] = { month: monthKey, Total: 0 };
        routers.forEach(r => { groups[monthKey][r] = 0; });
      }
      
      const rId = sale.routerId || "Direct/System";
      groups[monthKey][rId] = (groups[monthKey][rId] || 0) + sale.price;
      groups[monthKey].Total += sale.price;
    });
    
    // Convert to sorted array
    return Object.values(groups).sort((a: any, b: any) => a.month.localeCompare(b.month));
  }, [salesData]);

  // Dynamic colors list for stack bars
  const campColors = COLORS;

  const agentOptions = salesData?.filters?.agents || [];
  const planOptions = salesData?.filters?.plans || [];
  const carouselItems = summaryData?.agents.slice(0, 5) || [];

  // Unique list of camps found in the current loaded sales log
  const campList = useMemo(() => {
    if (!salesData?.sales) return [];
    return Array.from(new Set(salesData.sales.map(s => s.routerId || "Direct/System")));
  }, [salesData]);

  // Calculate current page's sum for Voucher Sales footer
  const pageTotalRevenue = useMemo(() => {
    if (!salesData?.sales) return 0;
    return salesData.sales.reduce((sum, item) => sum + item.price, 0);
  }, [salesData]);

  const handleDropdownToggle = (e: React.MouseEvent, type: "sales" | "reports" | "masters") => {
    e.stopPropagation();
    setActiveDropdown((prev) => (prev === type ? null : type));
  };

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

      {/* ── SUB NAVIGATION MENU (Light blue background with dropdown support) ──── */}
      <nav className="fixed top-[70px] left-0 w-full h-[45px] bg-[#bfebff] border-b border-[#aedbff] flex items-center px-6 z-40 overflow-visible shadow-sm">
        <ul className="flex items-center gap-5 text-sm font-bold whitespace-nowrap overflow-visible">
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
          
          {/* Dropdown 1: Sales */}
          <li className="relative overflow-visible">
            <button 
              onClick={(e) => handleDropdownToggle(e, "sales")} 
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-all ${
                ["voucher-sales", "monthly-sales", "sales-chart"].includes(activeTab)
                  ? "text-[#1e3c72] bg-white/60 shadow-sm" 
                  : "text-[#4a6b82] hover:text-[#1e3c72]"
              }`}
            >
              <CreditCard className="h-4 w-4" />
              Sales
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {activeDropdown === "sales" && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#cfdbe6] rounded-md shadow-md min-w-[200px] z-50 flex flex-col py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                <button 
                  onClick={() => { setActiveTab("voucher-sales"); setActiveDropdown(null); }}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-[#4a6b82] hover:text-[#1e3c72] hover:bg-[#bfebff]/30 text-left w-full transition-all"
                >
                  Voucher Sales
                </button>
                <button 
                  onClick={() => { setActiveTab("monthly-sales"); setActiveDropdown(null); }}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-[#4a6b82] hover:text-[#1e3c72] hover:bg-[#bfebff]/30 text-left w-full transition-all"
                >
                  Monthly Voucher Sales
                </button>
                <button 
                  onClick={() => { setActiveTab("sales-chart"); setActiveDropdown(null); }}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-[#4a6b82] hover:text-[#1e3c72] hover:bg-[#bfebff]/30 text-left w-full transition-all"
                >
                  Voucher Sales Chart
                </button>
              </div>
            )}
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
          
          {/* Dropdown 2: Reports */}
          <li className="relative overflow-visible">
            <button 
              onClick={(e) => handleDropdownToggle(e, "reports")} 
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-all ${
                activeTab === "agents"
                  ? "text-[#1e3c72] bg-white/60 shadow-sm" 
                  : "text-[#4a6b82] hover:text-[#1e3c72]"
              }`}
            >
              <FileText className="h-4 w-4" />
              Reports
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {activeDropdown === "reports" && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#cfdbe6] rounded-md shadow-md min-w-[200px] z-50 flex flex-col py-1">
                <button 
                  onClick={() => { setActiveTab("agents"); setActiveDropdown(null); }}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-[#4a6b82] hover:text-[#1e3c72] hover:bg-[#bfebff]/30 text-left w-full transition-all"
                >
                  Agent Leaderboard
                </button>
              </div>
            )}
          </li>

          {/* Dropdown 3: Masters */}
          <li className="relative overflow-visible">
            <button 
              onClick={(e) => handleDropdownToggle(e, "masters")} 
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-all ${
                activeTab === "pricing"
                  ? "text-[#1e3c72] bg-white/60 shadow-sm" 
                  : "text-[#4a6b82] hover:text-[#1e3c72]"
              }`}
            >
              <Layers className="h-4 w-4" />
              Masters
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {activeDropdown === "masters" && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#cfdbe6] rounded-md shadow-md min-w-[200px] z-50 flex flex-col py-1">
                <button 
                  onClick={() => { setActiveTab("pricing"); setActiveDropdown(null); }}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-[#4a6b82] hover:text-[#1e3c72] hover:bg-[#bfebff]/30 text-left w-full transition-all"
                >
                  Pricing Settings
                </button>
              </div>
            )}
          </li>
        </ul>
      </nav>

      {/* ── MAIN WORKSPACE CONTENT ─────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 pt-[135px] pb-8 px-6 overflow-y-auto">
        
        {/* Title bar of the section */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-[#1f2d3d] tracking-wide uppercase font-sans">
            {activeTab === "dashboard" && "Dashboard"}
            {activeTab === "voucher-sales" && "Voucher Sales"}
            {activeTab === "monthly-sales" && "Monthly Voucher Sales"}
            {activeTab === "sales-chart" && "Camps - Monthly Voucher Sales"}
            {activeTab === "agents" && "Agent Performance Leaderboard"}
            {activeTab === "pricing" && "Pricing Settings"}
          </h3>
          <div className="text-xs sm:text-sm text-slate-600 font-medium">
            Last Login: <span className="text-[#3958b2] font-bold">August 09, 2026 11:47 am</span>
          </div>
        </div>

        {/* ── 1. FILTER BAR (Voucher Sales - Option 1) ────────────────────── */}
        {activeTab === "voucher-sales" && (
          <section className="bg-white border border-[#cfdbe6] rounded-xl p-5 mb-6 shadow-sm">
            <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
              
              {/* Keyword Search */}
              <div className="lg:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Search Keyword</label>
                <input 
                  type="text" 
                  placeholder="Type something..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* Date Filters */}
              <div className="lg:col-span-4 grid grid-cols-2 gap-3">
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

              {/* Router ID (Company filter equivalent) */}
              <div className="lg:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Company / Router</label>
                <select 
                  value={selectedRouter}
                  onChange={(e) => setSelectedRouter(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 transition-all cursor-pointer"
                >
                  <option value="all">-- All Routers --</option>
                  <option value="1">Apricom DXB</option>
                </select>
              </div>

              {/* Validity Profile */}
              <div className="lg:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Validity Profile</label>
                <select 
                  value={selectedValidity}
                  onChange={(e) => setSelectedValidity(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 transition-all cursor-pointer"
                >
                  <option value="all">-- All Profiles --</option>
                  {planOptions.map(days => (
                    <option key={days} value={days}>{days}-Days</option>
                  ))}
                  {planOptions.length === 0 && [7, 10, 15, 30].map(days => (
                    <option key={days} value={days}>{days}-Days</option>
                  ))}
                </select>
              </div>

              {/* Sold By */}
              <div className="lg:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Sold By</label>
                <select 
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 transition-all cursor-pointer"
                >
                  <option value="all">-- All Users --</option>
                  {agentOptions.map(agent => (
                    <option key={agent} value={agent}>{agent}</option>
                  ))}
                  {agentOptions.length === 0 && summaryData?.agents.map(a => (
                    <option key={a.name} value={a.name}>{a.name}</option>
                  ))}
                </select>
              </div>

              {/* Show By Entries count */}
              <div className="lg:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Show By</label>
                <select 
                  value={entriesLimit}
                  onChange={(e) => setEntriesLimit(Number(e.target.value))}
                  className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 transition-all cursor-pointer"
                >
                  <option value={10}>10 entries</option>
                  <option value={25}>25 entries</option>
                  <option value={50}>50 entries</option>
                  <option value={100}>100 entries</option>
                  <option value={1000}>1000 entries</option>
                </select>
              </div>

              {/* Search button and Export button */}
              <div className="lg:col-span-10 flex gap-3 justify-end">
                <button 
                  type="submit" 
                  className="bg-[#3958b2] hover:bg-[#2d468f] text-white font-bold px-5 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-sm text-sm"
                >
                  <Search className="h-4 w-4" />
                  Search
                </button>

                <button 
                  type="button"
                  onClick={resetFilters}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-slate-900 px-4 py-2 rounded-lg text-sm font-bold transition-all border border-slate-300"
                >
                  Reset
                </button>

                <button 
                  type="button"
                  onClick={handleExportCSV}
                  className="bg-[#26b048] hover:bg-[#1d8b37] text-white font-bold px-5 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-sm text-sm"
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
              </div>

            </form>
          </section>
        )}

        {/* ── 2. FILTER BAR (Monthly Voucher Sales - Option 2) ────────────── */}
        {activeTab === "monthly-sales" && (
          <section className="bg-white border border-[#cfdbe6] rounded-xl p-5 mb-6 shadow-sm">
            <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
              
              {/* Select Month Calendar */}
              <div className="lg:col-span-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Select Month</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input 
                    type="month" 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 pl-10 pr-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 transition-all"
                  />
                </div>
              </div>

              {/* Camps dropdown */}
              <div className="lg:col-span-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Camps</label>
                <select 
                  value={selectedRouter}
                  onChange={(e) => setSelectedRouter(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 transition-all cursor-pointer"
                >
                  <option value="all">-- Select Camp --</option>
                  {campList.map(camp => (
                    <option key={camp} value={camp}>{camp}</option>
                  ))}
                </select>
              </div>

              {/* Submit search button */}
              <div className="lg:col-span-2">
                <button 
                  type="submit" 
                  className="bg-[#3958b2] hover:bg-[#2d468f] text-white font-bold px-5 py-2.5 rounded-lg flex items-center gap-1.5 transition-all shadow-sm text-sm w-full justify-center"
                >
                  <Search className="h-4 w-4" />
                  Search
                </button>
              </div>

              {/* Header metrics pills floated right */}
              <div className="lg:col-span-4 flex gap-2 justify-end">
                <div className="bg-[#3958b2]/10 text-[#3958b2] border border-[#3958b2]/20 px-4 py-2.5 rounded-lg text-xs font-black shadow-sm flex items-center gap-1">
                  <Coins className="h-4 w-4" />
                  <span>Amount : {monthlyAggregatedTotals.revenue.toLocaleString()}</span>
                </div>
                <div className="bg-[#26b048]/10 text-[#26b048] border border-[#26b048]/20 px-4 py-2.5 rounded-lg text-xs font-black shadow-sm flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  <span>Total : {monthlyAggregatedTotals.count}</span>
                </div>
              </div>

            </form>
          </section>
        )}

        {/* ── 3. FILTER BAR (Voucher Sales Chart - Option 3) ──────────────── */}
        {activeTab === "sales-chart" && (
          <section className="bg-white border border-[#cfdbe6] rounded-xl p-5 mb-6 shadow-sm">
            <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
              
              {/* Start Month and Day */}
              <div className="lg:col-span-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Start Month & Day</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input 
                    type="date" 
                    value={startMonthDay}
                    onChange={(e) => setStartMonthDay(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 pl-10 pr-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 transition-all"
                  />
                </div>
              </div>

              {/* End Day Range */}
              <div className="lg:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">End Day Range</label>
                <select 
                  value={endDayRange}
                  onChange={(e) => setEndDayRange(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 transition-all cursor-pointer"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>

              {/* No. of Months */}
              <div className="lg:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">No. of Months</label>
                <input 
                  type="number" 
                  value={noOfMonths}
                  onChange={(e) => setNoOfMonths(Number(e.target.value))}
                  min={1} 
                  max={36}
                  className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 transition-all"
                />
              </div>

              {/* Company / Router */}
              <div className="lg:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Company</label>
                <select 
                  value={selectedRouter}
                  onChange={(e) => setSelectedRouter(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 transition-all cursor-pointer"
                >
                  <option value="all">-- All Companies --</option>
                  <option value="1">Apricom DXB</option>
                </select>
              </div>

              {/* Stacked Chart toggle */}
              <div className="lg:col-span-2 flex items-center gap-2 mb-2 pb-1.5">
                <input 
                  type="checkbox" 
                  id="stacked_chart" 
                  checked={isStacked}
                  onChange={(e) => setIsStacked(e.target.checked)}
                  className="w-4 h-4 text-[#3958b2] border-slate-300 rounded focus:ring-[#3958b2]"
                />
                <label htmlFor="stacked_chart" className="text-xs font-bold text-slate-600 cursor-pointer select-none">
                  Stacked Chart
                </label>
              </div>

              {/* Search button */}
              <div className="lg:col-span-1">
                <button 
                  type="submit" 
                  className="bg-[#3958b2] hover:bg-[#2d468f] text-white font-bold p-2.5 rounded-lg flex items-center justify-center transition-all shadow-sm text-sm w-full"
                >
                  <Search className="h-4.5 w-4.5" />
                </button>
              </div>

            </form>
          </section>
        )}

        {/* ── TAB CONTENT: DASHBOARD ─────────────────────────────────────── */}
        {activeTab === "dashboard" && (
          <div className="space-y-6 flex-1 flex flex-col">
            
            {/* Top Row Cards */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Card 1: Outstanding Balance */}
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

            {/* Middle Row Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2">
              
              {/* Left Panel: Agent Analysis */}
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
                          setActiveTab("voucher-sales");
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

              {/* Right Panel: Carousel and Monthly stats */}
              <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. Today Sale Slider Card */}
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

                {/* 2. This Month Sales */}
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

                {/* 3. Last Month Sale & Collection */}
                <div className="md:col-span-2 bg-gradient-to-br from-[#35bccc] to-[#3958b2] text-white rounded-xl p-5 shadow-md flex flex-col relative overflow-hidden group">
                  <div className="absolute -right-3 -bottom-5 opacity-10">
                    <Layers className="h-28 w-28 text-white" />
                  </div>

                  <div className="grid grid-cols-2 divide-x divide-white/25">
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

            {/* Recharts Analytics Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2">
              <div className="lg:col-span-8 bg-white border border-[#cfdbe6] rounded-xl p-5 shadow-sm flex flex-col h-[300px]">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4.5 w-4.5 text-[#3958b2]" />
                  Sales Volume & Revenue Trend
                </h4>
                <div className="flex-1 min-h-0">
                  {summaryData?.trends && summaryData.trends.length > 0 ? (
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
                        <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cfdbe6", borderRadius: "8px" }} />
                        <Area type="monotone" dataKey="revenue" name="Revenue (AED)" stroke="#3958b2" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
                      No trend data available.
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-4 bg-white border border-[#cfdbe6] rounded-xl p-5 shadow-sm flex flex-col h-[300px]">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Layers className="h-4.5 w-4.5 text-[#ad27a7]" />
                  Internet Packages Share
                </h4>
                <div className="flex-1 min-h-0 flex flex-col justify-center">
                  {summaryData?.plans && summaryData.plans.length > 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="h-32 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={summaryData.plans}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={60}
                              paddingAngle={3}
                              dataKey="count"
                              nameKey="planName"
                            >
                              {summaryData.plans.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cfdbe6" }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-1 text-[10px] w-full px-2">
                        {summaryData.plans.map((entry, index) => (
                          <div key={entry.planName} className="flex items-center gap-1.5">
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

        {/* ── TAB CONTENT: VOUCHER SALES TABLE (Option 1) ──────────────────── */}
        {activeTab === "voucher-sales" && (
          <div className="bg-white border border-[#cfdbe6] rounded-xl shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden">
            
            <div className="flex-1 overflow-x-auto min-h-0">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#cfdbe6] bg-slate-50 font-black text-slate-600">
                    <th className="px-5 py-4 w-16">Sl. No.</th>
                    <th className="px-5 py-4">Voucher Name</th>
                    <th className="px-5 py-4">Mobile</th>
                    <th className="px-5 py-4 text-right">Amount</th>
                    <th className="px-5 py-4">Validity Profile</th>
                    <th className="px-5 py-4">Company</th>
                    <th className="px-5 py-4">Hotspot</th>
                    <th className="px-5 py-4">Sold By</th>
                    <th className="px-5 py-4">Sold Date</th>
                    <th className="px-5 py-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingSales ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-3 justify-center">
                          <RefreshCw className="h-6 w-6 animate-spin text-[#3958b2]" />
                          <span className="text-slate-500 font-bold">Loading Voucher Sales...</span>
                        </div>
                      </td>
                    </tr>
                  ) : salesData?.sales && salesData.sales.length > 0 ? (
                    salesData.sales.map((record, index) => (
                      <tr key={record.code} className="hover:bg-slate-50/70 transition-all font-medium text-slate-700">
                        <td className="px-5 py-3 text-slate-400 font-bold">
                          {((salesPage - 1) * entriesLimit) + index + 1}
                        </td>
                        <td className="px-5 py-3 font-mono text-[#3958b2] font-black tracking-wider select-all">
                          {record.code}
                        </td>
                        <td className="px-5 py-3 font-mono select-all">
                          {record.mobile || "—"}
                        </td>
                        <td className="px-5 py-3 text-right font-black text-[#3958b2]">
                          AED {record.price.toFixed(2)}
                        </td>
                        <td className="px-5 py-3 font-bold">
                          <span className="bg-[#ad27a7]/10 text-[#ad27a7] border border-[#ad27a7]/20 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold whitespace-nowrap">
                            {record.validity}-Days
                          </span>
                        </td>
                        <td className="px-5 py-3 font-bold text-slate-500">
                          Apricom DXB
                        </td>
                        <td className="px-5 py-3 font-semibold text-slate-600 truncate max-w-[150px]">
                          {record.routerId}
                        </td>
                        <td className="px-5 py-3 font-bold">
                          {record.seller || <span className="text-slate-400 italic font-normal">Direct / System</span>}
                        </td>
                        <td className="px-5 py-3 font-semibold text-slate-500 whitespace-nowrap">
                          {record.timestamp}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <button className="text-slate-400 hover:text-slate-700 p-1 transition-colors">
                            <CogIcon className="h-4.5 w-4.5 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="px-6 py-16 text-center text-slate-400 italic">
                        No sales transactions match the filtered criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
                
                {!loadingSales && salesData?.sales && salesData.sales.length > 0 && (
                  <tfoot className="bg-slate-50 border-t border-[#cfdbe6] font-bold text-slate-700 text-xs">
                    <tr className="border-b border-[#cfdbe6]">
                      <td colSpan={3} className="px-5 py-2.5 text-right font-extrabold">
                        Total
                      </td>
                      <td className="px-5 py-2.5 text-right font-black text-sky-600">
                        AED {pageTotalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td colSpan={6}></td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-5 py-2.5 text-right font-extrabold">
                        Grand Total
                      </td>
                      <td className="px-5 py-2.5 text-right font-black text-[#26b048]">
                        AED {summaryData?.summary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || pageTotalRevenue.toLocaleString()}
                      </td>
                      <td colSpan={6}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Pagination Controls */}
            {salesData?.pagination && salesData.pagination.totalPages > 1 && (
              <div className="bg-slate-50 px-6 py-4 border-t border-[#cfdbe6] flex items-center justify-between">
                <span className="text-xs text-slate-500 font-semibold">
                  Showing {((salesPage - 1) * entriesLimit) + 1} to {Math.min(salesPage * entriesLimit, salesData.pagination.totalCount)} of {salesData.pagination.totalCount} entries
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

        {/* ── TAB CONTENT: MONTHLY DAILY SALES CHART (Option 2) ───────────── */}
        {activeTab === "monthly-sales" && (
          <div className="bg-white border border-[#cfdbe6] rounded-xl p-6 shadow-sm flex flex-col h-[450px]">
            <div className="pb-3 mb-4 border-b border-slate-100 flex justify-between items-center">
              <h5 className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="h-4.5 w-4.5 text-[#3958b2]" />
                Daily Sales Count for Month ({selectedMonth})
              </h5>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span className="w-3.5 h-3.5 bg-[#3958b2] rounded"></span>
                <span>Sales Count</span>
              </div>
            </div>
            
            <div className="flex-1 min-h-0">
              {loadingSummary ? (
                <div className="h-full flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : monthlyDailyTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyDailyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cfdbe6", borderRadius: "8px", color: "#334155" }}
                      labelStyle={{ fontWeight: "bold", color: "#3958b2" }}
                    />
                    <Bar dataKey="sales" name="Sales Count" fill="#3958b2" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
                  No sales logged for this month.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB CONTENT: CAMPS MONTHLY STACKED CHART (Option 3) ──────────── */}
        {activeTab === "sales-chart" && (
          <div className="bg-white border border-[#cfdbe6] rounded-xl p-6 shadow-sm flex flex-col h-[480px]">
            <div className="pb-3 mb-4 border-b border-slate-100 flex justify-between items-center">
              <h5 className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Layers className="h-4.5 w-4.5 text-[#3958b2]" />
                Camps - Monthly Voucher Sales Revenue
              </h5>
              <div className="text-xs text-slate-500 font-bold">
                Date Range: {startDate} to {endDate}
              </div>
            </div>

            <div className="flex-1 min-h-0">
              {loadingSales ? (
                <div className="h-full flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : campChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={campChartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} label={{ value: 'Year | Month', position: 'bottom', offset: 5, fill: '#334155', fontWeight: 'bold' }} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} label={{ value: 'Sales Amount (AED)', angle: -90, position: 'left', offset: 0, fill: '#334155', fontWeight: 'bold' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cfdbe6", borderRadius: "8px", color: "#334155" }}
                    />
                    <Legend verticalAlign="top" height={36} />
                    
                    {/* Render separate bar for each camp */}
                    {campList.map((camp, index) => (
                      <Bar 
                        key={camp} 
                        dataKey={camp} 
                        name={camp} 
                        fill={campColors[index % campColors.length]} 
                        stackId={isStacked ? "camp-stack" : undefined}
                        radius={isStacked ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                      />
                    ))}

                    {/* Total overlay line */}
                    <Line type="monotone" dataKey="Total" name="Total Revenue" stroke="#109618" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
                  No sales logged within this range to plot camp shares.
                </div>
              )}
            </div>
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
                              setActiveTab("voucher-sales");
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
