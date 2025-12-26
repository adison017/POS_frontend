import React, { useState, Suspense, lazy } from 'react';
import { Button } from '@/components/ui/button';
import {
  Store,
  ShoppingCart,
  History,
  Menu as MenuIcon,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Lazy load components
const POS = lazy(() => import('./POS'));
const PurchaseHistory = lazy(() => import('./Kitchen')); // Changed from Kitchen to PurchaseHistory
const Menu = lazy(() => import('./Menu'));
const Reports = lazy(() => import('./Reports'));
const SupabaseStorageManager = lazy(() => import('./SupabaseStorageManager'));

const Layout = () => {
  const [activeTab, setActiveTab] = useState('pos');

  const renderActiveTab = () => {
    // Loading fallback component
    const LoadingFallback = () => (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );

    switch (activeTab) {
      case 'pos':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <POS />
          </Suspense>
        );
      case 'purchase-history':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <PurchaseHistory />
          </Suspense>
        );
      case 'menu':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <Menu />
          </Suspense>
        );
      case 'report':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <Reports />
          </Suspense>
        );
      case 'storage':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <SupabaseStorageManager />
          </Suspense>
        );
      default:
        return (
          <Suspense fallback={<LoadingFallback />}>
            <POS />
          </Suspense>
        );
    }
  };

  const NavButton = ({ tab, label, icon: Icon }) => (
    <Button
      variant={activeTab === tab ? "default" : "ghost"}
      onClick={() => setActiveTab(tab)}
      className={cn(
        "gap-2 font-bold",
        activeTab === tab && "shadow-md"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Button>
  );

  return (
    <div className="min-h-screen bg-background w-full">
      {/* Offline Indicator */}
      <div id="offlineIndicator" className="offline-indicator fixed top-4 right-4 z-50 px-3 py-2 rounded-lg text-xs font-bold shadow-lg transition-all duration-300 online bg-background border">
        <span className="flex items-center text-foreground">
          <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
          ออนไลน์
        </span>
      </div>



      {/* Main Navigation - Full width */}
      <nav className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm border-b sticky top-0 z-40 w-full">
        <div className="px-4 py-3 mx-0 max-w-none">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h1 className="text-2xl font-bold flex items-center text-foreground">
              <span className="bg-primary text-primary-foreground p-2 rounded-lg mr-3">
                <Store className="w-6 h-6" />
              </span>
              ร้านอาหารเจ๊นิด
            </h1>
            <div className="flex flex-wrap gap-2">
              <NavButton tab="pos" label="POS" icon={ShoppingCart} />
              <NavButton tab="purchase-history" label="ประวัติการซื้อ" icon={History} />
              <NavButton tab="menu" label="เมนู" icon={MenuIcon} />
              <NavButton tab="report" label="รายงาน" icon={BarChart3} />
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