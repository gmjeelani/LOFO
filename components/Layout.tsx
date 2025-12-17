import React, { useState } from 'react';
import { Home, PlusCircle, MessageCircle, User as UserIcon, Menu, X, Facebook, Instagram, Twitter, Info, Phone, HelpCircle, Bell, ArrowLeft, RefreshCw, HandHeart, LogOut, Settings, CheckCircle, Linkedin, Youtube, Trash2 } from 'lucide-react';
import { AppView, User, CityAlert } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  notificationCount: number;
  unreadChatCount?: number;
  user: User;
  onRestrictedAction: () => boolean;
  greenLogoUrl?: string;
  redLogoUrl?: string;
  onSidebarAction?: (action: string) => void;
  notifications?: CityAlert[];
  onMarkAsRead?: (id: string) => void;
  onDeleteNotification?: (id: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  currentView, 
  setCurrentView, 
  notificationCount,
  unreadChatCount = 0,
  user, 
  onRestrictedAction, 
  greenLogoUrl,
  redLogoUrl,
  onSidebarAction,
  notifications = [],
  onMarkAsRead,
  onDeleteNotification
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);

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

  const isVerified = user.emailVerified && user.phoneVerified;
  const defaultRedLogo = "https://placehold.co/400x400/ef4444/ffffff?text=LOFO";

  const toggleNotifications = () => {
      if (onRestrictedAction()) {
          setShowNotificationModal(!showNotificationModal);
      }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 max-w-5xl mx-auto shadow-2xl relative overflow-hidden transition-colors duration-200">
      
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

                   <div className="mt-6">
                       <p className="text-xs text-slate-400 uppercase font-bold mb-3 tracking-wider pl-3">Follow Us :</p>
                       <div className="flex items-center gap-3 pl-3">
                           <a href="#" className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-[#1877F2] hover:bg-slate-100 dark:hover:bg-slate-700 hover:scale-110 transition-all shadow-sm"><Facebook className="w-4 h-4" /></a>
                           <a href="#" className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-[#0A66C2] hover:bg-slate-100 dark:hover:bg-slate-700 hover:scale-110 transition-all shadow-sm"><Linkedin className="w-4 h-4" /></a>
                           <a href="#" className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-[#FF0000] hover:bg-slate-100 dark:hover:bg-slate-700 hover:scale-110 transition-all shadow-sm"><Youtube className="w-4 h-4" /></a>
                           <a href="#" className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-[#E4405F] hover:bg-slate-100 dark:hover:bg-slate-700 hover:scale-110 transition-all shadow-sm"><Instagram className="w-4 h-4" /></a>
                       </div>
                   </div>
               </div>
          </div>
          
          {/* Sidebar Footer (Tray) */}
          <div className="p-4 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0 mt-auto">
               <div className="text-center">
                   <p className="text-xs text-slate-400 font-medium">© 2024 LOFO.PK</p>
                   <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">v1.0.0 Beta</p>
               </div>
          </div>
      </div>
      
      {/* Header / Top Bar */}
      <div className="h-16 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-4 sticky top-0 z-30 shadow-sm transition-colors duration-200 shrink-0">
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
            onClick={() => {
                if (user.isGuest) {
                    setCurrentView('AUTH');
                } else {
                    handleNavClick('PROFILE');
                }
            }} 
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
               <button onClick={toggleNotifications} className={`p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300 transition-colors relative ${showNotificationModal ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : ''}`}>
                   <Bell className="w-6 h-6" />
                   {notificationCount > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse"></span>}
               </button>
          </div>
      </div>

      {/* Notification Modal / Overlay */}
      {showNotificationModal && (
          <>
            <div className="absolute inset-0 z-30" onClick={() => setShowNotificationModal(false)}></div>
            <div className="absolute top-16 right-2 w-80 max-h-[80vh] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-800 z-40 flex flex-col overflow-hidden animate-in slide-in-from-top-2">
                <div className="p-3 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                    <h3 className="font-bold text-sm dark:text-white">Notifications ({notificationCount})</h3>
                    {notificationCount > 0 && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">New</span>}
                </div>
                <div className="overflow-y-auto flex-1 p-2 space-y-2">
                    {notifications && notifications.length > 0 ? notifications.map(n => {
                        const isRead = user.readNotificationIds?.includes(n.id);
                        return (
                            <div key={n.id} onClick={() => { if(onMarkAsRead) onMarkAsRead(n.id); }} className={`p-3 rounded-xl flex items-start gap-3 relative group transition-colors cursor-pointer ${isRead ? 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800' : 'bg-indigo-50 dark:bg-indigo-900/20'}`}>
                                <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${isRead ? 'bg-slate-300 dark:bg-slate-700' : 'bg-indigo-500'}`}></div>
                                <div className="flex-1">
                                    <p className={`text-xs ${isRead ? 'text-slate-500 dark:text-slate-400' : 'font-bold text-slate-800 dark:text-slate-200'}`}>{n.message}</p>
                                    <span className="text-[10px] text-slate-400 block mt-1">{new Date(n.timestamp).toLocaleDateString()}</span>
                                </div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); if(onDeleteNotification) onDeleteNotification(n.id); }}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        );
                    }) : (
                        <div className="text-center py-8 text-slate-400">
                            <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                            <p className="text-xs">No notifications in your city.</p>
                        </div>
                    )}
                </div>
            </div>
          </>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative z-0">
          {children}
      </main>

      {/* Frozen Footer Menu */}
      <div className="h-16 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-2 sticky bottom-0 z-30 shrink-0 w-full shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button onClick={() => setCurrentView('HOME')} className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all w-16 ${currentView === 'HOME' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>
              <Home className={`w-6 h-6 ${currentView === 'HOME' ? 'fill-current' : ''}`} />
              <span className="text-[10px] font-bold mt-1">Home</span>
          </button>

          <button onClick={() => setCurrentView('MATCH_CASES')} className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all w-16 ${currentView === 'MATCH_CASES' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>
              <RefreshCw className="w-6 h-6" />
              <span className="text-[10px] font-bold mt-1">Match</span>
          </button>

          <button onClick={() => { if(onRestrictedAction()) setCurrentView('POST_FLOW'); }} className="flex flex-col items-center justify-center -mt-8 w-16">
              <div className="w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-300 dark:shadow-indigo-900 text-white hover:scale-105 transition-transform border-4 border-slate-50 dark:border-slate-950">
                  <PlusCircle className="w-8 h-8" />
              </div>
              <span className="text-[10px] font-bold mt-1 text-indigo-600 dark:text-indigo-400">Post</span>
          </button>

          <button onClick={() => { if(onRestrictedAction()) setCurrentView('CHAT_LIST'); }} className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all w-16 ${currentView === 'CHAT_LIST' || currentView === 'CHAT_ROOM' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'} relative`}>
              <div className="relative">
                  <MessageCircle className={`w-6 h-6 ${currentView === 'CHAT_LIST' ? 'fill-current' : ''}`} />
                  {unreadChatCount > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full"></span>}
              </div>
              <span className="text-[10px] font-bold mt-1">Chat</span>
          </button>

          <button onClick={() => { if(user.isGuest) setCurrentView('AUTH'); else setCurrentView('PROFILE'); }} className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all w-16 ${currentView === 'PROFILE' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>
              <UserIcon className={`w-6 h-6 ${currentView === 'PROFILE' ? 'fill-current' : ''}`} />
              <span className="text-[10px] font-bold mt-1">Profile</span>
          </button>
      </div>

    </div>
  );
};

export default Layout;