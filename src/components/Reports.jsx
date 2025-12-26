import React, { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { getOrders, getOrderItems, getMenuItems, getExpenses, getIncome, createExpense, createIncome } from '../services/dataService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import {
  Activity, TrendingUp, TrendingDown, DollarSign, Calendar as CalendarIcon, FileText, Plus, Search, Filter, Download, ZoomIn, ZoomOut, RotateCw, CreditCard, Banknote, QrCode, ArrowUpRight, ArrowDownRight, PieChart as PieChartIcon, BarChart as BarChartIcon
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { cn } from '@/lib/utils';

const Reports = () => {
  const { toast } = useToast();
  const [activeReportTab, setActiveReportTab] = useState('dashboard');
  const [salesDateRange, setSalesDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  // Add state for top menus date filter
  const [topMenusDateFilter, setTopMenusDateFilter] = useState('today'); // today, thisWeek, thisMonth, custom
  const [customTopMenusDateRange, setCustomTopMenusDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [income, setIncome] = useState([]);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState('');
  const [receiptZoom, setReceiptZoom] = useState(1);
  const [receiptPan, setReceiptPan] = useState({ x: 0, y: 0 });
  const [isPanningReceipt, setIsPanningReceipt] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Sales period selection state
  const [salesPeriodMode, setSalesPeriodMode] = useState('day'); // day | week | month | year | custom
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().split('T')[0]);
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const oneJan = new Date(year, 0, 1);
    const days = Math.floor((d - oneJan) / 86400000) + oneJan.getDay();
    const week = Math.ceil((days + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
  });
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7)); // yyyy-mm
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Sync salesDateRange with period selection
  useEffect(() => {
    const toDateStr = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    if (salesPeriodMode === 'day') {
      const d = new Date(selectedDay);
      setSalesDateRange({ start: toDateStr(d), end: toDateStr(d) });
    } else if (salesPeriodMode === 'week') {
      // selectedWeek format: yyyy-Www
      const [yearStr, weekStr] = selectedWeek.split('-W');
      const year = parseInt(yearStr, 10);
      const week = parseInt(weekStr, 10);
      // Get Monday of the week
      const jan4 = new Date(year, 0, 4);
      const jan4Day = (jan4.getDay() || 7); // 1..7, Monday=1
      const monday = new Date(jan4);
      monday.setDate(jan4.getDate() - (jan4Day - 1) + (week - 1) * 7);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setSalesDateRange({ start: toDateStr(monday), end: toDateStr(sunday) });
    } else if (salesPeriodMode === 'month') {
      // selectedMonth format: yyyy-mm
      const [y, m] = selectedMonth.split('-').map(n => parseInt(n, 10));
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      setSalesDateRange({ start: toDateStr(start), end: toDateStr(end) });
    } else if (salesPeriodMode === 'year') {
      const y = parseInt(String(selectedYear), 10);
      const start = new Date(y, 0, 1);
      const end = new Date(y, 11, 31);
      setSalesDateRange({ start: toDateStr(start), end: toDateStr(end) });
    }
  }, [salesPeriodMode, selectedDay, selectedWeek, selectedMonth, selectedYear]);

  // State for income/expense forms
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [newIncome, setNewIncome] = useState({
    category: '',
    amount: '',
    note: ''
  });
  const [newExpense, setNewExpense] = useState({
    category: '',
    amount: '',
    note: ''
  });

  // Load data from Supabase
  useEffect(() => {
    const loadData = async () => {
      try {
        const [ordersData, menuItemsData, expensesData, incomeData] = await Promise.all([
          // load only latest 50 orders to speed up
          (await import('../services/dataService')).getOrdersPage({ limit: 50, offset: 0 }),
          getMenuItems(),
          getExpenses(),
          getIncome()
        ]);

        setOrders(ordersData);
        setMenuItems(menuItemsData);
        setExpenses(expensesData);
        setIncome(incomeData);

        // Load order items in parallel for the listed orders
        const itemsArrays = await Promise.all(
          ordersData.map((order) => getOrderItems(order.id))
        );
        setOrderItems(itemsArrays.flat());
        toast({ title: "สำเร็จ", description: 'โหลดข้อมูลรายงานเรียบร้อยแล้ว' });
      } catch (error) {
        console.error('Error loading report data:', error);
        toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถโหลดข้อมูลรายงานได้', variant: "destructive" });
      }
    };

    loadData();
  }, []);

  const formatCurrency = (amount) => {
    return `฿${Number(amount || 0).toFixed(2)}`;
  };

  const resetReceiptView = () => {
    setReceiptZoom(1);
    setReceiptPan({ x: 0, y: 0 });
  };
  const zoomReceiptIn = () => setReceiptZoom((z) => Math.min(5, +(z + 0.2).toFixed(2)));
  const zoomReceiptOut = () => setReceiptZoom((z) => Math.max(0.5, +(z - 0.2).toFixed(2)));

  const isImageUrl = (url) => {
    if (!url) return false;
    try {
      const u = new URL(url, window.location.href);
      const pathname = u.pathname.toLowerCase();
      return pathname.endsWith('.png') || pathname.endsWith('.jpg') || pathname.endsWith('.jpeg') || pathname.endsWith('.gif') || pathname.endsWith('.webp');
    } catch (_e) {
      const l = String(url).toLowerCase();
      return l.endsWith('.png') || l.endsWith('.jpg') || l.endsWith('.jpeg') || l.endsWith('.gif') || l.endsWith('.webp');
    }
  };

  const getPaymentMethodName = (method) => {
    const names = {
      pm_cash: 'เงินสด',
      pm_credit: 'บัตรเครดิต',
      pm_debit: 'บัตรเดบิต',
      pm_qr: 'QR Payment',
      cash: 'เงินสด',
      transfer: 'โอนเงิน',
      promptpay: 'พร้อมเพย์'
    };
    return names[method] || method || 'ไม่ระบุ';
  };

  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case 'pm_cash':
      case 'cash':
        return <Banknote className="w-4 h-4" />;
      case 'pm_credit':
      case 'pm_debit':
      case 'transfer':
        return <CreditCard className="w-4 h-4" />;
      case 'pm_qr':
      case 'promptpay':
        return <QrCode className="w-4 h-4" />;
      default:
        return <Banknote className="w-4 h-4" />;
    }
  };

  // Handle adding new income
  const handleAddIncome = async (e) => {
    e.preventDefault();
    if (newIncome.category && newIncome.amount) {
      try {
        const incomeData = {
          id: `inc_${Date.now()}`,
          category: newIncome.category,
          amount: parseFloat(newIncome.amount),
          note: newIncome.note || '',
          created_at: new Date().toISOString(),
          income_date: new Date().toISOString().split('T')[0]
        };

        const result = await createIncome(incomeData);

        if (!result.error) {
          setIncome([result.data, ...income]);
          setNewIncome({ category: '', amount: '', note: '' });
          setShowIncomeModal(false);
          toast({ title: "สำเร็จ", description: 'เพิ่มรายรับเรียบร้อยแล้ว' });
        } else {
          toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถเพิ่มรายรับได้', variant: "destructive" });
        }
      } catch (error) {
        console.error('Error adding income:', error);
        toast({ title: "เกิดข้อผิดพลาด", description: 'เกิดข้อผิดพลาดในการเพิ่มรายรับ', variant: "destructive" });
      }
    }
  };

  // Handle adding new expense
  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (newExpense.category && newExpense.amount) {
      try {
        const expenseData = {
          id: `exp_${Date.now()}`,
          category: newExpense.category,
          amount: parseFloat(newExpense.amount),
          note: newExpense.note || '',
          created_at: new Date().toISOString(),
          expense_date: new Date().toISOString().split('T')[0]
        };

        const result = await createExpense(expenseData);

        if (!result.error) {
          setExpenses([result.data, ...expenses]);
          setNewExpense({ category: '', amount: '', note: '' });
          setShowExpenseModal(false);
          toast({ title: "สำเร็จ", description: 'เพิ่มรายจ่ายเรียบร้อยแล้ว' });
        } else {
          toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถเพิ่มรายจ่ายได้', variant: "destructive" });
        }
      } catch (error) {
        console.error('Error adding expense:', error);
        toast({ title: "เกิดข้อผิดพลาด", description: 'เกิดข้อผิดพลาดในการเพิ่มรายจ่าย', variant: "destructive" });
      }
    }
  };

  // Calculate dashboard data with improved error handling
  const calculateDashboardData = () => {
    try {
      // Ensure we have valid data
      const validOrders = Array.isArray(orders) ? orders.filter(Boolean) : [];
      const validExpenses = Array.isArray(expenses) ? expenses.filter(Boolean) : [];
      const validIncome = Array.isArray(income) ? income.filter(Boolean) : [];
      const validOrderItems = Array.isArray(orderItems) ? orderItems.filter(Boolean) : [];

      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();

      const todayOrders = validOrders.filter(order =>
        order.status === 'paid' &&
        new Date(order.created_at).toDateString() === today
      );

      const yesterdayOrders = validOrders.filter(order =>
        order.status === 'paid' &&
        new Date(order.created_at).toDateString() === yesterday
      );

      const todaySales = todayOrders.reduce((sum, order) => sum + (Number(order.grand_total) || 0), 0);
      const yesterdaySales = yesterdayOrders.reduce((sum, order) => sum + (Number(order.grand_total) || 0), 0);

      const todayOrderCount = todayOrders.length;
      const yesterdayOrderCount = yesterdayOrders.length;

      const avgOrderValue = todayOrderCount > 0 ? todaySales / todayOrderCount : 0;
      const yesterdayAvgOrderValue = yesterdayOrderCount > 0 ? yesterdaySales / yesterdayOrderCount : 0;

      // Calculate net profit (simplified) - FOR SELECTED DATE RANGE
      const filteredExpenses = validExpenses.filter(exp => {
        const expDate = new Date(exp.created_at);
        const startDate = new Date(salesDateRange.start);
        const endDate = new Date(salesDateRange.end);
        endDate.setHours(23, 59, 59, 999);
        return expDate >= startDate && expDate <= endDate;
      });

      const filteredIncome = validIncome.filter(inc => {
        const incDate = new Date(inc.created_at);
        const startDate = new Date(salesDateRange.start);
        const endDate = new Date(salesDateRange.end);
        endDate.setHours(23, 59, 59, 999);
        return incDate >= startDate && incDate <= endDate;
      });

      const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
      const totalIncome = filteredIncome.reduce((sum, inc) => sum + (Number(inc.amount) || 0), 0);
      const netProfit = todaySales - totalExpenses + totalIncome;
      const profitMargin = todaySales > 0 ? (netProfit / todaySales) * 100 : 0;

      // Calculate actual top menus based on order items with date filtering
      const getMenuSalesStats = () => {
        try {
          // Create a map to store menu item statistics
          const menuStats = new Map();

          // Get relevant orders based on date filter
          let relevantOrders = [];

          if (topMenusDateFilter === 'today') {
            // Get today's paid orders only
            relevantOrders = validOrders.filter(order =>
              order.status === 'paid' &&
              new Date(order.created_at).toDateString() === today
            );
          } else if (topMenusDateFilter === 'thisWeek') {
            // Get this week's paid orders
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            relevantOrders = validOrders.filter(order => {
              const orderDate = new Date(order.created_at);
              return order.status === 'paid' && orderDate >= oneWeekAgo;
            });
          } else if (topMenusDateFilter === 'thisMonth') {
            // Get this month's paid orders
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            relevantOrders = validOrders.filter(order => {
              const orderDate = new Date(order.created_at);
              return order.status === 'paid' && orderDate >= startOfMonth;
            });
          } else if (topMenusDateFilter === 'custom') {
            // Get custom date range orders
            const startDate = new Date(customTopMenusDateRange.start);
            const endDate = new Date(customTopMenusDateRange.end);
            endDate.setHours(23, 59, 59, 999);

            relevantOrders = validOrders.filter(order => {
              const orderDate = new Date(order.created_at);
              return order.status === 'paid' && orderDate >= startDate && orderDate <= endDate;
            });
          }

          // Process each order item to calculate stats
          relevantOrders.forEach(order => {
            const items = validOrderItems.filter(item => item.order_id === order.id);
            items.forEach(item => {
              if (menuStats.has(item.item_id)) {
                // Update existing menu item stats
                const stats = menuStats.get(item.item_id);
                stats.qty += Number(item.qty) || 0;
                stats.revenue += Number(item.total_price) || 0;
              } else {
                // Add new menu item stats
                menuStats.set(item.item_id, {
                  id: item.item_id,
                  name: item.name || 'ไม่ระบุ',
                  qty: Number(item.qty) || 0,
                  revenue: Number(item.total_price) || 0
                });
              }
            });
          });

          // Convert map to array and sort by quantity (descending)
          const sortedMenus = Array.from(menuStats.values())
            .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue) // Sort by qty first, then by revenue
            .slice(0, 5); // Take top 5

          return sortedMenus;
        } catch (error) {
          console.error('Error calculating menu sales stats:', error);
          return [];
        }
      };

      const topMenus = getMenuSalesStats();

      // Payment methods with counts and amounts - ONLY FOR TODAY
      const paymentMethods = todayOrders.reduce((acc, order) => {
        const method = order.payment_method || 'ไม่ระบุ';
        if (!acc[method]) {
          acc[method] = { count: 0, amount: 0 };
        }
        acc[method].count += 1;
        acc[method].amount += Number(order.grand_total) || 0;
        return acc;
      }, {});

      const paymentMethodsArray = Object.entries(paymentMethods).map(([method, data]) => ({
        method,
        count: data.count,
        amount: data.amount
      }));

      return {
        todaySales,
        yesterdaySales,
        todayOrders: todayOrderCount,
        yesterdayOrders: yesterdayOrderCount,
        avgOrderValue,
        yesterdayAvgOrderValue,
        netProfit,
        profitMargin,
        topMenus,
        paymentMethods: paymentMethodsArray,
        // Add filtered data
        filteredExpenses,
        filteredIncome
      };
    } catch (error) {
      console.error('Error calculating dashboard data:', error);
      // Return safe defaults
      return {
        todaySales: 0,
        yesterdaySales: 0,
        todayOrders: 0,
        yesterdayOrders: 0,
        avgOrderValue: 0,
        yesterdayAvgOrderValue: 0,
        netProfit: 0,
        profitMargin: 0,
        topMenus: [],
        paymentMethods: [],
        todayExpenses: [],
        todayIncome: []
      };
    }
  };

  const dashboardData = calculateDashboardData();
  // Ensure dashboardData has default values if calculation fails
  const safeDashboardData = {
    todaySales: dashboardData?.todaySales || 0,
    yesterdaySales: dashboardData?.yesterdaySales || 0,
    todayOrders: dashboardData?.todayOrders || 0,
    yesterdayOrders: dashboardData?.yesterdayOrders || 0,
    avgOrderValue: dashboardData?.avgOrderValue || 0,
    yesterdayAvgOrderValue: dashboardData?.yesterdayAvgOrderValue || 0,
    netProfit: dashboardData?.netProfit || 0,
    profitMargin: dashboardData?.profitMargin || 0,
    topMenus: Array.isArray(dashboardData?.topMenus) ? dashboardData.topMenus : [],
    paymentMethods: Array.isArray(dashboardData?.paymentMethods) ? dashboardData.paymentMethods : [],
    filteredExpenses: Array.isArray(dashboardData?.filteredExpenses) ? dashboardData.filteredExpenses : [],
    filteredIncome: Array.isArray(dashboardData?.filteredIncome) ? dashboardData.filteredIncome : []
  };

  // Periodic sales summaries: day, week, month, year
  const getSalesForPeriod = (period) => {
    const now = new Date();
    let startDate;
    if (period === 'day') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'week') {
      const d = new Date(now);
      const day = d.getDay(); // 0 (Sun) - 6 (Sat)
      const diffToMonday = (day === 0 ? 6 : day - 1); // make Monday start
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - diffToMonday);
      startDate = d;
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else {
      startDate = new Date(0);
    }
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const filtered = (orders || []).filter(o => {
      if (o?.status !== 'paid') return false;
      const dt = new Date(o.created_at);
      return dt >= startDate && dt <= endDate;
    });
    const total = filtered.reduce((s, o) => s + Number(o.grand_total || 0), 0);
    const count = filtered.length;
    return { total, count };
  };
  const salesDay = getSalesForPeriod('day');
  const salesWeek = getSalesForPeriod('week');
  const salesMonth = getSalesForPeriod('month');
  const salesYear = getSalesForPeriod('year');

  // -------- Dashboard selectable period summary --------
  const [dashboardPeriodMode, setDashboardPeriodMode] = useState('day'); // day | week | month | year | custom
  const [dashboardSelectedDay, setDashboardSelectedDay] = useState(new Date().toISOString().split('T')[0]);
  const [dashboardSelectedWeek, setDashboardSelectedWeek] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const oneJan = new Date(year, 0, 1);
    const days = Math.floor((d - oneJan) / 86400000) + oneJan.getDay();
    const week = Math.ceil((days + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
  });
  const [dashboardSelectedMonth, setDashboardSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [dashboardSelectedYear, setDashboardSelectedYear] = useState(new Date().getFullYear());
  const [dashboardCustomRange, setDashboardCustomRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const getDateRangeForDashboard = () => {
    const toDateOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (dashboardPeriodMode === 'day') {
      const d = new Date(dashboardSelectedDay);
      const start = toDateOnly(d);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    } else if (dashboardPeriodMode === 'week') {
      const [yStr, wStr] = dashboardSelectedWeek.split('-W');
      const y = parseInt(yStr, 10);
      const w = parseInt(wStr, 10);
      const jan4 = new Date(y, 0, 4);
      const jan4Day = (jan4.getDay() || 7);
      const monday = new Date(jan4);
      monday.setDate(jan4.getDate() - (jan4Day - 1) + (w - 1) * 7);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      return { start: toDateOnly(monday), end: sunday };
    } else if (dashboardPeriodMode === 'month') {
      const [y, m] = dashboardSelectedMonth.split('-').map(n => parseInt(n, 10));
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    } else if (dashboardPeriodMode === 'year') {
      const y = parseInt(String(dashboardSelectedYear), 10);
      const start = new Date(y, 0, 1);
      const end = new Date(y, 11, 31, 23, 59, 59, 999);
      return { start, end };
    } else {
      const start = new Date(dashboardCustomRange.start);
      const end = new Date(dashboardCustomRange.end);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
  };

  const computeDashboardPeriodMetrics = () => {
    const { start, end } = getDateRangeForDashboard();
    const periodOrders = (orders || []).filter(o => o?.status === 'paid' && new Date(o.created_at) >= start && new Date(o.created_at) <= end);
    const periodSales = periodOrders.reduce((s, o) => s + Number(o.grand_total || 0), 0);
    const periodOrderCount = periodOrders.length;
    const periodAvg = periodOrderCount > 0 ? periodSales / periodOrderCount : 0;
    const periodExpenses = (expenses || []).filter(e => new Date(e.created_at) >= start && new Date(e.created_at) <= end).reduce((s, e) => s + Number(e.amount || 0), 0);
    const periodIncome = (income || []).filter(i => new Date(i.created_at) >= start && new Date(i.created_at) <= end).reduce((s, i) => s + Number(i.amount || 0), 0);
    const periodNetProfit = periodSales - periodExpenses + periodIncome;
    return { periodSales, periodOrderCount, periodAvg, periodNetProfit };
  };
  const periodMetrics = computeDashboardPeriodMetrics();
  // Ensure periodMetrics has default values
  const safePeriodMetrics = {
    periodSales: periodMetrics?.periodSales || 0,
    periodOrderCount: periodMetrics?.periodOrderCount || 0,
    periodAvg: periodMetrics?.periodAvg || 0,
    periodNetProfit: periodMetrics?.periodNetProfit || 0
  };

  // -------- Simple Charts (no external libs) ---------
  // Build 7-day sales data
  const buildLast7DaysSales = () => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ key, label: d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' }), total: 0 });
    }
    const map = Object.fromEntries(days.map(d => [d.key, d]));
    (orders || []).forEach(o => {
      if (o?.status !== 'paid') return;
      const k = new Date(o.created_at).toISOString().slice(0, 10);
      if (map[k]) map[k].total += Number(o.grand_total || 0);
    });
    return days;
  };
  const last7 = buildLast7DaysSales();

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  const SalesBarChart = ({ data }) => {
    // Transform data for Recharts if needed, but data format {name, total} fits well
    // data structure expected: { label: string, total: number }
    return (
      <div className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `฿${value}`}
            />
            <RechartsTooltip
              cursor={{ fill: 'transparent' }}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-popover border text-popover-foreground shadow-md rounded-lg p-2 text-sm">
                      <p className="font-semibold">{label}</p>
                      <p className="text-primary">
                        ยอดขาย: {formatCurrency(payload[0].value)}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const PaymentPieChart = ({ data }) => {
    const chartData = data.map(d => ({
      name: getPaymentMethodName(d.method),
      value: d.amount
    })).filter(d => d.value > 0);

    if (chartData.length === 0) {
      return (
        <div className="flex h-[300px] items-center justify-center text-muted-foreground">
          ไม่มีข้อมูลการชำระเงิน
        </div>
      );
    }

    return (
      <div className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <RechartsTooltip formatter={(value) => formatCurrency(value)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const salesGrowth = safeDashboardData.yesterdaySales > 0
    ? ((safeDashboardData.todaySales - safeDashboardData.yesterdaySales) / safeDashboardData.yesterdaySales * 100)
    : 0;

  const ordersGrowth = safeDashboardData.yesterdayOrders > 0
    ? ((safeDashboardData.todayOrders - safeDashboardData.yesterdayOrders) / safeDashboardData.yesterdayOrders * 100)
    : 0;

  const avgGrowth = safeDashboardData.yesterdayAvgOrderValue > 0
    ? ((safeDashboardData.avgOrderValue - safeDashboardData.yesterdayAvgOrderValue) / safeDashboardData.yesterdayAvgOrderValue * 100)
    : 0;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">รายงาน</h1>
          <p className="text-muted-foreground">สรุปยอดขาย การเงิน และสถิติต่างๆ</p>
        </div>
      </div>

      <Tabs value={activeReportTab} onValueChange={setActiveReportTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2"><Activity className="w-4 h-4" /> แดชบอร์ด</TabsTrigger>
          <TabsTrigger value="sales" className="gap-2"><TrendingUp className="w-4 h-4" /> รายงานขาย</TabsTrigger>
          <TabsTrigger value="finance" className="gap-2"><DollarSign className="w-4 h-4" /> รายรับ-รายจ่าย</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <h2 className="text-lg font-semibold">ภาพรวมธุรกิจ</h2>
            <div className="flex flex-wrap gap-2 items-center bg-muted/50 p-1 rounded-lg">
              <Select value={dashboardPeriodMode} onValueChange={setDashboardPeriodMode}>
                <SelectTrigger className="w-[120px] h-8 bg-background border-none shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">รายวัน</SelectItem>
                  <SelectItem value="week">รายสัปดาห์</SelectItem>
                  <SelectItem value="month">รายเดือน</SelectItem>
                  <SelectItem value="year">รายปี</SelectItem>
                  <SelectItem value="custom">กำหนดเอง</SelectItem>
                </SelectContent>
              </Select>

              {dashboardPeriodMode === 'day' && (
                <Input type="date" value={dashboardSelectedDay} onChange={(e) => setDashboardSelectedDay(e.target.value)} className="w-[150px] h-8 bg-background" />
              )}
              {/* Other date inputs simplified for brevity, using generic Input */}
              {dashboardPeriodMode === 'custom' && (
                <div className="flex items-center gap-2">
                  <Input type="date" value={dashboardCustomRange.start} onChange={(e) => setDashboardCustomRange({ ...dashboardCustomRange, start: e.target.value })} className="w-[140px] h-8 bg-background" />
                  <span>-</span>
                  <Input type="date" value={dashboardCustomRange.end} onChange={(e) => setDashboardCustomRange({ ...dashboardCustomRange, end: e.target.value })} className="w-[140px] h-8 bg-background" />
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ยอดขายรวม</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(safePeriodMetrics.periodSales)}</div>
                <p className="text-xs text-muted-foreground">ในช่วงเวลาที่เลือก</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">จำนวนออเดอร์</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{safePeriodMetrics.periodOrderCount}</div>
                <p className="text-xs text-muted-foreground">รายการ</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">เฉลี่ยต่อออเดอร์</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(safePeriodMetrics.periodAvg)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">กำไรสุทธิ</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(safePeriodMetrics.periodNetProfit)}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>แนวโน้มยอดขาย (7 วันล่าสุด)</CardTitle>
              </CardHeader>
              <CardContent className="pl-2">
                <SalesBarChart data={last7} />
              </CardContent>
            </Card>
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>สินค้าขายดี</CardTitle>
                <CardDescription>
                  5 อันดับสินค้าขายดีในช่วงเวลาที่เลือก
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {safeDashboardData.topMenus.map((menu, i) => {
                    const fullMenuItem = menuItems.find(item => item.id === menu.id);
                    return (
                      <div key={menu.id} className="flex items-center">
                        <Badge variant="secondary" className="mr-3 w-6 h-6 flex items-center justify-center rounded-full p-0">
                          {i + 1}
                        </Badge>
                        <div className="ml-2 space-y-1 flex-1">
                          <p className="text-sm font-medium leading-none">{menu.name}</p>
                          <p className="text-xs text-muted-foreground">{menu.qty} รายการ</p>
                        </div>
                        <div className="font-bold">{formatCurrency(menu.revenue)}</div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
            <Card className="col-span-4 lg:col-span-3">
              <CardHeader>
                <CardTitle>สัดส่วนวิธีการชำระเงิน (วันนี้)</CardTitle>
              </CardHeader>
              <CardContent>
                <PaymentPieChart data={safeDashboardData.paymentMethods} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sales Tab */}
        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <CardTitle>รายการขาย {salesPeriodMode === 'day' ? '(รายวัน)' : ''}</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={salesPeriodMode} onValueChange={setSalesPeriodMode}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">รายวัน</SelectItem>
                      <SelectItem value="week">รายสัปดาห์</SelectItem>
                      <SelectItem value="month">รายเดือน</SelectItem>
                      <SelectItem value="custom">กำหนดเอง</SelectItem>
                    </SelectContent>
                  </Select>
                  {salesPeriodMode === 'day' && (
                    <Input type="date" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} className="w-[150px]" />
                  )}
                  {/* ... other modes inputs (keep simple for now) ... */}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ออเดอร์ #</TableHead>
                    <TableHead>วันที่</TableHead>
                    <TableHead>รายการ</TableHead>
                    <TableHead>วิธีชำระเงิน</TableHead>
                    <TableHead className="text-right">ยอดรวม</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.filter(order => {
                    const orderDate = new Date(order.created_at);
                    const startDate = new Date(salesDateRange.start);
                    const endDate = new Date(salesDateRange.end);
                    endDate.setHours(23, 59, 59, 999);
                    return orderDate >= startDate && orderDate <= endDate;
                  }).map((order) => {
                    const items = orderItems.filter(item => item.order_id === order.id);
                    return (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">#{order.order_no}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(order.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {items.slice(0, 2).map((item, i) => (
                              <span key={i} className="text-sm">{item.name} x{item.qty}</span>
                            ))}
                            {items.length > 2 && <span className="text-xs text-muted-foreground">+{items.length - 2} รายการ</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getPaymentMethodIcon(order.payment_method)}
                            <span className="text-sm">{getPaymentMethodName(order.payment_method)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(order.grand_total)}</TableCell>
                        <TableCell>
                          {order.receipt_url && (
                            <Button variant="ghost" size="sm" onClick={() => { setReceiptPreviewUrl(order.receipt_url); setShowReceiptPreview(true); }}>
                              <FileText className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Finance Tab */}
        <TabsContent value="finance" className="space-y-4">
          <div className="flex justify-between items-center bg-muted/20 p-4 rounded-lg border">
            <h2 className="text-xl font-bold">งบกำไรขาดทุน</h2>
            <div className="flex gap-2">
              <Dialog open={showIncomeModal} onOpenChange={setShowIncomeModal}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50">
                    <Plus className="w-4 h-4" /> เพิ่มรายรับ
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>บันทึกรายรับ</DialogTitle>
                    <DialogDescription>บันทึกรายได้อื่นๆ นอกเหนือจากการขาย</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddIncome} className="space-y-4 mt-2">
                    <div className="grid gap-2">
                      <Label>หมวดหมู่</Label>
                      <Input value={newIncome.category} onChange={(e) => setNewIncome({ ...newIncome, category: e.target.value })} placeholder="เช่น ค่าบริการ, ทิป" required />
                    </div>
                    <div className="grid gap-2">
                      <Label>จำนวนเงิน</Label>
                      <Input type="number" value={newIncome.amount} onChange={(e) => setNewIncome({ ...newIncome, amount: e.target.value })} placeholder="0.00" required />
                    </div>
                    <div className="grid gap-2">
                      <Label>หมายเหตุ</Label>
                      <Input value={newIncome.note} onChange={(e) => setNewIncome({ ...newIncome, note: e.target.value })} placeholder="รายละเอียดเพิ่มเติม" />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setShowIncomeModal(false)}>ยกเลิก</Button>
                      <Button type="submit">บันทึก</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={showExpenseModal} onOpenChange={setShowExpenseModal}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2 border-rose-500 text-rose-600 hover:bg-rose-50">
                    <Plus className="w-4 h-4" /> เพิ่มรายจ่าย
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>บันทึกรายจ่าย</DialogTitle>
                    <DialogDescription>บันทึกค่าใช้จ่ายต่างๆ ของร้าน</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddExpense} className="space-y-4 mt-2">
                    <div className="grid gap-2">
                      <Label>หมวดหมู่</Label>
                      <Input value={newExpense.category} onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })} placeholder="เช่น ค่าวัตถุดิบ, ค่าแรง" required />
                    </div>
                    <div className="grid gap-2">
                      <Label>จำนวนเงิน</Label>
                      <Input type="number" value={newExpense.amount} onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })} placeholder="0.00" required />
                    </div>
                    <div className="grid gap-2">
                      <Label>หมายเหตุ</Label>
                      <Input value={newExpense.note} onChange={(e) => setNewExpense({ ...newExpense, note: e.target.value })} placeholder="รายละเอียดเพิ่มเติม" />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setShowExpenseModal(false)}>ยกเลิก</Button>
                      <Button type="submit" variant="destructive">บันทึก</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-emerald-600 flex items-center gap-2">
                  <ArrowUpRight className="w-5 h-5" /> รายรับอื่นๆ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {income.slice(0, 5).map((inc, i) => (
                    <div key={i} className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0">
                      <div>
                        <p className="font-medium">{inc.category}</p>
                        <p className="text-xs text-muted-foreground">{new Date(inc.created_at).toLocaleDateString('th-TH')}</p>
                      </div>
                      <span className="font-bold text-emerald-600">+{formatCurrency(inc.amount)}</span>
                    </div>
                  ))}
                  {income.length === 0 && <p className="text-center text-muted-foreground py-4">ไม่มีรายการ</p>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base text-rose-600 flex items-center gap-2">
                  <ArrowDownRight className="w-5 h-5" /> รายจ่ายล่าสุด
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {expenses.slice(0, 5).map((exp, i) => (
                    <div key={i} className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0">
                      <div>
                        <p className="font-medium">{exp.category}</p>
                        <p className="text-xs text-muted-foreground">{new Date(exp.created_at).toLocaleDateString('th-TH')}</p>
                      </div>
                      <span className="font-bold text-rose-600">-{formatCurrency(exp.amount)}</span>
                    </div>
                  ))}
                  {expenses.length === 0 && <p className="text-center text-muted-foreground py-4">ไม่มีรายการ</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Receipt View Dialog */}
      <Dialog open={showReceiptPreview} onOpenChange={setShowReceiptPreview}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col p-4">
          <DialogHeader>
            <DialogTitle>สลิปการชำระเงิน</DialogTitle>
          </DialogHeader>
          <div className="flex-1 bg-muted/20 rounded-md border border-dashed flex items-center justify-center p-4 relative overflow-auto">
            <div className="relative" style={{
              transform: `scale(${receiptZoom}) translate(${receiptPan.x}px, ${receiptPan.y}px)`,
              transition: isPanningReceipt ? 'none' : 'transform 0.1s'
            }}>
              <img src={receiptPreviewUrl} alt="Receipt" className="max-w-full max-h-full object-contain shadow-lg" />
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between items-center pt-4">
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={zoomReceiptOut}><ZoomOut className="w-4 h-4" /></Button>
              <Button variant="outline" size="icon" onClick={resetReceiptView}><RotateCw className="w-4 h-4" /></Button>
              <Button variant="outline" size="icon" onClick={zoomReceiptIn}><ZoomIn className="w-4 h-4" /></Button>
            </div>
            <Button variant="default" onClick={() => setShowReceiptPreview(false)}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reports;