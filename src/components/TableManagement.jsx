import React, { useState, useEffect, useRef, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    LayoutGrid,
    Plus,
    Save,
    Move,
    Trash2,
    Armchair,
    Users,
    Utensils,
    CheckCircle2,
    Clock,
    RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

import * as DataService from '../services/dataService';

// Initial dummy data if storage is empty
const INITIAL_TABLES = [
    { id: 't1', label: 'T1', x: 50, y: 50, type: 'square', status: 'available', seats: 4 },
];

const TableManagement = ({ onNavigateToPOS }) => {
    const { toast } = useToast();
    const [tables, setTables] = useState([]);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedTableId, setSelectedTableId] = useState(null);

    // Dragging state - using Refs for direct DOM manipulation (Zero Lag)
    const [isDragging, setIsDragging] = useState(false);
    const dragState = useRef({
        activeId: null,
        startX: 0,
        startY: 0,
        initialItemX: 0,
        initialItemY: 0,
        element: null
    });

    // Store references to table DOM elements
    const tableRefs = useRef({});

    // Callback to update table position in state
    const updateTableCallback = useCallback((id, updates) => {
        setTables(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
        setHasUnsavedChanges(true);
    }, []);

    const containerRef = useRef(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    useEffect(() => {
        loadTables();
    }, []);

    const loadTables = async () => {
        try {
            const data = await DataService.getTables();
            if (data && data.length > 0) {
                setTables(data);
            } else {
                setTables([]);
            }
        } catch (error) {
            console.error('Error loading tables:', error);
            toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถดาวน์โหลดผังร้านได้', variant: "destructive" });
        }
    };

    const saveLayout = async () => {
        try {
            // In a real app with many tables, bulk update might be better. 
            // For now, let's just update modified tables or all.
            // Since we don't track dirty state perfectly, let's update all for simplicity in this Proof of Concept,
            // OR ideally, we just update the specific table when drag ends.
            // But user expects "Save Layout" button.

            // For Supabase, we should update each table.
            const updates = tables.map(table => {
                // Check if it's a new table (temparary ID usually has timestamp but we use DataService.createTable for new ones immediately usually)
                // But here we added locally first.
                // Let's assume we sync everything. 
                return DataService.updateTable(table.id, {
                    x: table.x,
                    y: table.y,
                    type: table.type,
                    label: table.label,
                    seats: table.seats,
                    status: table.status
                });
            });

            await Promise.all(updates);

            toast({
                title: "บันทึกสำเร็จ",
                description: "บันทึกข้อมูลโต้ะเรียบร้อยแล้ว",
            });
            setIsEditMode(false);
            setHasUnsavedChanges(false);
        } catch (error) {
            console.error('Error saving layout:', error);
            toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถบันทึกข้อมูลได้', variant: "destructive" });
        }
    };

    const addTable = async (type) => {
        const newTableData = {
            label: `T${tables.length + 1}`,
            x: 100,
            y: 100,
            type,
            status: 'available',
            seats: type === 'round' ? 4 : 2
        };

        try {
            const result = await DataService.createTable(newTableData);
            if (result.data) {
                setTables([...tables, result.data]);
                toast({ title: "เพิ่มโต๊ะสำเร็จ", description: `เพิ่มโต๊ะ ${result.data.label} แล้ว` });
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error adding table:', error);
            toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถเพิ่มโต๊ะได้', variant: "destructive" });
        }
    };

    const updateTable = async (id, updates) => {
        // Optimistic update
        setTables(tables.map(t => t.id === id ? { ...t, ...updates } : t));

        // If it's just drag (x, y), we wait for explicit Save? 
        // OR we save on drop? 
        // User requested "Save Layout" flow originally.
        // But for status change, we want immediate save.

        if (updates.status || updates.label || updates.seats || updates.type) {
            // Immediate save for properties
            try {
                await DataService.updateTable(id, updates);
            } catch (error) {
                console.error('Error updating table:', error);
                // Revert if needed
            }
        } else {
            setHasUnsavedChanges(true);
        }
    };

    const deleteTable = async (id) => {
        if (!confirm('ยืนยันที่จะลบโต๊ะนี้?')) return;
        try {
            await DataService.deleteTable(id);
            setTables(tables.filter(t => t.id !== id));
            setSelectedTableId(null);
            toast({ title: "ลบโต๊ะสำเร็จ" });
        } catch (error) {
            console.error('Error deleting table:', error);
            toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถลบโต๊ะได้', variant: "destructive" });
        }
    };

    const handleWindowMouseMove = useCallback((e) => {
        const { activeId, startX, startY, initialItemX, initialItemY } = dragState.current;

        if (!activeId) return;

        const element = tableRefs.current[activeId];
        if (!element) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        element.style.left = `${initialItemX + dx}px`;
        element.style.top = `${initialItemY + dy}px`;
    }, []);

    const handleWindowMouseUp = useCallback(() => {
        const { activeId, initialItemX, initialItemY } = dragState.current;
        const element = activeId ? tableRefs.current[activeId] : null;

        if (activeId && element) {
            element.style.zIndex = '';

            const currentLeft = parseInt(element.style.left || 0, 10);
            const currentTop = parseInt(element.style.top || 0, 10);

            if (currentLeft !== initialItemX || currentTop !== initialItemY) {
                updateTableCallback(activeId, { x: currentLeft, y: currentTop });
            }
        }

        setIsDragging(false);
        dragState.current = { activeId: null, startX: 0, startY: 0, initialItemX: 0, initialItemY: 0, element: null };

        window.removeEventListener('mousemove', handleWindowMouseMove);
        window.removeEventListener('mouseup', handleWindowMouseUp);
    }, [handleWindowMouseMove, updateTableCallback]);

    const handleDragStart = (e, table) => {
        if (!isEditMode) return;

        e.stopPropagation();
        setIsDragging(true);
        setSelectedTableId(table.id);

        dragState.current = {
            activeId: table.id,
            startX: e.clientX,
            startY: e.clientY,
            initialItemX: table.x,
            initialItemY: table.y
        };

        if (tableRefs.current[table.id]) {
            tableRefs.current[table.id].style.zIndex = '100';
        }

        window.addEventListener('mousemove', handleWindowMouseMove);
        window.addEventListener('mouseup', handleWindowMouseUp);
    };



    const handleMouseUp = () => {
        if (isDragging && selectedTableId && dragPosition) {
            // Commit the final position to the main state
            const finalX = dragPosition.x;
            const finalY = dragPosition.y;

            // Update local state
            setTables(prev => prev.map(t => t.id === selectedTableId ? { ...t, x: finalX, y: finalY } : t));
            setHasUnsavedChanges(true);
        }
        setIsDragging(false);
        setDragPosition(null);
    };

    const handleTableClick = (table) => {
        if (isEditMode) {
            setSelectedTableId(table.id);
        } else {
            // Navigate to POS with this table
            handleOpenTable(table);
        }
    };

    const handleOpenTable = (table) => {
        if (onNavigateToPOS) {
            onNavigateToPOS(table);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'available': return 'bg-green-500 hover:bg-green-600 border-green-600';
            case 'occupied': return 'bg-red-500 hover:bg-red-600 border-red-600';
            case 'reserved': return 'bg-amber-500 hover:bg-amber-600 border-amber-600';
            default: return 'bg-gray-500';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'available': return 'ว่าง';
            case 'occupied': return 'ไม่ว่าง';
            case 'reserved': return 'จอง';
            default: return '-';
        }
    };

    return (
        <div className="w-full h-full p-6 flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <LayoutGrid className="w-8 h-8" />
                        จัดการโต๊ะ & ผังร้าน
                    </h1>
                    <p className="text-muted-foreground">จัดการตำแหน่งโต๊ะและสถานะการใช้งาน</p>
                </div>

                <div className="flex items-center gap-2">
                    {isEditMode ? (
                        <>
                            <Button variant="outline" onClick={() => addTable('square')}>
                                <Plus className="w-4 h-4 mr-2" /> โต๊ะเหลี่ยม
                            </Button>
                            <Button variant="outline" onClick={() => addTable('round')}>
                                <Plus className="w-4 h-4 mr-2" /> โต๊ะกลม
                            </Button>
                            <Button onClick={saveLayout}>
                                <Save className="w-4 h-4 mr-2" /> บันทึกผัง
                            </Button>
                        </>
                    ) : (
                        <Button variant="secondary" onClick={() => setIsEditMode(true)}>
                            <Move className="w-4 h-4 mr-2" /> แก้ไขผังร้าน
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[600px]">
                {/* Floor Plan Canvas */}
                <Card className="flex-1 border-2 border-dashed relative overflow-hidden bg-muted/20 shadow-inner">
                    <div
                        ref={containerRef}
                        className="w-full h-full relative min-h-[600px]"
                    >
                        {tables.map(table => (
                            <div
                                key={table.id}
                                ref={el => tableRefs.current[table.id] = el}
                                onMouseDown={(e) => handleDragStart(e, table)}
                                onClick={() => handleTableClick(table)}
                                style={{
                                    position: 'absolute',
                                    left: table.x,
                                    top: table.y,
                                    width: table.type === 'round' ? '100px' : '100px',
                                    height: table.type === 'round' ? '100px' : '100px',
                                    borderRadius: table.type === 'round' ? '50%' : '12px',
                                    cursor: isEditMode ? 'move' : 'pointer',
                                    transform: isDragging && selectedTableId === table.id ? 'scale(1.05)' : 'scale(1)',
                                    zIndex: isDragging && selectedTableId === table.id ? 50 : 10,
                                }}
                                className={cn(
                                    "flex flex-col items-center justify-center border-4 shadow-lg transition-all duration-200 select-none",
                                    isEditMode ? "bg-card border-primary/50" : getStatusColor(table.status),
                                    isEditMode && selectedTableId === table.id && "ring-2 ring-primary ring-offset-2"
                                )}
                            >
                                <span className={cn(
                                    "font-bold text-xl",
                                    isEditMode ? "text-foreground" : "text-white"
                                )}>
                                    {table.label}
                                </span>

                                {!isEditMode && (
                                    <div className="flex items-center gap-1 mt-1">
                                        <Users className="w-3 h-3 text-white/80" />
                                        <span className="text-xs text-white/90">{table.seats}</span>
                                    </div>
                                )}

                                {isEditMode && (
                                    <div className="absolute -top-3 -right-3">
                                        <Button
                                            size="icon"
                                            variant="destructive"
                                            className="h-6 w-6 rounded-full"
                                            onClick={(e) => { e.stopPropagation(); deleteTable(table.id); }}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))}

                        {tables.length === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground pointer-events-none">
                                <div className="text-center">
                                    <LayoutGrid className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                    <p>ยังไม่มีโต๊ะ</p>
                                    <p className="text-sm">กด "แก้ไขผังร้าน" เพื่อเริ่มวางโต๊ะ</p>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Sidebar Panel (Info or Edit Properties) */}
                <div className="w-full lg:w-80 space-y-6">
                    {isEditMode && selectedTableId ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>แก้ไขโต๊ะ</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {(() => {
                                    const table = tables.find(t => t.id === selectedTableId);
                                    if (!table) return null;
                                    return (
                                        <>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">ชื่อโต๊ะ</label>
                                                <Input
                                                    value={table.label}
                                                    onChange={(e) => updateTable(table.id, { label: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">จำนวนที่นั่ง</label>
                                                <Input
                                                    type="number"
                                                    value={table.seats}
                                                    onChange={(e) => updateTable(table.id, { seats: parseInt(e.target.value) || 0 })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">รูปร่าง</label>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant={table.type === 'square' ? 'default' : 'outline'}
                                                        className="flex-1"
                                                        onClick={() => updateTable(table.id, { type: 'square' })}
                                                    >
                                                        สี่เหลี่ยม
                                                    </Button>
                                                    <Button
                                                        variant={table.type === 'round' ? 'default' : 'outline'}
                                                        className="flex-1"
                                                        onClick={() => updateTable(table.id, { type: 'round' })}
                                                    >
                                                        วงกลม
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">สถานะ (ทดสอบ)</label>
                                                <select
                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                    value={table.status}
                                                    onChange={(e) => updateTable(table.id, { status: e.target.value })}
                                                >
                                                    <option value="available">ว่าง</option>
                                                    <option value="occupied">มีลูกค้า</option>
                                                    <option value="reserved">จอง</option>
                                                </select>
                                            </div>
                                        </>
                                    );
                                })()}
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardHeader>
                                <CardTitle>สถานะร้าน</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-muted p-4 rounded-lg text-center">
                                        <div className="text-2xl font-bold">{tables.length}</div>
                                        <div className="text-xs text-muted-foreground">ทั้งหมด</div>
                                    </div>
                                    <div className="bg-green-100 dark:bg-green-900/20 p-4 rounded-lg text-center">
                                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                            {tables.filter(t => t.status === 'available').length}
                                        </div>
                                        <div className="text-xs text-green-600/80 dark:text-green-400/80">ว่าง</div>
                                    </div>
                                    <div className="bg-red-100 dark:bg-red-900/20 p-4 rounded-lg text-center">
                                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                                            {tables.filter(t => t.status === 'occupied').length}
                                        </div>
                                        <div className="text-xs text-red-600/80 dark:text-red-400/80">มีลูกค้า</div>
                                    </div>
                                    <div className="bg-amber-100 dark:bg-amber-900/20 p-4 rounded-lg text-center">
                                        <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                                            {tables.filter(t => t.status === 'reserved').length}
                                        </div>
                                        <div className="text-xs text-amber-600/80 dark:text-amber-400/80">จอง</div>
                                    </div>
                                </div>

                                <div className="space-y-2 mt-4">
                                    <h4 className="font-medium text-sm">คำอธิบายสถานะ</h4>
                                    <div className="flex items-center gap-2 text-sm">
                                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                        <span>ว่าง (พร้อมบริการ)</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                        <span>มีลูกค้า (กำลังทาน)</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                                        <span>จองแล้ว</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TableManagement;
