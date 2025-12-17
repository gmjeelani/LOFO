import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, Filter, MapPin, X, ArrowLeft, Send, Image as ImageIcon, CheckCircle, AlertCircle, Loader2, MessageCircle, SlidersHorizontal, Trash2, Camera, Shield, ShieldAlert, Mail, Phone, Edit2, User as UserIcon, LogOut, Facebook, Lock, PhoneCall, ClipboardList, Eye, EyeOff, Tag, RefreshCw, Link as LinkIcon, ExternalLink, Package, Calendar, HandHeart, Copy, Check, Settings, Moon, Sun, UserX, Archive, List, ChevronRight, Paperclip, Reply, Smile, MoreVertical, Zap, Bell, Info } from 'lucide-react';
import { signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword, deleteUser, sendPasswordResetEmail, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, addDoc, onSnapshot, query, orderBy, getDocs, deleteDoc, updateDoc, arrayUnion } from 'firebase/firestore';

import { AppView, ItemPost, PostType, ChatSession, ChatMessage, User, AppSettings, CityAlert } from './types';
import { GUEST_USER, INITIAL_POSTS, CATEGORIES as DEFAULT_CATEGORIES, CITIES as DEFAULT_CITIES, PAK_LOCATIONS, ADMIN_CREDENTIALS, DEFAULT_CATEGORY_ITEMS } from './services/mockData';
import { findPotentialMatch } from './services/geminiService';
import { auth, db, googleProvider, facebookProvider } from './services/firebase';
import Layout from './components/Layout';
import ItemCard from './components/ItemCard';
import AdminPanel from './components/AdminPanel';
import { GoogleLoginButton } from './components/auth/GoogleLoginButton';

// Default Placeholders
const DEFAULT_RED_LOGO = "https://placehold.co/400x400/ef4444/ffffff?text=LOFO"; 

// --- Image Compression Helper ---
const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error("Canvas context missing"));
                    return;
                }

                // Max dimensions to ensure file size is small (< 200KB usually)
                const MAX_WIDTH = 1000;
                const MAX_HEIGHT = 1000;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                // Compress to JPEG at 0.6 quality
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                resolve(dataUrl);
            };
            img.onerror = (e) => reject(e);
        };
        reader.onerror = (e) => reject(e);
    });
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('SPLASH');
  const [user, setUser] = useState<User>(GUEST_USER);
  const [posts, setPosts] = useState<ItemPost[]>([]); 
  const [allUsers, setAllUsers] = useState<User[]>([]); // For Admin
  const [selectedItem, setSelectedItem] = useState<ItemPost | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<User | null>(null); // Author of selected item
  
  // App Config State (Dynamic from Admin)
  const [appSettings, setAppSettings] = useState<AppSettings>({});
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [categoryItems, setCategoryItems] = useState<Record<string, string[]>>(DEFAULT_CATEGORY_ITEMS);
  const [cities, setCities] = useState<string[]>(DEFAULT_CITIES);
  const [locations, setLocations] = useState<any>(PAK_LOCATIONS);

  // Post Flow State
  const [postType, setPostType] = useState<PostType | null>(null);
  const [postForm, setPostForm] = useState<Partial<ItemPost>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({}); // New: Track form errors
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Filter State
  const [activeTypeFilter, setActiveTypeFilter] = useState<'ALL' | 'LOST' | 'FOUND'>('ALL');
  const [activeCity, setActiveCity] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [activeItemName, setActiveItemName] = useState<string>(''); // For dependent filter
  const [searchQuery, setSearchQuery] = useState('');
  const [activeArea, setActiveArea] = useState<string>('');
  const [activeSubArea, setActiveSubArea] = useState<string>('');

  // Chat State
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChatPartner, setActiveChatPartner] = useState<User | null>(null); // New: Store partner details
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [newMessage, setNewMessage] = useState('');
  const [currentChatMessages, setCurrentChatMessages] = useState<ChatMessage[]>([]);
  
  // Advanced Chat State
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [chatImage, setChatImage] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null); // Message ID

  // Matching Logic State
  const [matchResult, setMatchResult] = useState<{ matchedId: string | null; confidence: number; reason: string } | null>(null);
  const [isMatching, setIsMatching] = useState(false);

  // Notifications & Modals
  const [notifications, setNotifications] = useState<CityAlert[]>([]);
  const [matchNotification, setMatchNotification] = useState<{show: boolean, matchedPostId: string | null} | null>(null);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [infoPageData, setInfoPageData] = useState<{title: string, content: string}>({ title: '', content: '' });
  const prevNotificationCount = useRef(0);
  
  // Slider State
  const [currentSlide, setCurrentSlide] = useState(0);

  // Password Management Modals
  const [showForgotPassModal, setShowForgotPassModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [confirmNewPass, setConfirmNewPass] = useState('');
  
  // Toast & Error State
  // Updated type to include title
  const [errorPopup, setErrorPopup] = useState<{show: boolean, message: string, title?: string} | null>(null);
  const [toast, setToast] = useState<{show: boolean, message: string, type: 'success' | 'error'}>({show: false, message: '', type: 'success'});
  
  // Donation Copy State
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Profile Edit State
  const [profileForm, setProfileForm] = useState<Partial<User>>({});
  const [verifyingField, setVerifyingField] = useState<'email' | 'phone' | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Settings State
  const [darkMode, setDarkMode] = useState(() => {
      // Initialize from local storage
      const saved = localStorage.getItem('lofo_dark_mode');
      return saved === 'true';
  });

  // Auth State
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Registration State
  const [registerName, setRegisterName] = useState('');
  const [registerCity, setRegisterCity] = useState('');
  const [registerMobile, setRegisterMobile] = useState('');
  const [justRegisteredName, setJustRegisteredName] = useState('');
  const isRegistering = useRef(false);

  // Derived Slides for Home Screen
  const featureSlides = [
      { type: 'feature', title: 'Instant Matching', desc: 'Our AI automatically connects lost items with found reports instantly.', icon: RefreshCw, gradient: 'from-indigo-500 to-purple-600', sub: 'Smart AI' },
      { type: 'feature', title: 'City Notifications', desc: 'Get real-time alerts for items reported in your specific area.', icon: Bell, gradient: 'from-emerald-500 to-teal-600', sub: 'Live Alerts' },
      { type: 'feature', title: 'Secure Chat', desc: 'Communicate safely with others without revealing your phone number.', icon: Shield, gradient: 'from-blue-500 to-cyan-500', sub: 'Privacy First' }
  ];
  const imageSlides = (appSettings.sliderImages || []).map(img => ({ type: 'image', content: img }));
  const allSlides = [...imageSlides, ...featureSlides];

  // Calculated count of active filters (excluding search query and type filter tabs)
  const activeFilterCount = [activeCity, activeCategory, activeArea, activeItemName].filter(Boolean).length;

  // --- Effects ---
  
  // Dark Mode Logic
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('lofo_dark_mode', darkMode.toString());
  }, [darkMode]);

  // Request Notification Permissions
  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission();
    }
  }, []);

  // Initialize post form contact when user loads
  useEffect(() => {
      if (user && !user.isGuest) {
          setPostForm(prev => ({ ...prev, contactPhone: user.phone || '' }));
      }
  }, [user]);

  // Fetch Global Settings (Logos, Locations, etc.) - Realtime
  useEffect(() => {
      const settingsRef = doc(db, 'settings', 'general');
      const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
          if (docSnap.exists()) {
              const data = docSnap.data() as AppSettings;
              setAppSettings(data);
              
              if (data.categoryItems) {
                  setCategoryItems(data.categoryItems);
                  setCategories(Object.keys(data.categoryItems));
              } else if (data.customCategories) {
                  setCategories(data.customCategories);
              }
              
              if (data.customLocations && Object.keys(data.customLocations).length > 0) {
                  setLocations(data.customLocations);
                  setCities(Object.keys(data.customLocations).sort());
              }
          }
      }, (error) => {
          console.warn("Error listening to settings:", error);
      });

      return () => unsubscribe();
  }, []); 

  // Slider Rotation
  useEffect(() => {
      const interval = setInterval(() => {
          setCurrentSlide(prev => (prev + 1) % (allSlides.length || 1));
      }, 5000);
      return () => clearInterval(interval);
  }, [allSlides.length]);

  // Splash Screen Timer
  useEffect(() => {
    if (currentView === 'SPLASH') {
      const timer = setTimeout(() => {
        // If admin, go dashboard, otherwise go HOME (allows Guest browsing)
        if (user.email === ADMIN_CREDENTIALS.email) {
             setCurrentView('ADMIN_DASHBOARD');
        } else {
             setCurrentView('HOME');
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentView, user]);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Prevent auto-login redirection if we are in the middle of a registration flow
      if (isRegistering.current) return;

      if (firebaseUser) {
        
        // Check if Admin
        if (firebaseUser.email === ADMIN_CREDENTIALS.email) {
             setUser({
                 id: firebaseUser.uid,
                 name: 'Administrator',
                 email: firebaseUser.email,
                 isGuest: false,
                 emailVerified: true,
                 phoneVerified: true
             });
             setCurrentView('ADMIN_DASHBOARD');
             setIsLoggingIn(false);
             return;
        }

        const basicUser: User = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'New User',
            email: firebaseUser.email || '',
            avatar: firebaseUser.photoURL || '',
            isGuest: false,
            emailVerified: firebaseUser.emailVerified,
            phoneVerified: false,
            readNotificationIds: [],
            deletedNotificationIds: []
        };

        try {
            const userRef = doc(db, 'users', firebaseUser.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data() as User;
                // Check if blocked
                if (userData.isBlocked) {
                    setErrorPopup({ show: true, message: "Your account has been blocked by the administrator." });
                    await signOut(auth);
                    setIsLoggingIn(false);
                    return;
                }
                // Ensure arrays exist
                if (!userData.readNotificationIds) userData.readNotificationIds = [];
                if (!userData.deletedNotificationIds) userData.deletedNotificationIds = [];
                
                setUser({ ...userData, id: firebaseUser.uid });
            } else {
                setUser(basicUser);
                if (currentView === 'AUTH') {
                    setProfileForm(basicUser);
                    setCurrentView('PROFILE'); 
                    setIsLoggingIn(false);
                    return;
                }
            }
        } catch (error: any) {
            console.warn("Error fetching user profile:", error.message);
            setUser(basicUser);
        }

        if (currentView === 'AUTH' || currentView === 'SPLASH') {
            setCurrentView('HOME');
        }
        setIsLoggingIn(false);

      } else {
        // No user logged in - Default to Guest, stay on current page (unless splash handled it)
        setUser(GUEST_USER);
      }
    });

    return () => unsubscribe();
  }, [currentView]);

  // Sync profile form with user data
  useEffect(() => {
    if (currentView === 'PROFILE' && user && !user.isGuest) {
      setProfileForm({ ...user });
    }
  }, [currentView, user]);

  // Fetch Author Details when viewing Item Detail
  useEffect(() => {
    if (currentView === 'ITEM_DETAIL' && selectedItem) {
        const fetchAuthor = async () => {
            try {
                const userSnap = await getDoc(doc(db, 'users', selectedItem.authorId));
                if (userSnap.exists()) {
                    setSelectedAuthor(userSnap.data() as User);
                } else {
                    setSelectedAuthor(null);
                }
            } catch (error) {
                console.error("Error fetching author details:", error);
                setSelectedAuthor(null);
            }
        };
        fetchAuthor();
    } else {
        setSelectedAuthor(null);
    }
  }, [selectedItem, currentView]);


  // Fetch Posts
  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedPosts: ItemPost[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ItemPost));
            setPosts(fetchedPosts); 
        },
        (error) => { console.error(error); }
    );
    return () => unsubscribe();
  }, []);

  // Fetch All Users (For Admin Only)
  useEffect(() => {
      if (currentView === 'ADMIN_DASHBOARD') {
          const fetchUsers = async () => {
              const snap = await getDocs(collection(db, 'users'));
              setAllUsers(snap.docs.map(d => ({id: d.id, ...d.data()} as User)));
          };
          fetchUsers();
      }
  }, [currentView]);

  // Listen to Chats
  useEffect(() => {
    if (user.isGuest) {
        setChats([]);
        return;
    }
    const q = query(collection(db, 'chats'), orderBy('lastMessageTime', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const myChats = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as ChatSession))
            .filter(c => c.participants.includes(user.id));
        setChats(myChats);
    });
    return () => unsubscribe();
  }, [user.id, user.isGuest]);

  // Listen to Messages & Fetch Partner Logic
  useEffect(() => {
    if (!activeChatId) return;

    // 1. Fetch Partner Details
    const chatSession = chats.find(c => c.id === activeChatId);
    if (chatSession && user.id) {
        const partnerId = chatSession.participants.find(p => p !== user.id);
        if (partnerId) {
             getDoc(doc(db, 'users', partnerId)).then(snap => {
                 if(snap.exists()) setActiveChatPartner(snap.data() as User);
             });
        }
    }

    // 2. Listen to Messages
    const messagesRef = collection(db, 'chats', activeChatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as ChatMessage));
        setCurrentChatMessages(msgs);
        setMessages(prev => ({ ...prev, [activeChatId]: msgs }));
        
        // --- MARK AS READ LOGIC ---
        // If we are viewing this chat, reset our unread count
        if (user.id && chatSession) {
            if (chatSession.unreadCounts && chatSession.unreadCounts[user.id] > 0) {
                 const newCounts = { ...chatSession.unreadCounts, [user.id]: 0 };
                 updateDoc(doc(db, 'chats', activeChatId), { unreadCounts: newCounts }).catch(e => console.error(e));
            }
        }
    });
    return () => unsubscribe();
  }, [activeChatId, user.id]); // Removed chats dependency to avoid re-running on list update

  // Listen to City Alerts with User Context
  useEffect(() => {
      if (user.isGuest) return;
      
      const q = query(collection(db, 'city_alerts'), orderBy('timestamp', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
          const rawAlerts = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
          } as CityAlert));

          // 1. Filter by City
          const myCityAlerts = user.city ? rawAlerts.filter(a => a.city === user.city) : [];
          
          // 2. Filter out Deleted alerts
          const visibleAlerts = myCityAlerts.filter(a => !user.deletedNotificationIds?.includes(a.id));
          
          setNotifications(visibleAlerts);

          // 3. Count Unread (Total Visible - Read ones)
          const unreadCount = visibleAlerts.filter(a => !user.readNotificationIds?.includes(a.id)).length;

          if (unreadCount > prevNotificationCount.current) {
               if (prevNotificationCount.current !== 0 && visibleAlerts.length > 0) {
                   const latestAlert = visibleAlerts[0];
                   // Don't alert if I posted it
                   if (Notification.permission === 'granted') {
                       new Notification("New Item in " + user.city, {
                           body: latestAlert.message,
                           icon: appSettings.redLogoUrl || DEFAULT_RED_LOGO
                       });
                   }
               }
          }
          prevNotificationCount.current = unreadCount;
      });
      return () => unsubscribe();
  }, [user.isGuest, user.city, user.readNotificationIds, user.deletedNotificationIds]);


  // --- Helpers ---

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ show: true, message, type });
      setTimeout(() => setToast(prev => ({...prev, show: false})), 3000);
  };

  const requireAuth = (): boolean => {
    if (user.isGuest) {
      // Changed title to Information
      setErrorPopup({ show: true, message: "Please sign up or log in to access this feature.", title: "Information" });
      setCurrentView('AUTH');
      return false;
    }
    return true;
  };

  const getWhatsAppLink = (phone: string, title: string) => {
      const cleanPhone = phone.replace(/\D/g, '');
      const message = `Hi, I saw your post regarding "${title}" on LOFO.PK and wanted to discuss it.`;
      return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };
  
  const unreadChatCount = chats.reduce((acc, chat) => {
      return acc + (chat.unreadCounts?.[user.id] || 0);
  }, 0);

  const unreadNotificationCount = notifications.filter(n => !user.readNotificationIds?.includes(n.id)).length;

  const validatePostForm = (form: Partial<ItemPost>) => {
      const errors: Record<string, string> = {};
      if (!form.category) errors.category = "Please select a category.";
      if (!form.title || form.title.length < 3) errors.title = "Title must be at least 3 characters.";
      if (!form.city) errors.city = "Please select a city.";
      if (!form.area) errors.area = "Please select an area.";
      if (!form.description || form.description.length < 10) errors.description = "Description must be at least 10 characters.";
      
      // Validate Item Name only if the category has items defined
      if (form.category && categoryItems[form.category] && categoryItems[form.category].length > 0) {
          if (!form.itemName) errors.itemName = "Please select an item type.";
      }

      if (!form.contactPhone || form.contactPhone.length < 10) errors.contactPhone = "Please enter a valid contact number.";

      return errors;
  };

  // --- Handlers ---
  const handleSidebarAction = async (action: string) => {
      if (action === 'POST_LOST') {
          if (requireAuth()) {
              setPostType('LOST');
              setPostForm({ contactPhone: user.phone || '' });
              setFormErrors({});
              setCurrentView('POST_FLOW');
          }
      } else if (action === 'POST_FOUND') {
          if (requireAuth()) {
              setPostType('FOUND');
              setPostForm({ contactPhone: user.phone || '' });
              setFormErrors({});
              setCurrentView('POST_FLOW');
          }
      } else if (action === 'POST_SELECT') {
          if (requireAuth()) {
              setPostType(null);
              setPostForm({ contactPhone: user.phone || '' });
              setFormErrors({});
              setCurrentView('POST_FLOW');
          }
      } else if (action === 'MATCH_CASES') {
          setCurrentView('MATCH_CASES');
      } else if (action === 'RESOLVED_CASES') {
          setCurrentView('RESOLVED_CASES');
      } else if (action === 'ABOUT') {
          setInfoPageData({ title: 'About Us', content: appSettings.aboutUs || 'We are LOFO.PK, Pakistan\'s central lost and found platform.' });
          setCurrentView('INFO_SCREEN');
      } else if (action === 'CONTACT') {
          setInfoPageData({ title: 'Contact Us', content: appSettings.contactUs || 'Email: support@lofo.pk' });
          setCurrentView('INFO_SCREEN');
      } else if (action === 'HOW_IT_WORKS') {
          setInfoPageData({ title: 'How it Works', content: appSettings.howItWorks || '1. Post Item\n2. Match\n3. Contact' });
          setCurrentView('INFO_SCREEN');
      } else if (action === 'DONATION') {
          setShowDonationModal(true);
      } else if (action === 'SETTINGS') {
          setCurrentView('SETTINGS');
      } else if (action === 'LOGOUT') {
          await handleLogout();
      }
  };
  
  const handleCopy = (text: string, field: string) => {
    if (!text || text === 'Not Set') return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const validateEmail = (email: string) => {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!re.test(email)) return { valid: false, error: "Invalid email ID format." };
      
      if (email.includes('@')) {
          const domain = email.split('@')[1].toLowerCase();
          // Check for common gmail misspellings
          if (domain !== 'gmail.com' && (
              domain === 'gmil.com' || 
              domain === 'gmal.com' || 
              domain === 'gmaill.com' ||
              domain === 'gamil.com' ||
              (domain.startsWith('gm') && domain.endsWith('l.com') && domain.length !== 9)
          )) {
              return { valid: false, error: "Wrong email ID. Did you mean @gmail.com?" };
          }
      }
      return { valid: true };
  };

  // Trigger Forgot Password Modal
  const handleForgotPasswordRequest = () => {
      setForgotEmail('');
      setShowForgotPassModal(true);
  };

  // Submit Forgot Password Link
  const handleSendResetEmail = async () => {
      if(!forgotEmail) {
          showToast("Please enter your email", "error");
          return;
      }
      const val = validateEmail(forgotEmail);
      if(!val.valid) {
          showToast(val.error || "Invalid Email", "error");
          return;
      }

      setIsSubmitting(true);
      try {
          await sendPasswordResetEmail(auth, forgotEmail);
          setShowForgotPassModal(false);
          showToast("Reset link sent! Please check your inbox.", "success");
      } catch (error: any) {
          let msg = "Failed to send reset link.";
          if(error.code === 'auth/user-not-found') msg = "This email is not registered with us.";
          else if(error.code === 'auth/invalid-email') msg = "Invalid email format.";
          
          setErrorPopup({ show: true, message: msg });
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleEmailAuth = async (e: React.FormEvent) => { 
      e.preventDefault(); 
      
      const emailVal = validateEmail(email);
      if (!emailVal.valid) { 
          setErrorPopup({ show: true, message: emailVal.error || "Invalid Email" });
          return; 
      }

      if (password.length < 6) { 
          setErrorPopup({ show: true, message: "Password must be at least 6 characters." });
          return; 
      }

      setIsLoggingIn(true);
      try { 
          if (email === ADMIN_CREDENTIALS.email && authMode === 'LOGIN') {
              await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
              await signInWithEmailAndPassword(auth, email, password); 
          } else { 
              if (authMode === 'REGISTER') {
                  if (!registerName || !registerCity || !registerMobile) {
                      setIsLoggingIn(false);
                      setErrorPopup({ show: true, message: "Please fill in all fields (Name, City, Mobile)." });
                      return;
                  }
                  
                  isRegistering.current = true;
                  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                  
                  // Save extended user details
                  await setDoc(doc(db, 'users', userCredential.user.uid), {
                      id: userCredential.user.uid,
                      name: registerName,
                      email: email,
                      city: registerCity,
                      phone: registerMobile,
                      isGuest: false,
                      emailVerified: false,
                      phoneVerified: false,
                      avatar: '',
                      readNotificationIds: [],
                      deletedNotificationIds: []
                  });

                  await signOut(auth); // Sign out immediately to show login screen
                  isRegistering.current = false;
                  
                  setJustRegisteredName(registerName);
                  setAuthMode('LOGIN');
                  setPassword(''); // Clear password for security
                  // Email stays filled
                  setIsLoggingIn(false);
                  showToast("Registration successful! Please log in.", "success");
              } else { 
                  // Login Flow
                  await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
                  await signInWithEmailAndPassword(auth, email, password); 
              } 
          } 
      } catch (e: any) { 
          setIsLoggingIn(false);
          isRegistering.current = false;
          
          let msg = e.message;
          if(e.code === 'auth/email-already-in-use') msg = "Email already registered. Please log in.";
          else if(e.code === 'auth/wrong-password') msg = "Incorrect password.";
          else if(e.code === 'auth/invalid-credential') msg = "Invalid Email or Password.";
          else if(e.code === 'auth/user-not-found') msg = "User not found.";
          else if(e.code === 'auth/too-many-requests') msg = "Too many failed attempts. Please try again later.";
          else if(e.code === 'auth/network-request-failed') msg = "Network error. Check your internet connection.";
          
          setErrorPopup({ show: true, message: msg });
      } 
  };

  const handleLogout = async () => { await signOut(auth); setCurrentView('AUTH'); };
  
  const handleProfileSave = async () => { 
      if (!profileForm.name || !profileForm.city || !profileForm.age) {
          showToast("Please fill in Name, City, and Age.", "error");
          return;
      }
      setIsSavingProfile(true); 
      try { 
          await setDoc(doc(db, 'users', user.id), { ...user, ...profileForm }, { merge: true }); 
          setUser({ ...user, ...profileForm } as User); 
          setCurrentView('HOME'); 
          setShowWelcomeBanner(true); 
          showToast("Profile saved successfully!", "success");
      } catch (e) { showToast("Failed to save profile.", "error"); } 
      finally { setIsSavingProfile(false); } 
  };
  
  // Trigger Change Password Modal
  const handleChangePasswordRequest = () => {
      setNewPass('');
      setConfirmNewPass('');
      setShowChangePassModal(true);
  };

  // Submit Change Password
  const handleSubmitChangePassword = async () => {
      if(newPass.length < 6) {
          showToast("Password must be at least 6 characters.", "error");
          return;
      }
      if(newPass !== confirmNewPass) {
          showToast("Passwords do not match.", "error");
          return;
      }
      
      setIsSubmitting(true);
      try {
          if (auth.currentUser) {
              await updatePassword(auth.currentUser, newPass);
              setShowChangePassModal(false);
              showToast("Password updated successfully.", "success");
          } else {
              showToast("You are not logged in.", "error");
          }
      } catch (e: any) {
          if (e.code === 'auth/requires-recent-login') {
              setShowChangePassModal(false);
              setErrorPopup({ show: true, message: "Security Check: Please log out and log in again to change your password." });
          } else {
              setErrorPopup({ show: true, message: "Error: " + e.message });
          }
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleDeleteAccount = async () => {
      if (confirm("Are you sure you want to delete your account? This action cannot be undone and will delete your profile data.")) {
          try {
              if (auth.currentUser) {
                  // Delete user data first
                  await deleteDoc(doc(db, 'users', user.id));
                  // Then delete auth user
                  await deleteUser(auth.currentUser);
                  setCurrentView('AUTH');
                  showToast("Account deleted.", "success");
              }
          } catch (e: any) {
              if (e.code === 'auth/requires-recent-login') {
                 alert("For security reasons, deleting your account requires a recent login. Please log in again and try.");
                 await signOut(auth);
                 setCurrentView('AUTH');
              } else {
                 alert("Error: " + e.message);
              }
          }
      }
  };

  const handlePrivacyPolicy = () => {
      setInfoPageData({
          title: "Privacy Policy",
          content: `Effective Date: ${new Date().toLocaleDateString()}\n\n1. Information Collection: We collect name, email, and lost/found item details to facilitate matching.\n\n2. Data Usage: Your data is used solely for matching lost items with found items and communicating with other users.\n\n3. Data Sharing: We do not sell your personal data. Contact details are shared only with other users when you initiate contact regarding a lost/found item.\n\n4. User Control: You can delete your posts and account at any time via Settings.`
      });
      setCurrentView('INFO_SCREEN');
  };

  const handlePostStatusChange = async (postId: string, newStatus: 'OPEN' | 'RESOLVED' | 'INACTIVE') => {
      try {
          await updateDoc(doc(db, 'posts', postId), { status: newStatus });
          showToast("Status updated successfully", "success");
      } catch(e) {
          showToast("Failed to update status.", "error");
      }
  };
  
  const handleTogglePostStatus = async (postId: string, currentStatus: string) => {
     try {
        const newStatus = currentStatus === 'OPEN' ? 'RESOLVED' : 'OPEN';
        await updateDoc(doc(db, 'posts', postId), { status: newStatus });
        showToast("Status updated successfully", "success");
     } catch(e) {
        console.error(e);
        showToast("Failed to update status.", "error");
     }
  };

  const handleReportUser = async (reportedUserId: string) => { 
      const reason = prompt("Please enter a reason for reporting this user:"); 
      if(reason) { 
          await addDoc(collection(db, 'reports'), { reporterId: user.id, reportedUserId, reason, timestamp: Date.now(), status: 'PENDING' }); 
          showToast("Report submitted. Admins will review.", "success"); 
      } 
  };

  const initiateVerification = (field: 'email' | 'phone') => { 
      if(field === 'email' && !profileForm.email) { showToast("Please enter email first", "error"); return; }
      if(field === 'phone' && !profileForm.phone) { showToast("Please enter phone first", "error"); return; }
      
      showToast(`Simulated OTP sent to ${field === 'email' ? profileForm.email : profileForm.phone}`, "success"); 
      setVerifyingField(field); 
      setOtpInput(''); 
  };

  const submitOtp = () => { 
      if (otpInput === '1234') { 
          setProfileForm(prev => ({ 
              ...prev, 
              [verifyingField === 'email' ? 'emailVerified' : 'phoneVerified']: true 
          })); 
          setVerifyingField(null); 
          showToast("Verified successfully!", "success"); 
      } else {
          showToast("Invalid OTP", "error"); 
      }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate type
      if (!file.type.startsWith('image/')) {
          showToast("Please select an image file.", "error");
          return;
      }

      setIsUploadingImage(true);
      setUploadProgress(10); // Start progress

      try {
          // Simulate progress for better UX (since client compression is mostly sync)
          const interval = setInterval(() => {
              setUploadProgress(prev => Math.min(prev + 10, 90));
          }, 100);

          const compressedBase64 = await compressImage(file);
          
          clearInterval(interval);
          setUploadProgress(100);
          
          setPostForm(prev => ({ ...prev, imageUrl: compressedBase64 }));
          showToast("Image compressed & ready!", "success");
      } catch (error) {
          console.error("Image processing error:", error);
          showToast("Failed to process image.", "error");
      } finally {
          // Delay hiding the progress to let user see 100%
          setTimeout(() => {
              setIsUploadingImage(false);
              setUploadProgress(0);
          }, 500);
      }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          if (file.size > 2 * 1024 * 1024) { 
              showToast("Image size should be less than 2MB", "error");
              return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
              setProfileForm(prev => ({ ...prev, avatar: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  // --- Notification Handlers ---
  
  const handleMarkNotificationAsRead = async (alertId: string, post?: ItemPost) => {
      if (user.readNotificationIds?.includes(alertId)) {
          if (post) { setSelectedItem(post); setCurrentView('ITEM_DETAIL'); }
          return;
      }

      try {
          const userRef = doc(db, 'users', user.id);
          await updateDoc(userRef, {
              readNotificationIds: arrayUnion(alertId)
          });
          // Optimistic update
          setUser(prev => ({
              ...prev,
              readNotificationIds: [...(prev.readNotificationIds || []), alertId]
          }));
          if (post) { setSelectedItem(post); setCurrentView('ITEM_DETAIL'); }
      } catch (error) {
          console.error("Error marking read", error);
      }
  };

  const handleDeleteNotification = async (alertId: string) => {
      try {
          const userRef = doc(db, 'users', user.id);
          await updateDoc(userRef, {
              deletedNotificationIds: arrayUnion(alertId)
          });
          // Optimistic update
          setUser(prev => ({
              ...prev,
              deletedNotificationIds: [...(prev.deletedNotificationIds || []), alertId]
          }));
      } catch (error) {
          console.error("Error deleting notification", error);
      }
  };

  // --- Chat Handlers ---

  const handleChatImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => setChatImage(reader.result as string);
          reader.readAsDataURL(file);
      }
  };

  const handleMessageReaction = async (messageId: string, emoji: string) => {
      if (!activeChatId) return;
      const msgRef = doc(db, 'chats', activeChatId, 'messages', messageId);
      
      try {
          const currentMsg = currentChatMessages.find(m => m.id === messageId);
          if (currentMsg) {
              const currentReactions = currentMsg.reactions || {};
              const usersForEmoji = currentReactions[emoji] || [];
              
              let newUsersForEmoji;
              if (usersForEmoji.includes(user.id)) {
                  newUsersForEmoji = usersForEmoji.filter(id => id !== user.id); 
              } else {
                  newUsersForEmoji = [...usersForEmoji, user.id]; 
              }
              
              const newReactions = { ...currentReactions, [emoji]: newUsersForEmoji };
              if (newUsersForEmoji.length === 0) delete newReactions[emoji];

              await updateDoc(msgRef, { reactions: newReactions });
          }
      } catch (e) { console.error(e); }
      setShowEmojiPicker(null);
  };

  const sendMessage = async () => { 
      if ((!newMessage.trim() && !chatImage) || !activeChatId) return; 
      
      const chatDoc = chats.find(c => c.id === activeChatId);
      let newUnreadCounts = chatDoc?.unreadCounts || {};
      
      if (chatDoc) {
          chatDoc.participants.forEach(pId => {
              if (pId !== user.id) newUnreadCounts[pId] = (newUnreadCounts[pId] || 0) + 1;
              else newUnreadCounts[pId] = 0; 
          });
      }

      const msgData: Partial<ChatMessage> = { 
          senderId: user.id, 
          text: newMessage, 
          timestamp: Date.now() 
      };

      if (chatImage) {
          msgData.imageUrl = chatImage;
      }

      if (replyingTo) {
          msgData.replyTo = {
              id: replyingTo.id,
              text: replyingTo.text,
              senderName: replyingTo.senderId === user.id ? 'You' : (activeChatPartner?.name || 'User')
          };
      }

      await addDoc(collection(db, 'chats', activeChatId, 'messages'), msgData); 
      
      await setDoc(doc(db, 'chats', activeChatId), { 
          lastMessage: chatImage ? '📷 Image' : newMessage, 
          lastMessageTime: Date.now(),
          unreadCounts: newUnreadCounts 
      }, { merge: true }); 
      
      setNewMessage(''); 
      setChatImage(null);
      setReplyingTo(null);
  };

  const startChat = async (item: ItemPost) => { 
      if (!requireAuth()) return; 
      const ex = chats.find(c => c.itemId === item.id); 
      if(ex) { 
          setActiveChatId(ex.id); 
          setCurrentView('CHAT_ROOM'); 
          if (ex.unreadCounts && ex.unreadCounts[user.id] > 0) {
             await updateDoc(doc(db, 'chats', ex.id), { unreadCounts: { ...ex.unreadCounts, [user.id]: 0 } });
          }
          return; 
      } 
      const d = await addDoc(collection(db, 'chats'), { 
          itemId: item.id, 
          participants: [user.id, item.authorId], 
          itemTitle: item.title, 
          lastMessage: '', 
          lastMessageTime: Date.now(),
          unreadCounts: { [user.id]: 0, [item.authorId]: 0 } 
      }); 
      setActiveChatId(d.id); 
      setCurrentView('CHAT_ROOM'); 
  };
  
  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireAuth()) return;
    
    // Validate Form
    const errors = validatePostForm(postForm);
    if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
    }
    
    setIsSubmitting(true);

    // Create ID first to use in alert
    const newPostRef = doc(collection(db, 'posts'));

    const newPostData: Omit<ItemPost, 'id'> = {
      type: postType!,
      title: postForm.title || 'Untitled',
      itemName: postForm.itemName || '',
      description: postForm.description || '',
      category: postForm.category || 'Other',
      city: postForm.city || 'Unknown',
      area: postForm.area || '',
      subArea1: postForm.subArea1 || '',
      subArea2: postForm.subArea2 || '',
      date: new Date().toISOString(),
      imageUrl: postForm.imageUrl,
      authorId: user.id,
      authorName: user.name,
      authorAvatar: user.avatar || '',
      contactPhone: postForm.contactPhone || user.phone || '', // Use form phone or fall back to user profile
      status: 'OPEN'
    };

    try {
        await setDoc(newPostRef, newPostData);
        if (newPostData.city) {
            let alertMsg = '';
            if (newPostData.type === 'LOST') {
                alertMsg = `${newPostData.itemName || newPostData.title} lost in ${newPostData.city}`;
            } else {
                alertMsg = `${newPostData.itemName || newPostData.title} found in ${newPostData.city}`;
            }
            await addDoc(collection(db, 'city_alerts'), {
                message: alertMsg,
                city: newPostData.city, 
                timestamp: Date.now(),
                type: newPostData.type,
                postId: newPostRef.id
            });
        }

        setIsSubmitting(false);
        setPostType(null);
        setPostForm({ contactPhone: user.phone || '' });
        setFormErrors({});
        setCurrentView('HOME');
        
        showToast("Post submitted successfully!", "success");

        const potentialMatch = posts.find(p => p.type !== newPostData.type && p.city === newPostData.city && p.category === newPostData.category);
        if (potentialMatch) {
            setMatchNotification({ show: true, matchedPostId: potentialMatch.id });
        }

    } catch (error) {
        setIsSubmitting(false);
        showToast("Failed to post.", "error");
    }
  };

  const handleDeleteOwnPost = async (postId: string) => {
      if(window.confirm("Are you sure you want to delete this post?")) {
          try { 
              await deleteDoc(doc(db, 'posts', postId)); 
              showToast("Post deleted successfully", "success");
              if (currentView !== 'MY_POSTS') {
                   setCurrentView('HOME');
              }
          } catch(e) { 
              console.error(e); 
              showToast("Failed to delete.", "error");
          }
      }
  };
  const handleViewMatch = () => { if (matchNotification?.matchedPostId) { setSelectedItem(posts.find(p => p.id === matchNotification.matchedPostId) || null); setCurrentView('ITEM_DETAIL'); } setMatchNotification(null); };
  const handleDismissMatch = () => { setMatchNotification(null); setCurrentView('HOME'); };

  // --- Render Functions ---

  const renderPostTypeSelection = () => (
    <div className="flex flex-col items-center justify-center h-full p-6 space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">What would you like to post?</h2>
      <button 
        onClick={() => { setPostType('LOST'); setPostForm({ contactPhone: user.phone || '' }); setFormErrors({}); }} 
        className="w-full py-6 bg-red-50 hover:bg-red-100 border-2 border-red-500 dark:bg-red-900/10 dark:hover:bg-red-900/20 dark:border-red-500/50 rounded-2xl flex flex-col items-center gap-3 transition-all group"
      >
        <div className="p-4 bg-red-500 rounded-full text-white group-hover:scale-110 transition-transform">
           <AlertCircle className="w-8 h-8" />
        </div>
        <span className="text-xl font-bold text-red-600 dark:text-red-400">I Lost Something</span>
      </button>

      <button 
        onClick={() => { setPostType('FOUND'); setPostForm({ contactPhone: user.phone || '' }); setFormErrors({}); }} 
        className="w-full py-6 bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-500 dark:bg-emerald-900/10 dark:hover:bg-emerald-900/20 dark:border-emerald-500/50 rounded-2xl flex flex-col items-center gap-3 transition-all group"
      >
        <div className="p-4 bg-emerald-500 rounded-full text-white group-hover:scale-110 transition-transform">
           <CheckCircle className="w-8 h-8" />
        </div>
        <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">I Found Something</span>
      </button>
    </div>
  );

  const renderPostFlow = () => {
    const renderOptions = (items: string[]) => items.map(i => <option key={i} value={i}>{i}</option>);
    const categoryList = categories;
    const itemList = postForm.category && categoryItems[postForm.category] ? categoryItems[postForm.category] : [];
    const cityList = cities;
    const areaList = postForm.city && locations[postForm.city] ? Object.keys(locations[postForm.city]).sort() : [];
    const subAreaList = postForm.city && postForm.area && locations[postForm.city][postForm.area] ? locations[postForm.city][postForm.area] : [];

    return (
      <div className="flex flex-col h-full bg-white dark:bg-slate-900">
        <div className="p-4 border-b dark:border-slate-800 flex items-center gap-3">
          <button onClick={() => { setPostType(null); setCurrentView('HOME'); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
            <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-300" />
          </button>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">Post {postType === 'LOST' ? 'Lost' : 'Found'} Item</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handlePostSubmit} className="space-y-6">
            <div className="flex flex-col items-center">
              <label className={`w-full h-48 bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors overflow-hidden relative ${isUploadingImage ? 'cursor-not-allowed opacity-80' : ''}`}>
                
                {isUploadingImage ? (
                    <div className="flex flex-col items-center justify-center w-full px-10">
                        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
                        <div className="w-full bg-slate-200 rounded-full h-2.5 dark:bg-slate-700">
                            <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                        <p className="text-xs text-slate-500 mt-2 font-bold animate-pulse">Compressing & Uploading... {uploadProgress}%</p>
                    </div>
                ) : postForm.imageUrl ? (
                  <img src={postForm.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Camera className="w-10 h-10 text-slate-400 mb-2" />
                    <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Tap to upload photo</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} disabled={isUploadingImage} />
              </label>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Category <span className="text-red-500">*</span></label>
                <select 
                    className={`w-full p-3 bg-slate-50 dark:bg-slate-800 border rounded-xl font-medium dark:text-white ${formErrors.category ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700'}`} 
                    value={postForm.category || ''} 
                    onChange={e => {
                        setPostForm({ ...postForm, category: e.target.value, itemName: '' });
                        if(e.target.value) setFormErrors(prev => ({...prev, category: ''}));
                    }}
                >
                  <option value="">Select</option>{renderOptions(categoryList)}
                </select>
                {formErrors.category && <p className="text-red-500 text-xs mt-1 font-semibold">{formErrors.category}</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Item Type {itemList.length > 0 && <span className="text-red-500">*</span>}</label>
                <select 
                    className={`w-full p-3 bg-slate-50 dark:bg-slate-800 border rounded-xl font-medium dark:text-white ${formErrors.itemName ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700'}`} 
                    value={postForm.itemName || ''} 
                    onChange={e => {
                        setPostForm({ ...postForm, itemName: e.target.value });
                        if(e.target.value) setFormErrors(prev => ({...prev, itemName: ''}));
                    }} 
                    disabled={!itemList.length}
                >
                  <option value="">Select</option>{renderOptions(itemList)}
                </select>
                {formErrors.itemName && <p className="text-red-500 text-xs mt-1 font-semibold">{formErrors.itemName}</p>}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Title / Name <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                placeholder="e.g. Black Leather Wallet" 
                className={`w-full p-3 bg-slate-50 dark:bg-slate-800 border rounded-xl font-medium dark:text-white ${formErrors.title ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700'}`} 
                value={postForm.title || ''} 
                onChange={e => {
                    setPostForm({ ...postForm, title: e.target.value });
                    if(e.target.value.length >= 3) setFormErrors(prev => ({...prev, title: ''}));
                }} 
              />
              {formErrors.title && <p className="text-red-500 text-xs mt-1 font-semibold">{formErrors.title}</p>}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">City <span className="text-red-500">*</span></label>
                <select 
                    className={`w-full p-3 bg-slate-50 dark:bg-slate-800 border rounded-xl font-medium dark:text-white ${formErrors.city ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700'}`} 
                    value={postForm.city || ''} 
                    onChange={e => {
                        setPostForm({ ...postForm, city: e.target.value, area: '', subArea1: '' });
                        if(e.target.value) setFormErrors(prev => ({...prev, city: ''}));
                    }}
                >
                  <option value="">Select City</option>{renderOptions(cityList)}
                </select>
                {formErrors.city && <p className="text-red-500 text-xs mt-1 font-semibold">{formErrors.city}</p>}
              </div>
              {postForm.city && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Area <span className="text-red-500">*</span></label>
                    <select 
                        className={`w-full p-3 bg-slate-50 dark:bg-slate-800 border rounded-xl font-medium dark:text-white ${formErrors.area ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700'}`} 
                        value={postForm.area || ''} 
                        onChange={e => {
                            setPostForm({ ...postForm, area: e.target.value, subArea1: '' });
                            if(e.target.value) setFormErrors(prev => ({...prev, area: ''}));
                        }}
                    >
                      <option value="">Select Area</option>{renderOptions(areaList)}<option value="Other">Other</option>
                    </select>
                    {formErrors.area && <p className="text-red-500 text-xs mt-1 font-semibold">{formErrors.area}</p>}
                  </div>
                   <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Sub-Area</label>
                    {postForm.area === 'Other' ? <input type="text" placeholder="Type area..." className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-medium dark:text-white" value={postForm.subArea1 || ''} onChange={e => setPostForm({ ...postForm, subArea1: e.target.value })} /> : <select className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-medium dark:text-white" value={postForm.subArea1 || ''} onChange={e => setPostForm({ ...postForm, subArea1: e.target.value })} disabled={!subAreaList.length}><option value="">Select (Opt)</option>{renderOptions(subAreaList)}</select>}
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Description <span className="text-red-500">*</span></label>
              <textarea 
                rows={4} 
                placeholder="Describe the item, color, unique marks..." 
                className={`w-full p-3 bg-slate-50 dark:bg-slate-800 border rounded-xl font-medium dark:text-white ${formErrors.description ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700'}`} 
                value={postForm.description || ''} 
                onChange={e => {
                    setPostForm({ ...postForm, description: e.target.value });
                    if(e.target.value.length >= 10) setFormErrors(prev => ({...prev, description: ''}));
                }} 
              />
              {formErrors.description && <p className="text-red-500 text-xs mt-1 font-semibold">{formErrors.description}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Contact Number <span className="text-red-500">*</span></label>
              <input 
                type="tel" 
                placeholder="0300xxxxxxx" 
                className={`w-full p-3 bg-slate-50 dark:bg-slate-800 border rounded-xl font-medium dark:text-white ${formErrors.contactPhone ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-700'}`} 
                value={postForm.contactPhone || ''} 
                onChange={e => {
                    setPostForm({ ...postForm, contactPhone: e.target.value });
                    if(e.target.value.length >= 10) setFormErrors(prev => ({...prev, contactPhone: ''}));
                }} 
              />
              {formErrors.contactPhone && <p className="text-red-500 text-xs mt-1 font-semibold">{formErrors.contactPhone}</p>}
            </div>

            <button type="submit" disabled={isSubmitting || isUploadingImage} className={`w-full py-4 rounded-xl font-bold text-white shadow-lg flex justify-center items-center gap-2 ${postType === 'LOST' ? 'bg-red-600 hover:bg-red-700 shadow-red-200 dark:shadow-none' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 dark:shadow-none'} disabled:opacity-50 disabled:cursor-not-allowed`}>
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Post'}
            </button>
          </form>
        </div>
      </div>
    );
  };

  const renderChatList = () => (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      <div className="p-4 border-b dark:border-slate-800 flex items-center justify-between">
         <h1 className="text-xl font-bold text-slate-800 dark:text-white">Messages</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
         {chats.length === 0 ? (
             <div className="text-center py-10 text-slate-400">No conversations yet.</div>
         ) : (
             chats.map(chat => (
                 <button key={chat.id} onClick={() => { setActiveChatId(chat.id); setCurrentView('CHAT_ROOM'); }} className="w-full flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors relative">
                      <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-lg shrink-0">
                          {chat.itemTitle.charAt(0)}
                      </div>
                      <div className="flex-1 text-left overflow-hidden">
                          <div className="flex justify-between items-center mb-0.5">
                              <h3 className="font-bold text-slate-800 dark:text-white truncate">{chat.itemTitle}</h3>
                              <span className="text-[10px] text-slate-400">{new Date(chat.lastMessageTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                          </div>
                          <p className={`text-sm truncate ${chat.unreadCounts?.[user.id] ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}>{chat.lastMessage || 'Start a conversation...'}</p>
                      </div>
                      {(chat.unreadCounts?.[user.id] || 0) > 0 && (
                          <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                              {chat.unreadCounts?.[user.id]}
                          </span>
                      )}
                 </button>
             ))
         )}
      </div>
    </div>
  );

  const renderChatRoom = () => {
    const chat = chats.find(c => c.id === activeChatId);
    if (!chat) return <div className="flex items-center justify-center h-full">Chat not found.</div>;
    
    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
            {/* Header */}
            <div className="p-4 bg-white dark:bg-slate-800 border-b dark:border-slate-700 flex items-center gap-3 shadow-sm">
                <button onClick={() => setCurrentView('CHAT_LIST')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"><ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300"/></button>
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    {activeChatPartner?.avatar ? <img src={activeChatPartner.avatar} className="w-full h-full object-cover"/> : <UserIcon className="w-6 h-6 m-auto mt-2 text-slate-400"/>}
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-slate-800 dark:text-white leading-tight">{activeChatPartner?.name || 'User'}</h3>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium truncate w-48">Item: {chat.itemTitle}</p>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {(messages[chat.id] || []).map((msg) => {
                    const isMe = msg.senderId === user.id;
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-3 rounded-2xl relative group ${isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none shadow-sm'}`}>
                                {msg.replyTo && (
                                    <div className={`mb-2 p-2 rounded-lg text-xs border-l-4 ${isMe ? 'bg-indigo-700 border-indigo-400 text-indigo-200' : 'bg-slate-100 dark:bg-slate-700 border-indigo-500 text-slate-500 dark:text-slate-400'}`}>
                                        <p className="font-bold mb-0.5">{msg.replyTo.senderName}</p>
                                        <p className="truncate">{msg.replyTo.text}</p>
                                    </div>
                                )}
                                {msg.imageUrl && <img src={msg.imageUrl} className="rounded-lg mb-2 max-h-48 object-cover" />}
                                <p className="text-sm">{msg.text}</p>
                                <span className={`text-[10px] block text-right mt-1 opacity-70`}>{new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                
                                {/* Reactions */}
                                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                    <div className="absolute -bottom-3 right-0 bg-white dark:bg-slate-700 shadow-sm rounded-full px-1.5 py-0.5 flex gap-1 border dark:border-slate-600">
                                        {Object.entries(msg.reactions).map(([emoji, users]) => (
                                            <span key={emoji} className="text-xs" title={(users as string[]).join(', ')}>{emoji} <span className="text-[9px] font-bold text-slate-500">{(users as string[]).length}</span></span>
                                        ))}
                                    </div>
                                )}
                                
                                {/* Message Options (Hover) */}
                                <button 
                                    onClick={() => setReplyingTo(msg)} 
                                    className={`absolute top-2 ${isMe ? '-left-8' : '-right-8'} p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm`}
                                >
                                    <Reply className="w-3 h-3"/>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white dark:bg-slate-800 border-t dark:border-slate-700">
                {replyingTo && (
                    <div className="flex justify-between items-center p-2 mb-2 bg-slate-50 dark:bg-slate-900 rounded-lg border-l-4 border-indigo-500">
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                            <span className="font-bold">Replying to:</span> {replyingTo.text.substring(0, 30)}...
                        </div>
                        <button onClick={() => setReplyingTo(null)}><X className="w-4 h-4 text-slate-400"/></button>
                    </div>
                )}
                {chatImage && (
                    <div className="relative inline-block mb-2">
                         <img src={chatImage} className="h-20 rounded-lg border dark:border-slate-600"/>
                         <button onClick={() => setChatImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"><X className="w-3 h-3"/></button>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <label className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full cursor-pointer transition-colors">
                        <ImageIcon className="w-6 h-6" />
                        <input type="file" accept="image/*" className="hidden" onChange={handleChatImageSelect} />
                    </label>
                    <input 
                        type="text" 
                        placeholder="Type a message..." 
                        className="flex-1 p-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && sendMessage()}
                    />
                    <button onClick={sendMessage} disabled={!newMessage.trim() && !chatImage} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
  };

  const renderItemDetail = () => {
      if (!selectedItem) return null;
      const isLost = selectedItem.type === 'LOST';
      const isOwner = user.id === selectedItem.authorId;

      return (
          <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-y-auto">
              {/* Image Header */}
              <div className="relative h-72 bg-slate-200 dark:bg-slate-800">
                  <button onClick={() => setCurrentView('HOME')} className="absolute top-4 left-4 z-10 p-2 bg-black/40 backdrop-blur-md text-white rounded-full hover:bg-black/60 transition-colors"><ArrowLeft className="w-6 h-6"/></button>
                  {selectedItem.imageUrl ? (
                      <img src={selectedItem.imageUrl} className="w-full h-full object-cover" />
                  ) : (
                      <div className="flex items-center justify-center h-full text-slate-400 flex-col"><ImageIcon className="w-12 h-12 mb-2"/><p>No Image Available</p></div>
                  )}
                  <div className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent pt-16`}>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold text-white mb-2 inline-block ${isLost ? 'bg-red-500' : 'bg-emerald-500'}`}>{isLost ? 'LOST' : 'FOUND'}</span>
                      <h1 className="text-2xl font-bold text-white">{selectedItem.title}</h1>
                      <div className="flex items-center text-slate-300 text-sm mt-1">
                          <MapPin className="w-4 h-4 mr-1"/> {selectedItem.city}, {selectedItem.area}
                      </div>
                  </div>
              </div>

              <div className="p-6 space-y-6">
                  {/* Status Banner if Resolved */}
                  {selectedItem.status !== 'OPEN' && (
                      <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl flex items-center gap-3 border border-slate-200 dark:border-slate-700">
                          <CheckCircle className="w-6 h-6 text-slate-500" />
                          <p className="font-bold text-slate-600 dark:text-slate-400">This case has been marked as {selectedItem.status}.</p>
                      </div>
                  )}

                  {/* Details */}
                  <div>
                      <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Description</h3>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{selectedItem.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
                          <p className="text-xs text-slate-400 font-bold uppercase mb-1">Category</p>
                          <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Tag className="w-4 h-4 text-indigo-500"/> {selectedItem.category}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
                          <p className="text-xs text-slate-400 font-bold uppercase mb-1">Date</p>
                          <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Calendar className="w-4 h-4 text-indigo-500"/> {new Date(selectedItem.date).toLocaleDateString()}</p>
                      </div>
                  </div>

                  {/* Author Info */}
                  <div className="border-t dark:border-slate-800 pt-6">
                      <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Posted By</h3>
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                  {selectedAuthor?.avatar ? <img src={selectedAuthor.avatar} className="w-full h-full object-cover" /> : <UserIcon className="w-6 h-6 m-auto mt-3 text-slate-400" />}
                              </div>
                              <div>
                                  <p className="font-bold text-slate-800 dark:text-white">{selectedAuthor?.name || selectedItem.authorName}</p>
                                  <p className="text-xs text-slate-500">Member since {selectedAuthor ? '2024' : '...'}</p>
                              </div>
                          </div>
                          {!isOwner && (
                               <div className="flex gap-2">
                                   <button onClick={() => startChat(selectedItem)} className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
                                       <MessageCircle className="w-5 h-5" />
                                   </button>
                                   <button onClick={() => handleReportUser(selectedItem.authorId)} className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-red-500 rounded-xl transition-colors">
                                       <ShieldAlert className="w-5 h-5" />
                                   </button>
                               </div>
                          )}
                      </div>
                  </div>

                  {/* Actions */}
                  {!isOwner && (
                      <div className="grid grid-cols-2 gap-3 pt-4">
                          <button onClick={() => startChat(selectedItem)} className="py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2 transition-colors">
                              <MessageCircle className="w-5 h-5" /> Chat Now
                          </button>
                          {selectedItem.contactPhone && (
                              <a href={getWhatsAppLink(selectedItem.contactPhone, selectedItem.title)} target="_blank" rel="noopener noreferrer" className="py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none flex items-center justify-center gap-2 transition-colors">
                                  <Phone className="w-5 h-5" /> WhatsApp
                              </a>
                          )}
                      </div>
                  )}
              </div>
          </div>
      );
  };

  const renderProfile = () => (
      <div className="flex flex-col h-full bg-white dark:bg-slate-900">
          <div className="p-4 border-b dark:border-slate-800 flex items-center gap-3">
              <button onClick={() => setCurrentView('HOME')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-300"/></button>
              <h1 className="text-xl font-bold text-slate-800 dark:text-white">My Profile</h1>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
              {/* Avatar Section */}
              <div className="flex flex-col items-center mb-8">
                  <div className="relative w-28 h-28 mb-4">
                      <div className="w-full h-full rounded-full bg-slate-100 dark:bg-slate-800 border-4 border-white dark:border-slate-700 shadow-xl overflow-hidden">
                          {profileForm.avatar ? <img src={profileForm.avatar} className="w-full h-full object-cover" /> : <UserIcon className="w-12 h-12 m-auto mt-7 text-slate-300" />}
                      </div>
                      <label className="absolute bottom-0 right-0 p-2 bg-indigo-600 text-white rounded-full cursor-pointer hover:bg-indigo-700 shadow-md transition-transform hover:scale-110">
                          <Camera className="w-4 h-4" />
                          <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                      </label>
                  </div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white">{profileForm.name || 'User Name'}</h2>
                  <p className="text-slate-500 dark:text-slate-400">{profileForm.email || 'email@example.com'}</p>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                  <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Full Name</label>
                      <input type="text" className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-medium dark:text-white" value={profileForm.name || ''} onChange={e => setProfileForm({...profileForm, name: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Age</label>
                          <input type="number" className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-medium dark:text-white" value={profileForm.age || ''} onChange={e => setProfileForm({...profileForm, age: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">City</label>
                          <select className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-medium dark:text-white" value={profileForm.city || ''} onChange={e => setProfileForm({...profileForm, city: e.target.value})}>
                              <option value="">Select</option>
                              {cities.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                      </div>
                  </div>
                  
                  {/* Verification Section */}
                  <div className="space-y-4 pt-4 border-t dark:border-slate-800">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Email</label>
                          <div className="flex gap-2">
                              <input type="email" disabled className="w-full p-3 bg-slate-100 dark:bg-slate-800/50 border dark:border-slate-700 rounded-xl font-medium text-slate-500" value={profileForm.email || ''} />
                              {profileForm.emailVerified ? (
                                  <span className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl flex items-center justify-center"><CheckCircle className="w-5 h-5"/></span>
                              ) : (
                                  <button onClick={() => initiateVerification('email')} className="px-4 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-xl font-bold text-sm">Verify</button>
                              )}
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Phone</label>
                          <div className="flex gap-2">
                              <input type="tel" className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl font-medium dark:text-white" value={profileForm.phone || ''} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} placeholder="0300xxxxxxx" />
                              {profileForm.phoneVerified ? (
                                  <span className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl flex items-center justify-center"><CheckCircle className="w-5 h-5"/></span>
                              ) : (
                                  <button onClick={() => initiateVerification('phone')} className="px-4 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-xl font-bold text-sm">Verify</button>
                              )}
                          </div>
                      </div>
                  </div>

                  {verifyingField && (
                      <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl animate-in slide-in-from-top-2">
                          <p className="text-sm font-bold text-indigo-900 dark:text-indigo-300 mb-2">Enter OTP sent to your {verifyingField} (Use 1234)</p>
                          <div className="flex gap-2">
                              <input type="text" className="flex-1 p-2 rounded-lg border dark:border-slate-700 dark:bg-slate-800 text-center tracking-widest font-bold" value={otpInput} onChange={e => setOtpInput(e.target.value)} maxLength={4} />
                              <button onClick={submitOtp} className="px-4 bg-indigo-600 text-white rounded-lg font-bold">Submit</button>
                              <button onClick={() => setVerifyingField(null)} className="px-4 text-slate-500 font-bold">Cancel</button>
                          </div>
                      </div>
                  )}

                  <button onClick={handleProfileSave} disabled={isSavingProfile} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg mt-6 flex justify-center items-center gap-2">
                      {isSavingProfile && <Loader2 className="w-5 h-5 animate-spin"/>} Save Changes
                  </button>
              </div>
          </div>
      </div>
  );

  const renderSettings = () => (
      <div className="flex flex-col h-full bg-white dark:bg-slate-900">
          <div className="p-4 border-b dark:border-slate-800 flex items-center gap-3">
              <button onClick={() => setCurrentView('HOME')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-300"/></button>
              <h1 className="text-xl font-bold text-slate-800 dark:text-white">Settings</h1>
          </div>
          <div className="p-4 space-y-6">
              <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-2">Preferences</p>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden">
                      <button onClick={() => setDarkMode(!darkMode)} className="w-full p-4 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                          <div className="flex items-center gap-3">
                              {darkMode ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5 text-orange-400" />}
                              <span className="font-medium text-slate-700 dark:text-slate-200">Dark Mode</span>
                          </div>
                          <div className={`w-11 h-6 rounded-full relative transition-colors ${darkMode ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${darkMode ? 'left-6' : 'left-1'}`}></div>
                          </div>
                      </button>
                  </div>
              </div>

              <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-2">Account</p>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden divide-y dark:divide-slate-700">
                      <button onClick={handleChangePasswordRequest} className="w-full p-4 flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors text-slate-700 dark:text-slate-200">
                          <Lock className="w-5 h-5 text-slate-500" /> Change Password
                      </button>
                      <button onClick={handleDeleteAccount} className="w-full p-4 flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600">
                          <UserX className="w-5 h-5" /> Delete Account
                      </button>
                  </div>
              </div>

              <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-2">Support</p>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden divide-y dark:divide-slate-700">
                      <button onClick={() => handlePrivacyPolicy()} className="w-full p-4 flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors text-slate-700 dark:text-slate-200">
                          <Shield className="w-5 h-5 text-slate-500" /> Privacy Policy
                      </button>
                      <button onClick={() => { setInfoPageData({ title: 'About Us', content: appSettings.aboutUs || 'LOFO.PK' }); setCurrentView('INFO_SCREEN'); }} className="w-full p-4 flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors text-slate-700 dark:text-slate-200">
                          <Info className="w-5 h-5 text-slate-500" /> About Us
                      </button>
                  </div>
              </div>
          </div>
      </div>
  );

  const renderMyPosts = () => {
      const myPosts = posts.filter(p => p.authorId === user.id);
      return (
          <div className="flex flex-col h-full bg-white dark:bg-slate-900">
              <div className="p-4 border-b dark:border-slate-800 flex items-center gap-3">
                  <button onClick={() => setCurrentView('HOME')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-300"/></button>
                  <h1 className="text-xl font-bold text-slate-800 dark:text-white">My Posts</h1>
              </div>
              <div className="p-4 overflow-y-auto">
                  {myPosts.length === 0 ? (
                      <div className="text-center py-10 text-slate-400">You haven't posted anything yet.</div>
                  ) : (
                      myPosts.map(post => (
                          <div key={post.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl mb-4 border border-slate-200 dark:border-slate-700">
                              <div className="flex justify-between items-start mb-2">
                                  <h3 className="font-bold text-slate-800 dark:text-white">{post.title}</h3>
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${post.type === 'LOST' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>{post.type}</span>
                              </div>
                              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{new Date(post.date).toLocaleDateString()}</p>
                              <div className="flex gap-2">
                                  <button onClick={() => handleTogglePostStatus(post.id, post.status)} className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${post.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                                      {post.status === 'RESOLVED' ? 'Resolved' : 'Mark Resolved'}
                                  </button>
                                  <button onClick={() => handleDeleteOwnPost(post.id)} className="px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors">
                                      <Trash2 className="w-4 h-4" />
                                  </button>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>
      );
  };

  const renderInfoScreen = () => (
      <div className="flex flex-col h-full bg-white dark:bg-slate-900">
          <div className="p-4 border-b dark:border-slate-800 flex items-center gap-3">
              <button onClick={() => setCurrentView('HOME')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-300"/></button>
              <h1 className="text-xl font-bold text-slate-800 dark:text-white">{infoPageData.title}</h1>
          </div>
          <div className="p-6 overflow-y-auto">
              <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap text-slate-600 dark:text-slate-300">
                  {infoPageData.content}
              </div>
          </div>
      </div>
  );

  const renderMatchCases = () => {
    const myOpenPosts = posts.filter(p => p.authorId === user.id && p.status === 'OPEN');
    
    const handleMatch = async (post: ItemPost) => {
        setIsMatching(true);
        setMatchResult(null);
        try {
            const res = await findPotentialMatch(post, posts);
            setMatchResult(res);
        } catch (e) { 
            console.error(e);
            showToast("Matching failed.", "error"); 
        } finally { 
            setIsMatching(false); 
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900">
            <div className="p-4 border-b dark:border-slate-800 flex items-center gap-3">
                <button onClick={() => setCurrentView('HOME')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-300"/></button>
                <h1 className="text-xl font-bold text-slate-800 dark:text-white">Smart Match</h1>
            </div>
            <div className="p-6 overflow-y-auto">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl mb-6">
                    <p className="text-indigo-800 dark:text-indigo-200 text-sm font-medium">Select one of your active posts to let our AI find potential matches from current listings.</p>
                </div>
                
                {myOpenPosts.length === 0 ? (
                    <div className="text-center text-slate-400 py-8">You have no active posts to match.</div>
                ) : (
                    <div className="space-y-4">
                        {myOpenPosts.map(post => (
                            <div key={post.id} className="border dark:border-slate-700 rounded-xl p-4 flex flex-col gap-3 bg-slate-50 dark:bg-slate-800">
                                <div className="flex justify-between">
                                    <h3 className="font-bold text-slate-800 dark:text-white">{post.title}</h3>
                                    <span className="text-xs font-bold bg-slate-200 dark:bg-slate-600 px-2 py-1 rounded text-slate-600 dark:text-slate-300">{post.type}</span>
                                </div>
                                <button onClick={() => handleMatch(post)} disabled={isMatching} className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold shadow hover:bg-indigo-700 disabled:opacity-50 flex justify-center gap-2">
                                    {isMatching ? <Loader2 className="w-4 h-4 animate-spin"/> : <RefreshCw className="w-4 h-4"/>} Check Matches
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Match Result Modal/Section */}
                {matchResult && (
                    <div className="mt-8 border-t dark:border-slate-800 pt-6 animate-in slide-in-from-bottom-4">
                        <h3 className="font-bold text-lg mb-4 text-slate-800 dark:text-white">Match Analysis</h3>
                        <div className={`p-4 rounded-xl border ${matchResult.matchedId ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}>
                            {matchResult.matchedId ? (
                                <div>
                                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold mb-2">
                                        <CheckCircle className="w-5 h-5" /> Match Found! ({matchResult.confidence}% Confidence)
                                    </div>
                                    <p className="text-slate-600 dark:text-slate-300 text-sm mb-4">{matchResult.reason}</p>
                                    <button 
                                        onClick={() => {
                                            const match = posts.find(p => p.id === matchResult.matchedId);
                                            if (match) { setSelectedItem(match); setCurrentView('ITEM_DETAIL'); }
                                        }}
                                        className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                                    >
                                        View Matched Item
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-slate-500">
                                    <AlertCircle className="w-5 h-5" /> No strong matches found yet.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
  };

  const renderResolvedCases = () => {
      const resolved = posts.filter(p => p.status === 'RESOLVED');
      return (
          <div className="flex flex-col h-full bg-white dark:bg-slate-900">
              <div className="p-4 border-b dark:border-slate-800 flex items-center gap-3">
                  <button onClick={() => setCurrentView('HOME')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-300"/></button>
                  <h1 className="text-xl font-bold text-slate-800 dark:text-white">Resolved Cases</h1>
              </div>
              <div className="p-4 overflow-y-auto">
                  {resolved.length === 0 ? (
                      <div className="text-center py-10 text-slate-400">No resolved cases yet.</div>
                  ) : (
                      resolved.map(post => (
                          <div key={post.id} className="opacity-75 grayscale hover:grayscale-0 transition-all">
                               <ItemCard item={post} onContact={() => { setSelectedItem(post); setCurrentView('ITEM_DETAIL'); }} />
                          </div>
                      ))
                  )}
              </div>
          </div>
      );
  };

  const renderFilter = () => (
      <div className="flex flex-col h-full bg-white dark:bg-slate-900">
          <div className="p-4 border-b dark:border-slate-800 flex items-center justify-between">
               <div className="flex items-center gap-3">
                   <button onClick={() => setCurrentView('HOME')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X className="w-6 h-6 text-slate-600 dark:text-slate-300"/></button>
                   <h1 className="text-xl font-bold text-slate-800 dark:text-white">Filters</h1>
               </div>
               <button onClick={() => { setActiveCity(''); setActiveArea(''); setActiveCategory(''); setActiveItemName(''); setCurrentView('HOME'); }} className="text-red-500 font-bold text-sm">Reset</button>
          </div>
          <div className="p-6 space-y-6 overflow-y-auto">
              <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">City</label>
                  <select className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl" value={activeCity} onChange={e => { setActiveCity(e.target.value); setActiveArea(''); }}>
                      <option value="">All Cities</option>
                      {cities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
              </div>
              {activeCity && (
                  <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Area</label>
                      <select className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl" value={activeArea} onChange={e => setActiveArea(e.target.value)}>
                          <option value="">All Areas</option>
                          {(locations[activeCity] ? Object.keys(locations[activeCity]) : []).map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                  </div>
              )}
              <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Category</label>
                  <select className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl" value={activeCategory} onChange={e => { setActiveCategory(e.target.value); setActiveItemName(''); }}>
                      <option value="">All Categories</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
              </div>
              {activeCategory && categoryItems[activeCategory] && (
                  <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Item Type</label>
                      <select className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl" value={activeItemName} onChange={e => setActiveItemName(e.target.value)}>
                          <option value="">All Types</option>
                          {categoryItems[activeCategory].map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                  </div>
              )}
              <button onClick={() => setCurrentView('HOME')} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg mt-4">Apply Filters</button>
          </div>
      </div>
  );

  const renderSplash = () => (
    <div className="flex flex-col items-center justify-center h-screen bg-white dark:bg-slate-900 animate-in fade-in duration-700">
      <div className="relative w-32 h-32 mb-4">
        <img src={appSettings.redLogoUrl || DEFAULT_RED_LOGO} className="w-full h-full object-contain animate-bounce" alt="LOFO" />
      </div>
      <h1 className="text-3xl font-black text-indigo-900 dark:text-white tracking-widest">LOFO.PK</h1>
      <p className="text-slate-400 text-sm font-medium tracking-wide mt-2">LOST & FOUND PAKISTAN</p>
      <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mt-8" />
    </div>
  );

  const renderAuth = () => (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900">
        <div className="w-24 h-24 mb-6">
            <img src={appSettings.redLogoUrl || DEFAULT_RED_LOGO} className="w-full h-full object-contain" alt="Logo" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{authMode === 'LOGIN' ? 'Welcome Back' : 'Create Account'}</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8 text-center">{authMode === 'LOGIN' ? 'Enter your details to sign in.' : 'Join the community to help others.'}</p>
        
        <form onSubmit={handleEmailAuth} className="w-full max-w-sm space-y-4">
            {authMode === 'REGISTER' && (
                <>
                    <input type="text" placeholder="Full Name" className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl" value={registerName} onChange={e => setRegisterName(e.target.value)} />
                    <select className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl" value={registerCity} onChange={e => setRegisterCity(e.target.value)}>
                        <option value="">Select City</option>
                        {cities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input type="tel" placeholder="Mobile Number" className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl" value={registerMobile} onChange={e => setRegisterMobile(e.target.value)} />
                </>
            )}
            
            <input type="email" placeholder="Email Address" className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl" value={email} onChange={e => setEmail(e.target.value)} />
            
            <div className="relative">
                <input type={showPassword ? "text" : "password"} placeholder="Password" className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl" value={password} onChange={e => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-slate-400">
                    {showPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}
                </button>
            </div>

            {authMode === 'LOGIN' && (
                 <div className="flex justify-between items-center text-sm">
                     <label className="flex items-center gap-2 text-slate-600 dark:text-slate-400 cursor-pointer">
                         <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="rounded text-indigo-600" />
                         Remember me
                     </label>
                     <button type="button" onClick={handleForgotPasswordRequest} className="text-indigo-600 font-bold hover:underline">Forgot Password?</button>
                 </div>
            )}

            <button type="submit" disabled={isLoggingIn} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2">
                {isLoggingIn && <Loader2 className="w-5 h-5 animate-spin" />}
                {authMode === 'LOGIN' ? 'Sign In' : 'Register'}
            </button>
        </form>

        <div className="my-6 flex items-center w-full max-w-sm">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
            <span className="px-3 text-slate-400 text-sm">OR</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
        </div>

        <div className="w-full max-w-sm space-y-3">
             <GoogleLoginButton onSuccess={() => {}} onError={(msg) => setErrorPopup({show: true, message: msg})} />
             <button onClick={() => { setUser(GUEST_USER); setCurrentView('HOME'); }} className="w-full py-3 text-slate-500 font-bold hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">Continue as Guest</button>
        </div>

        <p className="mt-8 text-center text-slate-500 dark:text-slate-400">
            {authMode === 'LOGIN' ? "Don't have an account?" : "Already have an account?"} 
            <button onClick={() => { setAuthMode(authMode === 'LOGIN' ? 'REGISTER' : 'LOGIN'); setFormErrors({}); }} className="ml-2 text-indigo-600 font-bold hover:underline">
                {authMode === 'LOGIN' ? 'Sign Up' : 'Login'}
            </button>
        </p>
    </div>
  );

  const renderErrorPopup = () => (
      errorPopup && errorPopup.show ? (
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{errorPopup.title || 'Error'}</h3>
                  <p className="text-slate-600 dark:text-slate-300 mb-6">{errorPopup.message}</p>
                  <button onClick={() => setErrorPopup(null)} className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold rounded-xl transition-colors">Okay</button>
              </div>
          </div>
      ) : null
  );

  const renderToast = () => (
      toast.show ? (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl shadow-xl flex items-center gap-2 text-white font-bold animate-in slide-in-from-top-4 z-[100] ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
              {toast.type === 'success' ? <CheckCircle className="w-5 h-5"/> : <AlertCircle className="w-5 h-5"/>}
              {toast.message}
          </div>
      ) : null
  );

  // Filter Logic Implementation inside Component Body
  const filteredPosts = posts.filter(post => {
      if (activeTypeFilter !== 'ALL' && post.type !== activeTypeFilter) return false;
      if (activeCity && post.city !== activeCity) return false;
      if (activeCategory && post.category !== activeCategory) return false;
      if (activeArea && post.area !== activeArea) return false;
      if (activeItemName && post.itemName !== activeItemName) return false;
      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return (
              post.title.toLowerCase().includes(q) || 
              post.description.toLowerCase().includes(q) ||
              (post.itemName && post.itemName.toLowerCase().includes(q))
          );
      }
      return true;
  });

  return (
    <Layout
      currentView={currentView}
      setCurrentView={setCurrentView}
      notificationCount={unreadNotificationCount}
      unreadChatCount={unreadChatCount}
      user={user}
      onRestrictedAction={requireAuth}
      greenLogoUrl={appSettings.greenLogoUrl}
      redLogoUrl={appSettings.redLogoUrl}
      onSidebarAction={handleSidebarAction}
      // New props for Notifications
      notifications={notifications}
      onMarkAsRead={(id) => {
          const alert = notifications.find(n => n.id === id);
          const post = alert?.postId ? posts.find(p => p.id === alert.postId) : undefined;
          handleMarkNotificationAsRead(id, post);
      }}
      onDeleteNotification={handleDeleteNotification}
    >
        {currentView === 'SPLASH' && renderSplash()}
        {currentView === 'AUTH' && renderAuth()}
        
        {currentView === 'HOME' && (
            <div className="pb-20">
                {/* Slider */}
                <div className="relative h-32 sm:h-44 bg-slate-900 overflow-hidden rounded-2xl mx-4 mt-4 shadow-sm">
                    {allSlides.map((slide, index) => (
                        <div key={index} className={`absolute inset-0 transition-opacity duration-1000 ${index === currentSlide ? 'opacity-100' : 'opacity-0'}`}>
                             {slide.type === 'image' ? (
                                 <img src={slide.content as string} className="w-full h-full object-cover opacity-60" />
                             ) : (
                                 <div className={`w-full h-full bg-gradient-to-br ${slide.gradient} flex flex-col items-center justify-center text-white p-6 text-center`}>
                                     {/* Feature slide content */}
                                      <h2 className="text-3xl font-bold mb-2">{slide.title}</h2>
                                      <p className="max-w-md opacity-90">{slide.desc}</p>
                                 </div>
                             )}
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className="p-4 space-y-4">
                     <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                         {['ALL', 'LOST', 'FOUND'].map(t => (
                             <button key={t} onClick={() => setActiveTypeFilter(t as any)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${activeTypeFilter === t ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white' : 'text-slate-500'}`}>{t}</button>
                         ))}
                     </div>
                     <div className="flex flex-col gap-2">
                         <div className="flex gap-2">
                             <div className="flex-1 relative">
                                 <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                 <input type="text" placeholder="Search items..." className="w-full pl-9 p-2.5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl text-sm" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                             </div>
                             <button onClick={() => setCurrentView('FILTER')} className="p-2.5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl relative transition-all active:scale-95">
                                <Filter className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                                {activeFilterCount > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-slate-50 dark:border-slate-900 shadow-sm animate-in zoom-in">
                                        {activeFilterCount}
                                    </span>
                                )}
                             </button>
                         </div>
                         
                         {/* Active Filters Chips */}
                         {(activeFilterCount > 0 || searchQuery) && (
                            <div className="flex flex-wrap gap-2 items-center animate-in slide-in-from-top-2 fade-in">
                                {searchQuery && (
                                    <span className="bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border border-indigo-100 dark:border-indigo-800">
                                        "{searchQuery}" <button onClick={() => setSearchQuery('')}><X className="w-3 h-3 hover:text-red-500"/></button>
                                    </span>
                                )}
                                {activeCategory && (
                                    <span className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border border-slate-200 dark:border-slate-700">
                                        {activeCategory} <button onClick={() => { setActiveCategory(''); setActiveItemName(''); }}><X className="w-3 h-3 hover:text-red-500"/></button>
                                    </span>
                                )}
                                {activeItemName && (
                                    <span className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border border-slate-200 dark:border-slate-700">
                                        {activeItemName} <button onClick={() => setActiveItemName('')}><X className="w-3 h-3 hover:text-red-500"/></button>
                                    </span>
                                )}
                                {activeCity && (
                                    <span className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border border-slate-200 dark:border-slate-700">
                                        {activeCity} <button onClick={() => { setActiveCity(''); setActiveArea(''); }}><X className="w-3 h-3 hover:text-red-500"/></button>
                                    </span>
                                )}
                                {activeArea && (
                                    <span className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border border-slate-200 dark:border-slate-700">
                                        {activeArea} <button onClick={() => setActiveArea('')}><X className="w-3 h-3 hover:text-red-500"/></button>
                                    </span>
                                )}
                                <button onClick={() => { setSearchQuery(''); setActiveCategory(''); setActiveItemName(''); setActiveCity(''); setActiveArea(''); }} className="text-xs text-red-500 font-bold hover:underline ml-auto bg-red-50 dark:bg-red-900/10 px-2 py-1 rounded-lg transition-colors hover:bg-red-100 dark:hover:bg-red-900/20">Clear All</button>
                            </div>
                         )}
                     </div>
                </div>

                {/* Posts */}
                <div className="px-4">
                     {filteredPosts.length === 0 ? (
                         <div className="text-center py-10 text-slate-400">
                             <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
                             <p>No items found matching your criteria.</p>
                             <button 
                                 onClick={() => {
                                     setSearchQuery('');
                                     setActiveTypeFilter('ALL');
                                     setActiveCity('');
                                     setActiveCategory('');
                                     setActiveArea('');
                                 }}
                                 className="mt-4 px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-colors"
                             >
                                 Clear Filters
                             </button>
                         </div>
                     ) : (
                         filteredPosts.map(post => (
                             <ItemCard key={post.id} item={post} onContact={(item) => { setSelectedItem(item); setCurrentView('ITEM_DETAIL'); }} />
                         ))
                     )}
                </div>
            </div>
        )}

        {currentView === 'POST_FLOW' && (postType ? renderPostFlow() : renderPostTypeSelection())}
        {currentView === 'CHAT_LIST' && renderChatList()}
        {currentView === 'CHAT_ROOM' && renderChatRoom()}
        {currentView === 'ITEM_DETAIL' && renderItemDetail()}
        
        {currentView === 'PROFILE' && renderProfile()}
        {currentView === 'SETTINGS' && renderSettings()}
        {currentView === 'MY_POSTS' && renderMyPosts()}
        {currentView === 'INFO_SCREEN' && renderInfoScreen()}
        {currentView === 'MATCH_CASES' && renderMatchCases()}
        {currentView === 'RESOLVED_CASES' && renderResolvedCases()}
        {currentView === 'ADMIN_DASHBOARD' && <AdminPanel db={db} onLogout={handleLogout} users={allUsers} posts={posts} />}
        {currentView === 'FILTER' && renderFilter()}

        {/* Global Modals */}
        {renderErrorPopup()}
        {renderToast()}
        
        {/* Forgot Password Modal */}
        {showForgotPassModal && (
             <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl w-full max-w-sm">
                      <h3 className="text-lg font-bold mb-4 dark:text-white">Reset Password</h3>
                      <input type="email" placeholder="Enter your email" className="w-full p-3 mb-4 border rounded-xl dark:bg-slate-800 dark:border-slate-700" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} />
                      <div className="flex gap-2">
                          <button onClick={() => setShowForgotPassModal(false)} className="flex-1 py-2 text-slate-500 font-bold">Cancel</button>
                          <button onClick={handleSendResetEmail} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-bold">Send Link</button>
                      </div>
                  </div>
             </div>
        )}
        
        {/* Donation Modal */}
        {showDonationModal && (
             <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl w-full max-w-sm">
                      <h3 className="text-lg font-bold mb-4 dark:text-white">Support LOFO.PK</h3>
                      <div className="space-y-4 mb-6">
                           <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl" onClick={() => handleCopy(appSettings.donationInfo?.bankName || '', 'bank')}>
                                <p className="text-xs text-slate-400 uppercase font-bold">Bank Name</p>
                                <p className="font-bold dark:text-white">{appSettings.donationInfo?.bankName || 'Not Set'}</p>
                           </div>
                           <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl" onClick={() => handleCopy(appSettings.donationInfo?.accountNumber || '', 'acc')}>
                                <p className="text-xs text-slate-400 uppercase font-bold">Account Number</p>
                                <p className="font-bold dark:text-white flex justify-between">{appSettings.donationInfo?.accountNumber || 'Not Set'} <Copy className="w-4 h-4 text-slate-400"/></p>
                                {copiedField === 'acc' && <span className="text-xs text-emerald-500 font-bold">Copied!</span>}
                           </div>
                      </div>
                      <button onClick={() => setShowDonationModal(false)} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl">Close</button>
                  </div>
             </div>
        )}

        {/* Change Password Modal */}
        {showChangePassModal && (
            <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                 <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl w-full max-w-sm">
                      <h3 className="text-lg font-bold mb-4 dark:text-white">Change Password</h3>
                      <input type="password" placeholder="New Password" className="w-full p-3 mb-4 border rounded-xl dark:bg-slate-800 dark:border-slate-700" value={newPass} onChange={e => setNewPass(e.target.value)} />
                      <input type="password" placeholder="Confirm Password" className="w-full p-3 mb-4 border rounded-xl dark:bg-slate-800 dark:border-slate-700" value={confirmNewPass} onChange={e => setConfirmNewPass(e.target.value)} />
                      <div className="flex gap-2">
                          <button onClick={() => setShowChangePassModal(false)} className="flex-1 py-2 text-slate-500 font-bold">Cancel</button>
                          <button onClick={handleSubmitChangePassword} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-bold">Update</button>
                      </div>
                 </div>
            </div>
        )}
        
        {/* Match Notification Modal */}
        {matchNotification && matchNotification.show && (
             <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl w-full max-w-sm text-center">
                       <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                           <RefreshCw className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                       </div>
                       <h3 className="text-xl font-bold mb-2 dark:text-white">Potential Match Found!</h3>
                       <p className="text-slate-600 dark:text-slate-300 mb-6">We found an item that matches your description.</p>
                       <div className="flex gap-3">
                           <button onClick={handleDismissMatch} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl">Later</button>
                           <button onClick={handleViewMatch} className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none">View Match</button>
                       </div>
                  </div>
             </div>
        )}

    </Layout>
  );
};

export default App;