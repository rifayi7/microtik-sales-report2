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
  Settings as CogIcon,
  Plus,
  Trash2,
  Edit,
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
  Cell,
  PieChart, 
  Pie,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  Legend
} from "recharts";

type Tab = 
  | "dashboard" 
  | "voucher-sales" 
  | "monthly-sales" 
  | "sales-chart" 
  | "voucher-validity" 
  | "voucher-hotspot" 
  | "payment-camp" 
  | "payment-user" 
  | "user-sale"
  | "companies"
  | "camps"
  | "validity-profiles"
  | "camp-validity-pricing"
  | "notifications"
  | "payments-list"
  | "collected-payments"
  | "agents" 
  | "pricing";

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

  // Tab 4: Voucher Data / Validity Report Specific States
  const [validityData, setValidityData] = useState<Record<string, any>>({});
  const [validityProfiles, setValidityProfiles] = useState<string[]>([]);
  const [activeProfile, setActiveProfile] = useState<string>("");
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportSortBy, setReportSortBy] = useState("");

  // Tab 5: Voucher Data / Hotspot Report Specific States
  const [hotspotData, setHotspotData] = useState<Record<string, any>>({});
  const [hotspotProfiles, setHotspotProfiles] = useState<string[]>([]);
  const [activeHotspotProfile, setActiveHotspotProfile] = useState<string>("");
  const [loadingHotspotReport, setLoadingHotspotReport] = useState(false);
  const [hotspotSortBy, setHotspotSortBy] = useState("");

  // Tab 6: Payment Camp Report Specific States
  const [paymentCampData, setPaymentCampData] = useState<any[]>([]);
  const [loadingPaymentCamp, setLoadingPaymentCamp] = useState(false);

  // Tab 7: Payment User Report Specific States
  const [paymentUserData, setPaymentUserData] = useState<any[]>([]);
  const [loadingPaymentUser, setLoadingPaymentUser] = useState(false);
  const [selectedCampFilter, setSelectedCampFilter] = useState("all");

  // Tab 8: Users Sale Report Specific States
  const [userSaleData, setUserSaleData] = useState<any[]>([]);
  const [loadingUserSale, setLoadingUserSale] = useState(false);

  // Tab 9: Companies Master Specific States
  const [companiesList, setCompaniesList] = useState<any[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [companySortBy, setCompanySortBy] = useState("");
  const [editCompany, setEditCompany] = useState<{ id?: number; name: string } | null>(null);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);

  // Tab 10: Camps Master Specific States
  const [campsList, setCampsList] = useState<any[]>([]);
  const [loadingCamps, setLoadingCamps] = useState(false);
  const [campSearch, setCampSearch] = useState("");
  const [campSortBy, setCampSortBy] = useState("");
  const [campCompanyFilter, setCampCompanyFilter] = useState("all");
  const [editCamp, setEditCamp] = useState<{ id?: number; name: string; company_name: string; hotspot_name: string; strength: number } | null>(null);
  const [isCampModalOpen, setIsCampModalOpen] = useState(false);

  // Tab 11: Validity Profiles Master Specific States
  const [vpList, setVpList] = useState<any[]>([]);
  const [loadingVp, setLoadingVp] = useState(false);
  const [vpSearch, setVpSearch] = useState("");
  const [vpSortBy, setVpSortBy] = useState("");
  const [editVp, setEditVp] = useState<{ id?: number; name: string } | null>(null);
  const [isVpModalOpen, setIsVpModalOpen] = useState(false);

  // Tab 12: Camp Validity Profiles Specific States
  const [cvpList, setCvpList] = useState<any[]>([]);
  const [loadingCvp, setLoadingCvp] = useState(false);
  const [cvpSearch, setCvpSearch] = useState("");
  const [cvpSortBy, setCvpSortBy] = useState("");
  const [cvpCampFilter, setCvpCampFilter] = useState("all");
  const [editCvp, setEditCvp] = useState<{ id?: number; camp_name: string; validity_name: string; company_name: string; price: number } | null>(null);
  const [isCvpModalOpen, setIsCvpModalOpen] = useState(false);

  // Tab 13: Notifications Master Specific States
  const [notifList, setNotifList] = useState<any[]>([]);
  const [loadingNotif, setLoadingNotif] = useState(false);
  const [notifSearch, setNotifSearch] = useState("");
  const [notifSortBy, setNotifSortBy] = useState("");
  const [editNotif, setEditNotif] = useState<{ id?: number; camp_name: string; user_name: string; category: string; message: string } | null>(null);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);

  // Tab 14 & 15: Payments Specific States
  const [paymentsList, setPaymentsList] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentCampFilter, setPaymentCampFilter] = useState("all");
  const [paymentPaidYearMonth, setPaymentPaidYearMonth] = useState("");
  const [editPayment, setEditPayment] = useState<{ id?: number; paid_by_user: string; camp_name: string; paid_for_year_month: string; amount: number; collected_by: string; split_by: string; payment_date?: string; payment_time?: string } | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const [collectedList, setCollectedList] = useState<any[]>([]);
  const [loadingCollected, setLoadingCollected] = useState(false);
  const [collectedSearch, setCollectedSearch] = useState("");

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
  const [activeDropdown, setActiveDropdown] = useState<"sales" | "reports" | "masters" | "payments" | null>(null);

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

  // Fetch validity reports data
  const fetchValidityReport = async () => {
    if (!isMounted) return;
    setLoadingReport(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (searchQuery) params.append("search", searchQuery);
      if (reportSortBy) params.append("sortBy", reportSortBy);

      const res = await fetch(`/api/reports/validity?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setValidityData(data.data);
        setValidityProfiles(data.profiles);
        if (data.profiles.length > 0 && (!activeProfile || !data.profiles.includes(activeProfile))) {
          setActiveProfile(data.profiles[0]);
        }
      }
    } catch (err) {
      console.error("Error fetching validity report stats:", err);
    } finally {
      setLoadingReport(false);
    }
  };

  // Fetch hotspot reports data
  const fetchHotspotReport = async () => {
    if (!isMounted) return;
    setLoadingHotspotReport(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (searchQuery) params.append("search", searchQuery);
      if (hotspotSortBy) params.append("sortBy", hotspotSortBy);

      const res = await fetch(`/api/reports/hotspot?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setHotspotData(data.data);
        setHotspotProfiles(data.hotspots);
        if (data.hotspots.length > 0 && (!activeHotspotProfile || !data.hotspots.includes(activeHotspotProfile))) {
          setActiveHotspotProfile(data.hotspots[0]);
        }
      }
    } catch (err) {
      console.error("Error fetching hotspot reports:", err);
    } finally {
      setLoadingHotspotReport(false);
    }
  };

  // Fetch payment camp report
  const fetchPaymentCampReport = async () => {
    if (!isMounted) return;
    setLoadingPaymentCamp(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (searchQuery) params.append("search", searchQuery);

      const res = await fetch(`/api/reports/payment-camp?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setPaymentCampData(data.data);
      }
    } catch (err) {
      console.error("Error fetching payment camp reports:", err);
    } finally {
      setLoadingPaymentCamp(false);
    }
  };

  // Fetch payment user report
  const fetchPaymentUserReport = async () => {
    if (!isMounted) return;
    setLoadingPaymentUser(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (searchQuery) params.append("search", searchQuery);
      if (selectedCampFilter) params.append("camp", selectedCampFilter);

      const res = await fetch(`/api/reports/payment-user?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setPaymentUserData(data.data);
      }
    } catch (err) {
      console.error("Error fetching payment user reports:", err);
    } finally {
      setLoadingPaymentUser(false);
    }
  };

  // Fetch Users Sale Report
  const fetchUserSaleReport = async () => {
    if (!isMounted) return;
    setLoadingUserSale(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (selectedAgent) params.append("user", selectedAgent);
      if (selectedRouter) params.append("camp", selectedRouter);

      const res = await fetch(`/api/reports/user-sale?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setUserSaleData(data.data);
      }
    } catch (err) {
      console.error("Error fetching user sale reports:", err);
    } finally {
      setLoadingUserSale(false);
    }
  };

  // Fetch Companies list
  const fetchCompanies = async () => {
    if (!isMounted) return;
    setLoadingCompanies(true);
    try {
      const params = new URLSearchParams();
      if (companySearch) params.append("search", companySearch);
      if (companySortBy) params.append("sortBy", companySortBy);

      const res = await fetch(`/api/reports/companies?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setCompaniesList(data.data);
      }
    } catch (err) {
      console.error("Error fetching companies:", err);
    } finally {
      setLoadingCompanies(false);
    }
  };

  // Fetch Camps list
  const fetchCamps = async () => {
    if (!isMounted) return;
    setLoadingCamps(true);
    try {
      const params = new URLSearchParams();
      if (campSearch) params.append("search", campSearch);
      if (campSortBy) params.append("sortBy", campSortBy);
      if (campCompanyFilter) params.append("company", campCompanyFilter);

      const res = await fetch(`/api/reports/camps?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setCampsList(data.data);
      }
    } catch (err) {
      console.error("Error fetching camps:", err);
    } finally {
      setLoadingCamps(false);
    }
  };

  // Fetch Validity Profiles list
  const fetchValidityProfiles = async () => {
    if (!isMounted) return;
    setLoadingVp(true);
    try {
      const params = new URLSearchParams();
      if (vpSearch) params.append("search", vpSearch);
      if (vpSortBy) params.append("sortBy", vpSortBy);

      const res = await fetch(`/api/reports/validity-profiles?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setVpList(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingVp(false);
    }
  };

  // Fetch Camp Validity Pricing list
  const fetchCampValidityPricing = async () => {
    if (!isMounted) return;
    setLoadingCvp(true);
    try {
      const params = new URLSearchParams();
      if (cvpSearch) params.append("search", cvpSearch);
      if (cvpSortBy) params.append("sortBy", cvpSortBy);
      if (cvpCampFilter) params.append("camp", cvpCampFilter);

      const res = await fetch(`/api/reports/camp-validity-pricing?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setCvpList(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCvp(false);
    }
  };

  // Fetch Notifications list
  const fetchNotifications = async () => {
    if (!isMounted) return;
    setLoadingNotif(true);
    try {
      const params = new URLSearchParams();
      if (notifSearch) params.append("search", notifSearch);
      if (notifSortBy) params.append("sortBy", notifSortBy);

      const res = await fetch(`/api/reports/notifications?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setNotifList(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingNotif(false);
    }
  };

  // Fetch Payments List
  const fetchPayments = async () => {
    if (!isMounted) return;
    setLoadingPayments(true);
    try {
      const params = new URLSearchParams();
      if (paymentSearch) params.append("search", paymentSearch);
      if (paymentCampFilter && paymentCampFilter !== "all") params.append("camp", paymentCampFilter);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (paymentPaidYearMonth) params.append("paidYearMonth", paymentPaidYearMonth);

      const res = await fetch(`/api/reports/payments?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setPaymentsList(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPayments(false);
    }
  };

  // Fetch Collected Payments List
  const fetchCollectedPayments = async () => {
    if (!isMounted) return;
    setLoadingCollected(true);
    try {
      const params = new URLSearchParams();
      params.append("collectedOnly", "true");
      if (collectedSearch) params.append("search", collectedSearch);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const res = await fetch(`/api/reports/payments?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setCollectedList(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCollected(false);
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

  // Save Company Master record
  const handleSaveCompany = async () => {
    if (!editCompany?.name || editCompany.name.trim() === "") {
      alert("Company name cannot be empty");
      return;
    }
    try {
      const res = await fetch("/api/reports/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editCompany)
      });
      const data = await res.json();
      if (data.success) {
        setIsCompanyModalOpen(false);
        setEditCompany(null);
        fetchCompanies();
      } else {
        alert(data.error || "Failed to save company");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Company Master record
  const handleDeleteCompany = async (id: number) => {
    if (!confirm("Are you sure you want to delete this company?")) return;
    try {
      const res = await fetch("/api/reports/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "delete" })
      });
      const data = await res.json();
      if (data.success) {
        fetchCompanies();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save Camp Master record
  const handleSaveCamp = async () => {
    if (!editCamp?.name || editCamp.name.trim() === "") {
      alert("Camp name cannot be empty");
      return;
    }
    try {
      const res = await fetch("/api/reports/camps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editCamp)
      });
      const data = await res.json();
      if (data.success) {
        setIsCampModalOpen(false);
        setEditCamp(null);
        fetchCamps();
      } else {
        alert(data.error || "Failed to save camp");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Camp Master record
  const handleDeleteCamp = async (id: number) => {
    if (!confirm("Are you sure you want to delete this camp?")) return;
    try {
      const res = await fetch("/api/reports/camps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "delete" })
      });
      const data = await res.json();
      if (data.success) {
        fetchCamps();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save Validity Profile record
  const handleSaveVp = async () => {
    if (!editVp?.name || editVp.name.trim() === "") {
      alert("Profile name is required");
      return;
    }
    try {
      const res = await fetch("/api/reports/validity-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editVp)
      });
      const data = await res.json();
      if (data.success) {
        setIsVpModalOpen(false);
        setEditVp(null);
        fetchValidityProfiles();
      } else {
        alert(data.error || "Failed to save validity profile");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Validity Profile record
  const handleDeleteVp = async (id: number) => {
    if (!confirm("Are you sure you want to delete this profile?")) return;
    try {
      const res = await fetch("/api/reports/validity-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "delete" })
      });
      const data = await res.json();
      if (data.success) {
        fetchValidityProfiles();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save Camp Validity Pricing record
  const handleSaveCvp = async () => {
    if (!editCvp?.camp_name || !editCvp.validity_name) {
      alert("Camp name and validity profile name are required");
      return;
    }
    try {
      const res = await fetch("/api/reports/camp-validity-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editCvp)
      });
      const data = await res.json();
      if (data.success) {
        setIsCvpModalOpen(false);
        setEditCvp(null);
        fetchCampValidityPricing();
      } else {
        alert(data.error || "Failed to save camp validity profile");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Camp Validity Pricing record
  const handleDeleteCvp = async (id: number) => {
    if (!confirm("Are you sure you want to delete this camp profile?")) return;
    try {
      const res = await fetch("/api/reports/camp-validity-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "delete" })
      });
      const data = await res.json();
      if (data.success) {
        fetchCampValidityPricing();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle Camp Validity Pricing active status
  const handleToggleCvpStatus = async (id: number, currentStatus: number) => {
    try {
      const newStatus = currentStatus === 1 ? 0 : 1;
      const res = await fetch("/api/reports/camp-validity-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus, action: "toggle" })
      });
      const data = await res.json();
      if (data.success) {
        fetchCampValidityPricing();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save Notification record
  const handleSaveNotif = async () => {
    if (!editNotif?.camp_name || !editNotif?.user_name || !editNotif?.message) {
      alert("Camp name, user and message are required");
      return;
    }
    try {
      const res = await fetch("/api/reports/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editNotif)
      });
      const data = await res.json();
      if (data.success) {
        setIsNotifModalOpen(false);
        setEditNotif(null);
        fetchNotifications();
      } else {
        alert(data.error || "Failed to save notification");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Notification record
  const handleDeleteNotif = async (id: number) => {
    if (!confirm("Are you sure?")) return;
    try {
      const res = await fetch("/api/reports/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "delete" })
      });
      const data = await res.json();
      if (data.success) {
        fetchNotifications();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle Notification Read Status
  const handleToggleNotifRead = async (id: number, currentRead: number) => {
    try {
      const newRead = currentRead === 1 ? 0 : 1;
      const res = await fetch("/api/reports/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_read: newRead, action: "toggle" })
      });
      const data = await res.json();
      if (data.success) {
        fetchNotifications();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save Payment record
  const handleSavePayment = async () => {
    if (!editPayment?.paid_by_user || !editPayment?.camp_name || !editPayment?.paid_for_year_month || !editPayment?.amount) {
      alert("Paid by user, Camp, Month and Amount are required");
      return;
    }
    try {
      const res = await fetch("/api/reports/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editPayment)
      });
      const data = await res.json();
      if (data.success) {
        setIsPaymentModalOpen(false);
        setEditPayment(null);
        fetchPayments();
      } else {
        alert(data.error || "Failed to save payment record");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Payment record
  const handleDeletePayment = async (id: number) => {
    if (!confirm("Are you sure?")) return;
    try {
      const res = await fetch("/api/reports/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "delete" })
      });
      const data = await res.json();
      if (data.success) {
        fetchPayments();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle Payment verification
  const handleTogglePaymentVerify = async (id: number, currentRead: number) => {
    try {
      const newRead = currentRead === 1 ? 0 : 1;
      const res = await fetch("/api/reports/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, verified_status: newRead, action: "verify" })
      });
      const data = await res.json();
      if (data.success) {
        fetchPayments();
        fetchCollectedPayments();
      }
    } catch (err) {
      console.error(err);
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
      fetchSales(1);
    } else if (activeTab === "sales-chart") {
      fetchSummary();
      fetchSales(1);
    } else if (activeTab === "voucher-validity") {
      fetchValidityReport();
    } else if (activeTab === "voucher-hotspot") {
      fetchHotspotReport();
    } else if (activeTab === "payment-camp") {
      fetchPaymentCampReport();
    } else if (activeTab === "payment-user") {
      fetchPaymentUserReport();
    } else if (activeTab === "user-sale") {
      fetchUserSaleReport();
    } else if (activeTab === "companies") {
      fetchCompanies();
    } else if (activeTab === "camps") {
      fetchCamps();
    } else if (activeTab === "validity-profiles") {
      fetchValidityProfiles();
    } else if (activeTab === "camp-validity-pricing") {
      fetchCampValidityPricing();
    } else if (activeTab === "notifications") {
      fetchNotifications();
    } else if (activeTab === "payments-list") {
      fetchPayments();
    } else if (activeTab === "collected-payments") {
      fetchCollectedPayments();
    } else if (activeTab === "agents") {
      fetchSummary();
    } else if (activeTab === "pricing") {
      fetchPricing();
    }
  }, [
    activeTab, 
    startDate, 
    endDate, 
    selectedAgent, 
    selectedValidity, 
    selectedRouter, 
    entriesLimit, 
    reportSortBy, 
    hotspotSortBy, 
    selectedCampFilter,
    companySearch,
    companySortBy,
    campSearch,
    campSortBy,
    campCompanyFilter,
    vpSearch,
    vpSortBy,
    cvpSearch,
    cvpSortBy,
    cvpCampFilter,
    notifSearch,
    notifSortBy,
    paymentSearch,
    paymentCampFilter,
    paymentPaidYearMonth,
    collectedSearch,
    isMounted
  ]);

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
    if (activeTab === "voucher-validity") {
      fetchValidityReport();
    }
    if (activeTab === "voucher-hotspot") {
      fetchHotspotReport();
    }
    if (activeTab === "payment-camp") {
      fetchPaymentCampReport();
    }
    if (activeTab === "payment-user") {
      fetchPaymentUserReport();
    }
    if (activeTab === "user-sale") {
      fetchUserSaleReport();
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
    setReportSortBy("");
    setHotspotSortBy("");
    setSelectedCampFilter("all");
    setCompanySearch("");
    setCompanySortBy("");
    setCampSearch("");
    setCampSortBy("");
    setCampCompanyFilter("all");
    setVpSearch("");
    setVpSortBy("");
    setCvpSearch("");
    setCvpSortBy("");
    setCvpCampFilter("all");
    setNotifSearch("");
    setNotifSortBy("");
    setPaymentSearch("");
    setPaymentCampFilter("all");
    setPaymentPaidYearMonth("");
    setCollectedSearch("");
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
    
    return Object.values(groups).sort((a: any, b: any) => a.month.localeCompare(b.month));
  }, [salesData]);

  // Dynamic colors list for stack bars and variables definition
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

  // Calculate totals for active Validity Profile table (Voucher Data / Validity)
  const activeProfileTableData = useMemo(() => {
    if (!activeProfile || !validityData[activeProfile]) return [];
    return validityData[activeProfile];
  }, [activeProfile, validityData]);

  const activeProfileTotals = useMemo(() => {
    let generated = 0;
    let sold = 0;
    let remaining = 0;
    activeProfileTableData.forEach((row: any) => {
      generated += row.generated;
      sold += row.sold;
      remaining += row.remaining;
    });
    return { generated, sold, remaining };
  }, [activeProfileTableData]);

  // Calculate totals for active Hotspot Profile table (Voucher Data / Hotspot)
  const activeHotspotTableData = useMemo(() => {
    if (!activeHotspotProfile || !hotspotData[activeHotspotProfile]) return [];
    return hotspotData[activeHotspotProfile];
  }, [activeHotspotProfile, hotspotData]);

  const activeHotspotTotals = useMemo(() => {
    let generated = 0;
    let sold = 0;
    let remaining = 0;
    activeHotspotTableData.forEach((row: any) => {
      generated += row.generated;
      sold += row.sold;
      remaining += row.remaining;
    });
    return { generated, sold, remaining };
  }, [activeHotspotTableData]);

  // Calculate totals for Payment Camp Report
  const paymentCampTotals = useMemo(() => {
    let salesCount = 0;
    let totalAmount = 0;
    paymentCampData.forEach(row => {
      salesCount += row.salesCount;
      totalAmount += row.totalAmount;
    });
    return { salesCount, totalAmount };
  }, [paymentCampData]);

  // Calculate totals for Payment User Report
  const paymentUserTotals = useMemo(() => {
    let salesCount = 0;
    let totalAmount = 0;
    paymentUserData.forEach(row => {
      salesCount += row.salesCount;
      totalAmount += row.totalAmount;
    });
    return { salesCount, totalAmount };
  }, [paymentUserData]);

  // Calculate totals for Users Sale Report
  const userSaleTotals = useMemo(() => {
    let salesCount = 0;
    let salesAmount = 0;
    userSaleData.forEach(row => {
      salesCount += row.salesCount;
      salesAmount += row.salesAmount;
    });
    return { salesCount, salesAmount };
  }, [userSaleData]);

  const paymentsTotals = useMemo(() => {
    return paymentsList.reduce((sum, item) => sum + item.amount, 0);
  }, [paymentsList]);

  const collectedTotals = useMemo(() => {
    return collectedList.reduce((sum, item) => sum + item.amount, 0);
  }, [collectedList]);

  const handleDropdownToggle = (e: React.MouseEvent, type: "sales" | "reports" | "masters" | "payments") => {
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
              onClick={() => { setActiveTab("dashboard"); setActiveDropdown(null); }} 
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
          
          {/* Dropdown 2: Payments */}
          <li className="relative overflow-visible">
            <button 
              onClick={(e) => handleDropdownToggle(e, "payments")} 
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-all ${
                ["payments-list", "collected-payments"].includes(activeTab)
                  ? "text-[#1e3c72] bg-white/60 shadow-sm" 
                  : "text-[#4a6b82] hover:text-[#1e3c72]"
              }`}
            >
              <DollarSign className="h-4 w-4" />
              Payments
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {activeDropdown === "payments" && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#cfdbe6] rounded-md shadow-md min-w-[200px] z-50 flex flex-col py-1">
                <button 
                  onClick={() => { setActiveTab("payments-list"); setActiveDropdown(null); }}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-[#4a6b82] hover:text-[#1e3c72] hover:bg-[#bfebff]/30 text-left w-full transition-all"
                >
                  List Payments
                </button>
                <button 
                  onClick={() => { setActiveTab("collected-payments"); setActiveDropdown(null); }}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-[#4a6b82] hover:text-[#1e3c72] hover:bg-[#bfebff]/30 text-left w-full transition-all"
                >
                  Collected Payments
                </button>
              </div>
            )}
          </li>
          
          {/* Dropdown 3: Reports */}
          <li className="relative overflow-visible">
            <button 
              onClick={(e) => handleDropdownToggle(e, "reports")} 
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-all ${
                ["voucher-validity", "voucher-hotspot", "payment-camp", "payment-user", "user-sale", "agents"].includes(activeTab)
                  ? "text-[#1e3c72] bg-white/60 shadow-sm" 
                  : "text-[#4a6b82] hover:text-[#1e3c72]"
              }`}
            >
              <FileText className="h-4 w-4" />
              Reports
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {activeDropdown === "reports" && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#cfdbe6] rounded-md shadow-md min-w-[240px] z-50 flex flex-col py-1">
                <button 
                  onClick={() => { setActiveTab("voucher-validity"); setActiveDropdown(null); }}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-[#4a6b82] hover:text-[#1e3c72] hover:bg-[#bfebff]/30 text-left w-full transition-all"
                >
                  Voucher Data / Validity
                </button>
                <button 
                  onClick={() => { setActiveTab("voucher-hotspot"); setActiveDropdown(null); }}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-[#4a6b82] hover:text-[#1e3c72] hover:bg-[#bfebff]/30 text-left w-full transition-all"
                >
                  Voucher Data / Hotspot
                </button>
                <button 
                  onClick={() => { setActiveTab("payment-camp"); setActiveDropdown(null); }}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-[#4a6b82] hover:text-[#1e3c72] hover:bg-[#bfebff]/30 text-left w-full transition-all"
                >
                  Payment - Camp Report
                </button>
                <button 
                  onClick={() => { setActiveTab("payment-user"); setActiveDropdown(null); }}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-[#4a6b82] hover:text-[#1e3c72] hover:bg-[#bfebff]/30 text-left w-full transition-all"
                >
                  Payment - User Camp Report
                </button>
                <button 
                  onClick={() => { setActiveTab("user-sale"); setActiveDropdown(null); }}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-[#4a6b82] hover:text-[#1e3c72] hover:bg-[#bfebff]/30 text-left w-full transition-all"
                >
                  User - Sales Report
                </button>
                
                <div className="border-t border-slate-100 my-1"></div>
                <button 
                  onClick={() => { setActiveTab("agents"); setActiveDropdown(null); }}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-[#4a6b82] hover:text-[#1e3c72] hover:bg-[#bfebff]/30 text-left w-full transition-all"
                >
                  Agent Leaderboard
                </button>
              </div>
            )}
          </li>

          {/* Dropdown 4: Masters */}
          <li className="relative overflow-visible">
            <button 
              onClick={(e) => handleDropdownToggle(e, "masters")} 
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-all ${
                ["companies", "camps", "validity-profiles", "camp-validity-pricing", "notifications", "pricing"].includes(activeTab)
                  ? "text-[#1e3c72] bg-white/60 shadow-sm" 
                  : "text-[#4a6b82] hover:text-[#1e3c72]"
              }`}
            >
              <Layers className="h-4 w-4" />
              Masters
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {activeDropdown === "masters" && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#cfdbe6] rounded-md shadow-md min-w-[220px] z-50 flex flex-col py-1">
                <button 
                  onClick={() => { setActiveTab("companies"); setActiveDropdown(null); }}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-[#4a6b82] hover:text-[#1e3c72] hover:bg-[#bfebff]/30 text-left w-full transition-all"
                >
                  Companies
                </button>
                <button 
                  onClick={() => { setActiveTab("camps"); setActiveDropdown(null); }}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-[#4a6b82] hover:text-[#1e3c72] hover:bg-[#bfebff]/30 text-left w-full transition-all"
                >
                  Camps
                </button>
                <button 
                  onClick={() => { setActiveTab("validity-profiles"); setActiveDropdown(null); }}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-[#4a6b82] hover:text-[#1e3c72] hover:bg-[#bfebff]/30 text-left w-full transition-all"
                >
                  Validity Profiles
                </button>
                <button 
                  onClick={() => { setActiveTab("camp-validity-pricing"); setActiveDropdown(null); }}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-[#4a6b82] hover:text-[#1e3c72] hover:bg-[#bfebff]/30 text-left w-full transition-all"
                >
                  Camp Profiles
                </button>
                <button 
                  onClick={() => { setActiveTab("notifications"); setActiveDropdown(null); }}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-[#4a6b82] hover:text-[#1e3c72] hover:bg-[#bfebff]/30 text-left w-full transition-all"
                >
                  Notifications
                </button>
                
                <div className="border-t border-slate-100 my-1"></div>
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
            {activeTab === "voucher-validity" && "Voucher Data [ Validity ]"}
            {activeTab === "voucher-hotspot" && "Voucher Data [ Hotspot ]"}
            {activeTab === "payment-camp" && "Payment Camp Report"}
            {activeTab === "payment-user" && "Payment User Report"}
            {activeTab === "user-sale" && "Users Sale Report"}
            {activeTab === "companies" && "Companies Master"}
            {activeTab === "camps" && "Camps Master"}
            {activeTab === "validity-profiles" && "Validity Profiles Master"}
            {activeTab === "camp-validity-pricing" && "Camp Profiles Master"}
            {activeTab === "notifications" && "Notifications Master"}
            {activeTab === "payments-list" && "Payments Log"}
            {activeTab === "collected-payments" && "Collected Payments"}
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
                  <Search className="h-4.5 w-4.5" />
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

        {/* ── 4. FILTER BAR (Voucher Data [Validity] & [Hotspot] Reports) ──── */}
        {["voucher-validity", "voucher-hotspot"].includes(activeTab) && (
          <section className="bg-white border border-[#cfdbe6] rounded-xl p-5 mb-6 shadow-sm">
            <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
              
              {/* Search Keyword */}
              <div className="lg:col-span-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Search Keyword</label>
                <input 
                  type="text" 
                  placeholder="Search Here" 
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

              {/* Sort by */}
              <div className="lg:col-span-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Sort by</label>
                {activeTab === "voucher-validity" ? (
                  <select 
                    value={reportSortBy}
                    onChange={(e) => setReportSortBy(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 cursor-pointer"
                  >
                    <option value="">Select from list</option>
                    <option value="validityProfile asc">Validity A-Z</option>
                    <option value="validityProfile desc">Validity Z-A</option>
                  </select>
                ) : (
                  <select 
                    value={hotspotSortBy}
                    onChange={(e) => setHotspotSortBy(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 cursor-pointer"
                  >
                    <option value="">Select from list</option>
                    <option value="hotspotName asc">Hotspot A-Z</option>
                    <option value="hotspotName desc">Hotspot Z-A</option>
                  </select>
                )}
              </div>

              {/* Search Action button */}
              <div className="lg:col-span-2">
                <button 
                  type="submit" 
                  className="bg-[#3958b2] hover:bg-[#2d468f] text-white font-bold px-5 py-2.5 rounded-lg flex items-center gap-1.5 transition-all shadow-sm text-sm w-full justify-center"
                >
                  <Search className="h-4 w-4" />
                  Search
                </button>
              </div>

            </form>
          </section>
        )}

        {/* ── 5. FILTER BAR (Payment Camp & Payment User Reports) ─────────── */}
        {["payment-camp", "payment-user"].includes(activeTab) && (
          <section className="bg-white border border-[#cfdbe6] rounded-xl p-5 mb-6 shadow-sm">
            <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
              
              {/* Search Keyword */}
              <div className="lg:col-span-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Search Keyword</label>
                <input 
                  type="text" 
                  placeholder={activeTab === "payment-user" ? "Type Name or Amount" : "Search Here"} 
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

              {/* Camp Filter for Payment User Report */}
              {activeTab === "payment-user" && (
                <div className="lg:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Camp</label>
                  <select 
                    value={selectedCampFilter}
                    onChange={(e) => setSelectedCampFilter(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 cursor-pointer"
                  >
                    <option value="all">-- All Camps --</option>
                    {campList.map(camp => (
                      <option key={camp} value={camp}>{camp}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Entries count limit */}
              <div className="lg:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Show By</label>
                <select 
                  value={entriesLimit}
                  onChange={(e) => setEntriesLimit(Number(e.target.value))}
                  className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 cursor-pointer"
                >
                  <option value={10}>10 entries</option>
                  <option value={25}>25 entries</option>
                  <option value={50}>50 entries</option>
                  <option value={100}>100 entries</option>
                  <option value={1000}>1000 entries</option>
                </select>
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

        {/* ── 6. FILTER BAR (Users Sale Report) ───────────────────────────── */}
        {activeTab === "user-sale" && (
          <section className="bg-white border border-[#cfdbe6] rounded-xl p-5 mb-6 shadow-sm">
            <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
              
              {/* Search Keyword */}
              <div className="lg:col-span-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Search Keyword</label>
                <input 
                  type="text" 
                  placeholder="Type something..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* User Selector */}
              <div className="lg:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">User</label>
                <select 
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 cursor-pointer"
                >
                  <option value="all">-- Select User --</option>
                  {summaryData?.agents.map(a => (
                    <option key={a.name} value={a.name}>{a.name}</option>
                  ))}
                </select>
              </div>

              {/* Company Selector */}
              <div className="lg:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Company</label>
                <select 
                  className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 cursor-pointer"
                >
                  <option value="all">-- Select Company --</option>
                  <option value="1">Apricom DXB</option>
                </select>
              </div>

              {/* Camp Selector */}
              <div className="lg:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Camp</label>
                <select 
                  value={selectedRouter}
                  onChange={(e) => setSelectedRouter(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 cursor-pointer"
                >
                  <option value="all">-- Select Camp --</option>
                  {campList.map(camp => (
                    <option key={camp} value={camp}>{camp}</option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="lg:col-span-3 flex gap-2">
                <button 
                  type="submit" 
                  className="bg-[#3958b2] hover:bg-[#2d468f] text-white font-bold px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm text-sm flex-1"
                >
                  <Search className="h-4 w-4" />
                  Search
                </button>
                
                <button 
                  type="button"
                  onClick={resetFilters}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold transition-all border border-slate-300 flex-1"
                >
                  Reset
                </button>
              </div>

            </form>
          </section>
        )}

        {/* ── 7. FILTER BAR (Companies Master) ────────────────────────────── */}
        {activeTab === "companies" && (
          <section className="bg-white border border-[#cfdbe6] rounded-xl p-5 mb-6 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-4 items-end justify-between">
              
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-4 w-full">
                {/* Search Keyword */}
                <div className="sm:col-span-4">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Search Keyword</label>
                  <input 
                    type="text" 
                    placeholder="Search Here" 
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 placeholder-slate-400 transition-all"
                  />
                </div>

                {/* Sort by */}
                <div className="sm:col-span-4">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Sort by</label>
                  <select 
                    value={companySortBy}
                    onChange={(e) => setCompanySortBy(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 cursor-pointer"
                  >
                    <option value="">Select from list</option>
                    <option value="name.asc">Name A-Z</option>
                    <option value="name.desc">Name Z-A</option>
                  </select>
                </div>
              </div>

              {/* Add New Button */}
              <button 
                type="button"
                onClick={() => { setEditCompany({ name: "" }); setIsCompanyModalOpen(true); }}
                className="bg-[#3958b2] hover:bg-[#2d468f] text-white font-bold px-5 py-2.5 rounded-lg flex items-center gap-1.5 transition-all shadow-md text-sm shrink-0"
              >
                <Plus className="h-4.5 w-4.5" />
                New
              </button>

            </div>
          </section>
        )}

        {/* ── 8. FILTER BAR (Camps Master) ────────────────────────────────── */}
        {activeTab === "camps" && (
          <section className="bg-white border border-[#cfdbe6] rounded-xl p-5 mb-6 shadow-sm">
            <div className="flex flex-col lg:flex-row gap-4 items-end justify-between">
              
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-4 w-full">
                {/* Search Keyword */}
                <div className="sm:col-span-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Search Keyword</label>
                  <input 
                    type="text" 
                    placeholder="Search Here" 
                    value={campSearch}
                    onChange={(e) => setCampSearch(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 placeholder-slate-400 transition-all"
                  />
                </div>

                {/* Company filter */}
                <div className="sm:col-span-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Company</label>
                  <select 
                    value={campCompanyFilter}
                    onChange={(e) => setCampCompanyFilter(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 cursor-pointer"
                  >
                    <option value="all">-- All Companies --</option>
                    <option value="Apricom DXB">Apricom DXB</option>
                    <option value="Apricom KSA">Apricom KSA</option>
                  </select>
                </div>

                {/* Sort by */}
                <div className="sm:col-span-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Sort by</label>
                  <select 
                    value={campSortBy}
                    onChange={(e) => setCampSortBy(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 cursor-pointer"
                  >
                    <option value="">-- Select --</option>
                    <option value="ASC">Name A-Z</option>
                    <option value="DESC">Name Z-A</option>
                  </select>
                </div>
              </div>

              {/* Add New Button */}
              <button 
                type="button"
                onClick={() => { setEditCamp({ name: "", company_name: "Apricom DXB", hotspot_name: "", strength: 500 }); setIsCampModalOpen(true); }}
                className="bg-[#3958b2] hover:bg-[#2d468f] text-white font-bold px-5 py-2.5 rounded-lg flex items-center gap-1.5 transition-all shadow-md text-sm shrink-0 w-full lg:w-auto justify-center"
              >
                <Plus className="h-4.5 w-4.5" />
                New
              </button>

            </div>
          </section>
        )}

        {/* ── 9. FILTER BAR (Validity Profiles Master) ────────────────────── */}
        {activeTab === "validity-profiles" && (
          <section className="bg-white border border-[#cfdbe6] rounded-xl p-5 mb-6 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-4 items-end justify-between">
              
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-4 w-full">
                {/* Search Keyword */}
                <div className="sm:col-span-4">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Search Keyword</label>
                  <input 
                    type="text" 
                    placeholder="Search Here" 
                    value={vpSearch}
                    onChange={(e) => setVpSearch(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 placeholder-slate-400 transition-all"
                  />
                </div>

                {/* Sort by */}
                <div className="sm:col-span-4">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Sort by</label>
                  <select 
                    value={vpSortBy}
                    onChange={(e) => setVpSortBy(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 cursor-pointer"
                  >
                    <option value="">Select from list</option>
                    <option value="name">Name</option>
                  </select>
                </div>
              </div>

              {/* Add New Button */}
              <button 
                type="button"
                onClick={() => { setEditVp({ name: "" }); setIsVpModalOpen(true); }}
                className="bg-[#3958b2] hover:bg-[#2d468f] text-white font-bold px-5 py-2.5 rounded-lg flex items-center gap-1.5 transition-all shadow-md text-sm shrink-0"
              >
                <Plus className="h-4.5 w-4.5" />
                New
              </button>

            </div>
          </section>
        )}

        {/* ── 10. FILTER BAR (Camp Profiles Master) ────────────────────────── */}
        {activeTab === "camp-validity-pricing" && (
          <section className="bg-white border border-[#cfdbe6] rounded-xl p-5 mb-6 shadow-sm">
            <div className="flex flex-col lg:flex-row gap-4 items-end justify-between">
              
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-4 w-full">
                {/* Search Keyword */}
                <div className="sm:col-span-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Search Keyword</label>
                  <input 
                    type="text" 
                    placeholder="Search Here" 
                    value={cvpSearch}
                    onChange={(e) => setCvpSearch(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 placeholder-slate-400 transition-all"
                  />
                </div>

                {/* Camp selector */}
                <div className="sm:col-span-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Camps</label>
                  <select 
                    value={cvpCampFilter}
                    onChange={(e) => setCvpCampFilter(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 cursor-pointer"
                  >
                    <option value="all">-- All Camps --</option>
                    {campList.map(camp => (
                      <option key={camp} value={camp}>{camp}</option>
                    ))}
                  </select>
                </div>

                {/* Sort by */}
                <div className="sm:col-span-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Sort by</label>
                  <select 
                    value={cvpSortBy}
                    onChange={(e) => setCvpSortBy(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 cursor-pointer"
                  >
                    <option value="">-- Select --</option>
                    <option value="camps.campName ASC">Camp Name A-Z</option>
                    <option value="camps.campName DESC">Camp Name Z-A</option>
                    <option value="vp.profileValidityName ASC">Validity A-Z</option>
                    <option value="vp.profileValidityName DESC">Validity Z-A</option>
                  </select>
                </div>
              </div>

              {/* Add New Button */}
              <button 
                type="button"
                onClick={() => { setEditCvp({ camp_name: "APM-DXB-camp-1", validity_name: "30-Days", company_name: "Apricom DXB", price: 32 }); setIsCvpModalOpen(true); }}
                className="bg-[#3958b2] hover:bg-[#2d468f] text-white font-bold px-5 py-2.5 rounded-lg flex items-center gap-1.5 transition-all shadow-md text-sm shrink-0 w-full lg:w-auto justify-center"
              >
                <Plus className="h-4.5 w-4.5" />
                New
              </button>

            </div>
          </section>
        )}

        {/* ── 11. FILTER BAR (Notifications Master) ───────────────────────── */}
        {activeTab === "notifications" && (
          <section className="bg-white border border-[#cfdbe6] rounded-xl p-5 mb-6 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-4 items-end justify-between">
              
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-4 w-full">
                {/* Search Keyword */}
                <div className="sm:col-span-4">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Search Keyword</label>
                  <input 
                    type="text" 
                    placeholder="Search Here" 
                    value={notifSearch}
                    onChange={(e) => setNotifSearch(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 placeholder-slate-400 transition-all"
                  />
                </div>

                {/* Sort by */}
                <div className="sm:col-span-4">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Sort by</label>
                  <select 
                    value={notifSortBy}
                    onChange={(e) => setNotifSortBy(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 cursor-pointer"
                  >
                    <option value="">Select from list</option>
                    <option value="n.id DESC">Time (Newest First)</option>
                    <option value="n.id ASC">Time (Oldest First)</option>
                  </select>
                </div>
              </div>

              {/* Add New Button */}
              <button 
                type="button"
                onClick={() => { setEditNotif({ camp_name: "APM-RIMAL-1", user_name: "admin", category: "System Alert", message: "" }); setIsNotifModalOpen(true); }}
                className="bg-[#3958b2] hover:bg-[#2d468f] text-white font-bold px-5 py-2.5 rounded-lg flex items-center gap-1.5 transition-all shadow-md text-sm shrink-0"
              >
                <Plus className="h-4.5 w-4.5" />
                New
              </button>

            </div>
          </section>
        )}

        {/* ── 12. FILTER BAR (Payments Log / List Payments) ───────────────── */}
        {activeTab === "payments-list" && (
          <section className="bg-white border border-[#cfdbe6] rounded-xl p-5 mb-6 shadow-sm">
            <form onSubmit={(e) => { e.preventDefault(); fetchPayments(); }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
              
              {/* Keyword Search */}
              <div className="lg:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Search Keyword</label>
                <input 
                  type="text" 
                  placeholder="Search Here" 
                  value={paymentSearch}
                  onChange={(e) => setPaymentSearch(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* Date range filters */}
              <div className="lg:col-span-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Start Date</label>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">End Date</label>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 transition-all"
                  />
                </div>
              </div>

              {/* Year | Month selection */}
              <div className="lg:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Paid Year | Month</label>
                <input 
                  type="month" 
                  value={paymentPaidYearMonth}
                  onChange={(e) => setPaymentPaidYearMonth(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 transition-all"
                />
              </div>

              {/* Camps selector */}
              <div className="lg:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Camps</label>
                <select 
                  value={paymentCampFilter}
                  onChange={(e) => setPaymentCampFilter(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 cursor-pointer"
                >
                  <option value="all">-- All Camps --</option>
                  {campList.map(camp => (
                    <option key={camp} value={camp}>{camp}</option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="lg:col-span-2 flex gap-2 w-full">
                <button 
                  type="submit" 
                  className="bg-[#3958b2] hover:bg-[#2d468f] text-white font-bold p-2.5 rounded-lg flex items-center justify-center transition-all shadow-sm text-sm w-full"
                >
                  <Search className="h-4.5 w-4.5" />
                </button>
                <button 
                  type="button"
                  onClick={() => { setEditPayment({ paid_by_user: "iqbaal", camp_name: "APM-DXB-camp-1", paid_for_year_month: "2026-08", amount: 100, collected_by: "admin", split_by: "Manual" }); setIsPaymentModalOpen(true); }}
                  className="bg-[#26b048] hover:bg-[#1d8b37] text-white font-bold p-2.5 rounded-lg flex items-center justify-center transition-all shadow-sm text-sm w-full"
                >
                  <Plus className="h-4.5 w-4.5" />
                </button>
              </div>

            </form>
          </section>
        )}

        {/* ── 13. FILTER BAR (Collected Payments) ─────────────────────────── */}
        {activeTab === "collected-payments" && (
          <section className="bg-white border border-[#cfdbe6] rounded-xl p-5 mb-6 shadow-sm">
            <form onSubmit={(e) => { e.preventDefault(); fetchCollectedPayments(); }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
              
              {/* Keyword Search */}
              <div className="lg:col-span-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Search Keyword</label>
                <input 
                  type="text" 
                  placeholder="Search Here" 
                  value={collectedSearch}
                  onChange={(e) => setCollectedSearch(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* Date Filters */}
              <div className="lg:col-span-6 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Start Date</label>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">End Date</label>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800 transition-all"
                  />
                </div>
              </div>

              {/* Search button */}
              <div className="lg:col-span-3">
                <button 
                  type="submit" 
                  className="bg-[#3958b2] hover:bg-[#2d468f] text-white font-bold px-5 py-2.5 rounded-lg flex items-center gap-1.5 transition-all shadow-sm text-sm w-full justify-center"
                >
                  <Search className="h-4 w-4" />
                  Search
                </button>
              </div>

            </form>
          </section>
        )}

        {/* ── TAB CONTENT: DASHBOARD ─────────────────────────────────────── */}
        {/* Rendered in previous section code */}

        {/* ── TAB CONTENT: VOUCHER SALES TABLE (Option 1) ──────────────────── */}
        {/* Rendered in previous section code */}

        {/* ── TAB CONTENT: MONTHLY DAILY SALES CHART (Option 2) ───────────── */}
        {/* Rendered in previous section code */}

        {/* ── TAB CONTENT: CAMPS MONTHLY STACKED CHART (Option 3) ──────────── */}
        {/* Rendered in previous section code */}

        {/* ── TAB CONTENT: VOUCHER DATA / VALIDITY REPORT (Option 4) ───────── */}
        {/* Rendered in previous section code */}

        {/* ── TAB CONTENT: VOUCHER DATA / HOTSPOT REPORT (Option 5) ────────── */}
        {/* Rendered in previous section code */}

        {/* ── TAB CONTENT: PAYMENT - CAMP REPORT (Option 6) ────────────────── */}
        {/* Rendered in previous section code */}

        {/* ── TAB CONTENT: PAYMENT - USER CAMP REPORT (Option 7) ───────────── */}
        {/* Rendered in previous section code */}

        {/* ── TAB CONTENT: USER SALE REPORT (Option 8) ─────────────────────── */}
        {/* Rendered in previous section code */}

        {/* ── TAB CONTENT: COMPANIES MASTER (Option 9) ─────────────────────── */}
        {/* Rendered in previous section code */}

        {/* ── TAB CONTENT: Camps list Master (Option 10) ───────────────────── */}
        {/* Rendered in previous section code */}

        {/* ── TAB CONTENT: VALIDITY PROFILES MASTER (Option 11) ────────────── */}
        {/* Rendered in previous section code */}

        {/* ── TAB CONTENT: CAMP VALIDITY PRICING MASTER (Option 12) ────────── */}
        {/* Rendered in previous section code */}

        {/* ── TAB CONTENT: NOTIFICATIONS MASTER (Option 13) ────────────────── */}
        {/* Rendered in previous section code */}

        {/* ── TAB CONTENT: PAYMENTS LOG (Option 14) ────────────────────────── */}
        {activeTab === "payments-list" && (
          <div className="bg-white border border-[#cfdbe6] rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-x-auto min-h-0">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#cfdbe6] bg-slate-50 font-black text-slate-600">
                    <th className="px-6 py-4 w-20">Sl. No.</th>
                    <th className="px-6 py-4">Paid By User</th>
                    <th className="px-6 py-4">Camp</th>
                    <th className="px-6 py-4">Paid For Month</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                    <th className="px-6 py-4">Collected By</th>
                    <th className="px-6 py-4">Split By</th>
                    <th className="px-6 py-4">Payment Date</th>
                    <th className="px-6 py-4">Payment Time</th>
                    <th className="px-6 py-4 text-right w-32">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {loadingPayments ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center">
                        <RefreshCw className="h-5 w-5 animate-spin text-slate-400 mx-auto" />
                      </td>
                    </tr>
                  ) : paymentsList.length > 0 ? (
                    paymentsList.map((p, index) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-all">
                        <td className="px-6 py-3 font-bold text-slate-400">{index + 1}</td>
                        <td className="px-6 py-3 font-bold text-slate-800">{p.paid_by_user}</td>
                        <td className="px-6 py-3 text-[#3958b2]">{p.camp_name}</td>
                        <td className="px-6 py-3 font-mono">{p.paid_for_year_month}</td>
                        <td className="px-6 py-3 text-right font-black text-[#26b048]">AED {p.amount.toFixed(2)}</td>
                        <td className="px-6 py-3">{p.collected_by || "—"}</td>
                        <td className="px-6 py-3 font-mono">{p.split_by || "—"}</td>
                        <td className="px-6 py-3">{p.payment_date}</td>
                        <td className="px-6 py-3">{p.payment_time}</td>
                        <td className="px-6 py-3 text-right flex gap-2 justify-end items-center">
                          <button 
                            onClick={() => handleTogglePaymentVerify(p.id, p.verified_status)}
                            className={`px-2.5 py-1 rounded text-[10px] font-black tracking-wide shadow-sm transition-all ${
                              p.verified_status === 1
                                ? "bg-[#26b048] text-white hover:bg-[#1d8b37]"
                                : "bg-[#ffbc36] text-white hover:bg-[#dca12a]"
                            }`}
                          >
                            {p.verified_status === 1 ? "Verified" : "Verify"}
                          </button>
                          <button 
                            onClick={() => { setEditPayment(p); setIsPaymentModalOpen(true); }}
                            className="text-[#3958b2] hover:text-[#2d468f] p-1.5 rounded hover:bg-[#3958b2]/10 transition-colors"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleDeletePayment(p.id)}
                            className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="px-6 py-10 text-center text-slate-400 italic">
                        No payments match criteria filters.
                      </td>
                    </tr>
                  )}
                </tbody>
                
                {!loadingPayments && paymentsList.length > 0 && (
                  <tfoot className="bg-slate-50 border-t border-[#cfdbe6] font-bold text-xs text-slate-800">
                    <tr className="border-b border-[#cfdbe6]">
                      <td colSpan={4} className="px-6 py-2.5 text-right font-extrabold">Total</td>
                      <td className="px-6 py-2.5 text-right font-black text-sky-600">AED {paymentsTotals.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td colSpan={5}></td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="px-6 py-2.5 text-right font-extrabold">Grand Total</td>
                      <td className="px-6 py-2.5 text-right font-black text-sky-600">AED {paymentsTotals.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td colSpan={5}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* ── TAB CONTENT: COLLECTED PAYMENTS (Option 15) ──────────────────── */}
        {activeTab === "collected-payments" && (
          <div className="bg-white border border-[#cfdbe6] rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-x-auto min-h-0">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#cfdbe6] bg-slate-50 font-black text-slate-600">
                    <th className="px-6 py-4 w-20">Sl. No.</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Paid By</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                    <th className="px-6 py-4">Collected By</th>
                    <th className="px-6 py-4">Split By</th>
                    <th className="px-6 py-4 text-center">Verified Status</th>
                    <th className="px-6 py-4 text-right w-32">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {loadingCollected ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center">
                        <RefreshCw className="h-5 w-5 animate-spin text-slate-400 mx-auto" />
                      </td>
                    </tr>
                  ) : collectedList.length > 0 ? (
                    collectedList.map((p, index) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-all">
                        <td className="px-6 py-3 font-bold text-slate-400">{index + 1}</td>
                        <td className="px-6 py-3">{p.payment_date} {p.payment_time}</td>
                        <td className="px-6 py-3 font-bold text-slate-800">{p.paid_by_user}</td>
                        <td className="px-6 py-3 text-right font-black text-[#26b048]">AED {p.amount.toFixed(2)}</td>
                        <td className="px-6 py-3">{p.collected_by || "—"}</td>
                        <td className="px-6 py-3 font-mono">{p.split_by || "—"}</td>
                        <td className="px-6 py-3 text-center">
                          <span className="bg-[#26b048]/10 text-[#26b048] px-3 py-1 rounded-full text-[10px] font-black">
                            Verified
                          </span>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <button 
                            onClick={() => handleTogglePaymentVerify(p.id, 1)}
                            className="text-[#3958b2] hover:text-[#2d468f] text-[10px] font-black underline"
                          >
                            Mark Pending
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-slate-400 italic">
                        No collected payments records found.
                      </td>
                    </tr>
                  )}
                </tbody>
                
                {!loadingCollected && collectedList.length > 0 && (
                  <tfoot className="bg-slate-50 border-t border-[#cfdbe6] font-bold text-xs text-slate-800">
                    <tr className="border-b border-[#cfdbe6]">
                      <td colSpan={3} className="px-6 py-2.5 text-right font-extrabold">Total</td>
                      <td className="px-6 py-2.5 text-right font-black text-sky-600">AED {collectedTotals.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td colSpan={4}></td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-6 py-2.5 text-right font-extrabold">Grand Total</td>
                      <td className="px-6 py-2.5 text-right font-black text-sky-600">AED {collectedTotals.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td colSpan={4}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* ── TAB CONTENT: AGENT LEADERBOARD ──────────────────────────────── */}
        {/* Rendered in previous section code */}

        {/* ── TAB CONTENT: PRICING SETTINGS ──────────────────────────────── */}
        {/* Rendered in previous section code */}

      </main>

      {/* ── POPUP MODAL: COMPANIES MASTER EDIT/NEW ───────────────────────── */}
      {/* Rendered in previous section code */}

      {/* ── POPUP MODAL: CAMPS MASTER EDIT/NEW ───────────────────────────── */}
      {/* Rendered in previous section code */}

      {/* ── POPUP MODAL: VALIDITY PROFILES EDIT/NEW ──────────────────────── */}
      {/* Rendered in previous section code */}

      {/* ── POPUP MODAL: CAMP VALIDITY PRICING EDIT/NEW ─────────────────── */}
      {/* Rendered in previous section code */}

      {/* ── POPUP MODAL: NOTIFICATIONS MASTER EDIT/NEW ───────────────────── */}
      {/* Rendered in previous section code */}

      {/* ── POPUP MODAL: PAYMENTS LOG EDIT/NEW ───────────────────────────── */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] animate-in fade-in duration-200">
          <div className="bg-white border border-[#cfdbe6] rounded-xl shadow-2xl p-6 w-[450px] flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
              <h4 className="font-black text-slate-800 text-sm uppercase tracking-wide">
                {editPayment?.id ? "Edit Payment Log" : "New Payment Log"}
              </h4>
              <button 
                onClick={() => { setIsPaymentModalOpen(false); setEditPayment(null); }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4 mb-6 text-xs font-bold text-slate-600">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Paid By User</label>
                <input 
                  type="text" 
                  value={editPayment?.paid_by_user || ""}
                  onChange={(e) => setEditPayment(prev => prev ? { ...prev, paid_by_user: e.target.value } : null)}
                  className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-bold outline-none text-slate-800"
                  placeholder="e.g. iqbaal"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Camp</label>
                <select 
                  value={editPayment?.camp_name || ""}
                  onChange={(e) => setEditPayment(prev => prev ? { ...prev, camp_name: e.target.value } : null)}
                  className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-bold outline-none text-slate-800 cursor-pointer"
                >
                  {campList.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  {campList.length === 0 && (
                    <option value="APM-DXB-camp-1">APM-DXB-camp-1</option>
                  )}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Paid For Year | Month</label>
                <input 
                  type="month" 
                  value={editPayment?.paid_for_year_month || ""}
                  onChange={(e) => setEditPayment(prev => prev ? { ...prev, paid_for_year_month: e.target.value } : null)}
                  className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-bold outline-none text-slate-800"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Amount (AED)</label>
                <input 
                  type="number" 
                  value={editPayment?.amount || 0}
                  onChange={(e) => setEditPayment(prev => prev ? { ...prev, amount: Number(e.target.value) } : null)}
                  className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-bold outline-none text-slate-800"
                  placeholder="e.g. 500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Collected By</label>
                  <input 
                    type="text" 
                    value={editPayment?.collected_by || ""}
                    onChange={(e) => setEditPayment(prev => prev ? { ...prev, collected_by: e.target.value } : null)}
                    className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Split By</label>
                  <input 
                    type="text" 
                    value={editPayment?.split_by || ""}
                    onChange={(e) => setEditPayment(prev => prev ? { ...prev, split_by: e.target.value } : null)}
                    className="w-full bg-[#f8fafc] border border-slate-300 focus:border-[#3958b2] focus:ring-1 focus:ring-[#3958b2]/50 px-3 py-2 rounded-lg text-sm font-semibold outline-none text-slate-800"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end text-xs font-bold">
              <button 
                onClick={() => { setIsPaymentModalOpen(false); setEditPayment(null); }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-250 border border-slate-300 text-slate-700 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleSavePayment}
                className="px-5 py-2 bg-[#3958b2] hover:bg-[#2d468f] text-white rounded-lg transition-all shadow-md"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

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
