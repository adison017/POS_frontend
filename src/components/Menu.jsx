import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { getAllMenuCategories, getAllMenuItems, createMenuCategory, createMenuItem, updateMenuCategory, updateMenuItem, deleteMenuCategory, deleteMenuItem } from '../services/dataService';
import { uploadToSupabaseStorage } from '../services/supabaseStorageService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Plus, Search, Edit, Trash2, X, Image as ImageIcon, Upload, CheckCircle, AlertTriangle, ChefHat, ShoppingBag, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const Menu = () => {
  const { toast } = useToast();
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCategoryEditModal, setShowCategoryEditModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  // Add state for delete confirmation dialog
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteItem, setDeleteItem] = useState({ id: null, name: '', type: '' }); // type: 'category' or 'menu'
  // Add state for filtering
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
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
  const [searchTerm, setSearchTerm] = useState('');
  const [newMenuItem, setNewMenuItem] = useState({
    category_id: '',
    name: '',
    price: '',
    cost_default: '',
    image_url: '',
    image_file: null,
    image_preview: null // For previewing selected images
  });

  // Load data from Supabase
  useEffect(() => {
    const loadData = async () => {
      try {
        const [categoriesData, menuItemsData] = await Promise.all([
          getAllMenuCategories(), // Use the new function to get all categories
          getAllMenuItems() // Use the new function to get all menu items
        ]);
        setCategories(categoriesData);
        setMenuItems(menuItemsData);
      } catch (error) {
        console.error('Error loading menu data:', error);
      }
    };

    loadData();
  }, []);

  const toggleCategoryStatus = async (categoryId) => {
    try {
      const category = categories.find(c => c.id === categoryId);
      if (category) {
        const updates = { is_active: !category.is_active };
        const result = await updateMenuCategory(categoryId, updates);

        if (!result.error) {
          setCategories(prevCategories =>
            prevCategories.map(c =>
              c.id === categoryId ? { ...c, is_active: !c.is_active } : c
            )
          );
          toast({ title: "สำเร็จ", description: `อัปเดตสถานะหมวดหมู่ "${category.name}" แล้ว` });
        } else {
          toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถอัปเดตสถานะหมวดหมู่ได้', variant: "destructive" });
        }
      }
    } catch (error) {
      console.error('Error toggling category status:', error);
      toast({ title: "เกิดข้อผิดพลาด", description: 'เกิดข้อผิดพลาดในการอัปเดตสถานะหมวดหมู่', variant: "destructive" });
    }
  };

  // Add delete menu category function
  const deleteMenuCategoryHandler = async (categoryId, categoryName) => {
    // Set the delete item info and show custom confirmation dialog
    setDeleteItem({ id: categoryId, name: categoryName, type: 'category' });
    setShowDeleteConfirm(true);
  };

  // Add delete menu item function
  const deleteMenuItemHandler = async (menuId, menuItemName) => {
    // Set the delete item info and show custom confirmation dialog
    setDeleteItem({ id: menuId, name: menuItemName, type: 'menu' });
    setShowDeleteConfirm(true);
  };

  // Confirm delete function
  const confirmDelete = async () => {
    try {
      if (deleteItem.type === 'category') {
        const result = await deleteMenuCategory(deleteItem.id);

        if (!result.error) {
          setCategories(prevCategories => prevCategories.filter(category => category.id !== deleteItem.id));
          toast({ title: "สำเร็จ", description: `ลบหมวดหมู่ "${deleteItem.name}" แล้ว` });
        } else {
          toast({ title: "เกิดข้อผิดพลาด", description: result.error || 'ไม่สามารถลบหมวดหมู่ได้', variant: "destructive" });
        }
      } else if (deleteItem.type === 'menu') {
        const result = await deleteMenuItem(deleteItem.id);

        if (!result.error) {
          setMenuItems(prevMenuItems => prevMenuItems.filter(item => item.id !== deleteItem.id));
          toast({ title: "สำเร็จ", description: `ลบเมนู "${deleteItem.name}" แล้ว` });
        } else {
          toast({ title: "เกิดข้อผิดพลาด", description: result.error || 'ไม่สามารถลบเมนูได้', variant: "destructive" });
        }
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      if (error.message.includes('foreign key constraint')) {
        toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถลบได้ เนื่องจากมีเมนูอาหารในหมวดหมู่นี้ กรุณาย้ายเมนูออกก่อน', variant: "destructive" });
      } else {
        toast({ title: "เกิดข้อผิดพลาด", description: error.message || `เกิดข้อผิดพลาดในการลบ ${deleteItem.type === 'category' ? 'หมวดหมู่' : 'เมนู'}`, variant: "destructive" });
      }
    } finally {
      // Close the dialog and reset
      setShowDeleteConfirm(false);
      setDeleteItem({ id: null, name: '', type: '' });
    }
  };

  const toggleMenuItemStatus = async (menuId) => {
    try {
      const menuItem = menuItems.find(item => item.id === menuId);
      if (menuItem) {
        const updates = { is_active: !menuItem.is_active };
        const result = await updateMenuItem(menuId, updates);

        if (!result.error) {
          setMenuItems(prevMenuItems =>
            prevMenuItems.map(item =>
              item.id === menuId ? { ...item, is_active: !item.is_active } : item
            )
          );
          toast({ title: "สำเร็จ", description: `อัปเดตสถานะเมนู "${menuItem.name}" แล้ว` });
        } else {
          toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถอัปเดตสถานะเมนูได้', variant: "destructive" });
        }
      }
    } catch (error) {
      console.error('Error toggling menu item status:', error);
      toast({ title: "เกิดข้อผิดพลาด", description: 'เกิดข้อผิดพลาดในการอัปเดตสถานะเมนู', variant: "destructive" });
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (newCategoryName.trim()) {
      try {
        const categoryData = {
          id: `cat_${Date.now()}`,
          name: newCategoryName,
          display_order: categories.length + 1,
          is_active: true,
          branch_id: 'branch1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const result = await createMenuCategory(categoryData);

        if (!result.error) {
          setCategories([...categories, result.data]);
          setNewCategoryName('');
          setShowCategoryModal(false);
          toast({ title: "สำเร็จ", description: 'เพิ่มหมวดหมู่ใหม่เรียบร้อยแล้ว' });
        } else {
          toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถเพิ่มหมวดหมู่ได้', variant: "destructive" });
        }
      } catch (error) {
        console.error('Error creating category:', error);
        toast({ title: "เกิดข้อผิดพลาด", description: 'เกิดข้อผิดพลาดในการเพิ่มหมวดหมู่', variant: "destructive" });
      }
    }
  };

  const openEditCategory = (category) => {
    setEditingCategoryId(category.id);
    setEditCategoryName(category.name || '');
    setShowCategoryEditModal(true);
  };

  const handleEditCategory = async (e) => {
    e.preventDefault();
    if (!editingCategoryId || !editCategoryName.trim()) return;
    try {
      const updates = { name: editCategoryName.trim(), updated_at: new Date().toISOString() };
      const result = await updateMenuCategory(editingCategoryId, updates);
      if (!result.error) {
        setCategories(prev => prev.map(c => (c.id === editingCategoryId ? { ...c, ...result.data } : c)));
        toast({ title: "สำเร็จ", description: 'อัปเดตหมวดหมู่เรียบร้อยแล้ว' });
        setShowCategoryEditModal(false);
        setEditingCategoryId(null);
        setEditCategoryName('');
      } else {
        toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถอัปเดตหมวดหมู่ได้', variant: "destructive" });
      }
    } catch (error) {
      console.error('Error updating category:', error);
      toast({ title: "เกิดข้อผิดพลาด", description: 'เกิดข้อผิดพลาดในการอัปเดตหมวดหมู่', variant: "destructive" });
    }
  };

  const openEditMenuItem = (item) => {
    setIsEditing(true);
    setEditingItemId(item.id);
    setNewMenuItem({
      category_id: item.category_id || '',
      name: item.name || '',
      price: item.price || '',
      cost_default: item.cost_default || '',
      image_url: item.image_url || '',
      image_file: null,
      image_preview: null
    });
    setShowMenuModal(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      toast({ title: "เกิดข้อผิดพลาด", description: 'กรุณาเลือกไฟล์รูปภาพเท่านั้น', variant: "destructive" });
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "เกิดข้อผิดพลาด", description: 'ขนาดไฟล์ต้องไม่เกิน 5MB', variant: "destructive" });
      return;
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);

    // Store the file and preview URL
    setNewMenuItem({
      ...newMenuItem,
      image_file: file,
      image_preview: previewUrl,
      image_url: '' // Clear any existing URL when selecting a new file
    });

    toast({ title: "ข้อมูล", description: 'ไฟล์รูปภาพถูกเลือกแล้ว จะอัปโหลดเมื่อบันทึก' });
  };

  const handleAddMenuItem = async (e) => {
    e.preventDefault();
    if (newMenuItem.category_id && newMenuItem.name && newMenuItem.price) {
      try {
        // Upload image to Supabase Storage if a file is selected
        let imageUrl = newMenuItem.image_url; // Keep existing URL if no new file
        if (newMenuItem.image_file) {
          toast({ title: "ข้อมูล", description: 'กำลังอัปโหลดรูปภาพ...' });
          const result = await uploadToSupabaseStorage(newMenuItem.image_file, 'pos_menu_items');
          imageUrl = result.publicUrl;
          toast({ title: "สำเร็จ", description: 'อัปโหลดรูปภาพเรียบร้อยแล้ว' });
        }

        const menuItemData = {
          id: isEditing ? editingItemId : `menu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          category_id: newMenuItem.category_id,
          name: newMenuItem.name,
          price: parseFloat(newMenuItem.price),
          cost_default: parseFloat(newMenuItem.cost_default) || 0,
          image_url: imageUrl, // This will be saved to the database
          is_active: true,
          branch_id: 'branch1',
          created_at: isEditing ? undefined : new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        let result;
        if (isEditing) {
          // Update existing item
          const updates = { ...menuItemData };
          delete updates.id; // Don't update the ID
          delete updates.created_at; // Don't update created_at
          result = await updateMenuItem(editingItemId, updates);
        } else {
          // Create new item
          result = await createMenuItem(menuItemData);
        }

        if (!result.error) {
          if (isEditing) {
            setMenuItems(prevItems =>
              prevItems.map(item =>
                item.id === editingItemId ? { ...result.data } : item
              )
            );
            toast({ title: "สำเร็จ", description: 'อัปเดตเมนูเรียบร้อยแล้ว' });
          } else {
            setMenuItems([...menuItems, result.data]);
            toast({ title: "สำเร็จ", description: 'เพิ่มเมนูใหม่เรียบร้อยแล้ว' });
          }

          // Clean up preview URL
          if (newMenuItem.image_preview) {
            URL.revokeObjectURL(newMenuItem.image_preview);
          }

          setNewMenuItem({
            category_id: '',
            name: '',
            price: '',
            cost_default: '',
            image_url: '',
            image_file: null,
            image_preview: null
          });
          setIsEditing(false);
          setEditingItemId(null);
          setShowMenuModal(false);
        } else {
          toast({ title: "เกิดข้อผิดพลาด", description: isEditing ? 'ไม่สามารถอัปเดตเมนูได้' : 'ไม่สามารถเพิ่มเมนูได้', variant: "destructive" });
        }
      } catch (error) {
        console.error('Error saving menu item:', error);
        // Handle specific error cases
        if (error.message.includes('permissions')) {
          toast({ title: "เกิดข้อผิดพลาด", description: 'ไม่สามารถอัปโหลดรูปภาพได้: ' + error.message, variant: "destructive" });
        } else {
          toast({ title: "เกิดข้อผิดพลาด", description: isEditing ? 'เกิดข้อผิดพลาดในการอัปเดตเมนู' : 'เกิดข้อผิดพลาดในการเพิ่มเมนู', variant: "destructive" });
        }
      }
    }
  };

  const formatCurrency = (amount) => {
    return `฿${amount.toFixed(2)}`;
  };

  // Add filtered menu items logic
  const filteredMenuItems = useMemo(() => {
    let filtered = menuItems;

    // Apply category filter
    if (selectedCategoryFilter !== 'all') {
      filtered = filtered.filter(item => item.category_id === selectedCategoryFilter);
    }

    // Apply search term filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [menuItems, selectedCategoryFilter, searchTerm]);

  return (
    <div className="w-full h-full p-6 space-y-6">
      <Card className="h-full flex flex-col shadow-md border-t-4 border-t-primary">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <ChefHat className="h-6 w-6 text-primary" />
                จัดการเมนู
              </CardTitle>
              <CardDescription>จัดการรายการอาหาร หมวดหมู่ และปรับปรุงราคา</CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => setShowCategoryModal(true)}
                className="gap-2 shadow-sm"
                variant="success"
              >
                <Plus className="h-4 w-4" />
                เพิ่มหมวดหมู่
              </Button>
              <Button
                onClick={() => {
                  setIsEditing(false);
                  setEditingItemId(null);
                  setNewMenuItem({
                    category_id: '',
                    name: '',
                    description: '',
                    price: '',
                    cost_default: '',
                    image_url: '',
                    image_file: null,
                    image_preview: null
                  });
                  setShowMenuModal(true);
                }}
                variant="success"
                className="gap-2 shadow-sm"
              >
                <Plus className="h-4 w-4" />
                เพิ่มเมนู
              </Button>
            </div>
          </div>
        </CardHeader>

        <div className="px-6 pb-2">
          <Separator />
        </div>

        <CardContent className="flex-1 overflow-hidden flex flex-col gap-6 pt-4">
          {/* Filter Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/30 p-4 rounded-lg border">
            {/* Search Input */}
            <div className="md:col-span-1">
              <Label className="mb-2 block">ค้นหาเมนู</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="พิมพ์ชื่อเมนู..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-background"
                />
              </div>
            </div>

            {/* Category Filter Buttons */}
            <div className="md:col-span-2 flex flex-col justify-end">
              <Label className="mb-2 block">กรองตามหมวดหมู่</Label>
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
                    <Badge
                      variant={selectedCategoryFilter === 'all' ? "default" : "outline"}
                      className={cn(
                        "cursor-pointer text-sm px-4 py-1.5 transition-all duration-300 shrink-0",
                        selectedCategoryFilter === 'all'
                          ? "scale-105 ring-2 ring-primary ring-offset-2"
                          : "hover:scale-105 hover:bg-primary hover:text-primary-foreground"
                      )}
                      onClick={() => setSelectedCategoryFilter('all')}
                    >
                      ทั้งหมด
                    </Badge>
                    {categories.map(category => (
                      <Badge
                        key={category.id}
                        variant={selectedCategoryFilter === category.id ? "default" : "outline"}
                        className={cn(
                          "cursor-pointer text-sm px-4 py-1.5 transition-all duration-300 shrink-0",
                          selectedCategoryFilter === category.id
                            ? "scale-105 ring-2 ring-primary ring-offset-2"
                            : "hover:scale-105 hover:bg-primary hover:text-primary-foreground"
                        )}
                        onClick={() => setSelectedCategoryFilter(category.id)}
                      >
                        {category.name}
                      </Badge>
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
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
            {/* Categories */}
            <Card className="flex flex-col border shadow-sm h-full overflow-hidden">
              <CardHeader className="py-3 px-4 bg-muted/50 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <div className="bg-primary/10 p-1.5 rounded-md">
                      <CheckCircle className="h-4 w-4 text-primary" />
                    </div>
                    หมวดหมู่เมนู
                  </CardTitle>
                  <Badge variant="secondary" className="px-2">{categories.length}</Badge>
                </div>
              </CardHeader>
              <div className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full">
                  {categories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground h-40">
                      <div className="bg-muted p-3 rounded-full mb-3">
                        <Plus className="h-6 w-6 opacity-50" />
                      </div>
                      <p className="text-sm">ยังไม่มีหมวดหมู่</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {categories.map(category => (
                        <div key={category.id} className={cn("flex items-center justify-between p-3 hover:bg-muted/30 transition-colors", !category.is_active && "opacity-60 bg-muted/20")}>
                          <div className="min-w-0 flex-1 mr-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{category.name}</span>
                              {!category.is_active && <Badge variant="destructive" className="text-[10px] h-4 px-1">ปิด</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">ลำดับ: {category.display_order}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200 shadow-sm transition-transform hover:scale-105" onClick={() => openEditCategory(category)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 shadow-sm transition-transform hover:scale-105" onClick={() => deleteMenuCategoryHandler(category.id, category.name)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <div className="flex items-center space-x-2">
                              <span className={cn("text-xs font-medium w-6 text-right", category.is_active ? "text-emerald-600" : "text-muted-foreground")}>
                                {category.is_active ? 'เปิด' : 'ปิด'}
                              </span>
                              <Switch
                                checked={category.is_active}
                                onCheckedChange={() => toggleCategoryStatus(category.id)}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </Card>

            {/* Menu Items */}
            <Card className="flex flex-col border shadow-sm h-full overflow-hidden">
              <CardHeader className="py-3 px-4 bg-muted/50 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <div className="bg-emerald-500/10 p-1.5 rounded-md">
                      <ShoppingBag className="h-4 w-4 text-emerald-600" />
                    </div>
                    รายการเมนู
                  </CardTitle>
                  <Badge variant="secondary" className="px-2">{filteredMenuItems.length}</Badge>
                </div>
              </CardHeader>
              <div className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full">
                  {filteredMenuItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground h-40">
                      <div className="bg-muted p-3 rounded-full mb-3">
                        <Plus className="h-6 w-6 opacity-50" />
                      </div>
                      <p className="text-sm">ไม่มีรายการแสดง</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredMenuItems.map(item => {
                        const category = categories.find(c => c.id === item.category_id);
                        return (
                          <div key={item.id} className={cn("flex items-center justify-between p-3 hover:bg-muted/30 transition-colors", !item.is_active && "opacity-60 bg-muted/20")}>
                            <div className="flex items-center min-w-0 flex-1 mr-3 gap-3">
                              <div className="h-12 w-12 rounded-lg bg-muted border flex-shrink-0 overflow-hidden">
                                {item.image_url ? (
                                  <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center">
                                    <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm truncate">{item.name}</span>
                                  {!item.is_active && <Badge variant="destructive" className="text-[10px] h-4 px-1">ปิด</Badge>}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge variant="outline" className="text-[10px] px-1.5 h-4 font-normal text-muted-foreground bg-background">
                                    {category?.name || 'ไม่มีหมวดหมู่'}
                                  </Badge>
                                  <span className="text-xs font-bold text-primary">{formatCurrency(item.price)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="outline" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200 shadow-sm transition-transform hover:scale-105" onClick={() => openEditMenuItem(item)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 shadow-sm transition-transform hover:scale-105" onClick={() => deleteMenuItemHandler(item.id, item.name)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <div className="flex items-center space-x-2">
                                <span className={cn("text-xs font-medium w-6 text-right", item.is_active ? "text-emerald-600" : "text-muted-foreground")}>
                                  {item.is_active ? 'เปิด' : 'ปิด'}
                                </span>
                                <Switch
                                  checked={item.is_active}
                                  onCheckedChange={() => toggleMenuItemStatus(item.id)}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </Card>
          </div>
        </CardContent >
      </Card >

      {/* Delete Confirmation Dialog */}
      < Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm} >
        <DialogContent className="sm:max-w-md border-destructive/50 shadow-destructive/20">
          <div className="absolute inset-0 bg-red-500/5 z-[-1]" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              ยืนยันการลบ
            </DialogTitle>
            <DialogDescription>
              คุณแน่ใจหรือไม่ที่ต้องการลบ "{deleteItem.name}"?
              {deleteItem.type === 'category' && (
                <span className="block mt-2 text-amber-600 bg-amber-50 p-2 rounded border border-amber-200 text-xs">
                  คำเตือน: หากยังมีเมนูอาหารในหมวดหมู่นี้ คุณจะไม่สามารถลบได้
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>ยกเลิก</Button>
            <Button variant="destructive" onClick={confirmDelete} className="gap-2">
              <Trash2 className="h-4 w-4" />
              ยืนยันการลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      {/* Add Category Modal */}
      < Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal} >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>เพิ่มหมวดหมู่ใหม่</DialogTitle>
            <DialogDescription>สร้างหมวดหมู่เพื่อจัดกลุ่มรายการอาหาร</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>ชื่อหมวดหมู่</Label>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="เช่น อาหารจานเดียว, ของหวาน"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryModal(false)}>ยกเลิก</Button>
            <Button onClick={handleAddCategory} disabled={!newCategoryName.trim()} variant="success" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      {/* Edit Category Modal */}
      < Dialog open={showCategoryEditModal} onOpenChange={setShowCategoryEditModal} >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไขหมวดหมู่</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>ชื่อหมวดหมู่</Label>
              <Input
                value={editCategoryName}
                onChange={(e) => setEditCategoryName(e.target.value)}
                placeholder="ชื่อหมวดหมู่"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryEditModal(false)}>ยกเลิก</Button>
            <Button onClick={handleEditCategory} disabled={!editCategoryName.trim()} variant="success" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >

      {/* Add/Edit Menu Item Modal */}
      < Dialog open={showMenuModal} onOpenChange={setShowMenuModal} >
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>{isEditing ? 'แก้ไขเมนู' : 'เพิ่มเมนูใหม่'}</DialogTitle>
            <DialogDescription>กรอกข้อมูลรายละเอียดของเมนูอาหาร</DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6 py-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>หมวดหมู่ <span className="text-red-500">*</span></Label>
                  <Select
                    value={newMenuItem.category_id}
                    onValueChange={(val) => setNewMenuItem({ ...newMenuItem, category_id: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกหมวดหมู่" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>ชื่อเมนู <span className="text-red-500">*</span></Label>
                  <Input
                    value={newMenuItem.name}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, name: e.target.value })}
                    placeholder="ชื่อเมนู"
                  />
                </div>
                <div className="space-y-2">
                  <Label>ราคาขาย <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    value={newMenuItem.price}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>ต้นทุน</Label>
                  <Input
                    type="number"
                    value={newMenuItem.cost_default}
                    onChange={(e) => setNewMenuItem({ ...newMenuItem, cost_default: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <Label>รูปภาพเมนู</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center bg-muted/20 hover:bg-muted/40 transition-colors">
                  {newMenuItem.image_preview || newMenuItem.image_url ? (
                    <div className="relative inline-block group">
                      <img
                        src={newMenuItem.image_preview || newMenuItem.image_url}
                        alt="Preview"
                        className="h-40 w-40 object-cover rounded-md border shadow-sm"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md">
                        <Button size="sm" variant="secondary" onClick={() => document.getElementById('image-upload').click()}>
                          เปลี่ยนรูป
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-40 cursor-pointer" onClick={() => document.getElementById('image-upload').click()}>
                      <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground font-medium">คลิกเพื่ออัปโหลดรูปภาพ</p>
                      <p className="text-xs text-muted-foreground/70">JPG, PNG สูงสุด 5MB</p>
                    </div>
                  )}
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="px-6 py-4 border-t bg-muted/10">
            <Button variant="outline" onClick={() => setShowMenuModal(false)}>ยกเลิก</Button>
            <Button onClick={handleAddMenuItem} disabled={!newMenuItem.name || !newMenuItem.price || !newMenuItem.category_id} variant="success" className="gap-2">
              {isEditing ? <CheckCircle className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {isEditing ? 'อัปเดตข้อมูล' : 'บันทึกเมนู'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >
    </div >
  );
};

export default Menu;