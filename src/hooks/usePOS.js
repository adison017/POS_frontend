import { useState, useEffect } from 'react';

// This hook manages the global state for our POS application
const usePOS = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize with sample data
  useEffect(() => {
    const initializeData = async () => {
      try {
        // In a real app, this would be an API call
        const sampleData = [
          { id: 'cat1', type: 'menu_category', name: 'อาหารจานหลัก', display_order: 1, is_active: true, branch_id: 'branch1', created_at: new Date().toISOString() },
          { id: 'cat2', type: 'menu_category', name: 'เครื่องดื่ม', display_order: 2, is_active: true, branch_id: 'branch1', created_at: new Date().toISOString() },
          { id: 'cat3', type: 'menu_category', name: 'ของหวาน', display_order: 3, is_active: true, branch_id: 'branch1', created_at: new Date().toISOString() },
          { id: 'menu1', type: 'menu_item', category_id: 'cat1', name: 'ข้าวผัดกุ้ง', price: 120, cost_default: 60, is_active: true, branch_id: 'branch1', created_at: new Date().toISOString() },
          { id: 'menu2', type: 'menu_item', category_id: 'cat1', name: 'ผัดไทย', price: 100, cost_default: 50, is_active: true, branch_id: 'branch1', created_at: new Date().toISOString() },
          { id: 'menu3', type: 'menu_item', category_id: 'cat2', name: 'น้ำส้มคั้น', price: 40, cost_default: 15, is_active: true, branch_id: 'branch1', created_at: new Date().toISOString() },
          { id: 'menu4', type: 'menu_item', category_id: 'cat3', name: 'ไอศกรีมวานิลลา', price: 60, cost_default: 25, is_active: true, branch_id: 'branch1', created_at: new Date().toISOString() }
        ];
        
        setData(sampleData);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    initializeData();
  }, []);

  const getMenuCategories = () => {
    return data.filter(item => item.type === 'menu_category' && item.is_active);
  };

  const getMenuItems = () => {
    return data.filter(item => item.type === 'menu_item' && item.is_active);
  };

  const getMenuItemsByCategory = (categoryId) => {
    return data.filter(item => item.type === 'menu_item' && item.category_id === categoryId && item.is_active);
  };

  const addCategory = (category) => {
    const newCategory = {
      ...category,
      id: `cat_${Date.now()}`,
      type: 'menu_category',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    setData(prevData => [...prevData, newCategory]);
    return newCategory;
  };

  const addMenuItem = (item) => {
    const newMenuItem = {
      ...item,
      id: `menu_${Date.now()}`,
      type: 'menu_item',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    setData(prevData => [...prevData, newMenuItem]);
    return newMenuItem;
  };

  const toggleCategoryStatus = (categoryId) => {
    setData(prevData => 
      prevData.map(item => 
        item.id === categoryId && item.type === 'menu_category'
          ? { ...item, is_active: !item.is_active, updated_at: new Date().toISOString() }
          : item
      )
    );
  };

  const toggleMenuItemStatus = (menuId) => {
    setData(prevData => 
      prevData.map(item => 
        item.id === menuId && item.type === 'menu_item'
          ? { ...item, is_active: !item.is_active, updated_at: new Date().toISOString() }
          : item
      )
    );
  };

  return {
    data,
    loading,
    error,
    getMenuCategories,
    getMenuItems,
    getMenuItemsByCategory,
    addCategory,
    addMenuItem,
    toggleCategoryStatus,
    toggleMenuItemStatus
  };
};

export default usePOS;