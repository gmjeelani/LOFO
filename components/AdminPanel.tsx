import React, { useState, useEffect } from 'react';
import { Users, Mail, Settings, Map, FileText, BarChart, ShieldAlert, LogOut, CheckCircle, XCircle, Trash2, Save, Upload, Plus, ChevronRight, ChevronLeft, HandHeart, FileSpreadsheet, Package, Search, Image as ImageIcon, Loader2, AlertTriangle, X } from 'lucide-react';
import { User, ItemPost, Report, AppSettings } from '../types';
import { doc, updateDoc, deleteDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { PAK_LOCATIONS, DEFAULT_CATEGORY_ITEMS } from '../services/mockData';

interface AdminPanelProps {
  db: any;
  onLogout: () => void;
  users: User[];
  posts: ItemPost[];
}

type AdminTab = 'DASHBOARD' | 'USERS' | 'EMAIL' | 'LOCATIONS' | 'CATEGORIES' | 'CMS' | 'REPORTS' | 'MATCHING' | 'LOST_ITEMS' | 'FOUND_ITEMS';

const AdminPanel: React.FC<AdminPanelProps> = ({ db, onLogout, users, posts }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('DASHBOARD');
  const [settings, setSettings] = useState<AppSettings>({});
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Local User State for optimistic UI updates on delete
  const [localUsers, setLocalUsers] = useState<User[]>(users);

  // --- DELETE FEATURE STATE ---
  const [deleteModal, setDeleteModal] = useState<{
      isOpen: boolean, 
      id: string | null, 
      type: 'users' | 'posts' | 'city' | 'area' | 'subArea' | 'category' | 'categoryItem' | null,
      extraData?: any
  }>({
      isOpen: false, id: null, type: null
  });
  
  const [toast, setToast] = useState<{show: boolean, msg: string, type: 'success' | 'error'}>({
      show: false, msg: '', type: 'success'
  });

  // CMS State
  const [cmsForm, setCmsForm] = useState<AppSettings>({
      donationInfo: { bankName: '', accountTitle: '', accountNumber: '', iban: '' },
      aboutUs: '',
      contactUs: '',
      howItWorks: '',
      redLogoUrl: '',
      greenLogoUrl: '',
      sliderImages: []
  });
  const [isSavingCMS, setIsSavingCMS] = useState(false);
  
  // Location Management State
  const [locData, setLocData] = useState<any>(PAK_LOCATIONS);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newArea, setNewArea] = useState('');
  const [newSubArea, setNewSubArea] = useState('');

  // Category State
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryItems, setCategoryItems] = useState<Record<string, string[]>>(DEFAULT_CATEGORY_ITEMS);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [newItemName, setNewItemName] = useState('');

  // Email State
  const [emailTarget, setEmailTarget] = useState<'ALL' | 'LOST_POSTERS' | 'FOUND_POSTERS' | 'SINGLE'>('ALL');
  const [singleEmail, setSingleEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  useEffect(() => {
    fetchSettings();
    fetchReports();
  }, []);

  // Sync users prop to local state
  useEffect(() => {
      setLocalUsers(users);
  }, [users]);

  // --- TOAST HELPER ---
  const triggerToast = (msg: string, type: 'success' | 'error') => {
      setToast({ show: true, msg, type });
      setTimeout(() => setToast(prev => ({...prev, show: false})), 3000);
  };

  const fetchSettings = async () => {
    try {
        setLoading(true);
        const docRef = doc(db, 'settings', 'general');
        const docSnap = await (await import('firebase/firestore')).getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data() as AppSettings;
            setSettings(data);
            setCmsForm({
                ...data,
                donationInfo: data.donationInfo || { bankName: '', accountTitle: '', accountNumber: '', iban: '' },
                sliderImages: data.sliderImages || []
            });
            
            if (data.customLocations && Object.keys(data.customLocations).length > 0) {
                setLocData(data.customLocations);
            }
            
            if (data.categoryItems) {
                setCategoryItems(data.categoryItems);
                setCategories(Object.keys(data.categoryItems));
            } else if (data.customCategories) {
                setCategories(data.customCategories);
            }
        }
    } catch (error) {
        console.error("Error fetching settings", error);
    } finally {
        setLoading(false);
    }
  };

  const fetchReports = async () => {
      try {
          const snap = await getDocs(collection(db, 'reports'));
          const fetchedReports = snap.docs.map(d => ({ id: d.id, ...d.data() } as Report));
          setReports(fetchedReports);
      } catch (e) {
          console.warn("Failed to fetch reports", e);
      }
  };

  // --- DELETE LOGIC ---
  const initiateDelete = (id: string, type: 'users' | 'posts' | 'city' | 'area' | 'subArea' | 'category' | 'categoryItem', extraData?: any) => {
      setDeleteModal({ isOpen: true, id, type, extraData });
  };

  const executeDelete = async () => {
      const { id, type, extraData } = deleteModal;
      if (!id || !type) return;
      
      try {
          if (type === 'users' || type === 'posts') {
              // REAL FIRESTORE DELETE for Documents
              await deleteDoc(doc(db, type, id));
              
              // Update Local State immediately
              if (type === 'users') {
                   setLocalUsers(prev => prev.filter(u => u.id !== id));
              }
              // Posts update automatically via App.tsx snapshot listener
          } 
          else if (type === 'city') {
               const nl = { ...locData };
               delete nl[id];
               await updateLocations(nl);
               if(selectedCity === id) { setSelectedCity(''); setSelectedArea(''); }
          }
          else if (type === 'area') {
               const { city } = extraData;
               const nl = JSON.parse(JSON.stringify(locData));
               delete nl[city][id];
               await updateLocations(nl);
               if(selectedArea === id) setSelectedArea('');
          }
          else if (type === 'subArea') {
               const { city, area } = extraData;
               const nl = JSON.parse(JSON.stringify(locData));
               nl[city][area] = nl[city][area].filter((s: string) => s !== id);
               await updateLocations(nl);
          }
          else if (type === 'category') {
               const newItems = { ...categoryItems };
               delete newItems[id];
               await updateCategories(newItems);
               if(selectedCategory === id) setSelectedCategory(null);
          }
          else if (type === 'categoryItem') {
               const { category } = extraData;
               const newItems = { ...categoryItems };
               newItems[category] = newItems[category].filter((i: string) => i !== id);
               await updateCategories(newItems);
          }
          
          triggerToast("Record deleted successfully", "success");
      } catch (error) {
          console.error(error);
          triggerToast("Failed to delete record", "error");
      } finally {
          setDeleteModal({ isOpen: false, id: null, type: null, extraData: undefined });
      }
  };

  const handleSaveCMS = async () => {
      setIsSavingCMS(true);
      try {
          const newSettings = {
              ...settings,
              ...cmsForm,
              categoryItems,
              customLocations: locData
          };

          await setDoc(doc(db, 'settings', 'general'), newSettings, { merge: true });
          setSettings(newSettings);
          triggerToast("CMS Settings saved!", "success");
      } catch (error) {
          console.error(error);
          triggerToast("Failed to save settings.", "error");
      } finally {
          setIsSavingCMS(false);
      }
  };

  const handleBlockUser = async (userId: string, currentStatus?: boolean) => {
      if(window.confirm(`Are you sure you want to ${currentStatus ? 'unblock' : 'block'} this user?`)) {
          try {
            await updateDoc(doc(db, 'users', userId), { isBlocked: !currentStatus });
            // Update local state to reflect block status immediately
            setLocalUsers(prev => prev.map(u => u.id === userId ? { ...u, isBlocked: !currentStatus } : u));
            triggerToast(`User ${currentStatus ? 'unblocked' : 'blocked'}`, "success");
          } catch(e) {
            console.error(e);
            triggerToast("Action failed", "error");
          }
      }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'redLogoUrl' | 'greenLogoUrl') => {
      const file = e.target.files?.[0];
      if (file) {
          if (file.size > 1024 * 1024) { 
              triggerToast("File too large. Max 1MB.", "error");
              return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
              setCmsForm(prev => ({ ...prev, [field]: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSliderImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          if (file.size > 500 * 1024) { 
              triggerToast("Slider image too large. Max 500KB to prevent database issues.", "error");
              return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
              const newImage = reader.result as string;
              setCmsForm(prev => ({ ...prev, sliderImages: [...(prev.sliderImages || []), newImage] }));
          };
          reader.readAsDataURL(file);
      }
  };

  const deleteSliderImage = (index: number) => {
      setCmsForm(prev => ({
          ...prev,
          sliderImages: prev.sliderImages?.filter((_, i) => i !== index)
      }));
  };

  const handleLocationImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          const text = event.target?.result as string;
          if (!text) return;

          const lines = text.split(/\r\n|\n/);
          const tempLocData = { ...locData };
          let addedCount = 0;

          lines.forEach(line => {
              const parts = line.split(',').map(s => s.trim());
              if (parts.length < 1 || parts[0] === '') return;

              const city = parts[0];
              const area = parts[1]; 
              const subArea = parts[2]; 

              if (!tempLocData[city]) tempLocData[city] = {};
              if (area) {
                  if (!tempLocData[city][area]) tempLocData[city][area] = [];
                  if (subArea && !tempLocData[city][area].includes(subArea)) {
                      tempLocData[city][area].push(subArea);
                  }
              }
              addedCount++;
          });
          
          updateLocations(tempLocData);
          triggerToast(`Processed ${addedCount} rows.`, "success");
      };
      reader.readAsText(file);
  };

  const handleSendEmail = () => {
      if (!emailSubject.trim()) { triggerToast("Subject required", "error"); return; }
      triggerToast(`Email sent to ${emailTarget}`, "success");
  };

  // --- Realtime DB Helpers ---

  const updateLocations = async (newLocations: any) => {
      setLocData(newLocations);
      try {
          await setDoc(doc(db, 'settings', 'general'), { customLocations: newLocations }, { merge: true });
      } catch (e) { 
          console.error(e); 
          triggerToast("Failed to sync locations.", "error");
      }
  };

  const updateCategories = async (newItems: Record<string, string[]>) => {
      setCategoryItems(newItems);
      setCategories(Object.keys(newItems));
      try {
          await setDoc(doc(db, 'settings', 'general'), { 
              categoryItems: newItems,
              customCategories: Object.keys(newItems)
          }, { merge: true });
      } catch (e) { 
          console.error(e); 
          triggerToast("Failed to sync categories.", "error");
      }
  };

  // --- Location CRUD ---

  const addCity = () => { 
      const city = newCity.trim();
      if(city && !locData[city]) { 
          const nl = { ...locData, [city]: {} };
          updateLocations(nl); 
          setNewCity(''); 
      } 
  };
  
  const addArea = () => { 
      const area = newArea.trim();
      if(selectedCity && area && !locData[selectedCity][area]) { 
          const nl = JSON.parse(JSON.stringify(locData));
          nl[selectedCity][area] = [];
          updateLocations(nl); 
          setNewArea(''); 
      } 
  };
  
  const addSubArea = () => { 
      const sub = newSubArea.trim();
      if(selectedCity && selectedArea && sub) { 
          const nl = JSON.parse(JSON.stringify(locData));
          if (!nl[selectedCity][selectedArea].includes(sub)) {
             nl[selectedCity][selectedArea].push(sub);
             updateLocations(nl); 
             setNewSubArea(''); 
          }
      } 
  };
  
  const deleteCity = (city: string) => { 
      initiateDelete(city, 'city');
  };
  
  const deleteArea = (area: string) => { 
      if(selectedCity) {
          initiateDelete(area, 'area', { city: selectedCity });
      }
  };
  
  const deleteSubArea = (sub: string) => { 
      if(selectedCity && selectedArea) {
          initiateDelete(sub, 'subArea', { city: selectedCity, area: selectedArea });
      }
  };

  // --- Category CRUD ---

  const addCategory = () => {
      const cat = newCategory.trim();
      if(cat && !categoryItems[cat]) {
          updateCategories({ ...categoryItems, [cat]: [] });
          setNewCategory('');
      }
  };

  const deleteCategory = (cat: string) => {
      initiateDelete(cat, 'category');
  };

  const addItemToCategory = () => {
      const item = newItemName.trim();
      if(selectedCategory && item) {
          const newItems = { ...categoryItems };
          const currentList = newItems[selectedCategory] || [];
          if (!currentList.includes(item)) {
               newItems[selectedCategory] = [...currentList, item];
               updateCategories(newItems);
               setNewItemName('');
          }
      }
  };

  const deleteItemFromCategory = (itemName: string) => {
      if(selectedCategory) {
          initiateDelete(itemName, 'categoryItem', { category: selectedCategory });
      }
  };

  // --- Post Management ---

  const handleTogglePostStatus = async (postId: string, currentStatus: string) => {
     try {
        await updateDoc(doc(db, 'posts', postId), { status: currentStatus === 'OPEN' ? 'RESOLVED' : 'OPEN' });
        triggerToast("Status updated", "success");
     } catch(e) { console.error(e); }
  };

  const resolveReport = async (reportId: string) => {
      try {
          await updateDoc(doc(db, 'reports', reportId), { status: 'RESOLVED' });
          fetchReports();
          triggerToast("Report resolved", "success");
      } catch (e) { console.error(e); }
  };

  // --- RENDER COMPONENTS ---

  const RenderToast = () => (
      toast.show ? (
          <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-white font-bold animate-in slide-in-from-bottom-5 z-[100] ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
              {toast.type === 'success' ? <CheckCircle className="w-5 h-5"/> : <AlertTriangle className="w-5 h-5"/>}
              {toast.msg}
          </div>
      ) : null
  );

  const RenderDeleteModal = () => (
      deleteModal.isOpen ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                  <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                          <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-500" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Delete Record?</h3>
                      <p className="text-slate-500 dark:text-slate-300 mb-6 text-sm">
                          This action is permanent and cannot be undone. Are you sure you want to proceed?
                      </p>
                      <div className="flex gap-3 w-full">
                          <button 
                              onClick={() => setDeleteModal({isOpen: false, id: null, type: null, extraData: undefined})} 
                              className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-bold rounded-xl transition-colors"
                          >
                              Cancel
                          </button>
                          <button 
                              onClick={executeDelete} 
                              className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-200 dark:shadow-none transition-colors"
                          >
                              Confirm Delete
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      ) : null
  );

  const renderPostTable = (type: 'LOST' | 'FOUND') => {
      const filteredPosts = posts.filter(p => p.type === type);
      return (
          <div className="animate-in fade-in duration-500">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                  {type === 'LOST' ? <Package className="w-6 h-6 text-red-500"/> : <Search className="w-6 h-6 text-emerald-500"/>}
                  {type === 'LOST' ? 'Lost' : 'Found'} Items Management
              </h2>
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                      <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200">
                          <tr>
                              <th className="p-4">Item</th>
                              <th className="p-4">Category</th>
                              <th className="p-4">City</th>
                              <th className="p-4">Posted By</th>
                              <th className="p-4">Status</th>
                              <th className="p-4 text-right">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          {filteredPosts.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-400">No items found.</td></tr> : 
                              filteredPosts.map(post => (
                                  <tr key={post.id} className="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                                      <td className="p-4">
                                          <div className="font-bold text-slate-800 dark:text-white">{post.itemName || post.title}</div>
                                          <div className="text-xs text-slate-500 dark:text-slate-400">{new Date(post.date).toLocaleDateString()}</div>
                                      </td>
                                      <td className="p-4"><span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-xs font-semibold">{post.category}</span></td>
                                      <td className="p-4 text-slate-600 dark:text-slate-300">{post.city}</td>
                                      <td className="p-4">
                                          <div className="font-medium text-slate-800 dark:text-white">{post.authorName}</div>
                                          <div className="text-xs text-slate-400">ID: {post.authorId.slice(0,6)}...</div>
                                      </td>
                                      <td className="p-4">
                                          <span className={`px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit ${post.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                                              {post.status === 'OPEN' ? 'Active' : 'Inactive'}
                                          </span>
                                      </td>
                                      <td className="p-4 flex gap-2 justify-end">
                                          <button type="button" onClick={(e) => { e.stopPropagation(); handleTogglePostStatus(post.id, post.status); }} title="Toggle Status" className="p-2 border dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"><CheckCircle className="w-4 h-4" /></button>
                                          {/* TRIGGER DELETE MODAL */}
                                          <button type="button" onClick={(e) => { e.stopPropagation(); initiateDelete(post.id, 'posts'); }} title="Delete Post" className="p-2 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /></button>
                                      </td>
                                  </tr>
                              ))
                          }
                      </tbody>
                  </table>
              </div>
          </div>
      );
  };

  const renderUsers = () => (
    <div className="animate-in fade-in duration-500">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2"><Users className="w-6 h-6 text-indigo-600"/> User Management</h2>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 flex justify-between items-center">
                <span className="font-bold text-slate-700 dark:text-white">Total Users: {localUsers.length}</span>
            </div>
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                    <tr>
                        <th className="p-4">User</th>
                        <th className="p-4">Contact</th>
                        <th className="p-4">Location</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {localUsers.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                            <td className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex-shrink-0">
                                        {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover"/> : <span className="flex h-full w-full items-center justify-center font-bold text-slate-500 dark:text-slate-400">{u.name.charAt(0)}</span>}
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800 dark:text-white">{u.name}</div>
                                        <div className="text-xs text-slate-400">ID: {u.id.slice(0,6)}...</div>
                                    </div>
                                </div>
                            </td>
                            <td className="p-4">
                                <div className="text-slate-600 dark:text-slate-300">{u.email}</div>
                                <div className="text-xs text-slate-400">{u.phone || 'No phone'}</div>
                            </td>
                            <td className="p-4 text-slate-600 dark:text-slate-300">{u.city || 'N/A'}</td>
                            <td className="p-4">
                                {u.isBlocked ? 
                                    <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><XCircle className="w-3 h-3"/> Blocked</span> : 
                                    <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><CheckCircle className="w-3 h-3"/> Active</span>
                                }
                            </td>
                            <td className="p-4 text-right flex justify-end gap-2">
                                <button 
                                    type="button"
                                    onClick={() => handleBlockUser(u.id, u.isBlocked)}
                                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${u.isBlocked ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-900/30' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30'}`}
                                >
                                    {u.isBlocked ? 'Unblock' : 'Block'}
                                </button>
                                {/* TRIGGER DELETE MODAL FOR USER */}
                                <button 
                                    type="button"
                                    onClick={() => initiateDelete(u.id, 'users')}
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/30"
                                    title="Delete User"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  );

  const renderCMS = () => (
    <div className="animate-in fade-in duration-500 max-w-4xl">
        <div className="flex justify-between items-center mb-6">
             <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><FileText className="w-6 h-6 text-indigo-600"/> Content Management & Logos</h2>
             <button onClick={handleSaveCMS} disabled={isSavingCMS} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50">
                 {isSavingCMS ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />} Save Changes
             </button>
        </div>

        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 border-b dark:border-slate-700 pb-2">App Logos</h3>
                <div className="grid grid-cols-2 gap-8">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Red Logo (Splash Screen)</label>
                        <div className="flex items-center gap-4">
                            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-lg flex items-center justify-center p-2 overflow-hidden">
                                {cmsForm.redLogoUrl ? <img src={cmsForm.redLogoUrl} className="max-w-full max-h-full object-contain"/> : <span className="text-xs text-slate-400">No Logo</span>}
                            </div>
                            <label className="cursor-pointer bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2">
                                <Upload className="w-4 h-4" /> Upload
                                <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'redLogoUrl')} />
                            </label>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Green Logo (App Header)</label>
                        <div className="flex items-center gap-4">
                            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-lg flex items-center justify-center p-2 overflow-hidden">
                                {cmsForm.greenLogoUrl ? <img src={cmsForm.greenLogoUrl} className="max-w-full max-h-full object-contain"/> : <span className="text-xs text-slate-400">No Logo</span>}
                            </div>
                            <label className="cursor-pointer bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2">
                                <Upload className="w-4 h-4" /> Upload
                                <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'greenLogoUrl')} />
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Slider Images Section */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 border-b dark:border-slate-700 pb-2 flex items-center justify-between">
                    <span>Home Slider Images</span>
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">Recommended: 1200x400px</span>
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    {cmsForm.sliderImages && cmsForm.sliderImages.length > 0 ? (
                        cmsForm.sliderImages.map((img, idx) => (
                            <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 h-32 bg-slate-50 dark:bg-slate-900">
                                <img src={img} alt={`Slide ${idx+1}`} className="w-full h-full object-cover" />
                                <button 
                                    onClick={() => deleteSliderImage(idx)}
                                    className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 shadow-sm"
                                    title="Delete Slide"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full py-8 text-center text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                            No slider images added yet. The default Welcome banner will be shown.
                        </div>
                    )}
                </div>

                <div className="flex justify-start">
                    <label className="cursor-pointer bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-6 py-3 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 border border-indigo-200 dark:border-indigo-800">
                        <Plus className="w-5 h-5" /> Add Slider Image
                        <input type="file" accept="image/*" className="hidden" onChange={handleSliderImageUpload} />
                    </label>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 border-b dark:border-slate-700 pb-2">Information Pages</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">About Us</label>
                        <textarea rows={4} className="w-full p-3 border dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none" value={cmsForm.aboutUs || ''} onChange={e => setCmsForm({...cmsForm, aboutUs: e.target.value})} placeholder="Enter About Us text..." />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Contact Us</label>
                        <textarea rows={3} className="w-full p-3 border dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none" value={cmsForm.contactUs || ''} onChange={e => setCmsForm({...cmsForm, contactUs: e.target.value})} placeholder="Enter Contact details..." />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">How It Works</label>
                        <textarea rows={4} className="w-full p-3 border dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 outline-none" value={cmsForm.howItWorks || ''} onChange={e => setCmsForm({...cmsForm, howItWorks: e.target.value})} placeholder="Explain app usage..." />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 border-b dark:border-slate-700 pb-2 flex items-center gap-2"><HandHeart className="w-5 h-5 text-pink-500"/> Donation Settings</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Bank Name</label>
                        <input type="text" className="w-full p-3 border dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-xl" value={cmsForm.donationInfo?.bankName || ''} onChange={e => setCmsForm({...cmsForm, donationInfo: {...(cmsForm.donationInfo || {}), bankName: e.target.value} as any})} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Account Title</label>
                        <input type="text" className="w-full p-3 border dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-xl" value={cmsForm.donationInfo?.accountTitle || ''} onChange={e => setCmsForm({...cmsForm, donationInfo: {...(cmsForm.donationInfo || {}), accountTitle: e.target.value} as any})} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Account Number</label>
                        <input type="text" className="w-full p-3 border dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-xl" value={cmsForm.donationInfo?.accountNumber || ''} onChange={e => setCmsForm({...cmsForm, donationInfo: {...(cmsForm.donationInfo || {}), accountNumber: e.target.value} as any})} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">IBAN</label>
                        <input type="text" className="w-full p-3 border dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-xl" value={cmsForm.donationInfo?.iban || ''} onChange={e => setCmsForm({...cmsForm, donationInfo: {...(cmsForm.donationInfo || {}), iban: e.target.value} as any})} />
                    </div>
                </div>
            </div>
        </div>
    </div>
  );

  const renderReports = () => (
      <div className="animate-in fade-in duration-500">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2"><ShieldAlert className="w-6 h-6 text-orange-500"/> Reported Users</h2>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200">
                      <tr>
                          <th className="p-4">Reported User</th>
                          <th className="p-4">Reason</th>
                          <th className="p-4">Reported By</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 text-right">Actions</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {reports.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-400">No active reports.</td></tr> : 
                          reports.map(rep => (
                              <tr key={rep.id} className="hover:bg-slate-50 dark:hover:bg-slate-750">
                                  <td className="p-4 font-bold text-slate-800 dark:text-white">
                                      {users.find(u => u.id === rep.reportedUserId)?.name || 'Unknown User'}
                                      <div className="text-xs text-slate-400">ID: {rep.reportedUserId.slice(0,6)}...</div>
                                  </td>
                                  <td className="p-4 text-red-600 font-medium">{rep.reason}</td>
                                  <td className="p-4 text-slate-600 dark:text-slate-300">
                                      {users.find(u => u.id === rep.reporterId)?.name || 'Unknown'}
                                  </td>
                                  <td className="p-4">
                                      <span className={`px-2 py-1 rounded text-xs font-bold ${rep.status === 'PENDING' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>{rep.status}</span>
                                  </td>
                                  <td className="p-4 text-right">
                                      {rep.status === 'PENDING' && (
                                          <button type="button" onClick={() => resolveReport(rep.id)} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700">Mark Resolved</button>
                                      )}
                                  </td>
                              </tr>
                          ))
                      }
                  </tbody>
              </table>
          </div>
      </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex font-sans transition-colors duration-200">
        {/* Sidebar */}
        <div className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-indigo-900 dark:bg-slate-900 text-white flex flex-col fixed h-full z-50 overflow-hidden transition-all duration-300 shadow-xl`}>
            <div className={`p-4 border-b border-indigo-800 dark:border-slate-800 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} shrink-0 h-16`}>
                {!isSidebarCollapsed && (
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold shrink-0">L</div>
                        <h1 className="text-xl font-bold tracking-tight truncate">LOFO Admin</h1>
                    </div>
                )}
                 {isSidebarCollapsed && (
                    <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold shrink-0">L</div>
                )}
                <button 
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
                    className={`text-indigo-300 hover:text-white p-2 rounded-lg hover:bg-indigo-800 dark:hover:bg-slate-800 transition-colors ${isSidebarCollapsed ? 'hidden group-hover:block absolute left-14 top-4 bg-indigo-900 z-50 shadow-md' : ''}`}
                    title="Toggle Sidebar"
                >
                    {isSidebarCollapsed ? <ChevronRight className="w-5 h-5"/> : <ChevronLeft className="w-5 h-5"/>}
                </button>
            </div>
            
            <nav className="flex-1 p-2 space-y-1 overflow-y-auto custom-scrollbar">
                {[
                    { id: 'DASHBOARD', icon: BarChart, label: 'Dashboard' },
                    { id: 'USERS', icon: Users, label: 'User Management' },
                    { id: 'LOST_ITEMS', icon: Package, label: 'Lost Items' },
                    { id: 'FOUND_ITEMS', icon: Search, label: 'Found Items' },
                    { id: 'EMAIL', icon: Mail, label: 'Email System' },
                    { id: 'LOCATIONS', icon: Map, label: 'Locations (CRUD)' },
                    { id: 'CATEGORIES', icon: Settings, label: 'Categories' },
                    { id: 'CMS', icon: FileText, label: 'CMS & Logos' },
                    { id: 'REPORTS', icon: ShieldAlert, label: 'Reported Users' },
                ].map((item) => (
                    <button 
                        key={item.id} 
                        onClick={() => setActiveTab(item.id as AdminTab)} 
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-indigo-200 hover:bg-indigo-800 dark:hover:bg-slate-800 hover:text-white'} ${isSidebarCollapsed ? 'justify-center' : ''}`}
                        title={isSidebarCollapsed ? item.label : ''}
                    >
                        <item.icon className="w-5 h-5 shrink-0" /> 
                        {!isSidebarCollapsed && <span className="font-medium text-sm truncate">{item.label}</span>}
                    </button>
                ))}
            </nav>
            <div className="p-2 border-t border-indigo-800 dark:border-slate-800 shrink-0">
                <button 
                    onClick={onLogout} 
                    className={`w-full flex items-center gap-2 text-red-300 p-3 hover:bg-indigo-800 dark:hover:bg-slate-800 rounded-xl transition-colors ${isSidebarCollapsed ? 'justify-center' : ''}`}
                    title={isSidebarCollapsed ? "Logout" : ""}
                >
                    <LogOut className="w-5 h-5 shrink-0" /> 
                    {!isSidebarCollapsed && "Logout"}
                </button>
            </div>
        </div>

        {/* Main Content */}
        <div className={`flex-1 ${isSidebarCollapsed ? 'ml-20' : 'ml-64'} p-8 overflow-y-auto transition-all duration-300`}>
            {loading ? <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-indigo-600"/></div> : (
              <>
                {activeTab === 'DASHBOARD' && (
                    <div className="animate-in fade-in duration-500">
                        <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-6">Dashboard Overview</h2>
                        <div className="grid grid-cols-4 gap-6">
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700"><p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Total Users</p><p className="text-4xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">{localUsers.length}</p></div>
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700"><p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Total Posts</p><p className="text-4xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">{posts.length}</p></div>
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700"><p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Lost Items</p><p className="text-4xl font-bold text-red-500 mt-2">{posts.filter(p => p.type === 'LOST').length}</p></div>
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700"><p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Found Items</p><p className="text-4xl font-bold text-emerald-500 mt-2">{posts.filter(p => p.type === 'FOUND').length}</p></div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'USERS' && renderUsers()}
                {activeTab === 'CMS' && renderCMS()}
                {activeTab === 'REPORTS' && renderReports()}
                {activeTab === 'LOST_ITEMS' && renderPostTable('LOST')}
                {activeTab === 'FOUND_ITEMS' && renderPostTable('FOUND')}

                {activeTab === 'CATEGORIES' && (
                    <div className="animate-in fade-in duration-500">
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Categories Management</h2>
                        <div className="grid grid-cols-2 gap-6 h-[600px]">
                            {/* Category List */}
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col shadow-sm">
                                <h3 className="font-bold mb-4 text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">1. Categories</h3>
                                <div className="flex gap-2 mb-4">
                                    <input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="New Category Name" className="flex-1 p-2 border dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                                    <button type="button" onClick={addCategory} disabled={!newCategory} className="p-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"><Plus className="w-5 h-5" /></button>
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-1 pr-2">
                                    {Object.keys(categoryItems).sort().map(cat => (
                                        <div key={cat} className={`p-3 rounded-lg flex justify-between items-center cursor-pointer transition-colors ${selectedCategory === cat ? 'bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-50 dark:hover:bg-slate-750 border border-transparent text-slate-700 dark:text-slate-300'}`} onClick={() => setSelectedCategory(cat)}>
                                            <div className="flex-1 flex justify-between items-center mr-2 font-medium text-sm">
                                                {cat} <ChevronRight className="w-4 h-4 text-slate-400" />
                                            </div>
                                            <button type="button" onClick={(e) => { e.stopPropagation(); deleteCategory(cat); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Item Names List */}
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col shadow-sm">
                                <h3 className="font-bold mb-4 text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">2. Item Names {selectedCategory ? `(in ${selectedCategory})` : ''}</h3>
                                {selectedCategory ? (
                                    <>
                                        <div className="flex gap-2 mb-4">
                                            <input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="New Item Name" className="flex-1 p-2 border dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                                            <button type="button" onClick={addItemToCategory} disabled={!newItemName} className="p-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"><Plus className="w-5 h-5" /></button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto space-y-1 pr-2">
                                            {(categoryItems[selectedCategory] || []).map((item, idx) => (
                                                <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-750 rounded-lg text-slate-700 dark:text-slate-300 flex justify-between group items-center text-sm border border-slate-100 dark:border-slate-700">
                                                    {item}
                                                    <button type="button" onClick={() => deleteItemFromCategory(item)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Select a category to manage items.</div>}
                            </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'LOCATIONS' && (
                    <div className="animate-in fade-in duration-500">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Location Management</h2>
                            <label className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2 cursor-pointer shadow-sm transition-colors text-sm">
                                <FileSpreadsheet className="w-4 h-4" /> Import CSV
                                <input type="file" accept=".csv" className="hidden" onChange={handleLocationImport} onClick={(e) => (e.target as HTMLInputElement).value = ''} />
                            </label>
                        </div>
                        <div className="grid grid-cols-3 gap-6 h-[600px]">
                            {/* Cities */}
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col shadow-sm">
                                <h3 className="font-bold mb-4 text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">1. Cities</h3>
                                <div className="flex gap-2 mb-4">
                                    <input value={newCity} onChange={e => setNewCity(e.target.value)} placeholder="New City" className="flex-1 p-2 border dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                                    <button type="button" onClick={addCity} disabled={!newCity} className="p-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"><Plus className="w-5 h-5" /></button>
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-1 pr-2">
                                    {Object.keys(locData).sort().map(city => (
                                        <div key={city} className={`p-3 rounded-lg flex justify-between items-center group transition-colors ${selectedCity === city ? 'bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-50 dark:hover:bg-slate-750 border border-transparent text-slate-700 dark:text-slate-300'}`}>
                                            <div className="flex-1 cursor-pointer flex justify-between items-center mr-2 font-medium text-sm" onClick={() => { setSelectedCity(city); setSelectedArea(''); }}>
                                                {city} <ChevronRight className="w-4 h-4 text-slate-400" />
                                            </div>
                                            <button type="button" onClick={(e) => { e.stopPropagation(); deleteCity(city); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Areas */}
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col shadow-sm">
                                <h3 className="font-bold mb-4 text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">2. Areas</h3>
                                {selectedCity ? (
                                    <>
                                        <div className="flex gap-2 mb-4">
                                            <input value={newArea} onChange={e => setNewArea(e.target.value)} placeholder="New Area" className="flex-1 p-2 border dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                                            <button type="button" onClick={addArea} disabled={!newArea} className="p-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"><Plus className="w-5 h-5" /></button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto space-y-1 pr-2">
                                            {Object.keys(locData[selectedCity] || {}).map(area => (
                                                <div key={area} className={`p-3 rounded-lg flex justify-between items-center group transition-colors ${selectedArea === area ? 'bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-50 dark:hover:bg-slate-750 border border-transparent text-slate-700 dark:text-slate-300'}`}>
                                                    <div className="flex-1 cursor-pointer flex justify-between items-center mr-2 font-medium text-sm" onClick={() => setSelectedArea(area)}>
                                                        {area} <ChevronRight className="w-4 h-4 text-slate-400" />
                                                    </div>
                                                    <button type="button" onClick={(e) => { e.stopPropagation(); deleteArea(area); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Select city first</div>}
                            </div>
                            
                            {/* Sub Areas */}
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col shadow-sm">
                                <h3 className="font-bold mb-4 text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">3. Sub-Areas</h3>
                                {selectedArea ? (
                                    <>
                                        <div className="flex gap-2 mb-4">
                                            <input value={newSubArea} onChange={e => setNewSubArea(e.target.value)} placeholder="New Sub-Area" className="flex-1 p-2 border dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-lg text-sm" />
                                            <button type="button" onClick={addSubArea} disabled={!newSubArea} className="p-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"><Plus className="w-5 h-5" /></button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto space-y-1 pr-2">
                                            {(locData[selectedCity]?.[selectedArea] || []).map((sub: string, idx: number) => (
                                                <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-750 rounded-lg text-slate-700 dark:text-slate-300 flex justify-between group items-center text-sm border border-slate-100 dark:border-slate-700">
                                                    {sub}
                                                    <button type="button" onClick={(e) => { e.stopPropagation(); deleteSubArea(sub); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Select area first</div>}
                            </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'EMAIL' && (
                    <div className="animate-in fade-in duration-500 max-w-2xl">
                         <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2"><Mail className="w-6 h-6 text-indigo-600"/> Email System</h2>
                         <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                             <div>
                                 <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Recipient Group</label>
                                 <select className="w-full p-3 border dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-xl" value={emailTarget} onChange={(e) => setEmailTarget(e.target.value as any)}>
                                     <option value="ALL">All Users</option>
                                     <option value="LOST_POSTERS">Users who posted Lost items</option>
                                     <option value="FOUND_POSTERS">Users who posted Found items</option>
                                     <option value="SINGLE">Single User (Specific Email)</option>
                                 </select>
                             </div>
                             {emailTarget === 'SINGLE' && (
                                 <div>
                                     <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">User Email</label>
                                     <input className="w-full p-3 border dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-xl" placeholder="user@example.com" value={singleEmail} onChange={e => setSingleEmail(e.target.value)}/>
                                 </div>
                             )}
                             <div>
                                 <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Subject</label>
                                 <input className="w-full p-3 border dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-xl" placeholder="Important Announcement" value={emailSubject} onChange={e => setEmailSubject(e.target.value)}/>
                             </div>
                             <div>
                                 <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Message Body</label>
                                 <textarea rows={6} className="w-full p-3 border dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-xl" placeholder="Type your message here..." value={emailBody} onChange={e => setEmailBody(e.target.value)}/>
                             </div>
                             <button onClick={handleSendEmail} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none">Send Email</button>
                         </div>
                    </div>
                )}
              </>
            )}
        </div>
        
        {/* Modal and Toast rendered at the root level of component */}
        <RenderDeleteModal />
        <RenderToast />
    </div>
  );
};

export default AdminPanel;