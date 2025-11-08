import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getOrders, getOrderItems, getMenuItems, getExpenses, getIncome, createExpense, createIncome } from '../services/dataService';

const Reports = () => {
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
    const toDateStr = (d) => new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().split('T')[0];
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
        toast.success('โหลดข้อมูลรายงานเรียบร้อยแล้ว');
      } catch (error) {
        console.error('Error loading report data:', error);
        toast.error('ไม่สามารถโหลดข้อมูลรายงานได้');
      }
    };

    loadData();
  }, []);

  const formatCurrency = (amount) => {
    return `฿${amount.toFixed(2)}`;
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
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path>
          </svg>
        );
      case 'pm_credit':
      case 'pm_debit':
      case 'transfer':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
          </svg>
        );
      case 'pm_qr':
      case 'promptpay':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path>
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        );
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
          toast.success('เพิ่มรายรับเรียบร้อยแล้ว');
        } else {
          toast.error('ไม่สามารถเพิ่มรายรับได้');
        }
      } catch (error) {
        console.error('Error adding income:', error);
        toast.error('เกิดข้อผิดพลาดในการเพิ่มรายรับ');
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
          toast.success('เพิ่มรายจ่ายเรียบร้อยแล้ว');
        } else {
          toast.error('ไม่สามารถเพิ่มรายจ่ายได้');
        }
      } catch (error) {
        console.error('Error adding expense:', error);
        toast.error('เกิดข้อผิดพลาดในการเพิ่มรายจ่าย');
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
  
  // --------- Simple Charts (no external libs) ---------
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

  const SalesBarChart = ({ data, height = 180, barColor = '#2563EB' }) => {
    const width = 560;
    const pad = 28;
    const w = width - pad * 2;
    const h = height - pad * 2 - 16; // space for x labels
    const maxV = Math.max(1, ...data.map(d => d.total));
    const gap = 8;
    const barW = Math.max(10, (w - gap * (data.length - 1)) / data.length);
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <rect x="0" y="0" width={width} height={height} fill="#ffffff" rx="12" />
        {/* baseline */}
        <line x1={pad} y1={pad + h} x2={pad + w} y2={pad + h} stroke="#E5E7EB" />
        {data.map((d, i) => {
          const x = pad + i * (barW + gap);
          const barH = (d.total / maxV) * h;
          const y = pad + (h - barH);
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} rx="6" fill={barColor} opacity="0.85" />
              {/* value label */}
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="11" fill="#111827" fontWeight="700">
                {`฿${d.total.toFixed(0)}`}
              </text>
              {/* x label */}
              <text x={x + barW / 2} y={pad + h + 14} textAnchor="middle" fontSize="10" fill="#6B7280">{d.label}</text>
            </g>
          );
        })}
      </svg>
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
    <div id="reportSection" className="p-4 md:p-6">
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-800">รายงานยอดขาย</h2>
        </div>
        
        {/* Report Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto pb-2">
          <button 
            onClick={() => {
              setActiveReportTab('dashboard');
              toast.info('กำลังโหลดข้อมูลแดชบอร์ด...');
            }}
            className={`report-tab px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 whitespace-nowrap ${
              activeReportTab === 'dashboard' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            แดชบอร์ด
          </button>
          <button 
            onClick={() => {
              setActiveReportTab('sales');
              toast.info('กำลังโหลดรายงานขาย...');
            }}
            className={`report-tab px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 whitespace-nowrap ${
              activeReportTab === 'sales' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            รายงานขาย
          </button>
          <button 
            onClick={() => {
              setActiveReportTab('finance');
              toast.info('กำลังโหลดข้อมูลรายรับ-รายจ่าย...');
            }}
            className={`report-tab px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 whitespace-nowrap ${
              activeReportTab === 'finance' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            รายรับ-รายจ่าย
          </button>
          
        </div>

        {/* Dashboard Report */}
        {activeReportTab === 'dashboard' && (
          <div className="report-content flex-1 overflow-y-auto">

            {/* Dashboard Period Selector and Summary Cards */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={dashboardPeriodMode}
                  onChange={(e) => setDashboardPeriodMode(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="day">วัน</option>
                  <option value="week">สัปดาห์</option>
                  <option value="month">เดือน</option>
                  <option value="year">ปี</option>
                  <option value="custom">กำหนดเอง</option>
                </select>
                {dashboardPeriodMode === 'day' && (
                  <input
                    type="date"
                    value={dashboardSelectedDay}
                    onChange={(e) => setDashboardSelectedDay(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                )}
                {dashboardPeriodMode === 'week' && (
                  <input
                    type="week"
                    value={dashboardSelectedWeek}
                    onChange={(e) => setDashboardSelectedWeek(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                )}
                {dashboardPeriodMode === 'month' && (
                  <input
                    type="month"
                    value={dashboardSelectedMonth}
                    onChange={(e) => setDashboardSelectedMonth(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                )}
                {dashboardPeriodMode === 'year' && (
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={dashboardSelectedYear}
                    onChange={(e) => setDashboardSelectedYear(e.target.value)}
                    className="w-28 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                )}
                {dashboardPeriodMode === 'custom' && (
                  <>
                    <input
                      type="date"
                      value={dashboardCustomRange.start}
                      onChange={(e) => setDashboardCustomRange({ ...dashboardCustomRange, start: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <span className="flex items-center text-gray-500">ถึง</span>
                    <input
                      type="date"
                      value={dashboardCustomRange.end}
                      onChange={(e) => setDashboardCustomRange({ ...dashboardCustomRange, end: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5 shadow-sm">
                <p className="text-sm text-blue-700 font-medium mb-1">ยอดขายรวม (ช่วงที่เลือก)</p>
                <h3 className="text-2xl font-bold text-blue-900">{formatCurrency(safePeriodMetrics.periodSales)}</h3>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-5 shadow-sm">
                <p className="text-sm text-emerald-700 font-medium mb-1">จำนวนออเดอร์</p>
                <h3 className="text-2xl font-bold text-emerald-900">{safePeriodMetrics.periodOrderCount}</h3>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-5 shadow-sm">
                <p className="text-sm text-amber-700 font-medium mb-1">ค่าเฉลี่ยต่อออเดอร์</p>
                <h3 className="text-2xl font-bold text-amber-900">{formatCurrency(safePeriodMetrics.periodAvg)}</h3>
              </div>
              <div className="bg-gradient-to-br from-fuchsia-50 to-fuchsia-100 border border-fuchsia-200 rounded-xl p-5 shadow-sm">
                <p className="text-sm text-fuchsia-700 font-medium mb-1">กำไรสุทธิ</p>
                <h3 className="text-2xl font-bold text-fuchsia-900">{formatCurrency(safePeriodMetrics.periodNetProfit)}</h3>
              </div>
            </div>

            {/* Sales Trend Chart */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-gray-800">แนวโน้มยอดขาย 7 วัน</h4>
                <div className="text-sm text-gray-500">รวม: {formatCurrency(last7.reduce((s,d)=>s+d.total,0))}</div>
              </div>
              <SalesBarChart data={last7} />
            </div>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-blue-600 font-medium mb-1">ยอดขายวันนี้</p>
                    <h3 className="text-2xl font-bold text-gray-800">{formatCurrency(safeDashboardData.todaySales)}</h3>
                  </div>
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                  </div>
                </div>
                <div className={`flex items-center mt-3 text-sm ${salesGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <svg className={`w-4 h-4 mr-1 ${salesGrowth >= 0 ? 'rotate-0' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path>
                  </svg>
                  {Math.abs(salesGrowth).toFixed(1)}% จากเมื่อวาน
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-green-600 font-medium mb-1">ออเดอร์วันนี้</p>
                    <h3 className="text-2xl font-bold text-gray-800">{safeDashboardData.todayOrders}</h3>
                  </div>
                  <div className="p-2 bg-green-100 rounded-lg">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
                    </svg>
                  </div>
                </div>
                <div className={`flex items-center mt-3 text-sm ${ordersGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <svg className={`w-4 h-4 mr-1 ${ordersGrowth >= 0 ? 'rotate-0' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path>
                  </svg>
                  {Math.abs(ordersGrowth).toFixed(1)}% จากเมื่อวาน
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-amber-600 font-medium mb-1">เฉลี่ยต่อออเดอร์</p>
                    <h3 className="text-2xl font-bold text-gray-800">{formatCurrency(safeDashboardData.avgOrderValue)}</h3>
                  </div>
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                    </svg>
                  </div>
                </div>
                <div className={`flex items-center mt-3 text-sm ${avgGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <svg className={`w-4 h-4 mr-1 ${avgGrowth >= 0 ? 'rotate-0' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path>
                  </svg>
                  {Math.abs(avgGrowth).toFixed(1)}% จากเมื่อวาน
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-100 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-purple-600 font-medium mb-1">กำไรสุทธิ</p>
                    <h3 className="text-2xl font-bold text-gray-800">{formatCurrency(safeDashboardData.netProfit)}</h3>
                  </div>
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z"></path>
                    </svg>
                  </div>
                </div>
                <div className="flex items-center mt-3 text-sm text-gray-600">
                  Margin: {safeDashboardData.profitMargin.toFixed(1)}%
                </div>
              </div>
            </div>
            
            {/* Charts and Additional Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Selling Menus */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <h4 className="font-bold text-gray-800">เมนูขายดีอันดับต้น ๆ</h4>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={topMenusDateFilter}
                      onChange={(e) => setTopMenusDateFilter(e.target.value)}
                      className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="today">วันนี้</option>
                      <option value="thisWeek">สัปดาห์นี้</option>
                      <option value="thisMonth">เดือนนี้</option>
                      <option value="custom">กำหนดเอง</option>
                    </select>
                    
                    {topMenusDateFilter === 'custom' && (
                      <div className="flex gap-1">
                        <input 
                          type="date" 
                          value={customTopMenusDateRange.start}
                          onChange={(e) => setCustomTopMenusDateRange({...customTopMenusDateRange, start: e.target.value})}
                          className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <span className="flex items-center text-gray-500 text-sm">ถึง</span>
                        <input 
                          type="date" 
                          value={customTopMenusDateRange.end}
                          onChange={(e) => setCustomTopMenusDateRange({...customTopMenusDateRange, end: e.target.value})}
                          className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  {safeDashboardData.topMenus.length > 0 ? (
                    safeDashboardData.topMenus.map((menu, index) => {
                      // Find the full menu item data to get the image
                      const fullMenuItem = menuItems.find(item => item.id === menu.id);
                      
                      return (
                        <div key={menu.id} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <span className="w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-700 text-xs font-bold rounded-full mr-3">
                              {index + 1}
                            </span>
                            {fullMenuItem?.image_url ? (
                              <img 
                                src={fullMenuItem.image_url} 
                                alt={fullMenuItem.name}
                                className="w-8 h-8 object-cover rounded-lg mr-2"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-gray-100 rounded-lg mr-2 flex items-center justify-center">
                                <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                              </div>
                            )}
                            <span className="font-medium text-gray-800">{menu.name}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-800">{formatCurrency(menu.revenue)}</p>
                            <p className="text-xs text-gray-500">{menu.qty} รายการ</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      ยังไม่มีข้อมูลเมนูขายดี
                    </div>
                  )}
                </div>
              </div>
              
              {/* Payment Methods */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <h4 className="font-bold text-gray-800 mb-4">วิธีการชำระเงิน</h4>
                <div className="space-y-4">
                  {safeDashboardData.paymentMethods.length > 0 ? (
                    safeDashboardData.paymentMethods.map((payment, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <span className="mr-3 text-gray-500">
                            {getPaymentMethodIcon(payment.method)}
                          </span>
                          <span className="font-medium text-gray-800">
                            {getPaymentMethodName(payment.method)}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-800">{formatCurrency(payment.amount)}</p>
                          <p className="text-xs text-gray-500">{payment.count} รายการ</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      ยังไม่มีข้อมูลการชำระเงิน
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sales Report Tab */}
        {activeReportTab === 'sales' && (
          <div className="report-content flex-1 overflow-y-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h3 className="text-xl font-bold text-gray-800">รายงานยอดขาย</h3>
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={salesPeriodMode}
                  onChange={(e) => setSalesPeriodMode(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="day">เลือกวัน</option>
                  <option value="week">เลือกสัปดาห์</option>
                  <option value="month">เลือกเดือน</option>
                  <option value="year">เลือกปี</option>
                  <option value="custom">กำหนดเอง</option>
                </select>

                {salesPeriodMode === 'day' && (
                  <input
                    type="date"
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                )}

                {salesPeriodMode === 'week' && (
                  <input
                    type="week"
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                )}

                {salesPeriodMode === 'month' && (
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                )}

                {salesPeriodMode === 'year' && (
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-28 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                )}

                {salesPeriodMode === 'custom' && (
                  <>
                    <input 
                      type="date" 
                      value={salesDateRange.start}
                      onChange={(e) => setSalesDateRange({...salesDateRange, start: e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <span className="flex items-center text-gray-500">ถึง</span>
                    <input 
                      type="date" 
                      value={salesDateRange.end}
                      onChange={(e) => setSalesDateRange({...salesDateRange, end: e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </>
                )}
              </div>
            </div>
            
            {/* Filtered Orders Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ออเดอร์ #</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">วันที่</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">รายการ</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">วิธีชำระเงิน</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ยอดรวม</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สลิป</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders
                    .filter(order => {
                      const orderDate = new Date(order.created_at);
                      const startDate = new Date(salesDateRange.start);
                      const endDate = new Date(salesDateRange.end);
                      endDate.setHours(23, 59, 59, 999);
                      return orderDate >= startDate && orderDate <= endDate;
                    })
                    .map(order => {
                      const orderItemsForOrder = orderItems.filter(item => item.order_id === order.id);
                      return (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm font-medium text-gray-900">#{order.order_no}</td>
                          <td className="py-3 px-4 text-sm text-gray-500">
                            {new Date(order.created_at).toLocaleDateString('th-TH', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500">
                            <div className="flex flex-col">
                              {orderItemsForOrder.slice(0, 2).map(item => (
                                <span key={item.id}>{item.name} x{item.qty}</span>
                              ))}
                              {orderItemsForOrder.length > 2 && (
                                <span className="text-xs text-gray-400">+{orderItemsForOrder.length - 2} รายการอื่น</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm">
                            <div className="flex items-center">
                              <span className="mr-2 text-gray-500">
                                {getPaymentMethodIcon(order.payment_method)}
                              </span>
                              <span className="font-medium">
                                {getPaymentMethodName(order.payment_method)}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm font-bold text-gray-900">{formatCurrency(order.grand_total)}</td>
                          <td className="py-3 px-4 text-sm">
                            {order.receipt_url ? (
                              <button
                                type="button"
                                onClick={() => { setReceiptPreviewUrl(order.receipt_url); setShowReceiptPreview(true); }}
                                className="inline-flex items-center text-indigo-600 hover:text-indigo-800"
                              >
                                ดูสลิป
                                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-4.553a1 1 0 00-1.414-1.414L13.5 8.672M19 10h-4a1 1 0 00-1 1v8a1 1 0 001 1h4a1 1 0 001-1v-8a1 1 0 00-1-1z"/></svg>
                              </button>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Finance Report */}
        {activeReportTab === 'finance' && (
          <div className="report-content flex-1 overflow-y-auto">
            <div className="mb-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="text-lg font-bold text-gray-800">งบกำไรขาดทุน</h3>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => setShowIncomeModal(true)}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-4 py-2.5 rounded-lg font-bold transition-all duration-200 shadow hover:shadow-md flex items-center"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                    เพิ่มรายรับ
                  </button>
                  <button 
                    onClick={() => setShowExpenseModal(true)}
                    className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white px-4 py-2.5 rounded-lg font-bold transition-all duration-200 shadow hover:shadow-md flex items-center"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                    เพิ่มรายจ่าย
                  </button>
                </div>
              </div>
            </div>
            {/* Date Filter for Finance Report */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h4 className="text-md font-bold text-gray-800">กรองข้อมูลตามช่วงเวลา</h4>
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={salesPeriodMode}
                  onChange={(e) => setSalesPeriodMode(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="day">เลือกวัน</option>
                  <option value="week">เลือกสัปดาห์</option>
                  <option value="month">เลือกเดือน</option>
                  <option value="year">เลือกปี</option>
                  <option value="custom">กำหนดเอง</option>
                </select>

                {salesPeriodMode === 'day' && (
                  <input
                    type="date"
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                )}

                {salesPeriodMode === 'week' && (
                  <input
                    type="week"
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                )}

                {salesPeriodMode === 'month' && (
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                )}

                {salesPeriodMode === 'year' && (
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-28 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                )}

                {salesPeriodMode === 'custom' && (
                  <>
                    <input 
                      type="date" 
                      value={salesDateRange.start}
                      onChange={(e) => setSalesDateRange({...salesDateRange, start: e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <span className="flex items-center text-gray-500">ถึง</span>
                    <input 
                      type="date" 
                      value={salesDateRange.end}
                      onChange={(e) => setSalesDateRange({...salesDateRange, end: e.target.value})}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* P&L Statement */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-5 rounded-xl border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-4">งบกำไรขาดทุน (ช่วงเวลาที่เลือก)</h4>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-700">รายรับจากการขาย</span>
                    <span className="font-medium text-gray-800">{formatCurrency(safeDashboardData.todaySales)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-700">รายรับอื่นๆ</span>
                    <span className="font-medium text-gray-800">{formatCurrency(Array.isArray(income) ? income.filter(inc => {
                      const incDate = new Date(inc.created_at);
                      const startDate = new Date(salesDateRange.start);
                      const endDate = new Date(salesDateRange.end);
                      endDate.setHours(23, 59, 59, 999);
                      return incDate >= startDate && incDate <= endDate;
                    }).reduce((sum, inc) => sum + (Number(inc.amount) || 0), 0) : 0)}</span>
                  </div>
                  <div className="flex justify-between font-bold py-2 border-b border-gray-300">
                    <span className="text-gray-800">รายรับรวม</span>
                    <span className="text-green-600">{formatCurrency(
                      safeDashboardData.todaySales + 
                      (Array.isArray(income) ? income.filter(inc => {
                        const incDate = new Date(inc.created_at);
                        const startDate = new Date(salesDateRange.start);
                        const endDate = new Date(salesDateRange.end);
                        endDate.setHours(23, 59, 59, 999);
                        return incDate >= startDate && incDate <= endDate;
                      }).reduce((sum, inc) => sum + (Number(inc.amount) || 0), 0) : 0)
                    )}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200 mt-3">
                    <span className="text-gray-700">ต้นทุนขาย (COGS)</span>
                    <span className="font-medium text-gray-800">{formatCurrency(0)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-700">ค่าใช้จ่ายดำเนินงาน</span>
                    <span className="font-medium text-gray-800">{formatCurrency(Array.isArray(expenses) ? expenses.filter(exp => {
                      const expDate = new Date(exp.created_at);
                      const startDate = new Date(salesDateRange.start);
                      const endDate = new Date(salesDateRange.end);
                      endDate.setHours(23, 59, 59, 999);
                      return expDate >= startDate && expDate <= endDate;
                    }).reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0) : 0)}</span>
                  </div>
                  <div className="flex justify-between font-bold py-2 border-b border-gray-300">
                    <span className="text-gray-800">ค่าใช้จ่ายรวม</span>
                    <span className="text-red-600">{formatCurrency(Array.isArray(expenses) ? expenses.filter(exp => {
                      const expDate = new Date(exp.created_at);
                      const startDate = new Date(salesDateRange.start);
                      const endDate = new Date(salesDateRange.end);
                      endDate.setHours(23, 59, 59, 999);
                      return expDate >= startDate && expDate <= endDate;
                    }).reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0) : 0)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg py-3 border-t border-gray-400 mt-2">
                    <span className="text-gray-900">กำไรสุทธิ</span>
                    <span className="text-blue-600">{formatCurrency(safeDashboardData.netProfit)}</span>
                  </div>
                </div>
              </div>
              
              {/* Quick Stats */}
              <div>
                <h4 className="font-bold text-gray-800 mb-4">สถิติการเงิน</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border border-green-100 text-center">
                    <p className="text-xs text-green-700 mb-1">Gross Margin</p>
                    <p className="text-xl font-bold text-green-900">{safeDashboardData.todaySales > 0 ? ((safeDashboardData.todaySales - (Array.isArray(expenses) ? expenses.filter(exp => {
                      const expDate = new Date(exp.created_at);
                      const startDate = new Date(salesDateRange.start);
                      const endDate = new Date(salesDateRange.end);
                      endDate.setHours(23, 59, 59, 999);
                      return expDate >= startDate && expDate <= endDate;
                    }).reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0) : 0)) / safeDashboardData.todaySales * 100).toFixed(1) : '0'}%</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100 text-center">
                    <p className="text-xs text-blue-700 mb-1">Net Margin</p>
                    <p className="text-xl font-bold text-blue-900">{safeDashboardData.todaySales > 0 ? (safeDashboardData.netProfit / safeDashboardData.todaySales * 100).toFixed(1) : '0'}%</p>
                  </div>
                  <div className="bg-gradient-to-br from-yellow-50 to-amber-50 p-4 rounded-xl border border-yellow-100 text-center">
                    <p className="text-xs text-yellow-700 mb-1">รายรับเฉลี่ย/วัน</p>
                    <p className="text-xl font-bold text-yellow-900">{formatCurrency(Array.isArray(income) && income.filter(inc => {
                      const incDate = new Date(inc.created_at);
                      const startDate = new Date(salesDateRange.start);
                      const endDate = new Date(salesDateRange.end);
                      endDate.setHours(23, 59, 59, 999);
                      return incDate >= startDate && incDate <= endDate;
                    }).length > 0 ? income.filter(inc => {
                      const incDate = new Date(inc.created_at);
                      const startDate = new Date(salesDateRange.start);
                      const endDate = new Date(salesDateRange.end);
                      endDate.setHours(23, 59, 59, 999);
                      return incDate >= startDate && incDate <= endDate;
                    }).reduce((sum, inc) => sum + (Number(inc.amount) || 0), 0) / income.filter(inc => {
                      const incDate = new Date(inc.created_at);
                      const startDate = new Date(salesDateRange.start);
                      const endDate = new Date(salesDateRange.end);
                      endDate.setHours(23, 59, 59, 999);
                      return incDate >= startDate && incDate <= endDate;
                    }).length : 0)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 p-4 rounded-xl border border-purple-100 text-center">
                    <p className="text-xs text-purple-700 mb-1">ค่าใช้จ่ายเฉลี่ย/วัน</p>
                    <p className="text-xl font-bold text-purple-900">{formatCurrency(Array.isArray(expenses) && expenses.filter(exp => {
                      const expDate = new Date(exp.created_at);
                      const startDate = new Date(salesDateRange.start);
                      const endDate = new Date(salesDateRange.end);
                      endDate.setHours(23, 59, 59, 999);
                      return expDate >= startDate && expDate <= endDate;
                    }).length > 0 ? expenses.filter(exp => {
                      const expDate = new Date(exp.created_at);
                      const startDate = new Date(salesDateRange.start);
                      const endDate = new Date(salesDateRange.end);
                      endDate.setHours(23, 59, 59, 999);
                      return expDate >= startDate && expDate <= endDate;
                    }).reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0) / expenses.filter(exp => {
                      const expDate = new Date(exp.created_at);
                      const startDate = new Date(salesDateRange.start);
                      const endDate = new Date(salesDateRange.end);
                      endDate.setHours(23, 59, 59, 999);
                      return expDate >= startDate && expDate <= endDate;
                    }).length : 0)}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl p-5 border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-4">รายรับอื่นๆ (ช่วงเวลาที่เลือก)</h4>
                <div className="space-y-3">
                  {Array.isArray(income) ? income.filter(inc => {
                    const incDate = new Date(inc.created_at);
                    const startDate = new Date(salesDateRange.start);
                    const endDate = new Date(salesDateRange.end);
                    endDate.setHours(23, 59, 59, 999);
                    return incDate >= startDate && incDate <= endDate;
                  }).map((inc, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div>
                        <h4 className="font-semibold text-gray-800">{inc.category}</h4>
                        <p className="text-sm text-gray-600 truncate max-w-[150px]">{inc.note}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-800">{formatCurrency(inc.amount)}</p>
                      </div>
                    </div>
                  )) : []}
                  {Array.isArray(income) && income.filter(inc => {
                    const incDate = new Date(inc.created_at);
                    const startDate = new Date(salesDateRange.start);
                    const endDate = new Date(salesDateRange.end);
                    endDate.setHours(23, 59, 59, 999);
                    return incDate >= startDate && incDate <= endDate;
                  }).length === 0 && (
                    <div className="text-center py-6">
                      <div className="text-gray-400 mb-2">
                        <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                      </div>
                      <p className="text-gray-500">ยังไม่มีข้อมูลรายรับ</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-4">รายจ่าย (ช่วงเวลาที่เลือก)</h4>
                <div className="space-y-3">
                  {Array.isArray(expenses) ? expenses.filter(exp => {
                    const expDate = new Date(exp.created_at);
                    const startDate = new Date(salesDateRange.start);
                    const endDate = new Date(salesDateRange.end);
                    endDate.setHours(23, 59, 59, 999);
                    return expDate >= startDate && expDate <= endDate;
                  }).map((exp, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div>
                        <h4 className="font-semibold text-gray-800">{exp.category}</h4>
                        <p className="text-sm text-gray-600 truncate max-w-[150px]">{exp.note}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-800">{formatCurrency(exp.amount)}</p>
                      </div>
                    </div>
                  )) : []}
                  {Array.isArray(expenses) && expenses.filter(exp => {
                    const expDate = new Date(exp.created_at);
                    const startDate = new Date(salesDateRange.start);
                    const endDate = new Date(salesDateRange.end);
                    endDate.setHours(23, 59, 59, 999);
                    return expDate >= startDate && expDate <= endDate;
                  }).length === 0 && (
                    <div className="text-center py-6">
                      <div className="text-gray-400 mb-2">
                        <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                      </div>
                      <p className="text-gray-500">ยังไม่มีข้อมูลรายจ่าย</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        
        
        {/* Add Income Modal */}
        {showIncomeModal && (
          <div className="modal-overlay">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">เพิ่มรายรับ</h3>
                <button 
                  onClick={() => {
                    setShowIncomeModal(false);
                    setNewIncome({ category: '', amount: '', note: '' });
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleAddIncome}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">หมวดหมู่</label>
                  <input
                    type="text"
                    value={newIncome.category}
                    onChange={(e) => setNewIncome({...newIncome, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="เช่น ขายของ, บริการ, อื่นๆ"
                    required
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">จำนวนเงิน</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newIncome.amount}
                    onChange={(e) => setNewIncome({...newIncome, amount: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                    required
                  />
                </div>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">หมายเหตุ</label>
                  <textarea
                    value={newIncome.note}
                    onChange={(e) => setNewIncome({...newIncome, note: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="เพิ่มรายละเอียดเพิ่มเติม (ถ้ามี)"
                    rows="3"
                  />
                </div>
                
                <div className="flex space-x-3">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowIncomeModal(false);
                      setNewIncome({ category: '', amount: '', note: '' });
                    }}
                    className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-colors duration-200"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-bold hover:from-green-600 hover:to-emerald-700 transition-all duration-200 shadow hover:shadow-md"
                  >
                    บันทึก
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* Add Expense Modal */}
        {showExpenseModal && (
          <div className="modal-overlay">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">เพิ่มรายจ่าย</h3>
                <button 
                  onClick={() => {
                    setShowExpenseModal(false);
                    setNewExpense({ category: '', amount: '', note: '' });
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleAddExpense}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">หมวดหมู่</label>
                  <input
                    type="text"
                    value={newExpense.category}
                    onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="เช่น วัตถุดิบ, ค่าแรง, ค่าเช่า, อื่นๆ"
                    required
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">จำนวนเงิน</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                    required
                  />
                </div>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">หมายเหตุ</label>
                  <textarea
                    value={newExpense.note}
                    onChange={(e) => setNewExpense({...newExpense, note: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="เพิ่มรายละเอียดเพิ่มเติม (ถ้ามี)"
                    rows="3"
                  />
                </div>
                
                <div className="flex space-x-3">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowExpenseModal(false);
                      setNewExpense({ category: '', amount: '', note: '' });
                    }}
                    className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-colors duration-200"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg font-bold hover:from-red-600 hover:to-rose-700 transition-all duration-200 shadow hover:shadow-md"
                  >
                    บันทึก
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Receipt Preview Dialog */}
        {showReceiptPreview && (
          <div className="modal-overlay">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-800">สลิปการชำระเงิน</h3>
                <button
                  onClick={() => { setShowReceiptPreview(false); setReceiptPreviewUrl(''); }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="flex-1 bg-gray-50">
                {isImageUrl(receiptPreviewUrl) ? (
                  <div
                    className="w-full h-full overflow-hidden flex items-center justify-center"
                    onWheel={(e) => {
                      e.preventDefault();
                      const delta = e.deltaY > 0 ? -0.1 : 0.1;
                      setReceiptZoom((z) => Math.max(0.5, Math.min(5, +(z + delta).toFixed(2))))
                    }}
                    onMouseDown={(e) => {
                      setIsPanningReceipt(true);
                      setPanStart({ x: e.clientX - receiptPan.x, y: e.clientY - receiptPan.y });
                    }}
                    onMouseMove={(e) => {
                      if (!isPanningReceipt) return;
                      setReceiptPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
                    }}
                    onMouseUp={() => setIsPanningReceipt(false)}
                    onMouseLeave={() => setIsPanningReceipt(false)}
                    onDoubleClick={resetReceiptView}
                    role="presentation"
                  >
                    <div
                      className="p-4"
                      style={{ transform: `translate(${receiptPan.x}px, ${receiptPan.y}px) scale(${receiptZoom})`, transformOrigin: 'center center' }}
                    >
                      <img src={receiptPreviewUrl} alt="Receipt" className="max-w-none max-h-none object-contain rounded-lg shadow select-none pointer-events-none" />
                    </div>
                  </div>
                ) : (
                  <iframe title="receipt-preview" src={receiptPreviewUrl} className="w-full h-[80vh] bg-white"></iframe>
                )}
              </div>
              <div className="p-3 border-t border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>เลื่อนเมาส์เพื่อซูม, ลากเพื่อเลื่อน, ดับเบิลคลิกเพื่อรีเซ็ต</span>
                </div>
                <div className="flex items-center gap-2">
                  {isImageUrl(receiptPreviewUrl) && (
                    <>
                      <button onClick={zoomReceiptOut} className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700">−</button>
                      <span className="w-12 text-center text-sm text-gray-700">{Math.round(receiptZoom * 100)}%</span>
                      <button onClick={zoomReceiptIn} className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700">+</button>
                      <button onClick={resetReceiptView} className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700">รีเซ็ต</button>
                    </>
                  )}
                  <a
                    href={receiptPreviewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700"
                  >
                    เปิดแท็บใหม่
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;