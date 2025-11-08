import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import * as DataService from '../services/dataService';
import socketService from '../services/socket';
import shopLogo from '../logo.png';

const POS = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
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
      toast.error('ไม่สามารถดาวน์โหลดสลิปได้');
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
      toast.error('ไม่สามารถพิมพ์สลิปได้');
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
        
        setCategories(categoriesData || []);
        setMenuItems(menuItemsData || []);
        setPaymentMethods(paymentMethodsData || []);
        
        // Set default payment method if available
        if (paymentMethodsData && paymentMethodsData.length > 0) {
          setSelectedPaymentMethod(paymentMethodsData[0].id);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('ไม่สามารถโหลดข้อมูลได้');
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

  const filteredMenuItems = selectedCategory === 'all' 
    ? menuItems 
    : menuItems.filter(item => item.category_id === selectedCategory);

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
      toast.error('กรุณาเลือกวิธีการชำระเงิน');
      return;
    }

    const selectedMethod = paymentMethods.find(m => m.id === selectedPaymentMethod);
    const isCash = selectedMethod?.id === 'pm_cash' || selectedMethod?.id === 'cash' ||
      selectedMethod?.name?.toLowerCase?.().includes('cash') || selectedMethod?.name?.includes('เงินสด');

    if (isCash) {
      const received = parseFloat(cashReceived || '0');
      if (!isFinite(received) || received < currentOrder.grandTotal) {
        toast.error('จำนวนเงินที่รับมาต้องมากกว่าหรือเท่ากับยอดชำระ');
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
        toast.error('ไม่สามารถสร้างออเดอร์ได้ กรุณาลองใหม่อีกครั้ง');
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
          toast.error('ไม่สามารถบันทึกรายการอาหารได้ กรุณาลองใหม่อีกครั้ง');
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

      toast.success('ชำระเงินเรียบร้อยแล้ว!');
    } catch (error) {
      console.error('Payment processing error:', error);
      toast.error('เกิดข้อผิดพลาดในการชำระเงิน กรุณาลองใหม่อีกครั้ง');
    }
  };

  const formatCurrency = (amount) => {
    return `฿${amount.toFixed(2)}`;
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">ระบบขายหน้าร้าน (POS)</h1>
          <p className="text-gray-600">จัดการออเดอร์และชำระเงินอย่างรวดเร็ว</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-full">
          {/* Menu Section */}
          <div className="xl:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg p-6 h-full">
              {/* Category Filter */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">เมนูอาหาร</h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                      selectedCategory === 'all'
                        ? 'bg-indigo-500 text-white shadow-md shadow-indigo-200'
                        : 'bg-white text-gray-700 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
                    }`}
                  >
                    ทั้งหมด
                  </button>
                  {categories.map(category => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                        selectedCategory === category.id
                          ? 'bg-indigo-500 text-white shadow-md shadow-indigo-200'
                          : 'bg-white text-gray-700 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Menu Items Grid */}
              {filteredMenuItems.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-gray-300 mb-4">
                    <svg className="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">ไม่มีรายการเมนู</h3>
                  <p className="text-gray-500">กรุณาเพิ่มเมนูในหน้า "เมนู"</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[calc(100vh-280px)] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredMenuItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => addToOrder(item.id)}
                      className="bg-white rounded-2xl p-4 text-left border border-gray-100 hover:border-indigo-300 hover:shadow-lg transition-all duration-300 group relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      
                      {item.image_url ? (
                        <img 
                          src={item.image_url} 
                          alt={item.name}
                          className="w-full h-28 object-cover rounded-xl mb-3 group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-28 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl mb-3 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                          <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                          </svg>
                        </div>
                      )}
                      
                      <div className="relative z-10">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-gray-800 group-hover:text-indigo-600 text-sm leading-tight flex-1 mr-2">{item.name}</h3>
                          <span className="font-bold text-lg text-emerald-600 whitespace-nowrap">{formatCurrency(item.price)}</span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{item.description || 'ไม่มีคำอธิบาย'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Order Section */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 h-full flex flex-col">
              {/* Order Header */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">ออเดอร์ปัจจุบัน</h2>
                {currentOrder.items.length > 0 && (
                  <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white px-3 py-1.5 rounded-full text-sm font-bold shadow-md">
                    #{`ORD${String(currentOrderNumber).padStart(4, '0')}`}
                  </div>
                )}
              </div>
              
              {currentOrder.items.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                  <div className="text-gray-200 mb-6">
                    <svg className="w-24 h-24 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">ยังไม่มีรายการ</h3>
                  <p className="text-gray-500 mb-4">เพิ่มรายการจากเมนูด้านซ้าย</p>
                  <div className="text-gray-400 text-sm">
                    คลิกที่เมนูอาหารเพื่อเพิ่มลงในออเดอร์
                  </div>
                </div>
              ) : (
                <>
                  {/* Order Items */}
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar mb-6">
                    {currentOrder.items.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 bg-gray-50 rounded-xl mb-3 last:mb-0 border border-gray-100 hover:border-gray-200 transition-colors duration-200"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-semibold text-gray-800 truncate pr-2 flex-1 min-w-0">{item.name}</h3>
                          <span className="font-bold text-gray-800 text-lg whitespace-nowrap">{formatCurrency(item.total)}</span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {/* Qty controls */}
                          <div className="flex items-center justify-between sm:justify-start gap-3">
                            <span className="text-sm text-gray-500 whitespace-nowrap">{formatCurrency(item.price)} × {item.qty}</span>
                            <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden">
                              <button
                                onClick={() => updateItemQuantity(item.id, 'decrease')}
                                className="p-2 text-gray-600 hover:bg-gray-100 transition-colors duration-200"
                                aria-label="decrease quantity"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"/></svg>
                              </button>
                              <span className="px-3 py-1 text-sm font-bold text-gray-700 min-w-8 text-center">{item.qty}</span>
                              <button
                                onClick={() => updateItemQuantity(item.id, 'increase')}
                                className="p-2 text-gray-600 hover:bg-gray-100 transition-colors duration-200"
                                aria-label="increase quantity"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                              </button>
                            </div>
                          </div>
                          {/* Quick price adjust moved to bottom */}
                          <div className="flex items-center flex-wrap gap-1 justify-end sm:justify-start">
                            <span className="text-sm text-gray-400 mr-1">ปรับราคา:</span>
                            <button onClick={() => adjustLinePrice(item.id, -10)} className="px-2 py-1 text-xs bg-white hover:bg-gray-100 rounded border border-gray-200">-10</button>
                            <button onClick={() => adjustLinePrice(item.id, -5)} className="px-2 py-1 text-xs bg-white hover:bg-gray-100 rounded border border-gray-200">-5</button>
                            <button onClick={() => adjustLinePrice(item.id, 5)} className="px-2 py-1 text-xs bg-white hover:bg-gray-100 rounded border border-gray-200">+5</button>
                            <button onClick={() => adjustLinePrice(item.id, 10)} className="px-2 py-1 text-xs bg-white hover:bg-gray-100 rounded border border-gray-200">+10</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Order Summary */}
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 mb-6 border border-gray-200">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">รวมย่อย:</span>
                        <span className="font-semibold text-gray-800">{formatCurrency(currentOrder.subtotal)}</span>
                      </div>
                      {/* Adjustments */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">ส่วนลด</label>
                          <div className="flex items-stretch gap-2">
                            <input
                              type="number"
                              step="0.01"
                              value={discountInput}
                              onChange={(e) => setDiscountInput(e.target.value)}
                              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              placeholder="0"
                            />
                            <select
                              value={discountType}
                              onChange={(e) => setDiscountType(e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              aria-label="หน่วยส่วนลด"
                            >
                              <option value="amount">บาท</option>
                              <option value="percent">%</option>
                            </select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">ค่าอื่น ๆ</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.01"
                              value={extraFeeInput}
                              onChange={(e) => setExtraFeeInput(e.target.value)}
                              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              placeholder="เช่น ค่าบริการ"
                            />
                            <span className="text-gray-600 text-sm">บาท</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">ส่วนลด:</span>
                        <span className="font-semibold text-red-500">-{formatCurrency(currentOrder.discount)}</span>
                      </div>
                      {parseFloat(extraFeeInput) > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">ค่าอื่น ๆ:</span>
                          <span className="font-semibold text-gray-800">{formatCurrency(Math.max(0, parseFloat(extraFeeInput) || 0))}</span>
                        </div>
                      )}
                      <div className="border-t border-gray-300 pt-3 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold text-gray-800">รวมทั้งหมด:</span>
                          <span className="text-2xl font-bold text-emerald-600">{formatCurrency(currentOrder.grandTotal)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-3">
                    <button 
                      onClick={clearOrder}
                      className="flex-1 py-4 px-6 bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700 rounded-xl font-bold hover:from-gray-200 hover:to-gray-300 transition-all duration-300 shadow hover:shadow-md border border-gray-200"
                    >
                      ล้างออเดอร์
                    </button>
                    <button 
                      onClick={openPaymentModal}
                      className="flex-1 py-4 px-6 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-bold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      ชำระเงิน
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md transform animate-scale-in border border-gray-200">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-bold text-gray-800">ชำระเงิน</h3>
              <button 
                onClick={closePaymentModal}
                className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-2 hover:bg-gray-100 rounded-xl"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <div className="mb-8">
              <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-2xl p-6 mb-6 text-center">
                <div className="text-sm opacity-90 mb-1">ออเดอร์ #</div>
                <div className="text-2xl font-bold mb-2">{`ORD${String(currentOrderNumber).padStart(4, '0')}`}</div>
                <div className="text-3xl font-bold">{formatCurrency(currentOrder.grandTotal)}</div>
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-4">เลือกวิธีการชำระเงิน</label>
                <div className="grid grid-cols-2 gap-3">
                  {paymentMethods.map(method => (
                    <button
                      key={method.id}
                      onClick={() => setSelectedPaymentMethod(method.id)}
                      className={`p-4 rounded-xl border-2 text-center transition-all duration-300 ${
                        selectedPaymentMethod === method.id
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold shadow-md scale-105'
                          : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700'
                      }`}
                    >
                      {method.name}
                    </button>
                  ))}
                </div>
              </div>

            {/* Cash section: amount received and change */}
            {(() => {
              const m = paymentMethods.find(pm => pm.id === selectedPaymentMethod);
              const isCash = m?.id === 'pm_cash' || m?.id === 'cash' || m?.name?.toLowerCase?.().includes('cash') || m?.name?.includes('เงินสด');
              if (!isCash) return null;
              const received = parseFloat(cashReceived || '0');
              const change = isFinite(received) ? Math.max(0, received - currentOrder.grandTotal) : 0;
              const isEnough = isFinite(received) && received >= currentOrder.grandTotal;
              const boxClass = isEnough ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200';
              const amountClass = isEnough ? 'text-emerald-700' : 'text-amber-700';
              return (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">รับเงินมา</label>
                  <div className="flex items-stretch gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="0.00"
                    />
                    <span className="px-3 py-2 text-gray-600 bg-gray-50 border border-gray-200 rounded-lg">บาท</span>
                  </div>
                  <div className={`mt-3 flex items-center justify-between rounded-xl px-4 py-3 border ${boxClass}`}>
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <svg className={`w-5 h-5 ${isEnough ? 'text-emerald-600' : 'text-amber-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      <span>{isEnough ? 'เงินทอน' : 'รับเงินไม่พอ'}</span>
                    </div>
                    <span className={`font-extrabold text-2xl ${amountClass}`}>{formatCurrency(change)}</span>
                  </div>
                </div>
              );
            })()}
            </div>

            <div className="flex space-x-4">
              <button 
                onClick={closePaymentModal}
                className="flex-1 py-4 px-6 bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700 rounded-xl font-bold hover:from-gray-200 hover:to-gray-300 transition-all duration-300 shadow border border-gray-200"
              >
                ยกเลิก
              </button>
              <button 
                onClick={processPayment}
                className="flex-1 py-4 px-6 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-bold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={(() => {
                  const m = paymentMethods.find(pm => pm.id === selectedPaymentMethod);
                  const isCash = m?.id === 'pm_cash' || m?.id === 'cash' || m?.name?.toLowerCase?.().includes('cash') || m?.name?.includes('เงินสด');
                  if (!isCash) return false;
                  const received = parseFloat(cashReceived || '0');
                  return !(isFinite(received) && received >= currentOrder.grandTotal);
                })()}
              >
                ยืนยันการชำระ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Price quick adjust handled inline per line item; no dialog */}

      {/* Receipt Preview Modal */}
      {showReceiptModal && receiptPreviewUrl && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-4 w-full max-w-xl border border-gray-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold text-gray-800">สลิปการชำระเงิน</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrintReceipt(receiptPreviewUrl)}
                  className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold"
                >
                  พิมพ์
                </button>
                <button
                  onClick={() => handleDownloadReceipt(`receipt_${String(currentOrderNumber - 1).padStart(4, '0')}`, receiptPreviewUrl)}
                  className="px-3 py-1.5 text-sm bg-white hover:bg-gray-50 text-gray-700 rounded-lg border border-gray-200 font-bold"
                >
                  ดาวน์โหลด
                </button>
                <a
                  href={receiptPreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold"
                >
                  เปิดในแท็บใหม่
                </a>
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                  aria-label="close receipt"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              <img src={receiptPreviewUrl} alt="receipt" className="w-full h-auto rounded-lg border border-gray-200" />
            </div>
          </div>
        </div>
      )}

      {/* Custom Scrollbar Styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .animate-scale-in {
          animation: scaleIn 0.2s ease-out;
        }
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export default POS;