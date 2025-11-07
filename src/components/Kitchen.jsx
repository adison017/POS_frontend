import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getOrders, getOrderItems, getKitchenTickets, updateKitchenTicket, getMenuItems } from '../services/dataService';
import socketService from '../services/socket';

const PurchaseHistory = () => {
  const [orders, setOrders] = useState([]);
  const [orderItemsMap, setOrderItemsMap] = useState({});
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [kitchenTickets, setKitchenTickets] = useState([]);
  const [menuItems, setMenuItems] = useState([]); // Add state for menu items
  const [receiptPreviewMap, setReceiptPreviewMap] = useState({}); // orderId -> boolean

  // โหลด Orders
  useEffect(() => {
    const loadData = async () => {
      try {
        const ordersData = await getOrders();
        setOrders(Array.isArray(ordersData) ? ordersData.filter(Boolean) : []);
      } catch (error) {
        console.error('Error loading orders:', error);
        setOrders([]);
      }
    };

    loadData();
  }, []);

  // โหลด Menu Items
  useEffect(() => {
    const loadMenuItems = async () => {
      try {
        const menuItemsData = await getMenuItems();
        setMenuItems(Array.isArray(menuItemsData) ? menuItemsData.filter(Boolean) : []);
      } catch (error) {
        console.error('Error loading menu items:', error);
        setMenuItems([]);
      }
    };

    loadMenuItems();
  }, []);

  // โหลด Order Items ต่อเมื่อมี orders
  useEffect(() => {
    const loadOrderItems = async () => {
      if (!Array.isArray(orders) || orders.length === 0) {
        setOrderItemsMap({});
        return;
      }

      try {
        const itemsMap = {};
        for (const order of orders.filter(Boolean)) {
          if (!order?.id) continue;
          const items = await getOrderItems(order.id);
          itemsMap[order.id] = Array.isArray(items) ? items.filter(Boolean) : [];
        }
        setOrderItemsMap(itemsMap);
      } catch (error) {
        console.error('Error loading order items:', error);
        setOrderItemsMap({});
      }
    };

    loadOrderItems();
  }, [orders]);

  // โหลด Kitchen Tickets
  useEffect(() => {
    const loadKitchenTickets = async () => {
      try {
        const tickets = await getKitchenTickets();
        setKitchenTickets(Array.isArray(tickets) ? tickets.filter(Boolean) : []);
      } catch (error) {
        console.error('Error loading kitchen tickets:', error);
        setKitchenTickets([]);
      }
    };

    loadKitchenTickets();
    const socket = socketService.connectSocket();
    socket.on('kitchen-ticket:created', (ticket) => {
      setKitchenTickets((prev) => [ticket, ...prev]);
    });
    socket.on('kitchen-ticket:updated', (ticket) => {
      setKitchenTickets((prev) => prev.map((t) => (t.id === ticket.id ? ticket : t)));
    });
    socket.on('order:created', async () => {
      try {
        const ordersData = await getOrders();
        setOrders(Array.isArray(ordersData) ? ordersData.filter(Boolean) : []);
      } catch {}
    });

    return () => {
      socket.off('kitchen-ticket:created');
      socket.off('kitchen-ticket:updated');
      socket.off('order:created');
    };
  }, []);

  // กรองคำสั่งซื้อตามวันที่
  useEffect(() => {
    const filterOrders = () => {
      const now = new Date();
      let filtered = [...orders];

      switch (dateFilter) {
        case 'today':
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          filtered = orders.filter(order => {
            const orderDate = new Date(order.created_at);
            return orderDate >= today;
          });
          break;
        case 'week':
          const weekAgo = new Date(now);
          weekAgo.setDate(now.getDate() - 7);
          filtered = orders.filter(order => {
            const orderDate = new Date(order.created_at);
            return orderDate >= weekAgo;
          });
          break;
        case 'month':
          const monthAgo = new Date(now);
          monthAgo.setMonth(now.getMonth() - 1);
          filtered = orders.filter(order => {
            const orderDate = new Date(order.created_at);
            return orderDate >= monthAgo;
          });
          break;
        case 'custom':
          if (customStartDate && customEndDate) {
            const start = new Date(customStartDate);
            const end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999); // ตั้งเวลาสิ้นสุดเป็นสิ้นวัน
            
            filtered = orders.filter(order => {
              const orderDate = new Date(order.created_at);
              return orderDate >= start && orderDate <= end;
            });
          }
          break;
        default:
          // แสดงทั้งหมด
          break;
      }

      setFilteredOrders(filtered);
    };

    filterOrders();
  }, [orders, dateFilter, customStartDate, customEndDate]);

  const getStatusText = (status) => {
    const texts = {
      pending: 'รอดำเนินการ',
      paid: 'ชำระเงินแล้ว',
      cancelled: 'ยกเลิก',
    };
    return texts[status] ?? status ?? '-';
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      pending: 'bg-amber-100 text-amber-800 border-amber-200',
      paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      cancelled: 'bg-rose-100 text-rose-800 border-rose-200',
    };
    return classes[status] || 'bg-gray-100 text-gray-800 border-gray-200';
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

  const getPaymentMethodBadgeClass = (method) => {
    const classes = {
      pm_cash: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      pm_credit: 'bg-blue-100 text-blue-800 border-blue-200',
      pm_debit: 'bg-blue-100 text-blue-800 border-blue-200',
      pm_qr: 'bg-violet-100 text-violet-800 border-violet-200',
      cash: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      transfer: 'bg-blue-100 text-blue-800 border-blue-200',
      promptpay: 'bg-violet-100 text-violet-800 border-violet-200'
    };
    return classes[method] || 'bg-gray-100 text-gray-800 border-gray-200';
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

  const toggleReceiptPreview = (orderId) => {
    setReceiptPreviewMap((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const downloadReceipt = async (orderNo, url) => {
    try {
      const res = await fetch(url, { credentials: 'omit' });
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${orderNo || 'receipt'}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      console.error('Download receipt failed', e);
      toast.error('ไม่สามารถดาวน์โหลดสลิปได้');
    }
  };

  const formatCurrency = (amount) => {
    return `฿${amount?.toFixed(2) || '0.00'}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const safeTickets = (kitchenTickets ?? []).filter(Boolean);
      const ticket = safeTickets.find((t) => t?.order_id === orderId);

      if (ticket?.id) {
        const updates = {
          status: newStatus,
          updated_at: new Date().toISOString(),
        };

        if (newStatus === 'in_progress' && !ticket.started_at) {
          updates.started_at = new Date().toISOString();
        } else if (newStatus === 'done' && !ticket.finished_at) {
          updates.finished_at = new Date().toISOString();
        }

        const result = await updateKitchenTicket(ticket.id, updates);
        if (!result?.error && result?.data) {
          setKitchenTickets((prev) =>
            (prev ?? []).map((t) => (t?.id === ticket.id ? result.data : t)).filter(Boolean)
          );
          toast.success('อัปเดตสถานะออเดอร์เรียบร้อยแล้ว');
        } else {
          console.error('updateKitchenTicket error:', result?.error);
          toast.error('ไม่สามารถอัปเดตสถานะออเดอร์ได้');
        }
      } else {
        // ยังไม่มี ticket → เพิ่มใน state ชั่วคราว (ถ้ามี createKitchenTicket ค่อยเปลี่ยนไปเรียก Supabase)
        const now = new Date().toISOString();
        const newTicket = {
          id: `ticket_${Date.now()}`,
          order_id: orderId,
          status: newStatus,
          created_at: now,
          updated_at: now,
          ...(newStatus === 'in_progress' ? { started_at: now } : {}),
          ...(newStatus === 'done' ? { finished_at: now } : {}),
        };

        setKitchenTickets((prev) => [...(prev ?? []), newTicket]);
        toast.success('อัปเดตสถานะออเดอร์เรียบร้อยแล้ว');
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('เกิดข้อผิดพลาดในการอัปเดตสถานะออเดอร์');
    }
  };

  // Function to get menu item by ID
  const getMenuItemById = (itemId) => {
    return menuItems.find(item => item.id === itemId);
  };

  return (
    <div id="purchaseHistorySection" className="p-4 md:p-6">
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-800">ประวัติการซื้อ</h2>
          
          {/* ตัวกรองวันที่ */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium text-gray-600">กรองตามวันที่:</span>
            <select 
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">ทั้งหมด</option>
              <option value="today">วันนี้</option>
              <option value="week">7 วันที่แล้ว</option>
              <option value="month">30 วันที่แล้ว</option>
              <option value="custom">กำหนดเอง</option>
            </select>
            
            {dateFilter === 'custom' && (
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <span className="text-gray-500">ถึง</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {filteredOrders.length === 0 ? (
            <div className="col-span-full text-center py-16">
              <div className="text-gray-400 mb-4">
                <svg className="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">ไม่มีประวัติการซื้อ</h3>
              <p className="text-gray-500">ไม่พบคำสั่งซื้อที่ตรงกับเงื่อนไขการกรอง</p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const oid = order?.id;
              const orderItems = (orderItemsMap?.[oid] ?? []).filter(Boolean);
              
              // ป้องกัน key/field ขาด
              const orderNo = order?.order_no ?? oid ?? '-';
              const status = order?.status ?? 'pending';
              const createdAtText = formatDate(order?.created_at);
              const grandTotal = order?.grand_total ?? 0;
              
              return (
                <div
                  key={oid ?? Math.random()}
                  className="border border-gray-200 rounded-xl p-5 shadow-sm transition-all duration-200 hover:shadow-md"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-gray-800">ออเดอร์ #{orderNo}</h3>
                      <p className="text-sm text-gray-500">{createdAtText}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadgeClass(status)}`}>
                        {getStatusText(status)}
                      </span>
                      <span className="font-bold text-lg text-gray-800">{formatCurrency(grandTotal)}</span>
                      {order?.receipt_url && (
                        <button
                          onClick={() => toggleReceiptPreview(oid)}
                          className="px-3 py-1.5 text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200"
                        >
                          {receiptPreviewMap[oid] ? 'ซ่อนสลิป' : 'ดูสลิป'}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Payment Method Display */}
                  {order?.payment_method && (
                    <div className="mb-3">
                      <div className="flex items-center">
                        <span className="text-xs text-gray-500 mr-2">วิธีการชำระเงิน:</span>
                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPaymentMethodBadgeClass(order.payment_method)}`}>
                          <span className="mr-1">
                            {getPaymentMethodIcon(order.payment_method)}
                          </span>
                          {getPaymentMethodName(order.payment_method)}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-3 mb-4">
                    {orderItems.length > 0 ? (
                      orderItems.map((item) => {
                        // Get the menu item to access the image_url
                        const menuItem = getMenuItemById(item?.item_id);
                        const imageUrl = menuItem?.image_url;
                        
                        return (
                          <div
                            key={item?.id ?? Math.random()}
                            className="flex items-center py-2 border-b border-gray-100 last:border-0"
                          >
                            {imageUrl ? (
                              <img 
                                src={imageUrl} 
                                alt={item.name}
                                className="w-12 h-12 object-cover rounded-lg mr-3"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.parentElement.innerHTML = `
                                    <div class="w-12 h-12 bg-gray-100 rounded-lg mr-3 flex items-center justify-center">
                                      <svg class="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                      </svg>
                                    </div>
                                  `;
                                }}
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-100 rounded-lg mr-3 flex items-center justify-center">
                                <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-700 truncate">{item?.name || 'ไม่พบชื่อเมนู'}</div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-600 text-sm">x{item?.qty ?? 0}</span>
                                <span className="font-bold text-gray-800">{formatCurrency(item?.total_price)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-gray-500 text-center py-2">ไม่มีรายการอาหาร</p>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                    <div className="text-sm text-gray-500">
                      จำนวน {orderItems.length} รายการ
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">รวมทั้งหมด</div>
                      <div className="font-bold text-lg text-gray-800">{formatCurrency(grandTotal)}</div>
                    </div>
                  </div>

                  {/* Inline receipt preview */}
                  {order?.receipt_url && receiptPreviewMap[oid] && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-gray-600">สลิปการชำระเงิน</div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => downloadReceipt(orderNo, order.receipt_url)}
                            className="px-3 py-1.5 text-sm bg-white hover:bg-gray-50 text-gray-700 rounded-lg border border-gray-200"
                          >
                            ดาวน์โหลด
                          </button>
                        </div>
                      </div>
                      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                        <img
                          src={order.receipt_url}
                          alt={`receipt-${orderNo}`}
                          className="w-full h-auto max-h-[70vh] object-contain"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.parentElement.innerHTML = '<div class="p-6 text-center text-gray-400">ไม่สามารถแสดงสลิปได้</div>';
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default PurchaseHistory;