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
  ChevronRight,
  Armchair,
  Save
} from 'lucide-react';
import { cn } from '@/lib/utils';

const POS = ({ initialTable, onTableHandled }) => {
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
  const [activeTable, setActiveTable] = useState(null);
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [orderType, setOrderType] = useState('take-away'); // 'take-away' | 'dine-in'
  const [showTableSelectionModal, setShowTableSelectionModal] = useState(false);
  const [tables, setTables] = useState([]);

  // Refactored handleTableSelect to be reusable
  const handleTableSelect = async (table) => {
    setActiveTable(table);
    setOrderType('dine-in'); // Switch to dine-in when table is selected

    // Load Open Order for this Table
    try {
      const openOrder = await DataService.getOpenOrderByTable(table.id);

      if (openOrder) {
        console.log("Open Order Found:", openOrder);
        // Populate Cart
        let itemsData = openOrder.order_items;
        console.log("Initial Items Data:", itemsData);

        // Fallback: If order_items is empty/undefined but we have an order, fetch items explicitly
        if (!itemsData || itemsData.length === 0) {
          try {
            console.warn("Order items missing in payload, fetching explicitly for order:", openOrder.id);
            itemsData = await DataService.getOrderItems(openOrder.id);
            console.log("Fallback Items Data:", itemsData);
          } catch (fetchErr) {
            console.warn("Failed to fetch fallback items", fetchErr);
          }
        }

        const cartItems = (itemsData || []).map(item => ({
          id: item.id, // Use existing ID so we can track it (though we nuke on save usually)
          baseItemId: item.item_id,
          name: item.name,
          price: parseFloat(item.unit_price),
          qty: item.qty,
          total: parseFloat(item.total_price)
        }));

        const subtotal = parseFloat(openOrder.subtotal);
        const discount = parseFloat(openOrder.discount || 0);
        const grandTotal = parseFloat(openOrder.grand_total);

        // Infer extra fee: GrandTotal = Subtotal - Discount + ExtraFee
        // ExtraFee = GrandTotal - (Subtotal - Discount)
        const extraFeeRaw = grandTotal - (subtotal - discount);
        const extraFee = Math.max(0, parseFloat(extraFeeRaw.toFixed(2))); // Fix potential float precision issues

        setCurrentOrder({
          items: cartItems,
          subtotal: subtotal,
          discount: discount,
          grandTotal: grandTotal
        });

        // Restore input states so recalculation works correctly
        setDiscountInput(discount > 0 ? discount.toString() : '0');
        setDiscountType('amount'); // Default to amount as we only store value
        setExtraFeeInput(extraFee > 0 ? extraFee.toString() : '0');

        setCurrentOrderId(openOrder.id);
        setCurrentOrderNumber(parseInt(openOrder.order_no.replace('ORD', ''), 10) || currentOrderNumber);

        toast({
          title: "โหลดออเดอร์เดิม",
          description: `พบออเดอร์คงค้างสำหรับโต๊ะ ${table.label}`,
        });
      } else {
        // New Order for Table
        clearOrder();
        setDiscountInput('0');
        setExtraFeeInput('0');
        setCurrentOrderId(null); // Will create new one on save
        toast({
          title: "เริ่มรายการใหม่",
          description: `สร้างรายการใหม่สำหรับโต๊ะ ${table.label}`,
        });
      }
    } catch (err) {
      console.error("Error loading table order:", err);
      clearOrder();
    }
  };

  // Handle initial table from props (Layout navigation)
  useEffect(() => {
    if (initialTable) {
      handleTableSelect(initialTable);
      if (onTableHandled) {
        onTableHandled();
      }
    }
  }, [initialTable]);

  // Listen for table selection from Floor Plan (Window Event - Keep for compatibility)
  useEffect(() => {
    const onTableSelectEvent = (e) => {
      handleTableSelect(e.detail);
    };

    window.addEventListener('select-table', onTableSelectEvent);
    return () => window.removeEventListener('select-table', onTableSelectEvent);
  }, [currentOrderNumber]);

  const handleTableSelectionFromModal = (table) => {
    setShowTableSelectionModal(false);
    handleTableSelect(table);
  };

  // Refresh tables when modal opens
  useEffect(() => {
    if (showTableSelectionModal) {
      DataService.getTables()
        .then(data => setTables(data || []))
        .catch(err => console.error("Failed to refresh tables", err));
    }
  }, [showTableSelectionModal]);

  // Handle Order Type Change
  const handleOrderTypeChange = (type) => {
    if (type === 'take-away') {
      // Clear table info when switching to take-away
      setActiveTable(null);
      setCurrentOrderId(null);
      setOrderType('take-away');
      // We keep the cart items so user can switch mode easily
    } else {
      setOrderType('dine-in');
      if (!activeTable) {
        setShowTableSelectionModal(true);
        // toast({ title: "กรุณาเลือกโต๊ะ", description: "เลือกโต๊ะจากผังร้านค้าด้านบน" });
      }
    }
  };

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
        const [categoriesData, menuItemsData, paymentMethodsData, tablesData] = await Promise.all([
          DataService.getMenuCategories(),
          DataService.getMenuItems(),
          DataService.getPaymentMethods(),
          DataService.getTables()
        ]);

        // Filter out inactive categories
        const activeCategories = categoriesData ? categoriesData.filter(cat => cat.is_active) : [];
        // Filter out inactive menu items
        const activeMenuItems = menuItemsData ? menuItemsData.filter(item => item.is_active) : [];

        setCategories(activeCategories || []);
        setMenuItems(activeMenuItems || []);
        setPaymentMethods(paymentMethodsData || []);
        setTables(tablesData || []);

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

  const saveTableOrder = async () => {
    if (!activeTable) return;
    if (currentOrder.items.length === 0) {
      toast({ title: "ไม่สามารถบันทึกได้", description: "กรุณาเพิ่มรายการอาหารก่อนบันทึก", variant: "destructive" });
      return;
    }

    try {
      let orderId = currentOrderId;
      let orderNoStr = `ORD${String(currentOrderNumber).padStart(4, '0')}`;

      if (orderId) {
        // Update Existing Order

        // VALIDATION STEP: Check all items before modifying DB
        const itemsToSave = [];
        for (const item of currentOrder.items) {
          const info = {
            id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Generate ID client-side
            order_id: orderId,
            item_id: item.baseItemId || item.id, // Prefer baseItemId (menu_id), fallback to id if new
            name: item.name,
            qty: item.qty,
            unit_price: item.price,
            total_price: item.total,
            created_at: new Date().toISOString()
          };

          // If we have an existing item loaded from DB, item.id is the UUID of the order_item. 
          // item.baseItemId IS the menu_item id.
          // If it's a NEW item, item.id is "menuId__price". item.baseItemId is menuId.

          // CRITICAL: We need a valid menu_item ID for the FK. 
          // If baseItemId is missing, and id looks like a UUID (long string), we might fail FK if we use UUID.
          // However, if we loaded it correctly, baseItemId should be there.

          if (!info.item_id || (String(info.item_id).length > 10 && !item.baseItemId && !String(item.id).includes('__'))) {
            // Suspicious: No baseItemId, and ID looks like a UUID (long string), likely a re-save of a loaded item without baseId mapped.
            console.warn("Potential Invalid Item ID:", item);
            // We won't block strictly unless it's empty, but we log it.
          }

          itemsToSave.push(info);
        }

        // 1. Update Order Header
        await DataService.updateOrder(orderId, {
          subtotal: currentOrder.subtotal,
          grand_total: currentOrder.grandTotal,
          discount: currentOrder.discount,
          updated_at: new Date().toISOString()
        });

        // 2. Sync Items: Delete all and Re-create
        // We only delete if we have valid items to replace them with, or if the intention is to clear (itemsToSave empty is valid if user deleted all)
        await DataService.deleteOrderItems(orderId);

        // 3. Create Items
        for (const itemPayload of itemsToSave) {
          try {
            const result = await DataService.createOrderItem(itemPayload);
          } catch (createErr) {
            console.error("Failed to create item:", itemPayload, createErr);
            toast({ title: "บันทึกรายการล้มเหลว", description: `ไม่สามารถบันทึก: ${itemPayload.name}`, variant: "destructive" });
          }
        }
      } else {
        // Create New Order
        const orderData = {
          id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          order_no: orderNoStr,
          status: 'pending',
          table_id: activeTable.id,
          subtotal: currentOrder.subtotal,
          grand_total: currentOrder.grandTotal,
          created_at: new Date().toISOString()
        };

        const result = await DataService.createOrder(orderData);
        if (!result.data) throw new Error("Create failed");
        orderId = result.data.id;
        setCurrentOrderId(orderId);
        setCurrentOrderNumber(prev => prev + 1);

        // Create Items
        for (const item of currentOrder.items) {
          const itemIdToUse = item.baseItemId || item.id;

          if (!itemIdToUse) {
            console.error("Skipping item with no ID:", item);
            continue;
          }

          await DataService.createOrderItem({
            id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Generate ID
            order_id: orderId,
            item_id: itemIdToUse,
            name: item.name,
            qty: item.qty,
            unit_price: item.price,
            total_price: item.total,
            created_at: new Date().toISOString()
          });
        }
      }

      // Update Table Status
      if (activeTable.status === 'available') {
        await DataService.updateTable(activeTable.id, { status: 'occupied' });
      }

      toast({ title: "บันทึกออเดอร์สำเร็จ", description: "ส่งรายการเข้าครัวแล้ว" });
    } catch (err) {
      console.error("Save Error", err);
      toast({ title: "บันทึกไม่สำเร็จ", variant: "destructive" });
    }
  };

  const openPaymentModal = async () => {
    // Robust check: If we have an order ID and grand total > 0, but no items in memory, try to fetch them one last time.
    if (currentOrder.items.length === 0 && currentOrderId && currentOrder.grandTotal > 0) {
      toast({ title: "กำลังตรวจสอบรายการ...", description: "ไม่พบรายการอาหารในหน้าจอ กำลังดึงข้อมูลใหม่" });
      try {
        const items = await DataService.getOrderItems(currentOrderId);
        if (items && items.length > 0) {
          const mappedItems = items.map(item => ({
            id: item.id,
            baseItemId: item.item_id,
            name: item.name,
            price: parseFloat(item.unit_price),
            qty: item.qty,
            total: parseFloat(item.total_price)
          }));
          setCurrentOrder(prev => ({ ...prev, items: mappedItems }));
          // Wait a tick for state update (or proceed directly since we know it's valid)
          setTimeout(() => setShowPaymentModal(true), 100);
          return;
        }
      } catch (e) {
        console.error("Failed to recover items:", e);
      }
    }

    if (currentOrder.items.length === 0) {
      toast({ title: "ไม่พบรายการ", description: "ไม่สามารถเช็คบิลได้เนื่องจากไม่มีรายการอาหาร", variant: "destructive" });
      return;
    }
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
      // Capture state for receipt before clearing/modifying
      const orderSnapshot = { ...currentOrder };
      const paymentMethodSnapshot = selectedPaymentMethod;
      const paymentMethodName = paymentMethods.find(m => m.id === selectedPaymentMethod)?.name || selectedPaymentMethod;
      const cashReceivedSnapshot = cashReceived; // Capture cash received for receipt
      const extraFeeInputSnapshot = extraFeeInput; // Capture extra fee for receipt

      let orderId;
      let finalOrderNo;

      if (currentOrderId && activeTable) {
        // Update Existing Order
        const updates = {
          status: 'paid',
          subtotal: currentOrder.subtotal,
          grand_total: currentOrder.grandTotal,
          discount: currentOrder.discount, // Ensure discount is updated
          payment_method: selectedPaymentMethod,
          updated_at: new Date().toISOString()
        };

        if (isCash) {
          const received = parseFloat(cashReceived || '0');
          const change = Math.max(0, received - currentOrder.grandTotal);
          updates.cash_received = received;
          updates.cash_change = change;
        }

        const res = await DataService.updateOrder(currentOrderId, updates);
        if (res.error) throw new Error(res.error.message);

        orderId = currentOrderId;
        finalOrderNo = `ORD${String(currentOrderNumber).padStart(4, '0')}`; // Approximate, ideally fetch from DB

        // Sync Items: Delete all and re-create to match payment
        await DataService.deleteOrderItems(orderId);

        // Clear Table Status
        await DataService.updateTable(activeTable.id, { status: 'available' });

      } else {
        // Create New Order
        finalOrderNo = `ORD${String(currentOrderNumber).padStart(4, '0')}`;
        const orderData = {
          id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          order_no: finalOrderNo,
          status: 'paid',
          subtotal: currentOrder.subtotal,
          grand_total: currentOrder.grandTotal,
          discount: currentOrder.discount, // Ensure discount is saved
          payment_method: selectedPaymentMethod,
          branch_id: 'branch1',
          cashier_id: 'cashier1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        if (isCash) {
          const received = parseFloat(cashReceived || '0');
          const change = Math.max(0, received - currentOrder.grandTotal);
          orderData.cash_received = received;
          orderData.cash_change = change;
        }

        const orderResult = await DataService.createOrder(orderData);
        if (orderResult.error) {
          console.error('Failed to create order:', orderResult.error);
          toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถสร้างออเดอร์ได้ กรุณาลองใหม่อีกครั้ง', variant: "destructive" });
          throw new Error('Failed to create order: ' + orderResult.error.message);
        }
        orderId = orderResult.data.id;
      }

      // Create order items
      for (const item of currentOrder.items) {
        const orderItemData = {
          id: `order_item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          order_id: orderId,
          item_id: item.baseItemId || item.id,
          name: item.name,
          qty: item.qty,
          unit_price: item.price,
          total_price: item.total,
          created_at: new Date().toISOString()
        };

        const itemResult = await DataService.createOrderItem(orderItemData);
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
        const W = 900;
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
          img.onerror = () => resolve(null); // Handle error
        });
        const logoSize = 140;
        if (logoImg) {
          ctx.drawImage(logoImg, W / 2 - logoSize / 2, y, logoSize, logoSize);
        }
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
        drawLeft(`เลขที่ออร์เดอร์: ${finalOrderNo}`, cardPad + 60, y, '600 18px ui-sans-serif');
        drawRight(new Date().toLocaleString('th-TH'), W - cardPad - 60, y, '16px ui-sans-serif');
        y += 26;
        drawLeft(`วิธีชำระเงิน: ${paymentMethodName}`, cardPad + 60, y);
        y += 26;

        // Cash in/out if cash
        if (isCash) {
          const received = parseFloat(cashReceivedSnapshot || '0');
          const change = Math.max(0, received - orderSnapshot.grandTotal);
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
        orderSnapshot.items.forEach((it) => {
          drawLeft(`${it.name} x${it.qty} @${formatCurrency(it.price)}`, cardPad + 60, y);
          drawRight(`${formatCurrency(it.total)}`, W - cardPad - 60, y);
          y += 22;
        });

        y += 6; hr(y); y += 24;

        // Totals
        drawLeft('ยอดรวม', cardPad + 60, y, '600 18px ui-sans-serif');
        drawRight(`${formatCurrency(orderSnapshot.subtotal)}`, W - cardPad - 60, y, '600 18px ui-sans-serif');
        y += 26;
        drawLeft('ส่วนลด', cardPad + 60, y);
        drawRight(`-${formatCurrency(orderSnapshot.discount)}`, W - cardPad - 60, y);
        y += 22;
        const extraFee = Math.max(0, parseFloat(extraFeeInputSnapshot) || 0);
        drawLeft('ค่าอื่น ๆ', cardPad + 60, y);
        drawRight(`${formatCurrency(extraFee)}`, W - cardPad - 60, y);
        y += 26;
        hr(y); y += 30;
        drawLeft('ยอดสุทธิ', cardPad + 60, y, '700 22px ui-sans-serif');
        drawRight(`${formatCurrency(orderSnapshot.grandTotal)}`, W - cardPad - 60, y, '700 22px ui-sans-serif');
        y += 36;

        // Footer message
        drawCentered('ขอบคุณที่อุดหนุนครับ/ค่ะ ❤️', y + 10, '600 18px ui-sans-serif');

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (blob) {
          const formData = new FormData();
          formData.append('file', new File([blob], `${finalOrderNo}.png`, { type: 'image/png' }));
          formData.append('folder', 'receipts');
          const uploadRes = await (await import('../services/apiClient')).default.post('/storage/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          const receiptUrl = uploadRes?.data?.publicUrl;
          if (receiptUrl) {
            await DataService.updateOrder(orderId, { receipt_url: receiptUrl });
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
                  <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                    ระบบขายหน้าร้าน (POS)
                    {activeTable && (
                      <Badge variant="default" className="text-lg px-3 py-1 bg-primary animate-in fade-in zoom-in">
                        <Armchair className="w-4 h-4 mr-2" />
                        โต๊ะ {activeTable.label}
                      </Badge>
                    )}
                  </h1>
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
              <div className="flex justify-between items-center mb-4">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5" /> ออเดอร์ปัจจุบัน
                </CardTitle>
                {currentOrder.items.length > 0 && (
                  <Badge variant="secondary" className="font-mono text-base">
                    #{`ORD${String(currentOrderNumber).padStart(4, '0')}`}
                  </Badge>
                )}
              </div>

              {/* Order Mode Toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
                <Button
                  variant={orderType === 'dine-in' ? "default" : "ghost"}
                  className={cn("rounded-md transition-all", orderType === 'dine-in' && "shadow-sm")}
                  onClick={() => handleOrderTypeChange('dine-in')}
                >
                  <Armchair className="w-4 h-4 mr-2" /> ทานที่ร้าน
                </Button>
                <Button
                  variant={orderType === 'take-away' ? "default" : "ghost"}
                  className={cn("rounded-md transition-all", orderType === 'take-away' && "shadow-sm")}
                  onClick={() => handleOrderTypeChange('take-away')}
                >
                  <ShoppingBag className="w-4 h-4 mr-2" /> กลับบ้าน/รับเอง
                </Button>
              </div>

              {orderType === 'dine-in' && !activeTable && (
                <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 text-amber-700 rounded-lg text-sm flex items-center justify-center animate-pulse cursor-pointer hover:bg-amber-500/20" onClick={() => setShowTableSelectionModal(true)}>
                  กรุณาเลือกโต๊ะ (คลิกที่นี่)
                </div>
              )}

              {orderType === 'dine-in' && activeTable && (
                <div className="mt-2 flex items-center justify-between p-2 bg-primary/10 border border-primary/20 rounded-lg">
                  <span className="text-sm font-semibold flex items-center gap-2">
                    <Armchair className="w-4 h-4" /> โต๊ะ: <span className="text-lg text-primary">{activeTable.label}</span>
                  </span>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowTableSelectionModal(true)}>
                    เปลี่ยน
                  </Button>
                </div>
              )}
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

                {orderType === 'dine-in' ? (
                  <div className="col-span-2 flex gap-2">
                    {!currentOrderId ? (
                      <Button
                        className="w-full h-12 text-lg font-bold shadow-md shadow-green-500/20 min-w-0"
                        variant="success"
                        onClick={saveTableOrder}
                        disabled={currentOrder.items.length === 0 || !activeTable}
                      >
                        <Save className="mr-2 h-5 w-5 shrink-0" /> <span className="truncate">ยืนยันออเดอร์</span>
                      </Button>
                    ) : (
                      <Button
                        className="w-full h-12 text-lg font-bold shadow-lg shadow-green-500/20 min-w-0"
                        size="lg"
                        variant="success"
                        onClick={openPaymentModal}
                      >
                        <CreditCard className="mr-2 h-5 w-5 shrink-0" />
                        <span className="truncate">เช็คบิล</span>
                      </Button>
                    )}
                  </div>
                ) : (
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
                )}
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
      {/* Table Selection Modal */}
      <Dialog open={showTableSelectionModal} onOpenChange={setShowTableSelectionModal}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Armchair className="w-6 h-6 text-primary" /> เลือกโต๊ะสำหรับออเดอร์
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 py-4 max-h-[60vh] overflow-y-auto">
            {tables.map(table => (
              <Button
                key={table.id}
                variant={table.status === 'occupied' ? "secondary" : "outline"}
                className={cn(
                  "h-24 flex flex-col gap-2 relative border-2",
                  table.status === 'occupied' ? "border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20" : "border-primary/20 hover:border-primary hover:bg-primary/5",
                  activeTable?.id === table.id && "ring-2 ring-primary ring-offset-2 border-primary"
                )}
                onClick={() => handleTableSelectionFromModal(table)}
              >
                <span className="text-xl font-bold">{table.label}</span>
                <Badge variant={table.status === 'occupied' ? "warning" : "success"} className="text-[10px] px-1 py-0 h-5">
                  {table.status === 'occupied' ? 'ไม่ว่าง' : 'ว่าง'}
                </Badge>
              </Button>
            ))}
            {tables.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                ยังไม่มีข้อมูลโต๊ะ
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowTableSelectionModal(false)}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POS;