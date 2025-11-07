import React, { useState } from 'react';
import POS from './POS';
import PurchaseHistory from './Kitchen'; // Changed from Kitchen to PurchaseHistory
import Menu from './Menu';
import Reports from './Reports';
import SupabaseStorageManager from './SupabaseStorageManager';

const Layout = () => {
  const [activeTab, setActiveTab] = useState('pos');

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'pos':
        return <POS />;
      case 'purchase-history': // Changed from 'kitchen'
        return <PurchaseHistory />;
      case 'menu':
        return <Menu />;
      case 'report':
        return <Reports />;
      case 'storage':
        return <SupabaseStorageManager />;
      default:
        return <POS />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 w-full">
      {/* Offline Indicator */}
      <div id="offlineIndicator" className="offline-indicator fixed top-4 right-4 z-50 px-3 py-2 rounded-lg text-xs font-bold shadow-lg transition-all duration-300 online">
        <span className="flex items-center">
          <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
          ออนไลน์
        </span>
      </div>

      {/* Toast Notification */}
      <div id="toast" className="toast fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg transition-all duration-300"></div>

      {/* Main Navigation - Full width */}
      <nav className="bg-white shadow-sm border-b sticky top-0 z-40 w-full">
        <div className="px-4 py-3 mx-0 max-w-none">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h1 id="restaurantTitle" className="text-2xl font-bold text-gray-900 flex items-center">
              <span className="bg-indigo-500 text-white p-2 rounded-lg mr-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h6M3 9h18M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
              </span>
              ร้านอาหารเจ๊นิด
            </h1>
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => setActiveTab('pos')}
                className={`px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center ${
                  activeTab === 'pos' 
                    ? 'bg-indigo-500 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
                POS
              </button>
              <button 
                onClick={() => setActiveTab('purchase-history')} // Changed from 'kitchen'
                className={`px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center ${
                  activeTab === 'purchase-history' // Changed from 'kitchen'
                    ? 'bg-indigo-500 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                </svg>
                ประวัติการซื้อ
              </button>
              <button 
                onClick={() => setActiveTab('menu')}
                className={`px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center ${
                  activeTab === 'menu' 
                    ? 'bg-indigo-500 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
                </svg>
                เมนู
              </button>
              <button 
                onClick={() => setActiveTab('report')}
                className={`px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center ${
                  activeTab === 'report' 
                    ? 'bg-indigo-500 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
                รายงาน
              </button>
              <button 
                onClick={() => setActiveTab('storage')}
                className={`px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center ${
                  activeTab === 'storage' 
                    ? 'bg-indigo-500 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                Storage
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content - Full screen usage */}
      <main className="w-full h-full">
        {renderActiveTab()}
      </main>
    </div>
  );
};

export default Layout;