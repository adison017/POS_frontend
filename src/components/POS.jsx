import React, { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import * as DataService from '../services/dataService';
import socketService from '../services/socket';
import shopLogo from '../logo.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingBag,
  ChefHat,
  Trash2,
  CreditCard,
  Printer,
  Download,
  ExternalLink,
  Plus,
  Minus,
  Search,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

const POS = () => {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const scrollContainerRef = React.useRef(null);

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const { current } = scrollContainerRef;
      const scrollAmount = 200;
      if (direction === 'left') {
        current.scrollLeft -= scrollAmount;
      } else {
        current.scrollLeft += scrollAmount;
      }
    }
  };
  const [currentOrder, setCurrentOrder] = useState({
    items: [],
    subtotal: 0,
    discount: 0,
    grandTotal: 0
  });
  const [currentOrderNumber, setCurrentOrderNumber] = useState(1);
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [cashReceived, setCashReceived] = useState('');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState('');
  // Add state for top selling items
  const [topSellingItems, setTopSellingItems] = useState([]);

  const handleDownloadReceipt = async (fileName, url) => {
    try {
      const res = await fetch(url, { credentials: 'omit' });
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${fileName || 'receipt'}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      console.error('Download receipt failed', e);
      toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถดาวน์โหลดสลิปได้', variant: "destructive" });
    }
  };

  const handlePrintReceipt = (url) => {
    try {
      const printWindow = window.open('', '_blank', 'width=480,height=720');
      if (!printWindow) return;
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Print Receipt</title>
        <style>html,body{margin:0;padding:0;background:#fff} img{max-width:100%;height:auto;display:block;margin:0 auto}</style>
      </head><body><img src="${url}" onload="window.focus();window.print();" /></body></html>`;
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (e) {
      console.error('Print receipt failed', e);
      toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถพิมพ์สลิปได้', variant: "destructive" });
    }
  };
  // Bill-level adjustments
  const [discountType, setDiscountType] = useState('amount'); // 'amount' | 'percent'
  const [discountInput, setDiscountInput] = useState('0');
  const [extraFeeInput, setExtraFeeInput] = useState('0'); // e.g., service charge or other fee

  // Load data from Supabase with performance optimizations
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load data in parallel but with pagination for orders
        const [categoriesData, menuItemsData, paymentMethodsData] = await Promise.all([
          DataService.getMenuCategories(),
          DataService.getMenuItems(),
          DataService.getPaymentMethods()
        ]);

        // Filter out inactive categories
        const activeCategories = categoriesData ? categoriesData.filter(cat => cat.is_active) : [];
        // Filter out inactive menu items
        const activeMenuItems = menuItemsData ? menuItemsData.filter(item => item.is_active) : [];

        setCategories(activeCategories || []);
        setMenuItems(activeMenuItems || []);
        setPaymentMethods(paymentMethodsData || []);

        // Set default payment method if available
        if (paymentMethodsData && paymentMethodsData.length > 0) {
          setSelectedPaymentMethod(paymentMethodsData[0].id);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถโหลดข้อมูลได้', variant: "destructive" });
      }
    };

    loadData();

    const socket = socketService.connectSocket();
    socket.on('order:updated', async () => {
      try {
        const paymentMethodsData = await DataService.getPaymentMethods();
        setPaymentMethods(paymentMethodsData || []);
      } catch (error) {
        console.error('Error updating payment methods:', error);
      }
    });

    return () => {
      socket.off('order:updated');
    };
  }, []);

  // Load the latest order number (faster than fetching all orders)
  useEffect(() => {
    const loadLatestOrder = async () => {
      try {
        const latestOrderNo = await DataService.getLatestOrderNo();
        if (latestOrderNo && latestOrderNo.startsWith('ORD')) {
          const latestNumber = parseInt(latestOrderNo.replace('ORD', ''));
          setCurrentOrderNumber((isNaN(latestNumber) ? 0 : latestNumber) + 1);
        } else {
          setCurrentOrderNumber(1);
        }
      } catch (error) {
        console.error('Error loading latest order:', error);
        setCurrentOrderNumber(1);
      }
    };

    loadLatestOrder();
  }, []);

  // Load top selling items
  useEffect(() => {
    const loadTopSellingItems = async () => {
      try {
        // Get recent orders and order items
        const ordersData = await DataService.getOrders();
        const orderItemsData = await Promise.all(
          ordersData.map(order => DataService.getOrderItems(order.id))
        ).then(results => results.flat());

        // Calculate top selling items based on quantity sold
        const itemCounts = {};
        orderItemsData.forEach(item => {
          if (itemCounts[item.item_id]) {
            itemCounts[item.item_id].qty += Number(item.qty) || 0;
            itemCounts[item.item_id].revenue += Number(item.total_price) || 0;
          } else {
            itemCounts[item.item_id] = {
              id: item.item_id,
              name: item.name,
              qty: Number(item.qty) || 0,
              revenue: Number(item.total_price) || 0
            };
          }
        });

        // Convert to array and sort by quantity
        const sortedItems = Object.values(itemCounts)
          .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
          .slice(0, 5); // Top 5 items

        setTopSellingItems(sortedItems);
      } catch (error) {
        console.error('Error loading top selling items:', error);
        setTopSellingItems([]);
      }
    };

    loadTopSellingItems();
  }, []);

  const filteredMenuItems = selectedCategory === 'all'
    ? menuItems.filter(item => item.is_active) // Only show active items
    : menuItems.filter(item => item.category_id === selectedCategory && item.is_active); // Only show active items in selected category

  // Sort menu items to show top selling items first
  const sortedMenuItems = (() => {
    if (topSellingItems.length === 0) return filteredMenuItems;

    // Create a map for quick lookup of top selling items and their ranks
    const topSellingMap = {};
    topSellingItems.forEach((item, index) => {
      topSellingMap[item.id] = index + 1;
    });

    // Sort items: top selling first, then others
    return [...filteredMenuItems].sort((a, b) => {
      const aRank = topSellingMap[a.id];
      const bRank = topSellingMap[b.id];

      // If both are top selling items, sort by rank
      if (aRank && bRank) {
        return aRank - bRank;
      }

      // If only a is top selling, it comes first
      if (aRank) return -1;

      // If only b is top selling, it comes first
      if (bRank) return 1;

      // If neither is top selling, maintain original order
      return 0;
    });
  })();

  const addToOrder = (itemId, overridePrice, qty = 1) => {
    const menuItem = menuItems.find(item => item.id === itemId);
    if (!menuItem) return;

    setCurrentOrder(prevOrder => {
      const priceToUse = Number.isFinite(overridePrice) ? overridePrice : (parseFloat(overridePrice) || menuItem.price);
      const qtyToUse = Math.max(1, parseInt(qty, 10) || 1);
      const lineId = `${menuItem.id}__${priceToUse}`; // separate lines for different prices

      const existingItem = prevOrder.items.find(item => item.id === lineId);

      let updatedItems;
      if (existingItem) {
        updatedItems = prevOrder.items.map(item =>
          item.id === lineId
            ? { ...item, qty: item.qty + qtyToUse, total: (item.qty + qtyToUse) * item.price }
            : item
        );
      } else {
        updatedItems = [
          ...prevOrder.items,
          {
            id: lineId,
            baseItemId: menuItem.id,
            name: menuItem.name,
            price: priceToUse,
            cost: menuItem.cost_default || 0,
            qty: qtyToUse,
            total: priceToUse * qtyToUse
          }
        ];
      }

      const subtotal = updatedItems.reduce((sum, item) => sum + item.total, 0);
      const discountValue =
        discountType === 'percent'
          ? Math.min(subtotal, (subtotal * (parseFloat(discountInput) || 0)) / 100)
          : Math.min(subtotal, parseFloat(discountInput) || 0);
      const extraFee = Math.max(0, parseFloat(extraFeeInput) || 0);
      const grandTotal = Math.max(0, subtotal - discountValue + extraFee);

      return {
        items: updatedItems,
        subtotal,
        discount: discountValue,
        grandTotal
      };
    });
  };

  const updateItemQuantity = (itemId, action) => {
    setCurrentOrder(prevOrder => {
      let updatedItems;

      if (action === 'increase') {
        updatedItems = prevOrder.items.map(item =>
          item.id === itemId
            ? { ...item, qty: item.qty + 1, total: (item.qty + 1) * item.price }
            : item
        );
      } else if (action === 'decrease') {
        updatedItems = prevOrder.items.map(item =>
          item.id === itemId
            ? { ...item, qty: item.qty - 1, total: (item.qty - 1) * item.price }
            : item
        ).filter(item => item.qty > 0);
      }

      const subtotal = updatedItems.reduce((sum, item) => sum + item.total, 0);
      const discountValue =
        discountType === 'percent'
          ? Math.min(subtotal, (subtotal * (parseFloat(discountInput) || 0)) / 100)
          : Math.min(subtotal, parseFloat(discountInput) || 0);
      const extraFee = Math.max(0, parseFloat(extraFeeInput) || 0);
      const grandTotal = Math.max(0, subtotal - discountValue + extraFee);

      return {
        items: updatedItems,
        subtotal,
        discount: discountValue,
        grandTotal
      };
    });
  };

  const adjustLinePrice = (itemId, delta) => {
    setCurrentOrder(prev => {
      const updatedItems = prev.items.map((item) => {
        if (item.id !== itemId) return item;
        const newPrice = Math.max(0, (parseFloat(item.price) || 0) + delta);
        return { ...item, price: newPrice, total: newPrice * item.qty };
      });
      const subtotal = updatedItems.reduce((sum, it) => sum + it.total, 0);
      const discountValue =
        discountType === 'percent'
          ? Math.min(subtotal, (subtotal * (parseFloat(discountInput) || 0)) / 100)
          : Math.min(subtotal, parseFloat(discountInput) || 0);
      const extraFee = Math.max(0, parseFloat(extraFeeInput) || 0);
      const grandTotal = Math.max(0, subtotal - discountValue + extraFee);
      return { ...prev, items: updatedItems, subtotal, discount: discountValue, grandTotal };
    });
  };

  const clearOrder = () => {
    setCurrentOrder({
      items: [],
      subtotal: 0,
      discount: 0,
      grandTotal: 0
    });
    setDiscountInput('0');
    setExtraFeeInput('0');
    setDiscountType('amount');
  };

  // Recalculate totals when adjustments change
  useEffect(() => {
    setCurrentOrder(prev => {
      const subtotal = prev.items.reduce((sum, item) => sum + item.total, 0);
      const discountValue =
        discountType === 'percent'
          ? Math.min(subtotal, (subtotal * (parseFloat(discountInput) || 0)) / 100)
          : Math.min(subtotal, parseFloat(discountInput) || 0);
      const extraFee = Math.max(0, parseFloat(extraFeeInput) || 0);
      const grandTotal = Math.max(0, subtotal - discountValue + extraFee);
      return { ...prev, subtotal, discount: discountValue, grandTotal };
    });
  }, [discountType, discountInput, extraFeeInput]);

  const openPaymentModal = () => {
    if (currentOrder.items.length === 0) return;
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedPaymentMethod(paymentMethods.length > 0 ? paymentMethods[0].id : '');
  };

  const processPayment = async () => {
    if (currentOrder.items.length === 0) return;
    if (!selectedPaymentMethod) {
      toast({ title: "เกิดข้อผิดพลาด", description: 'กรุณาเลือกวิธีการชำระเงิน', variant: "destructive" });
      return;
    }

    const selectedMethod = paymentMethods.find(m => m.id === selectedPaymentMethod);
    const isCash = selectedMethod?.id === 'pm_cash' || selectedMethod?.id === 'cash' ||
      selectedMethod?.name?.toLowerCase?.().includes('cash') || selectedMethod?.name?.includes('เงินสด');

    if (isCash) {
      const received = parseFloat(cashReceived || '0');
      if (!isFinite(received) || received < currentOrder.grandTotal) {
        toast({ title: "เกิดข้อผิดพลาด", description: 'จำนวนเงินที่รับมาต้องมากกว่าหรือเท่ากับยอดชำระ', variant: "destructive" });
        return;
      }
    }

    try {
      // Generate a unique order number based on currentOrderNumber
      const orderNo = `ORD${String(currentOrderNumber).padStart(4, '0')}`;

      // Create order record
      const orderData = {
        id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // More unique ID
        order_no: orderNo,
        status: 'paid',
        subtotal: currentOrder.subtotal,
        grand_total: currentOrder.grandTotal,
        payment_method: selectedPaymentMethod,
        branch_id: 'branch1',
        cashier_id: 'cashier1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // If cash, include cash_received and cash_change for persistence
      if (isCash) {
        const received = parseFloat(cashReceived || '0');
        const change = Math.max(0, received - currentOrder.grandTotal);
        orderData.cash_received = received;
        orderData.cash_change = change;
      }

      console.log('Creating order with data:', orderData);
      const orderResult = await DataService.createOrder(orderData);
      console.log('Order result:', orderResult);

      if (orderResult.error) {
        console.error('Failed to create order:', orderResult.error);
        toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถสร้างออเดอร์ได้ กรุณาลองใหม่อีกครั้ง', variant: "destructive" });
        throw new Error('Failed to create order: ' + orderResult.error.message);
      }

      // Create order items
      for (const item of currentOrder.items) {
        const orderItemData = {
          id: `order_item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // More unique ID
          order_id: orderResult.data.id,
          item_id: item.baseItemId || item.id,
          name: item.name,
          qty: item.qty,
          unit_price: item.price,
          total_price: item.total,
          created_at: new Date().toISOString()
        };

        console.log('Creating order item with data:', orderItemData);
        const itemResult = await DataService.createOrderItem(orderItemData);
        console.log('Order item result:', itemResult);

        if (itemResult.error) {
          console.error('Failed to create order item:', itemResult.error);
          toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถบันทึกรายการอาหารได้ กรุณาลองใหม่อีกครั้ง', variant: "destructive" });
          throw new Error('Failed to create order item: ' + itemResult.error.message);
        }
      }

      // Clear order and increment order number
      clearOrder();
      setCurrentOrderNumber(prev => prev + 1);
      setShowPaymentModal(false);
      setCashReceived('');

      try {
        // Generate modern receipt (3:4) with logo and structured layout
        const canvas = document.createElement('canvas');
        const W = 900; // 3:4 aspect ratio (width:height = 3:4)
        const H = 1200;
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#F7F7F8';
        ctx.fillRect(0, 0, W, H);

        // Card area
        const cardPad = 40;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(cardPad, cardPad, W - cardPad * 2, H - cardPad * 2);

        // Helpers
        const drawCentered = (text, y, font = 'bold 28px ui-sans-serif') => {
          ctx.font = font;
          ctx.fillStyle = '#111827';
          ctx.textAlign = 'center';
          ctx.fillText(text, W / 2, y);
        };
        const drawLeft = (text, x, y, font = '16px ui-sans-serif') => {
          ctx.font = font;
          ctx.fillStyle = '#111827';
          ctx.textAlign = 'left';
          ctx.fillText(text, x, y);
        };
        const drawRight = (text, x, y, font = '16px ui-sans-serif') => {
          ctx.font = font;
          ctx.fillStyle = '#111827';
          ctx.textAlign = 'right';
          ctx.fillText(text, x, y);
        };
        const hr = (y) => {
          ctx.strokeStyle = '#E5E7EB';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cardPad + 20, y);
          ctx.lineTo(W - cardPad - 20, y);
          ctx.stroke();
        };

        let y = cardPad + 30;

        // Logo (centered)
        const logoImg = await new Promise((resolve) => {
          const img = new Image();
          img.src = shopLogo;
          img.onload = () => resolve(img);
        });
        const logoSize = 140;
        ctx.drawImage(logoImg, W / 2 - logoSize / 2, y, logoSize, logoSize);
        y += logoSize + 20;

        // Shop info
        drawCentered('POS-By-adison', y, '700 30px ui-sans-serif');
        y += 34;
        drawCentered('123 ถนนหลัก เมืองหนองบัวลำภู จังหวัดหนองบัวลำภู 39000', y, '16px ui-sans-serif');
        y += 22;
        drawCentered('โทร: 089-123-4567', y, '16px ui-sans-serif');
        y += 30;
        hr(y); y += 24;

        // Order basic info
        drawLeft(`เลขที่ออร์เดอร์: ${orderNo}`, cardPad + 60, y, '600 18px ui-sans-serif');
        drawRight(new Date().toLocaleString('th-TH'), W - cardPad - 60, y, '16px ui-sans-serif');
        y += 26;
        const methodName = selectedMethod?.name || selectedPaymentMethod;
        drawLeft(`วิธีชำระเงิน: ${methodName}`, cardPad + 60, y);
        y += 26;

        // Cash in/out if cash
        const isCash = selectedMethod && (selectedMethod.id === 'pm_cash' || selectedMethod.id === 'cash' || selectedMethod.name?.includes('เงินสด') || selectedMethod.name?.toLowerCase?.().includes('cash'));
        if (isCash) {
          const received = parseFloat(cashReceived || '0');
          const change = Math.max(0, received - currentOrder.grandTotal);
          drawLeft(`ยอดรับเงิน: ${formatCurrency(received)}`, cardPad + 60, y);
          y += 24;
          drawLeft(`เงินทอน: ${formatCurrency(change)}`, cardPad + 60, y);
          y += 24;
        }

        y += 6; hr(y); y += 24;

        // Items header
        drawLeft('รายการ', cardPad + 60, y, '600 16px ui-sans-serif');
        drawRight('รวม', W - cardPad - 60, y, '600 16px ui-sans-serif');
        y += 22;

        // Items
        currentOrder.items.forEach((it) => {
          drawLeft(`${it.name} x${it.qty} @${formatCurrency(it.price)}`, cardPad + 60, y);
          drawRight(`${formatCurrency(it.total)}`, W - cardPad - 60, y);
          y += 22;
        });

        y += 6; hr(y); y += 24;

        // Totals
        drawLeft('ยอดรวม', cardPad + 60, y, '600 18px ui-sans-serif');
        drawRight(`${formatCurrency(currentOrder.subtotal)}`, W - cardPad - 60, y, '600 18px ui-sans-serif');
        y += 26;
        drawLeft('ส่วนลด', cardPad + 60, y);
        drawRight(`-${formatCurrency(currentOrder.discount)}`, W - cardPad - 60, y);
        y += 22;
        const extraFee = Math.max(0, parseFloat(extraFeeInput) || 0);
        drawLeft('ค่าอื่น ๆ', cardPad + 60, y);
        drawRight(`${formatCurrency(extraFee)}`, W - cardPad - 60, y);
        y += 26;
        hr(y); y += 30;
        drawLeft('ยอดสุทธิ', cardPad + 60, y, '700 22px ui-sans-serif');
        drawRight(`${formatCurrency(currentOrder.grandTotal)}`, W - cardPad - 60, y, '700 22px ui-sans-serif');
        y += 36;

        // Footer message
        drawCentered('ขอบคุณที่อุดหนุนครับ/ค่ะ ❤️', y + 10, '600 18px ui-sans-serif');

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (blob) {
          const formData = new FormData();
          formData.append('file', new File([blob], `${orderNo}.png`, { type: 'image/png' }));
          formData.append('folder', 'receipts');
          const uploadRes = await (await import('../services/apiClient')).default.post('/storage/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          const receiptUrl = uploadRes?.data?.publicUrl;
          if (receiptUrl) {
            await DataService.updateOrder(orderResult.data.id, { receipt_url: receiptUrl });
            setReceiptPreviewUrl(receiptUrl);
            setShowReceiptModal(true);
          }
        }
      } catch (e) {
        console.error('Receipt upload error:', e);
      }

      toast({ title: "สำเร็จ", description: 'ชำระเงินเรียบร้อยแล้ว!' });
    } catch (error) {
      console.error('Payment processing error:', error);
      toast({ title: "เกิดข้อผิดพลาด", description: 'เกิดข้อผิดพลาดในการชำระเงิน กรุณาลองใหม่อีกครั้ง', variant: "destructive" });
    }
  };

  const formatCurrency = (amount) => {
    return `฿${amount.toFixed(2)}`;
  };

  // Check if an item is in top selling items
  const isTopSellingItem = (itemId) => {
    return topSellingItems.some(item => item.id === itemId);
  };

  // Get top selling item rank
  const getTopSellingRank = (itemId) => {
    const index = topSellingItems.findIndex(item => item.id === itemId);
    return index >= 0 ? index + 1 : null;
  };

  return (
    <div className="w-full min-h-screen bg-background p-4 md:p-6 lg:p-8 space-y-6">
      <div className="max-w-[1920px] mx-auto h-[calc(100vh-80px)]">

        <div className="flex flex-col lg:flex-row gap-6 h-full">
          {/* Left Side: Menu */}
          <div className="flex-1 min-w-0 flex flex-col gap-6 h-full">
            {/* Header & Categories */}
            <div className="flex flex-col gap-4 shrink-0">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">ระบบขายหน้าร้าน (POS)</h1>
                  <p className="text-muted-foreground">จัดการออเดอร์และชำระเงิน</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="ค้นหาเมนู..."
                      className="pl-8 w-64"
                    />
                  </div>
                </div>
              </div>

              <div className="relative group flex items-center">
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute left-0 z-10 h-8 w-8 -ml-4 bg-primary text-primary-foreground shadow-md hover:bg-primary/90 rounded-full hidden md:flex"
                  onClick={() => scroll('left')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <ScrollArea className="w-full whitespace-nowrap pb-2 px-2" viewportRef={scrollContainerRef}>
                  <div className="flex w-max space-x-2 p-1">
                    <Button
                      variant={selectedCategory === 'all' ? "default" : "outline"}
                      onClick={() => setSelectedCategory('all')}
                      className={cn(
                        "rounded-full shadow-sm transition-all duration-300 shrink-0",
                        selectedCategory === 'all'
                          ? "scale-105 font-bold ring-2 ring-primary ring-offset-2"
                          : "hover:scale-105 hover:bg-primary hover:text-primary-foreground"
                      )}
                    >
                      ทั้งหมด
                    </Button>
                    {categories.map(category => (
                      <Button
                        key={category.id}
                        variant={selectedCategory === category.id ? "default" : "outline"}
                        onClick={() => setSelectedCategory(category.id)}
                        className={cn(
                          "rounded-full shadow-sm transition-all duration-300 shrink-0",
                          selectedCategory === category.id
                            ? "scale-105 font-bold ring-2 ring-primary ring-offset-2"
                            : "hover:scale-105 hover:bg-primary hover:text-primary-foreground"
                        )}
                      >
                        {category.name}
                      </Button>
                    ))}
                  </div>
                  <ScrollBar orientation="horizontal" className="hidden" />
                </ScrollArea>

                <Button
                  variant="outline"
                  size="icon"
                  className="absolute right-0 z-10 h-8 w-8 -mr-4 bg-primary text-primary-foreground shadow-md hover:bg-primary/90 rounded-full hidden md:flex"
                  onClick={() => scroll('right')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Menu Grid */}
            <Card className="flex-1 bg-muted/40 border-none shadow-inner overflow-hidden">
              <ScrollArea className="h-full p-4">
                {sortedMenuItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-center text-muted-foreground">
                    <ChefHat className="h-24 w-24 mb-4 opacity-20" />
                    <h3 className="text-xl font-semibold">ไม่มีรายการเมนู</h3>
                    <p>กรุณาเพิ่มเมนูในหน้า "เมนู"</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                    {sortedMenuItems.map(item => (
                      <Card
                        key={item.id}
                        className="group relative overflow-hidden cursor-pointer hover:border-primary hover:shadow-lg transition-all active:scale-95"
                        onClick={() => addToOrder(item.id)}
                      >
                        <div className="aspect-[4/3] overflow-hidden relative">
                          {isTopSellingItem(item.id) && (
                            <Badge className="absolute top-2 right-2 z-10 bg-amber-500 hover:bg-amber-600">
                              อันดับ {getTopSellingRank(item.id)}
                            </Badge>
                          )}
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full bg-secondary flex items-center justify-center">
                              <ShoppingBag className="h-12 w-12 text-muted-foreground/40" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Plus className="text-white h-12 w-12 drop-shadow-lg" />
                          </div>
                        </div>

                        <div className="p-4">
                          <h3 className="font-semibold truncate mb-1" title={item.name}>{item.name}</h3>
                          <p className="text-lg font-bold text-primary">{formatCurrency(item.price)}</p>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </Card>
          </div>

          {/* Right Side: Order Summary */}
          <Card className="w-full lg:w-[450px] flex flex-col h-full shadow-xl border-l-4 border-l-primary/20">
            <CardHeader className="pb-4 border-b bg-muted/20">
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" /> ออเดอร์ปัจจุบัน
                </CardTitle>
                {currentOrder.items.length > 0 && (
                  <Badge variant="secondary" className="font-mono text-base">
                    #{`ORD${String(currentOrderNumber).padStart(4, '0')}`}
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex-1 p-0 overflow-hidden relative">
              {currentOrder.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
                  <ShoppingBag className="h-16 w-16 mb-4 opacity-20" />
                  <p>ยังไม่มีรายการ</p>
                  <p className="text-sm">เลือกเมนูทางซ้ายเพื่อเริ่มรายการขาย</p>
                </div>
              ) : (
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-3">
                    {currentOrder.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col gap-2 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div className="min-w-0 flex-1 mr-2">
                            <h4 className="font-medium truncate">{item.name}</h4>
                            <div className="text-xs text-muted-foreground">
                              {formatCurrency(item.price)} / หน่วย
                            </div>
                          </div>
                          <div className="font-bold tabular-nums">
                            {formatCurrency(item.total)}
                          </div>
                        </div>

                        <div className="flex justify-between items-center mt-1">
                          {/* Quantity Control */}
                          <div className="flex items-center border rounded-md bg-background">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-r-none"
                              onClick={() => updateItemQuantity(item.id, 'decrease')}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <div className="w-10 text-center text-sm font-semibold tabular-nums">
                              {item.qty}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-l-none"
                              onClick={() => updateItemQuantity(item.id, 'increase')}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>

                          {/* Quick Price Adjust */}
                          <div className="flex gap-1 ml-auto">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => adjustLinePrice(item.id, -5)}
                            >
                              -5
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => adjustLinePrice(item.id, 5)}
                            >
                              +5
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>

            <Separator />

            {/* Calculation & Actions */}
            <div className="p-6 bg-muted/20 space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">รวมย่อย</span>
                  <span>{formatCurrency(currentOrder.subtotal)}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">ส่วนลด</label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        className="h-8 text-right"
                        value={discountInput}
                        onChange={(e) => setDiscountInput(e.target.value)}
                        placeholder="0"
                      />
                      <Select value={discountType} onValueChange={setDiscountType}>
                        <SelectTrigger className="h-8 w-[70px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="amount">บาท</SelectItem>
                          <SelectItem value="percent">%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">ค่าอื่น ๆ (บาท)</label>
                    <Input
                      type="number"
                      className="h-8 text-right"
                      value={extraFeeInput}
                      onChange={(e) => setExtraFeeInput(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="flex justify-between text-red-500">
                  <span>ส่วนลดรวม</span>
                  <span>-{formatCurrency(currentOrder.discount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ค่าอื่น ๆ</span>
                  <span>+{formatCurrency(Math.max(0, parseFloat(extraFeeInput) || 0))}</span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">รวมทั้งสิ้น</span>
                <span className="text-3xl font-bold text-primary tabular-nums tracking-tight">
                  {formatCurrency(currentOrder.grandTotal)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <Button
                  variant="outline"
                  className="h-12 border-destructive text-destructive hover:bg-destructive hover:text-white transition-all hover:scale-105 shadow-sm"
                  onClick={clearOrder}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  ล้าง
                </Button>
                <Button
                  className="col-span-2 h-12 text-lg font-bold shadow-lg shadow-primary/20"
                  size="lg"
                  variant="success"
                  onClick={openPaymentModal}
                  disabled={currentOrder.items.length === 0}
                >
                  <CreditCard className="mr-2 h-5 w-5" />
                  ชำระเงิน
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Payment Modal Refactored to Dialog */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">ชำระเงิน</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="bg-primary/10 rounded-xl p-6 text-center space-y-1 border border-primary/20">
              <p className="text-sm text-muted-foreground">ODR#{String(currentOrderNumber).padStart(4, '0')}</p>
              <p className="text-4xl font-bold text-primary tabular-nums">{formatCurrency(currentOrder.grandTotal)}</p>
            </div>

            <div className="space-y-4">
              <label className="text-sm font-medium">วิธีการชำระเงิน</label>
              <div className="grid grid-cols-2 gap-3">
                {paymentMethods.map(method => (
                  <Button
                    key={method.id}
                    variant={selectedPaymentMethod === method.id ? "default" : "outline"}
                    className={cn("h-16 text-lg", selectedPaymentMethod === method.id && "ring-2 ring-primary ring-offset-2")}
                    onClick={() => setSelectedPaymentMethod(method.id)}
                  >
                    {method.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Cash Calculation */}
            {(() => {
              const m = paymentMethods.find(pm => pm.id === selectedPaymentMethod);
              const isCash = m?.id === 'pm_cash' || m?.id === 'cash' || m?.name?.toLowerCase?.().includes('cash') || m?.name?.includes('เงินสด');
              if (!isCash) return null;

              const received = parseFloat(cashReceived || '0');
              const change = isFinite(received) ? Math.max(0, received - currentOrder.grandTotal) : 0;
              const isEnough = isFinite(received) && received >= currentOrder.grandTotal;

              return (
                <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">รับเงินมา</label>
                    <Input
                      type="number"
                      className="text-lg h-12"
                      placeholder="0.00"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                    />
                  </div>

                  <div className={cn("flex justify-between items-center p-3 rounded-lg border", isEnough ? "bg-green-500/10 border-green-500/20 text-green-700" : "bg-yellow-500/10 border-yellow-500/20 text-yellow-700")}>
                    <span className="font-medium">{isEnough ? 'เงินทอน' : 'ยังขาดอีก'}</span>
                    <span className="text-xl font-bold">{formatCurrency(isEnough ? change : currentOrder.grandTotal - received)}</span>
                  </div>
                </div>
              )
            })()}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={closePaymentModal} size="lg">ยกเลิก</Button>
            <Button
              size="lg"
              className="w-full sm:w-auto font-bold"
              variant="success"
              onClick={processPayment}
              disabled={(() => {
                const m = paymentMethods.find(pm => pm.id === selectedPaymentMethod);
                const isCash = m?.id === 'pm_cash' || m?.id === 'cash' || m?.name?.toLowerCase?.().includes('cash') || m?.name?.includes('เงินสด');
                if (!isCash) return false;
                const received = parseFloat(cashReceived || '0');
                return !(isFinite(received) && received >= currentOrder.grandTotal);
              })()}
            >
              ยืนยันการชำระเงิน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Preview Dialog */}
      <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>ใบเสร็จรับเงิน</DialogTitle>
          </DialogHeader>

          <div className="aspect-[3/4] overflow-auto border rounded-md bg-white">
            {receiptPreviewUrl && (
              <img src={receiptPreviewUrl} alt="Receipt" className="w-full h-auto" />
            )}
          </div>

          <DialogFooter>
            <div className="flex w-full gap-2">
              <Button variant="outline" className="flex-1" onClick={() => handleDownloadReceipt(`receipt_${String(currentOrderNumber - 1).padStart(4, '0')}`, receiptPreviewUrl)}>
                <Download className="mr-2 h-4 w-4" /> ดาวน์โหลด
              </Button>
              <Button className="flex-1" onClick={() => handlePrintReceipt(receiptPreviewUrl)}>
                <Printer className="mr-2 h-4 w-4" /> พิมพ์
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POS;