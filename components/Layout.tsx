import React, { useState } from 'react';
import { Home, PlusCircle, MessageCircle, User as UserIcon, Menu, X, Facebook, Instagram, Twitter, Info, Phone, HelpCircle, Bell, ArrowLeft, RefreshCw, HandHeart, LogOut, Settings, CheckCircle } from 'lucide-react';
import { AppView, User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  notificationCount: number;
  unreadChatCount?: number; // Added unread count for chat
  user: User;
  onRestrictedAction: () => boolean;
  greenLogoUrl?: string;
  redLogoUrl?: string;
  onSidebarAction?: (action: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  currentView, 
  setCurrentView, 
  notificationCount,
  unreadChatCount = 0, // Default to 0
  user, 
  onRestrictedAction, 
  greenLogoUrl,
  redLogoUrl,
  onSidebarAction
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  // If we are in Admin Dashboard, just render children without the app shell
  if (currentView === 'ADMIN_DASHBOARD') {
      return <>{children}</>;
  }

  const handleNavClick = (view: AppView) => {
    if (view === 'HOME') {
      setCurrentView(view);
      return;
    }
    if (onRestrictedAction()) {
      setCurrentView(view);
    }
  };

  const handleSidebarClick = (action: string) => {
      setIsSidebarOpen(false);
      if (onSidebarAction) onSidebarAction(action);
  };

  const handleNotificationClick = () => {
      // Trigger Shake Animation
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500); // Stop shaking after 500ms
      setIsNotificationsOpen(true);
  };

  const isVerified = user.emailVerified && user.phoneVerified;
  const defaultRedLogo = "https://placehold.co/400x400/ef4444/ffffff?text=LOFO";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 max-w-5xl mx-auto shadow-2xl relative overflow-hidden transition-colors duration-200">
      <style>{`
        @keyframes shake {
          0% { transform: rotate(0deg); }
          25% { transform: rotate(-15deg); }
          50% { transform: rotate(15deg); }
          75% { transform: rotate(-15deg); }
          100% { transform: rotate(0deg); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
      
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="absolute inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* Sidebar Drawer */}
      <div className={`absolute top-0 left-0 h-full w-72 bg-white dark:bg-slate-900 z-50 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          {/* Sidebar Header */}
          <div className="h-16 border-b dark:border-slate-800 flex items-center px-6 bg-white dark:bg-slate-900 shrink-0 gap-3">
               <div className="w-8 h-8">
                   <img src={redLogoUrl || defaultRedLogo} alt="Logo" className="w-full h-full object-contain" />
               </div>
               <h1 className="text-2xl font-bold text-indigo-900 dark:text-indigo-100 tracking-tight">LOFO.PK</h1>
              <button onClick={() => setIsSidebarOpen(false)} className="ml-auto p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500 dark:text-slate-400" /></button>
          </div>

          {/* Sidebar Content */}
          <div className="p-4 space-y-2 flex-1 overflow-y-auto">
              <div className="mb-6">
                  <p className="text-xs text-slate-400 uppercase font-bold mb-2 tracking-wider pl-3">Quick Actions</p>
                  <button onClick={() => handleSidebarClick('POST_LOST')} className="w-full text-left p-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 font-bold rounded-xl flex items-center gap-3 transition-colors">
                      <PlusCircle className="w-5 h-5" /> Post Lost Item
                  </button>
                  <button onClick={() => handleSidebarClick('POST_FOUND')} className="w-full text-left p-3 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-bold rounded-xl flex items-center gap-3 transition-colors">
                      <PlusCircle className="w-5 h-5" /> Post Found Item
                  </button>
                  <button onClick={() => handleSidebarClick('MATCH_CASES')} className="w-full text-left p-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 font-bold rounded-xl flex items-center gap-3 transition-colors mt-1">
                      <RefreshCw className="w-5 h-5" /> Match Cases
                  </button>
                  <button onClick={() => handleSidebarClick('RESOLVED_CASES')} className="w-full text-left p-3 hover:bg-teal-50 dark:hover:bg-teal-900/20 text-teal-600 dark:text-teal-400 font-bold rounded-xl flex items-center gap-3 transition-colors mt-1">
                      <CheckCircle className="w-5 h-5" /> Resolved Cases
                  </button>
              </div>

              <div className="mb-6">
                  <p className="text-xs text-slate-400 uppercase font-bold mb-2 tracking-wider pl-3">Information</p>
                  <button onClick={() => handleSidebarClick('ABOUT')} className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-xl flex items-center gap-3 transition-colors">
                      <Info className="w-5 h-5" /> About Us
                  </button>
                  <button onClick={() => handleSidebarClick('CONTACT')} className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-xl flex items-center gap-3 transition-colors">
                      <Phone className="w-5 h-5" /> Contact Us
                  </button>
                  <button onClick={() => handleSidebarClick('HOW_IT_WORKS')} className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-xl flex items-center gap-3 transition-colors">
                      <HelpCircle className="w-5 h-5" /> How it Works
                  </button>
              </div>

              <div className="mb-6">
                  <p className="text-xs text-slate-400 uppercase font-bold mb-2 tracking-wider pl-3">Support</p>
                  <button onClick={() => handleSidebarClick('DONATION')} className="w-full text-left p-3 hover:bg-pink-50 dark:hover:bg-pink-900/20 text-pink-600 dark:text-pink-400 font-bold rounded-xl flex items-center gap-3 transition-colors">
                      <HandHeart className="w-5 h-5" /> Donate
                  </button>
              </div>

              <div className="mb-6">
                   <p className="text-xs text-slate-400 uppercase font-bold mb-2 tracking-wider pl-3">Account</p>
                   <button onClick={() => handleSidebarClick('SETTINGS')} className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium rounded-xl flex items-center gap-3 transition-colors">
                        <Settings className="w-5 h-5" /> Settings
                   </button>
                   <button onClick={() => handleSidebarClick('LOGOUT')} className="w-full text-left p-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 font-medium rounded-xl flex items-center gap-3 transition-colors">
                        <LogOut className="w-5 h-5" /> Log out
                   </button>
               </div>
          </div>
          
          {/* Sidebar Footer (Tray) */}
          <div className="p-4 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0 mt-auto">
               <div className="flex flex-col items-center pt-2">
                   <p className="text-xs text-slate-400 font-medium">© 2024 LOFO.PK</p>
                   <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">v1.0.0 Beta</p>
               </div>
          </div>
      </div>
      
      {/* Header / Top Bar */}
      <div className="h-16 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-4 sticky top-0 z-30 shadow-sm transition-colors duration-200">
          {/* Left: Menu & Logo */}
          <div className="flex items-center gap-2 w-20">
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300 transition-colors">
                  <Menu className="w-6 h-6" />
              </button>
              <div className="w-8 h-8 hidden sm:block">
                  <img src={greenLogoUrl || "https://placehold.co/100x100/10b981/ffffff?text=L"} alt="Logo" className="w-full h-full object-contain" />
              </div>
          </div>

          {/* Center: User Profile Info */}
          <button 
            onClick={() => handleNavClick('PROFILE')} 
            className="flex flex-col items-center justify-center flex-1 max-w-[200px] hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl p-1 transition-colors group"
          >
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mb-0.5 ring-2 ring-transparent group-hover:ring-indigo-100 dark:group-hover:ring-indigo-900 transition-all">
                  {user.avatar ? (
                      <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                      <UserIcon className="w-5 h-5 m-auto mt-1.5 text-slate-400" />
                  )}
              </div>
              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-full leading-tight">
                  {user.isGuest ? 'Login / Register' : (user.name || 'User')}
              </span>
          </button>

          {/* Right: Notifications */}
          <div className="flex items-center justify-end w-20">
               <button onClick={handleNotificationClick} className={`p-2 rounded-full relative transition-colors ${isNotificationsOpen ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'} ${isShaking ? 'animate-shake' : ''}`}>
                   <Bell className="w-6 h-6" />
                   {notificationCount > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full"></span>}
               </button>
          </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative">
          {children}
      </main>

      {/* Bottom Navigation */}
      {currentView !== 'CHAT_ROOM' && (
          <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-2 pb-5 flex justify-between items-center sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] transition-colors duration-200">
              <button onClick={() => handleNavClick('HOME')} className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${currentView === 'HOME' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                  <Home className={`w-6 h-6 ${currentView === 'HOME' ? 'fill-current' : ''}`} />
                  <span className="text-[10px] font-bold">Home</span>
              </button>
              
              <button onClick={() => handleSidebarClick('POST_SELECT')} className="flex-1 flex flex-col items-center gap-1 p-2 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  <PlusCircle className="w-6 h-6" />
                  <span className="text-[10px] font-bold">Post</span>
              </button>

              <button onClick={() => handleNavClick('CHAT_LIST')} className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-xl transition-all relative ${currentView === 'CHAT_LIST' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                  <div className="relative">
                      <MessageCircle className={`w-6 h-6 ${currentView === 'CHAT_LIST' ? 'fill-current' : ''}`} />
                      {unreadChatCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-slate-900">{unreadChatCount}</span>}
                  </div>
                  <span className="text-[10px] font-bold">Chats</span>
              </button>
          </div>
      )}

      {/* Notifications Drawer/Modal */}
      {isNotificationsOpen && (
          <div className="absolute inset-0 z-[60] bg-black/20 backdrop-blur-sm" onClick={() => setIsNotificationsOpen(false)}>
               <div className="absolute top-16 right-4 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 border dark:border-slate-800" onClick={e => e.stopPropagation()}>
                   <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
                       <h3 className="font-bold text-slate-800 dark:text-white">Notifications</h3>
                       <button onClick={() => setIsNotificationsOpen(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full"><X className="w-4 h-4 text-slate-500 dark:text-slate-400"/></button>
                   </div>
                   <div className="max-h-[300px] overflow-y-auto p-2">
                       {notificationCount === 0 ? (
                           <div className="text-center py-8 text-slate-400 text-sm">No new notifications</div>
                       ) : (
                           <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl mb-2 border border-indigo-100 dark:border-indigo-800">
                               <p className="text-sm text-indigo-900 dark:text-indigo-300 font-medium">You have {notificationCount} new alerts in your area.</p>
                           </div>
                       )}
                   </div>
               </div>
          </div>
      )}

    </div>
  );
};

export default Layout;