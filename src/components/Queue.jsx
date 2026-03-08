import React, { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { getKitchenTickets, updateKitchenTicket, getMenuItems } from '../services/dataService';
import socketService from '../services/socket';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChefHat, Clock, PlayCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const Queue = () => {
  const { toast } = useToast();
  const [tickets, setTickets] = useState([]);
  const [menuItems, setMenuItems] = useState([]);

  // Load Initial Data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [ticketsData, menuData] = await Promise.all([
          getKitchenTickets(),
          getMenuItems()
        ]);
        setTickets(Array.isArray(ticketsData) ? ticketsData.filter(Boolean) : []);
        setMenuItems(Array.isArray(menuData) ? menuData.filter(Boolean) : []);
      } catch (error) {
        console.error('Error loading kitchen data:', error);
        toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถโหลดข้อมูลครัวได้', variant: "destructive" });
      }
    };
    loadData();

    // Socket Connections
    const socket = socketService.connectSocket();
    
    socket.on('kitchen-ticket:created', (newTicket) => {
      setTickets(prev => {
        // Prevent duplicates
        if (prev.some(t => t.id === newTicket.id)) return prev;
        return [newTicket, ...prev];
      });
      // Optional sound notification could go here
    });

    socket.on('kitchen-ticket:updated', (updatedTicket) => {
      setTickets(prev => prev.map(t => t.id === updatedTicket.id ? updatedTicket : t));
    });

    return () => {
      socket.off('kitchen-ticket:created');
      socket.off('kitchen-ticket:updated');
    };
  }, [toast]);

  // Handle Status Update
  const updateTicketStatus = async (ticketId, newStatus) => {
    try {
      const updates = { 
        status: newStatus,
        updated_at: new Date().toISOString()
      };
      
      if (newStatus === 'started') {
        updates.started_at = new Date().toISOString();
      } else if (newStatus === 'finished') {
        updates.finished_at = new Date().toISOString();
      }

      // Optimistic Update
      setTickets(prev => prev.map(t => 
        t.id === ticketId ? { ...t, ...updates } : t
      ));

      const response = await updateKitchenTicket(ticketId, updates);
      
      if (response?.error) {
         // Revert on error
         const originalTickets = await getKitchenTickets();
         setTickets(Array.isArray(originalTickets) ? originalTickets.filter(Boolean) : []);
         throw new Error(response.error);
      }
       
      toast({ title: "อัปเดตสถานะสำเร็จ", description: `เปลี่ยนสถานะเป็น ${getStatusText(newStatus)}` });
      
    } catch (error) {
      console.error('Error updating ticket:', error);
      toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถอัปเดตสถานะได้', variant: "destructive" });
    }
  };

  const getStatusText = (status) => {
    const texts = { queued: 'รอคิว', started: 'กำลังทำ', finished: 'เสร็จแล้ว' };
    return texts[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      queued: 'bg-amber-100 text-amber-800 border-amber-200',
      started: 'bg-blue-100 text-blue-800 border-blue-200',
      finished: 'bg-green-100 text-green-800 border-green-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getTimeElapsed = (dateString) => {
    if (!dateString) return '';
    const start = new Date(dateString);
    const now = new Date();
    const diffMins = Math.floor((now - start) / 60000);
    
    if (diffMins < 1) return 'เพิ่งสั่ง';
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours} ชม. ${mins} นาที`;
  };

  const getMenuItemName = (itemId) => {
      const item = menuItems.find(m => m.id === itemId);
      return item ? item.name : 'Unknown Item';
  };

  // Safe parsing of order_items
  const parseOrderItems = (ticket) => {
      // ticket.orders might be an object containing order_items array now (due to the join)
      if (ticket?.orders?.order_items && Array.isArray(ticket.orders.order_items)) {
          return ticket.orders.order_items;
      }
      
      return [];
  };

  // Column Render Helper
  const renderTicketColumn = (title, status, icon, emptyText) => {
    const columnTickets = tickets.filter(t => t.status === status)
                                 .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    return (
      <Card className="flex flex-col h-[calc(100vh-12rem)] border-t-4 shadow-sm" style={{ borderTopColor: status === 'queued' ? '#f59e0b' : status === 'started' ? '#3b82f6' : '#10b981' }}>
        <CardHeader className="py-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              {icon}
              {title}
            </CardTitle>
            <Badge variant="outline" className="font-bold text-lg px-3 py-1 bg-background">
              {columnTickets.length}
            </Badge>
          </div>
        </CardHeader>
        
        <ScrollArea className="flex-1 p-4">
          <div className="flex flex-col gap-4">
            {columnTickets.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
                 {emptyText}
              </div>
            ) : (
              columnTickets.map(ticket => {
                const orderItems = parseOrderItems(ticket);
                const orderNo = ticket.orders?.order_no || ticket.order_id?.substring(0,8) || '-';
                // Check if it's an old ticket in 'queued' state
                const isWarning = status === 'queued' && (new Date() - new Date(ticket.created_at)) > 15 * 60000;

                return (
                  <Card key={ticket.id} className={cn("overflow-hidden transition-all duration-200 border-2", isWarning ? "border-red-300 shadow-md scale-[1.02]" : "hover:border-primary/50")}>
                    <div className="p-3 bg-muted/20 border-b flex justify-between items-start">
                        <div>
                           <div className="font-bold text-lg leading-none mb-1">Order #{orderNo}</div>
                           <div className="text-xs text-muted-foreground flex items-center gap-1">
                               <Clock className="w-3 h-3" />
                               {getTimeElapsed(ticket.created_at)}
                           </div>
                        </div>
                        <Badge className={cn(getStatusColor(status))}>
                           {getStatusText(status)}
                        </Badge>
                    </div>

                    <CardContent className="p-3">
                        <ul className="space-y-2">
                             {orderItems.length > 0 ? (
                                 orderItems.map(item => (
                                     <li key={item.id} className="flex justify-between items-start text-sm">
                                         <span className="font-medium mr-2">
                                             <span className="text-primary font-bold mr-1">{item.qty}x</span>
                                             {item.name || getMenuItemName(item.item_id)}
                                         </span>
                                     </li>
                                 ))
                             ) : (
                                 <li className="text-sm text-center text-muted-foreground py-2 italic bg-muted/20 rounded">
                                     (ไม่มีรายการ/ไม่สามารถดึงข้อมูลได้) 
                                     <br/><span className="text-xs">รบกวนดูจากบิลแทน</span>
                                 </li>
                             )}
                        </ul>
                    </CardContent>

                    <CardFooter className="p-2 border-t bg-muted/10 grid grid-cols-1 gap-2">
                        {status === 'queued' && (
                            <Button size="sm" className="w-full font-bold bg-blue-600 hover:bg-blue-700" onClick={() => updateTicketStatus(ticket.id, 'started')}>
                               <PlayCircle className="w-4 h-4 mr-2" />
                               เริ่มทำอาหาร
                            </Button>
                        )}
                        {status === 'started' && (
                            <Button size="sm" className="w-full font-bold bg-green-600 hover:bg-green-700" onClick={() => updateTicketStatus(ticket.id, 'finished')}>
                               <CheckCircle className="w-4 h-4 mr-2" />
                               ทำเสร็จแล้ว
                            </Button>
                        )}
                        {status === 'finished' && (
                            <Button size="sm" variant="outline" className="w-full text-muted-foreground" onClick={() => updateTicketStatus(ticket.id, 'started')}>
                               ย้อนกลับไปทำใหม่
                            </Button>
                        )}
                    </CardFooter>
                  </Card>
                );
              })
            )}
          </div>
        </ScrollArea>
      </Card>
    );
  };

  return (
    <div className="w-full h-full p-4 md:p-6 flex flex-col gap-6">
       <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
             <ChefHat className="h-6 w-6 text-orange-500" />
             คิวออเดอร์ห้องครัว (Kitchen Queue)
          </h2>
          <p className="text-muted-foreground">จัดการคิวอาหารและอัปเดตสถานะแบบเรียลไทม์</p>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {renderTicketColumn("รอคิว", "queued", <Clock className="w-5 h-5 text-amber-500" />, "ไม่มีออเดอร์รอคิว")}
           {renderTicketColumn("กำลังทำ", "started", <PlayCircle className="w-5 h-5 text-blue-500" />, "ไม่มีออเดอร์ที่กำลังทำ")}
           {renderTicketColumn("ทำเสร็จแล้ว", "finished", <CheckCircle className="w-5 h-5 text-green-500" />, "ไม่มีออเดอร์ที่เสร็จแล้ว")}
       </div>
    </div>
  );
};

export default Queue;
