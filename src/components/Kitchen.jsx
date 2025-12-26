import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { getOrdersPage, getOrderItems, getKitchenTickets, updateKitchenTicket, getMenuItems } from '../services/dataService';
import socketService from '../services/socket';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CreditCard, Banknote, QrCode, FileText, Download, Clock, CheckCircle, XCircle, Search, Calendar, Filter, Archive
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PurchaseHistory = () => {
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [orderItemsMap, setOrderItemsMap] = useState({});
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [kitchenTickets, setKitchenTickets] = useState([]);
  const [menuItems, setMenuItems] = useState([]); // Add state for menu items
  const [receiptPreviewMap, setReceiptPreviewMap] = useState({}); // orderId -> boolean

  // Infinite scroll states
  const [ordersPage, setOrdersPage] = useState(0);
  const [hasMoreOrders, setHasMoreOrders] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // โหลด Menu Items
  useEffect(() => {
    const loadMenuItems = async () => {
      try {
        const menuItemsData = await getMenuItems();
        const validMenuItems = Array.isArray(menuItemsData) ? menuItemsData.filter(Boolean) : [];
        setMenuItems(validMenuItems);
      } catch (error) {
        console.error('Error loading menu items:', error);
        toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถโหลดข้อมูลเมนูได้', variant: "destructive" });
        setMenuItems([]);
      }
    };

    loadMenuItems();
  }, []);

  // โหลด Orders with infinite scroll
  const loadOrders = useCallback(async (page = 0) => {
    if (loadingOrders) return;

    setLoadingOrders(true);
    try {
      const limit = 20; // Load 20 orders at a time
      const offset = page * limit;

      const ordersData = await getOrdersPage({ limit, offset });

      // Ensure we have arrays before setting state
      const validOrders = Array.isArray(ordersData) ? ordersData.filter(Boolean) : [];

      if (page === 0) {
        setOrders(validOrders);
      } else {
        setOrders(prev => [...prev, ...validOrders]);
      }

      setHasMoreOrders(validOrders.length === limit);
      setOrdersPage(page);

      // Load order items for new orders
      if (validOrders.length > 0) {
        const itemsArrays = await Promise.all(
          validOrders.map((order) => getOrderItems(order.id))
        );

        // Create items map
        const newItemsMap = { ...orderItemsMap };
        validOrders.forEach((order, index) => {
          const items = itemsArrays[index] || [];
          newItemsMap[order.id] = Array.isArray(items) ? items.filter(Boolean) : [];
        });

        setOrderItemsMap(newItemsMap);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถโหลดข้อมูลคำสั่งซื้อได้', variant: "destructive" });
      setHasMoreOrders(false);
    } finally {
      setLoadingOrders(false);
    }
  }, [loadingOrders, orderItemsMap]);

  // โหลด Orders ครั้งแรก - add error handling
  useEffect(() => {
    let isMounted = true;

    const loadInitialOrders = async () => {
      try {
        if (isMounted) {
          await loadOrders(0);
        }
      } catch (error) {
        console.error('Error loading initial orders:', error);
        if (isMounted) {
          toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถโหลดข้อมูลคำสั่งซื้อได้', variant: "destructive" });
        }
      }
    };

    loadInitialOrders();

    return () => {
      isMounted = false;
    };
  }, [loadOrders]);

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (!hasMoreOrders || loadingOrders) return;

    const scrollTop = document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;

    // Load more when user is 100px from bottom
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      loadOrders(ordersPage + 1);
    }
  }, [hasMoreOrders, loadingOrders, ordersPage, loadOrders]);

  // Add scroll event listener
  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // โหลด Kitchen Tickets
  useEffect(() => {
    const loadKitchenTickets = async () => {
      try {
        const tickets = await getKitchenTickets();
        const validTickets = Array.isArray(tickets) ? tickets.filter(Boolean) : [];
        setKitchenTickets(validTickets);
      } catch (error) {
        console.error('Error loading kitchen tickets:', error);
        toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถโหลดข้อมูลตั๋วครัวได้', variant: "destructive" });
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
        // Reload only recent orders to maintain performance
        const ordersData = await getOrdersPage({ limit: 20, offset: 0 });
        const validOrders = Array.isArray(ordersData) ? ordersData.filter(Boolean) : [];
        setOrders(validOrders);
      } catch (error) {
        console.error('Error reloading orders:', error);
      }
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

  const getStatusBadgeVariant = (status) => {
    const variants = {
      pending: 'secondary', // amber-like usually custom needed
      paid: 'default', // primary color (usually dark or blue)
      cancelled: 'destructive',
    };
    return variants[status] || 'outline';
  };

  const getStatusColorClass = (status) => {
    // Custom colors for specific statuses to override/enhance variants
    switch (status) {
      case 'pending': return "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200";
      case 'paid': return "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200";
      case 'cancelled': return ""; // destructive variant handles red
      default: return "";
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
      toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถดาวน์โหลดสลิปได้', variant: "destructive" });
    }
  };

  const formatCurrency = (amount) => {
    return `฿${amount?.toFixed(2) || '0.00'}`;
  };

  const formatDate = (dateString, simple = false) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (simple) {
      return date.toLocaleDateString('th-TH', { year: '2-digit', month: 'short', day: 'numeric' });
    }
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
          toast({ title: "สำเร็จ", description: 'อัปเดตสถานะออเดอร์เรียบร้อยแล้ว' });
        } else {
          console.error('updateKitchenTicket error:', result?.error);
          toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถอัปเดตสถานะออเดอร์ได้', variant: "destructive" });
        }
      } else {
        // ยังไม่มี ticket → เพิ่มใน state ชั่วคราว
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
        toast({ title: "สำเร็จ", description: 'อัปเดตสถานะออเดอร์เรียบร้อยแล้ว' });
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast({ title: "เกิดข้อผิดพลาด", description: 'เกิดข้อผิดพลาดในการอัปเดตสถานะออเดอร์', variant: "destructive" });
    }
  };

  const getMenuItemById = (itemId) => {
    return menuItems.find(item => item.id === itemId);
  };

  return (
    <div className="w-full h-full p-4 md:p-6 space-y-6">
      <Card className="shadow-md border-t-4 border-t-blue-500">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <Archive className="h-6 w-6 text-blue-600" />
                ประวัติการซื้อ
              </CardTitle>
              <CardDescription>
                รายการคำสั่งซื้อทั้งหมดและสถานะ
              </CardDescription>
            </div>

            {/* Date Filter */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
                <Filter className="w-4 h-4 text-muted-foreground ml-2" />
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-[140px] h-9 border-0 bg-transparent focus:ring-0">
                    <SelectValue placeholder="ช่วงเวลา" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    <SelectItem value="today">วันนี้</SelectItem>
                    <SelectItem value="week">7 วันที่แล้ว</SelectItem>
                    <SelectItem value="month">30 วันที่แล้ว</SelectItem>
                    <SelectItem value="custom">กำหนดเอง</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {dateFilter === 'custom' && (
                <div className="flex bg-muted/30 p-1 rounded-lg border items-center gap-2">
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="h-9 w-auto bg-background border-0"
                  />
                  <span className="text-muted-foreground text-xs">-</span>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="h-9 w-auto bg-background border-0"
                  />
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <div className="px-6">
          <Separator />
        </div>

        <CardContent className="pt-6">
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
              <div className="bg-muted p-4 rounded-full mb-4">
                <FileText className="h-8 w-8 opacity-50" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">ไม่มีประวัติการซื้อ</h3>
              <p>ไม่พบคำสั่งซื้อในช่วงเวลาที่เลือก</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredOrders.map((order) => {
                const oid = order?.id;
                const orderItems = (orderItemsMap?.[oid] ?? []).filter(Boolean);
                const orderNo = order?.order_no ?? oid ?? '-';
                const status = order?.status ?? 'pending';
                const grandTotal = order?.grand_total ?? 0;

                return (
                  <Card key={oid ?? Math.random()} className="overflow-hidden hover:shadow-md transition-shadow duration-200 border-l-4 border-l-transparent hover:border-l-primary">
                    <div className="p-4 sm:p-5">
                      <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">Order #{orderNo}</span>
                            <Badge variant={getStatusBadgeVariant(status)} className={cn("capitalize", getStatusColorClass(status))}>
                              {getStatusText(status)}
                            </Badge>
                          </div>
                          <div className="flex items-center text-sm text-muted-foreground gap-4">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(order?.created_at)}
                            </span>
                            {order?.payment_method && (
                              <span className="flex items-center gap-1">
                                {getPaymentMethodIcon(order.payment_method)}
                                {getPaymentMethodName(order.payment_method)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-2xl font-bold text-primary">{formatCurrency(grandTotal)}</div>
                            <div className="text-xs text-muted-foreground">{orderItems.length} รายการ</div>
                          </div>

                          {order?.receipt_url && (
                            <Button
                              variant={receiptPreviewMap[oid] ? "secondary" : "outline"}
                              size="sm"
                              className={cn("gap-2 transition-transform hover:scale-105", receiptPreviewMap[oid] ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "hover:bg-blue-50 text-blue-600 border-blue-200")}
                              onClick={() => toggleReceiptPreview(oid)}
                            >
                              <FileText className="w-4 h-4" />
                              {receiptPreviewMap[oid] ? 'ซ่อนสลิป' : 'ดูสลิป'}
                            </Button>
                          )}
                        </div>
                      </div>

                      <Separator className="my-3" />

                      {/* Order Items */}
                      <div className="space-y-2">
                        {orderItems.length > 0 ? (
                          orderItems.map((item) => {
                            const menuItem = getMenuItemById(item?.item_id);
                            const imageUrl = menuItem?.image_url;

                            return (
                              <div key={item?.id ?? Math.random()} className="flex items-center gap-3 py-1">
                                <div className="h-10 w-10 rounded-md bg-muted border overflow-hidden flex-shrink-0">
                                  {imageUrl ? (
                                    <img src={imageUrl} alt={item.name} className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center">
                                      <FileText className="h-4 w-4 text-muted-foreground/40" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{item?.name || 'Unknown Item'}</p>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                  <span className="text-muted-foreground">x{item?.qty ?? 0}</span>
                                  <span className="font-semibold w-20 text-right">{formatCurrency(item?.total_price)}</span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-2">ไม่มีรายการสินค้า</p>
                        )}
                      </div>

                      {/* Receipt Preview */}
                      {order?.receipt_url && receiptPreviewMap[oid] && (
                        <div className="mt-4 pt-4 border-t bg-muted/20 -mx-4 -mb-4 px-4 pb-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-sm flex items-center gap-2">
                              <FileText className="w-4 h-4 text-primary" /> สลิปการชำระเงิน
                            </h4>
                            <Button size="sm" variant="outline" className="h-8 gap-2 bg-background border-primary/20 hover:bg-primary/5 text-primary transition-transform hover:scale-105" onClick={() => downloadReceipt(orderNo, order.receipt_url)}>
                              <Download className="w-3.5 h-3.5" /> ดาวน์โหลด
                            </Button>
                          </div>
                          <div className="flex justify-center bg-background rounded-lg border border-dashed p-4">
                            <img
                              src={order.receipt_url}
                              alt={`receipt-${orderNo}`}
                              className="max-w-full max-h-[60vh] object-contain shadow-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
        {filteredOrders.length > 0 && (
          <CardFooter className="bg-muted/10 border-t py-4 flex justify-center">
            <p className="text-xs text-muted-foreground">แสดง {filteredOrders.length} รายการล่าสุด</p>
          </CardFooter>
        )}
      </Card>
    </div>
  );
};

export default PurchaseHistory;