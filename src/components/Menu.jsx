import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getAllMenuCategories, getAllMenuItems, createMenuCategory, createMenuItem, updateMenuCategory, updateMenuItem, deleteMenuItem } from '../services/dataService';
import { uploadToSupabaseStorage } from '../services/supabaseStorageService';

const Menu = () => {
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
          toast.success(`อัปเดตสถานะหมวดหมู่ "${category.name}" แล้ว`);
        } else {
          toast.error('ไม่สามารถอัปเดตสถานะหมวดหมู่ได้');
        }
      }
    } catch (error) {
      console.error('Error toggling category status:', error);
      toast.error('เกิดข้อผิดพลาดในการอัปเดตสถานะหมวดหมู่');
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
          toast.success(`อัปเดตสถานะเมนู "${menuItem.name}" แล้ว`);
        } else {
          toast.error('ไม่สามารถอัปเดตสถานะเมนูได้');
        }
      }
    } catch (error) {
      console.error('Error toggling menu item status:', error);
      toast.error('เกิดข้อผิดพลาดในการอัปเดตสถานะเมนู');
    }
  };

  // Add delete menu item function
  const deleteMenuItemHandler = async (menuId, menuItemName) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ที่ต้องการลบเมนู "${menuItemName}"?`)) {
      return;
    }
    
    try {
      const result = await deleteMenuItem(menuId);
      
      if (!result.error) {
        setMenuItems(prevMenuItems => prevMenuItems.filter(item => item.id !== menuId));
        toast.success(`ลบเมนู "${menuItemName}" แล้ว`);
      } else {
        toast.error('ไม่สามารถลบเมนูได้');
      }
    } catch (error) {
      console.error('Error deleting menu item:', error);
      toast.error('เกิดข้อผิดพลาดในการลบเมนู');
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
          toast.success('เพิ่มหมวดหมู่ใหม่เรียบร้อยแล้ว');
        } else {
          toast.error('ไม่สามารถเพิ่มหมวดหมู่ได้');
        }
      } catch (error) {
        console.error('Error creating category:', error);
        toast.error('เกิดข้อผิดพลาดในการเพิ่มหมวดหมู่');
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
        toast.success('อัปเดตหมวดหมู่เรียบร้อยแล้ว');
        setShowCategoryEditModal(false);
        setEditingCategoryId(null);
        setEditCategoryName('');
      } else {
        toast.error('ไม่สามารถอัปเดตหมวดหมู่ได้');
      }
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error('เกิดข้อผิดพลาดในการอัปเดตหมวดหมู่');
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
      toast.error('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('ขนาดไฟล์ต้องไม่เกิน 5MB');
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
    
    toast.info('ไฟล์รูปภาพถูกเลือกแล้ว จะอัปโหลดเมื่อบันทึก');
  };

  const handleAddMenuItem = async (e) => {
    e.preventDefault();
    if (newMenuItem.category_id && newMenuItem.name && newMenuItem.price) {
      try {
        // Upload image to Supabase Storage if a file is selected
        let imageUrl = newMenuItem.image_url; // Keep existing URL if no new file
        if (newMenuItem.image_file) {
          toast.info('กำลังอัปโหลดรูปภาพ...');
          const result = await uploadToSupabaseStorage(newMenuItem.image_file, 'pos_menu_items');
          imageUrl = result.publicUrl;
          toast.success('อัปโหลดรูปภาพเรียบร้อยแล้ว');
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
            toast.success('อัปเดตเมนูเรียบร้อยแล้ว');
          } else {
            setMenuItems([...menuItems, result.data]);
            toast.success('เพิ่มเมนูใหม่เรียบร้อยแล้ว');
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
          toast.error(isEditing ? 'ไม่สามารถอัปเดตเมนูได้' : 'ไม่สามารถเพิ่มเมนูได้');
        }
      } catch (error) {
        console.error('Error saving menu item:', error);
        // Handle specific error cases
        if (error.message.includes('permissions')) {
          toast.error('ไม่สามารถอัปโหลดรูปภาพได้: ' + error.message);
        } else {
          toast.error(isEditing ? 'เกิดข้อผิดพลาดในการอัปเดตเมนู' : 'เกิดข้อผิดพลาดในการเพิ่มเมนู');
        }
      }
    }
  };

  const formatCurrency = (amount) => {
    return `฿${amount.toFixed(2)}`;
  };

  return (
    <div id="menuSection" className="p-4 md:p-6 w-full h-full">
      <div className="bg-white rounded-xl shadow-md p-4 md:p-6 h-full flex flex-col">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-800">จัดการเมนู</h2>
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setShowCategoryModal(true)}
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-bold transition-all duration-200 shadow hover:shadow-md flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              </svg>
              เพิ่มหมวดหมู่
            </button>
            <button 
              onClick={() => {
                setIsEditing(false);
                setEditingItemId(null);
                setNewMenuItem({
                  category_id: '',
                  name: '',
                  description: '',
                  price: '',
                  cost_default: '',
                  image_url: ''
                });
                setShowMenuModal(true);
              }}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-lg font-bold transition-all duration-200 shadow hover:shadow-md flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              </svg>
              เพิ่มเมนู
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
          {/* Categories */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">หมวดหมู่เมนู</h3>
              <span className="text-sm text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                {categories.length} หมวดหมู่
              </span>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-300px)]">
              {categories.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-3">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
                    </svg>
                  </div>
                  <p className="text-gray-500 font-medium">ยังไม่มีหมวดหมู่เมนู</p>
                  <button 
                    onClick={() => setShowCategoryModal(true)}
                    className="mt-3 text-indigo-600 hover:text-indigo-800 font-medium flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                    เพิ่มหมวดหมู่แรกของคุณ
                  </button>
                </div>
              ) : (
                categories.map(category => (
                  <div key={category.id} className={`flex items-center justify-between p-4 rounded-xl hover:bg-gray-100 transition-colors ${
                    category.is_active ? 'bg-gray-50' : 'bg-gray-100 opacity-70'
                  }`}>
                    <div>
                      <h4 className={`font-bold ${category.is_active ? 'text-gray-800' : 'text-gray-500'}`}>
                        {category.name} {category.is_active ? '' : '(ปิด)'}
                      </h4>
                      <p className="text-sm text-gray-600">ลำดับ: {category.display_order}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => openEditCategory(category)}
                        className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="แก้ไขหมวดหมู่"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                      </button>
                      <button 
                        onClick={() => toggleCategoryStatus(category.id)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                          category.is_active 
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' 
                            : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                        }`}
                      >
                        {category.is_active ? 'เปิด' : 'ปิด'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* Menu Items */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">รายการเมนู</h3>
              <span className="text-sm text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                {menuItems.length} เมนู
              </span>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-300px)]">
              {menuItems.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-3">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
                    </svg>
                  </div>
                  <p className="text-gray-500 font-medium">ยังไม่มีรายการเมนู</p>
                  <button 
                    onClick={() => {
                      setIsEditing(false);
                      setEditingItemId(null);
                      setNewMenuItem({
                        category_id: '',
                        name: '',
                        description: '',
                        price: '',
                        cost_default: '',
                        image_url: ''
                      });
                      setShowMenuModal(true);
                    }}
                    className="mt-3 text-indigo-600 hover:text-indigo-800 font-medium flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                    เพิ่มเมนูแรกของคุณ
                  </button>
                </div>
              ) : (
                menuItems.map(item => {
                  const category = categories.find(c => c.id === item.category_id);
                  return (
                    <div key={item.id} className={`flex items-center justify-between p-4 rounded-xl hover:bg-gray-100 transition-colors ${
                      item.is_active ? 'bg-gray-50' : 'bg-gray-100 opacity-70'
                    }`}>
                      <div className="flex items-center">
                        {item.image_url ? (
                          <img 
                            src={item.image_url} 
                            alt={item.name}
                            className="w-12 h-12 object-cover rounded-lg mr-3"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-200 rounded-lg mr-3 flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                          </div>
                        )}
                        <div>
                          <h4 className={`font-bold ${item.is_active ? 'text-gray-800' : 'text-gray-500'}`}>
                            {item.name} {item.is_active ? '' : '(ปิด)'}
                          </h4>
                          <p className="text-sm text-gray-600">{category?.name || 'ไม่มีหมวดหมู่'}</p>
                          <p className="text-sm font-bold text-gray-800">{formatCurrency(item.price)}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => openEditMenuItem(item)}
                          className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="แก้ไข"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                          </svg>
                        </button>
                        <button 
                          onClick={() => deleteMenuItemHandler(item.id, item.name)}
                          className="p-2 text-gray-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="ลบ"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                          </svg>
                        </button>
                        <button 
                          onClick={() => toggleMenuItemStatus(item.id)}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                            item.is_active 
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' 
                              : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                          }`}
                        >
                          {item.is_active ? 'เปิด' : 'ปิด'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
        
        {/* Add Category Modal */}
        {showCategoryModal && (
          <div className="modal-overlay">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">เพิ่มหมวดหมู่ใหม่</h3>
                <button 
                  onClick={() => {
                    setShowCategoryModal(false);
                    setNewCategoryName('');
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleAddCategory}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">ชื่อหมวดหมู่</label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="เช่น อาหารจานเดียว, ของหวาน"
                    required
                  />
                </div>
                
                <div className="flex space-x-3">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowCategoryModal(false);
                      setNewCategoryName('');
                    }}
                    className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-colors duration-200"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 px-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-bold transition-all duration-200 shadow hover:shadow-md"
                  >
                    บันทึก
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Category Modal */}
        {showCategoryEditModal && (
          <div className="modal-overlay">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">แก้ไขหมวดหมู่</h3>
                <button 
                  onClick={() => {
                    setShowCategoryEditModal(false);
                    setEditingCategoryId(null);
                    setEditCategoryName('');
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>

              <form onSubmit={handleEditCategory}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">ชื่อหมวดหมู่</label>
                  <input
                    type="text"
                    value={editCategoryName}
                    onChange={(e) => setEditCategoryName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="เช่น อาหารจานเดียว, ของหวาน"
                    required
                  />
                </div>

                <div className="flex space-x-3">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowCategoryEditModal(false);
                      setEditingCategoryId(null);
                      setEditCategoryName('');
                    }}
                    className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-colors duration-200"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 px-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-bold transition-all duration-200 shadow hover:shadow-md"
                  >
                    บันทึก
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* Add/Edit Menu Item Modal */}
        {showMenuModal && (
          <div className="modal-overlay">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">{isEditing ? 'แก้ไขเมนู' : 'เพิ่มเมนูใหม่'}</h3>
                <button 
                  onClick={() => {
                    setShowMenuModal(false);
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
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleAddMenuItem}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">หมวดหมู่</label>
                  <select
                    value={newMenuItem.category_id}
                    onChange={(e) => setNewMenuItem({...newMenuItem, category_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  >
                    <option value="">เลือกหมวดหมู่</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">ชื่อเมนู</label>
                  <input
                    type="text"
                    value={newMenuItem.name}
                    onChange={(e) => setNewMenuItem({...newMenuItem, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ราคา</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newMenuItem.price}
                      onChange={(e) => setNewMenuItem({...newMenuItem, price: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ต้นทุน</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newMenuItem.cost_default}
                      onChange={(e) => setNewMenuItem({...newMenuItem, cost_default: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
                
                {/* Image Upload */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">รูปภาพ</label>
                  {newMenuItem.image_preview ? (
                    <div className="mb-2">
                      <img 
                        src={newMenuItem.image_preview} 
                        alt="Preview" 
                        className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                      />
                    </div>
                  ) : newMenuItem.image_url ? (
                    <div className="mb-2">
                      <img 
                        src={newMenuItem.image_url} 
                        alt="Existing" 
                        className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                      />
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center mb-2">
                      <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                      </svg>
                      <p className="mt-2 text-sm text-gray-500">ยังไม่ได้อัปโหลดรูปภาพ</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="w-full py-2 px-4 border border-gray-300 rounded-lg text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                  <p className="mt-1 text-xs text-gray-500">รองรับไฟล์ JPG, PNG หรือ GIF (สูงสุด 5MB)</p>
                </div>
                
                <div className="flex space-x-3">
                  <button 
                    type="button"
                    onClick={() => {
                      // Clean up preview URL if exists
                      if (newMenuItem.image_preview) {
                        URL.revokeObjectURL(newMenuItem.image_preview);
                      }
                      
                      setShowMenuModal(false);
                      setIsEditing(false);
                      setEditingItemId(null);
                      setNewMenuItem({
                        category_id: '',
                        name: '',
                        price: '',
                        cost_default: '',
                        image_url: '',
                        image_file: null,
                        image_preview: null
                      });
                    }}
                    className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-colors duration-200"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold transition-all duration-200 shadow hover:shadow-md"
                  >
                    {isEditing ? 'อัปเดต' : 'บันทึก'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Menu;