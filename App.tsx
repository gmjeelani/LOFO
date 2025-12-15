import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, Filter, MapPin, X, ArrowLeft, Send, Image as ImageIcon, CheckCircle, AlertCircle, Loader2, MessageCircle, SlidersHorizontal, Trash2, Camera, Shield, ShieldAlert, Mail, Phone, Edit2, User as UserIcon, LogOut, Facebook, Lock, PhoneCall, ClipboardList, Eye, EyeOff, Tag, RefreshCw, Link as LinkIcon, ExternalLink, Package, Calendar, HandHeart, Copy, Check, Settings, Moon, Sun, UserX, Archive, List, ChevronRight, Paperclip, Reply, Smile, MoreVertical } from 'lucide-react';
import { signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword, deleteUser, sendPasswordResetEmail, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, addDoc, onSnapshot, query, orderBy, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';

import { AppView, ItemPost, PostType, ChatSession, ChatMessage, User, AppSettings } from './types';
import { GUEST_USER, INITIAL_POSTS, CATEGORIES as DEFAULT_CATEGORIES, CITIES as DEFAULT_CITIES, PAK_LOCATIONS, ADMIN_CREDENTIALS, DEFAULT_CATEGORY_ITEMS } from './services/mockData';
import { findPotentialMatch } from './services/geminiService';
import { auth, db, googleProvider, facebookProvider } from './services/firebase';
import Layout from './components/Layout';
import ItemCard from './components/ItemCard';
import AdminPanel from './components/AdminPanel';
import { GoogleLoginButton } from './components/auth/GoogleLoginButton';

// Default Placeholders
const DEFAULT_RED_LOGO = "https://placehold.co/400x400/ef4444/ffffff?text=LOFO"; 

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

  // Notifications & Modals
  const [matchNotification, setMatchNotification] = useState<{show: boolean, matchedPostId: string | null} | null>(null);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [infoPageData, setInfoPageData] = useState<{title: string, content: string}>({ title: '', content: '' });
  const [alertCount, setAlertCount] = useState(0);
  const prevAlertCount = useRef(0);
  
  // Slider State
  const [currentSlide, setCurrentSlide] = useState(0);

  // Password Management Modals
  const [showForgotPassModal, setShowForgotPassModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [confirmNewPass, setConfirmNewPass] = useState('');
  
  // Toast & Error State
  const [errorPopup, setErrorPopup] = useState<{show: boolean, message: string} | null>(null);
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
          setCurrentSlide(prev => {
              const max = (appSettings.sliderImages?.length || 0);
              return max > 0 ? (prev + 1) % max : 0;
          });
      }, 5000);
      return () => clearInterval(interval);
  }, [appSettings.sliderImages]);

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

  // Listen to City Alerts (GLOBAL for ALL Users)
  useEffect(() => {
      if (user.isGuest) return;
      
      const q = query(collection(db, 'city_alerts'), orderBy('timestamp', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
          const alerts = snapshot.docs.map(doc => doc.data() as any);
          const newCount = alerts.length;
          
          setAlertCount(newCount);

          if (newCount > prevAlertCount.current) {
               if (prevAlertCount.current !== 0) {
                   const latestAlert = alerts[0];
                   if (Notification.permission === 'granted') {
                       new Notification("LOFO Alert", {
                           body: latestAlert.message,
                           icon: appSettings.redLogoUrl || DEFAULT_RED_LOGO
                       });
                   }
               }
          }
          prevAlertCount.current = newCount;
      });
      return () => unsubscribe();
  }, [user.isGuest]);


  // --- Helpers ---

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ show: true, message, type });
      setTimeout(() => setToast(prev => ({...prev, show: false})), 3000);
  };

  const requireAuth = (): boolean => {
    if (user.isGuest) {
      setErrorPopup({ show: true, message: "Please sign up or log in to access this feature." });
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
                      avatar: ''
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setPostForm(prev => ({ ...prev, imageUrl: reader.result as string })); }; reader.readAsDataURL(file); } };

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
        await addDoc(collection(db, 'posts'), newPostData);
        if (newPostData.city) {
            let alertMsg = '';
            if (newPostData.type === 'LOST') {
                alertMsg = `${newPostData.itemName || newPostData.title} of Mr. ${newPostData.authorName} has losted ${newPostData.city} if you find then post it here.`;
            } else {
                alertMsg = `${newPostData.itemName || newPostData.title} has founded by Mr ${newPostData.authorName} at ${newPostData.area} ${newPostData.city}`;
            }
            await addDoc(collection(db, 'city_alerts'), {
                message: alertMsg,
                city: newPostData.city, 
                timestamp: Date.now(),
                type: newPostData.type
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
              <label className="w-full h-48 bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors overflow-hidden relative">
                {postForm.imageUrl ? (
                  <img src={postForm.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Camera className="w-10 h-10 text-slate-400 mb-2" />
                    <span className="text-sm font-bold text-slate-500 dark:text-slate-400">Tap to upload photo</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
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

            <button type="submit" disabled={isSubmitting} className={`w-full py-4 rounded-xl font-bold text-white shadow-lg flex justify-center items-center gap-2 ${postType === 'LOST' ? 'bg-red-600 hover:bg-red-700 shadow-red-200 dark:shadow-none' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 dark:shadow-none'}`}>
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Post'}
            </button>
          </form>
        </div>
      </div>
    );
  };

  const renderChatList = () => (
    <div className="p-4 flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        <div className="flex items-center gap-3 mb-4 px-2">
            <button onClick={() => setCurrentView('HOME')} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full"><ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300"/></button>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Messages</h2>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto">
            {chats.length === 0 ? <div className="text-center text-slate-400 mt-10">No chats yet</div> : chats.map(c => {
                const unread = c.unreadCounts?.[user.id] || 0;
                return (
                <div key={c.id} onClick={() => { setActiveChatId(c.id); setCurrentView('CHAT_ROOM'); }} className={`bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer transition-all ${unread > 0 ? 'border-l-4 border-l-indigo-600' : ''}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                            <MessageCircle className="w-6 h-6 text-indigo-300 dark:text-indigo-400" />
                        </div>
                        <div>
                            <div className="font-bold text-slate-800 dark:text-slate-200">{c.itemTitle}</div>
                            <div className={`text-sm ${unread > 0 ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'} line-clamp-1`}>{c.lastMessage || 'Start a conversation...'}</div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] text-slate-400">{new Date(c.lastMessageTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        {unread > 0 && (
                            <span className="w-5 h-5 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unread}</span>
                        )}
                    </div>
                </div>
            )})}
        </div>
    </div>
  );

  const renderChatRoom = () => {
    return (
        <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-950 relative">
            {/* Header */}
            <div className="p-3 bg-white dark:bg-slate-900 border-b dark:border-slate-800 shadow-sm flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <button onClick={() => setCurrentView('CHAT_LIST')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" /></button>
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden ring-2 ring-white dark:ring-slate-700">
                             {activeChatPartner?.avatar ? <img src={activeChatPartner.avatar} className="w-full h-full object-cover"/> : <UserIcon className="w-6 h-6 m-auto mt-2 text-slate-400" />}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-white leading-tight">{activeChatPartner?.name || 'User'}</h3>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">{activeChatPartner?.isGuest ? 'Guest' : 'Online'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {currentChatMessages.map(m => {
                    const isMe = m.senderId === user.id;
                    const reactions = m.reactions || {};
                    const reactionKeys = Object.keys(reactions);
                    
                    return (
                    <div key={m.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex max-w-[85%] gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                            {/* Avatar */}
                            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0 self-end mb-4 shadow-sm border border-white dark:border-slate-700">
                                {isMe ? (
                                    user.avatar ? <img src={user.avatar} className="w-full h-full object-cover"/> : <UserIcon className="w-5 h-5 m-auto mt-1.5 text-slate-400"/>
                                ) : (
                                    activeChatPartner?.avatar ? <img src={activeChatPartner.avatar} className="w-full h-full object-cover"/> : <UserIcon className="w-5 h-5 m-auto mt-1.5 text-slate-400"/>
                                )}
                            </div>

                            <div className="flex flex-col gap-1 min-w-0">
                                {/* Sender Name (Tiny) */}
                                <span className={`text-[10px] text-slate-400 px-1 ${isMe ? 'text-right' : 'text-left'}`}>
                                    {isMe ? 'You' : (activeChatPartner?.name || 'User')}
                                </span>

                                <div className={`group relative rounded-2xl p-3 shadow-sm ${isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none'}`}>
                                    
                                    {/* Reply Context */}
                                    {m.replyTo && (
                                        <div className={`mb-2 p-2 rounded-lg text-xs border-l-4 ${isMe ? 'bg-indigo-700/50 border-indigo-300' : 'bg-slate-100 dark:bg-slate-700 border-indigo-500'}`}>
                                            <p className="font-bold opacity-80">{m.replyTo.senderName}</p>
                                            <p className="line-clamp-1 opacity-70">{m.replyTo.text}</p>
                                        </div>
                                    )}

                                    {/* Media */}
                                    {m.imageUrl && (
                                        <img src={m.imageUrl} className="max-w-full rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(m.imageUrl, '_blank')} />
                                    )}

                                    {/* Text */}
                                    <p className="text-sm break-words whitespace-pre-wrap">{m.text}</p>
                                    
                                    {/* Timestamp */}
                                    <p className={`text-[9px] mt-1 text-right ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                                        {new Date(m.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </p>

                                    {/* Action Button (Reply/React) */}
                                    <button 
                                        onClick={() => setReplyingTo(m)}
                                        className={`absolute top-2 ${isMe ? '-left-8' : '-right-8'} p-1.5 rounded-full bg-slate-200/50 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity`}
                                        title="Reply"
                                    >
                                        <Reply className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                        onClick={() => setShowEmojiPicker(showEmojiPicker === m.id ? null : m.id)}
                                        className={`absolute bottom-2 ${isMe ? '-left-8' : '-right-8'} p-1.5 rounded-full bg-slate-200/50 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity`}
                                        title="React"
                                    >
                                        <Smile className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Emoji Picker Popover */}
                                    {showEmojiPicker === m.id && (
                                        <div className={`absolute bottom-8 ${isMe ? 'right-0' : 'left-0'} bg-white dark:bg-slate-800 shadow-xl border dark:border-slate-700 rounded-full p-1 flex gap-1 z-10 animate-in zoom-in-95`}>
                                            {['👍','❤️','😂','😮','😢'].map(emoji => (
                                                <button key={emoji} onClick={() => handleMessageReaction(m.id, emoji)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-lg hover:scale-125 transition-transform">{emoji}</button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Reactions Display */}
                                    {reactionKeys.length > 0 && (
                                        <div className={`absolute -bottom-3 ${isMe ? 'right-0' : 'left-0'} flex gap-1`}>
                                            {reactionKeys.map(emoji => (
                                                <div key={emoji} className="bg-white dark:bg-slate-700 shadow border dark:border-slate-600 rounded-full px-1.5 py-0.5 text-[10px] flex items-center gap-1">
                                                    <span>{emoji}</span>
                                                    <span className="font-bold text-slate-600 dark:text-slate-300">{reactions[emoji].length}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )})}
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white dark:bg-slate-900 border-t dark:border-slate-800 sticky bottom-0">
                {/* Reply Preview */}
                {replyingTo && (
                    <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-800 p-2 rounded-lg mb-2 border-l-4 border-indigo-500 text-xs">
                        <div>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">Replying to {replyingTo.senderId === user.id ? 'yourself' : 'them'}</span>
                            <p className="text-slate-600 dark:text-slate-300 line-clamp-1">{replyingTo.text || 'Image'}</p>
                        </div>
                        <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full"><X className="w-4 h-4 text-slate-500"/></button>
                    </div>
                )}

                {/* Image Preview */}
                {chatImage && (
                    <div className="relative inline-block mb-2">
                        <img src={chatImage} className="h-20 rounded-lg border border-slate-200 dark:border-slate-700" />
                        <button onClick={() => setChatImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
                    </div>
                )}

                <div className="flex gap-2 items-end">
                    <label className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-colors text-slate-500 dark:text-slate-400">
                        <Paperclip className="w-5 h-5" />
                        <input type="file" accept="image/*" className="hidden" onChange={handleChatImageSelect} />
                    </label>
                    <textarea 
                        className="flex-1 border dark:border-slate-700 rounded-2xl p-3 bg-slate-50 dark:bg-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 focus:border-indigo-300 outline-none resize-none max-h-32 text-sm" 
                        value={newMessage} 
                        onChange={e => setNewMessage(e.target.value)} 
                        placeholder="Type a message..." 
                        rows={1}
                        onKeyDown={e => {
                            if(e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage();
                            }
                        }}
                    />
                    <button 
                        onClick={sendMessage} 
                        className={`p-3 rounded-full transition-all ${newMessage.trim() || chatImage ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'}`}
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
  };

  // ... (Other View Renders remain mostly similar) ...
  const renderItemDetail = () => {
    // ... (Existing implementation, just ensuring imports are correct) ...
    if (!selectedItem) return null;
    const isOwner = user.id === selectedItem.authorId;
    const whatsappLink = selectedItem.contactPhone ? getWhatsAppLink(selectedItem.contactPhone, selectedItem.title) : '';
    const isLost = selectedItem.type === 'LOST';

    return (
      <div className="flex flex-col h-full bg-white dark:bg-slate-900 pb-20">
        <div className="relative h-72 bg-slate-200 dark:bg-slate-700 shrink-0">
          {selectedItem.imageUrl ? (
            <img src={selectedItem.imageUrl} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
               <ImageIcon className="w-12 h-12 mb-2"/>
               <span>No Image Available</span>
            </div>
          )}
          <button onClick={() => setCurrentView('HOME')} className="absolute top-4 left-4 p-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-full shadow-sm hover:bg-white dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft className="w-6 h-6 text-slate-800 dark:text-white" />
          </button>
          <div className={`absolute bottom-4 left-4 px-3 py-1 rounded-full text-xs font-bold tracking-wide text-white ${isLost ? 'bg-red-500' : 'bg-emerald-500'}`}>
            {isLost ? 'LOST ITEM' : 'FOUND ITEM'}
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {/* ... Item Details Text ... */}
          <div className="flex justify-between items-start mb-4">
             <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight mb-1">{selectedItem.title}</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-1"><MapPin className="w-3 h-3"/> {selectedItem.city}, {selectedItem.area}</p>
             </div>
             {selectedItem.status === 'RESOLVED' && (
                 <div className="bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 px-3 py-1 rounded-full text-xs font-bold border border-teal-200 dark:border-teal-800 flex items-center gap-1">
                     <CheckCircle className="w-3 h-3"/> Resolved
                 </div>
             )}
          </div>
          <div className="flex gap-2 mb-6">
             <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold uppercase tracking-wider">{selectedItem.category}</span>
             {selectedItem.itemName && <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold uppercase tracking-wider">{selectedItem.itemName}</span>}
             <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-xs font-medium ml-auto">{new Date(selectedItem.date).toLocaleDateString()}</span>
          </div>

          <div className="mb-8">
            <h3 className="font-bold text-slate-800 dark:text-white mb-2">Description</h3>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{selectedItem.description}</p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 mb-6">
            <div className="flex items-center gap-3">
               <div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-full border border-slate-200 dark:border-slate-600 overflow-hidden flex-shrink-0">
                  {(selectedAuthor?.avatar || selectedItem.authorAvatar) ? (
                      <img src={selectedAuthor?.avatar || selectedItem.authorAvatar} className="w-full h-full object-cover" />
                  ) : (
                      <UserIcon className="w-6 h-6 m-auto mt-3 text-slate-400" />
                  )}
               </div>
               <div className="flex-1">
                 <p className="text-xs text-slate-400 font-bold uppercase">Posted by</p>
                 <p className="font-bold text-slate-800 dark:text-white">{selectedItem.authorName}</p>
                 {selectedAuthor?.isGuest && <span className="text-[10px] bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 px-1.5 rounded">Guest</span>}
               </div>
               
               {isOwner ? (
                 <div className="flex gap-2">
                     <button onClick={() => handleDeleteOwnPost(selectedItem.id)} className="p-2 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-lg hover:bg-red-100 transition-colors" title="Delete Post"><Trash2 className="w-5 h-5"/></button>
                 </div>
               ) : (
                 <div className="flex gap-2">
                    <button onClick={() => startChat(selectedItem)} className="p-2 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 transition-colors"><MessageCircle className="w-5 h-5"/></button>
                 </div>
               )}
            </div>
          </div>
          
          {!isOwner && (
              <div className="grid grid-cols-2 gap-3 mt-auto">
                 {selectedItem.contactPhone && (
                     <>
                        <a href={`tel:${selectedItem.contactPhone}`} className="flex items-center justify-center gap-2 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                            <Phone className="w-5 h-5" /> Call
                        </a>
                        <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-3 bg-[#25D366] text-white font-bold rounded-xl hover:opacity-90 transition-opacity">
                            <MessageCircle className="w-5 h-5" /> WhatsApp
                        </a>
                     </>
                 )}
                 {!selectedItem.contactPhone && (
                     <button onClick={() => startChat(selectedItem)} className="col-span-2 flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors">
                        <MessageCircle className="w-5 h-5" /> Chat in App
                     </button>
                 )}
              </div>
          )}
        </div>
      </div>
    );
  };
  
  const renderSplash = () => ( <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col items-center justify-center relative overflow-hidden transition-colors duration-200"><div className="w-24 h-24 mb-6"><img src={appSettings.redLogoUrl || DEFAULT_RED_LOGO} className="w-full h-full object-contain" /></div><h1 className="text-4xl font-bold text-indigo-950 dark:text-white">LOFO.PK</h1><p className="text-slate-400 mt-2 text-sm font-medium">Connecting lost items with their owners</p></div> );
  
  const renderLoadingBubbles = () => (
      <div className="absolute inset-0 z-50 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
          <div className="flex space-x-2">
              <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce"></div>
          </div>
      </div>
  );

  const renderErrorPopup = () => (
      errorPopup && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative text-center border border-red-100 dark:border-red-900/30">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShieldAlert className="w-8 h-8 text-red-600 dark:text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Error</h3>
                <p className="text-slate-600 dark:text-slate-300 mb-6 text-sm">{errorPopup.message}</p>
                <button onClick={() => setErrorPopup(null)} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-red-200 dark:shadow-none">
                    Okay
                </button>
            </div>
        </div>
      )
  );

  const renderToast = () => (
      toast.show && (
          <div className={`fixed bottom-24 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-white font-bold animate-in slide-in-from-bottom-5 fade-in zoom-in-95 z-[100] min-w-[300px] justify-center ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
              {toast.type === 'success' ? <CheckCircle className="w-5 h-5"/> : <AlertCircle className="w-5 h-5"/>}
              {toast.message}
          </div>
      )
  );

  const renderAuth = () => (
    <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col items-center justify-center px-6 py-10 relative transition-colors duration-200">
        {isLoggingIn && renderLoadingBubbles()}
        <div className="w-full max-w-sm">
            <div className="text-center mb-8">
                <div className="w-20 h-20 mx-auto mb-4">
                    <img src={appSettings.redLogoUrl || DEFAULT_RED_LOGO} className="w-full h-full object-contain" />
                </div>
                <h1 className="text-2xl font-bold text-indigo-950 dark:text-white">Welcome to LOFO.PK</h1>
                {justRegisteredName && authMode === 'LOGIN' && (
                    <p className="text-emerald-600 dark:text-emerald-400 font-bold mt-2 animate-pulse">
                        Welcome, {justRegisteredName}! Please log in.
                    </p>
                )}
            </div>
            
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6">
                <button onClick={() => { setAuthMode('LOGIN'); setJustRegisteredName(''); }} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${authMode === 'LOGIN' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Log In</button>
                <button onClick={() => { setAuthMode('REGISTER'); setJustRegisteredName(''); }} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${authMode === 'REGISTER' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>Register</button>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
                {authMode === 'REGISTER' && (
                    <div className="space-y-4 animate-in slide-in-from-top-2">
                        <input 
                            type="text" 
                            placeholder="Full Name" 
                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white" 
                            value={registerName} 
                            onChange={e => setRegisterName(e.target.value)} 
                            required 
                        />
                        <select 
                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                            value={registerCity} 
                            onChange={e => setRegisterCity(e.target.value)} 
                            required
                        >
                            <option value="">Select City</option>
                            {cities.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input 
                            type="tel" 
                            placeholder="Mobile Number" 
                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white" 
                            value={registerMobile} 
                            onChange={e => setRegisterMobile(e.target.value)} 
                            required 
                        />
                    </div>
                )}

                <input 
                    type="email" 
                    placeholder="Email" 
                    autoComplete="username" 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    required 
                />
                
                <div className="relative">
                    <input 
                        type={showPassword ? "text" : "password"} 
                        placeholder={authMode === 'REGISTER' ? "Set Password (min 6 chars)" : "Password"} 
                        autoComplete="current-password" 
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        required 
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                </div>

                {authMode === 'LOGIN' && (
                    <div className="flex justify-between items-center text-sm">
                        <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400 select-none">
                            <input 
                                type="checkbox" 
                                checked={rememberMe} 
                                onChange={e => setRememberMe(e.target.checked)}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                            />
                            Save login info
                        </label>
                        <button type="button" onClick={handleForgotPasswordRequest} className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
                            Forgot Password?
                        </button>
                    </div>
                )}

                <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-none">
                    {authMode === 'LOGIN' ? 'Log In' : 'Sign Up'}
                </button>
            </form>

            <div className="space-y-3">
                <GoogleLoginButton 
                    onSuccess={() => setIsLoggingIn(false)}
                    onError={(msg) => setErrorPopup({show: true, message: msg})}
                />
            </div>
        </div>
    </div>
  );
  
  // Reuse existing profile, settings, myposts...
  const isUserVerified = (userData: Partial<User>) => userData.emailVerified && userData.phoneVerified;
  const renderProfile = () => (
      <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col transition-colors duration-200">
           <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
             <div className="flex items-center gap-3">
               <button onClick={() => setCurrentView('HOME')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><ArrowLeft className="w-5 h-5 dark:text-slate-300" /></button>
               <h1 className="text-xl font-bold dark:text-white">Profile</h1>
             </div>
             <div className="flex items-center gap-2">
                 <button onClick={() => setCurrentView('SETTINGS')} className="text-slate-600 dark:text-slate-300 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><Settings className="w-6 h-6" /></button>
             </div>
           </div>
           <div className="p-6 space-y-6 flex-1 overflow-y-auto pb-20">
               <div className="flex flex-col items-center">
                   <div className="relative group">
                       <div className="w-28 h-28 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-3 ring-4 ring-slate-50 dark:ring-slate-900 shadow-sm">
                           {profileForm.avatar ? <img src={profileForm.avatar} className="w-full h-full object-cover" /> : <UserIcon className="w-14 h-14 m-auto mt-7 text-slate-400" />}
                       </div>
                       <label className="absolute bottom-3 right-0 bg-indigo-600 text-white p-2 rounded-full cursor-pointer hover:bg-indigo-700 transition-colors shadow-md border-2 border-white dark:border-slate-800">
                           <Camera className="w-4 h-4" />
                           <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                       </label>
                   </div>
                   <h2 className="text-xl font-bold text-slate-800 dark:text-white">{user.name}</h2>
               </div>
               {/* Quick Links */}
               <button onClick={() => setCurrentView('MY_POSTS')} className="w-full bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold py-4 rounded-xl flex items-center justify-between px-6 transition-colors border border-indigo-100 dark:border-indigo-800 shadow-sm">
                   <div className="flex items-center gap-3"><List className="w-5 h-5" /> My Posted Items</div><ChevronRight className="w-5 h-5 text-indigo-400" />
               </button>
               {/* Profile Form (Omitted for brevity in edit, keeping existing structure logic...) */}
               <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                   <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Edit2 className="w-4 h-4"/> Edit Details</h3>
                   {/* Fields */}
                   <div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Full Name</label><input type="text" placeholder="Full Name" className="w-full p-3 border dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl" value={profileForm.name || ''} onChange={e => setProfileForm({...profileForm, name: e.target.value})} /></div>
                   <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Age</label><input type="number" placeholder="Age" className="w-full p-3 border dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl" value={profileForm.age || ''} onChange={e => setProfileForm({...profileForm, age: e.target.value})} /></div><div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">City</label><select className="w-full p-3 border dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl" value={profileForm.city || ''} onChange={e => setProfileForm({...profileForm, city: e.target.value})}><option value="">Select City</option>{cities.map(c => <option key={c} value={c}>{c}</option>)}</select></div></div>
                   <div className="pt-2 space-y-4">
                       <div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address</label><div className="flex gap-2"><div className="relative flex-1"><input type="email" className={`w-full p-3 border dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl ${profileForm.emailVerified ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400' : ''}`} value={profileForm.email || ''} onChange={e => setProfileForm({...profileForm, email: e.target.value, emailVerified: false})} placeholder="Enter Email"/></div>{!profileForm.emailVerified && (<button onClick={() => initiateVerification('email')} className="bg-indigo-600 text-white px-4 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors">Verify</button>)}</div></div>
                       <div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Mobile Number</label><div className="flex gap-2"><div className="relative flex-1"><input type="tel" className={`w-full p-3 border dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl ${profileForm.phoneVerified ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400' : ''}`} value={profileForm.phone || ''} onChange={e => setProfileForm({...profileForm, phone: e.target.value, phoneVerified: false})} placeholder="0300xxxxxxx"/></div>{!profileForm.phoneVerified && (<button onClick={() => initiateVerification('phone')} className="bg-indigo-600 text-white px-4 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors">Verify</button>)}</div></div>
                   </div>
                   <button onClick={handleProfileSave} disabled={isSavingProfile} className="w-full bg-slate-900 dark:bg-slate-700 text-white font-bold py-4 rounded-xl mt-4 flex justify-center shadow-lg hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors">{isSavingProfile ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Save Profile Changes'}</button>
               </div>
           </div>
           {verifyingField && (
               <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in"><div className="bg-white p-6 rounded-2xl w-full max-w-xs shadow-2xl relative"><button onClick={() => setVerifyingField(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button><div className="text-center mb-6"><div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3"><Shield className="w-6 h-6 text-indigo-600" /></div><h3 className="font-bold text-lg text-slate-800">Verification</h3><p className="text-sm text-slate-500 mt-1">Enter the OTP sent to your {verifyingField}. <br/><span className="font-mono bg-slate-100 px-1 rounded text-xs">Simulated OTP: 1234</span></p></div><input value={otpInput} onChange={e => setOtpInput(e.target.value)} className="w-full p-3 border rounded-xl text-center text-2xl tracking-widest mb-4 font-mono focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0000" maxLength={4} autoFocus /><button onClick={submitOtp} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">Verify OTP</button></div></div>
           )}
      </div>
  );

  const renderSettings = () => (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors duration-200">
          <div className="p-4 border-b bg-white dark:bg-slate-900 shadow-sm flex items-center gap-3 dark:border-slate-800">
              <button onClick={() => setCurrentView('PROFILE')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" /></button>
              <h1 className="text-xl font-bold text-slate-800 dark:text-white">Settings</h1>
          </div>
          <div className="p-6 space-y-6 flex-1">
              {/* Settings Content */}
              <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 ml-1">Preferences</h3>
                  <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <div className="p-4 flex justify-between items-center border-b border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-3">
                              {darkMode ? <Moon className="w-5 h-5 text-indigo-600 dark:text-indigo-400"/> : <Sun className="w-5 h-5 text-orange-500"/>}
                              <span className="font-medium text-slate-700 dark:text-slate-200">Dark Mode</span>
                          </div>
                          <button onClick={() => setDarkMode(!darkMode)} className={`w-12 h-6 rounded-full p-1 transition-colors ${darkMode ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                              <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${darkMode ? 'translate-x-6' : ''}`}></div>
                          </button>
                      </div>
                  </div>
              </div>
              <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 ml-1">Security</h3>
                  <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                      <button onClick={handleChangePasswordRequest} className="w-full p-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left">
                          <Lock className="w-5 h-5 text-slate-500 dark:text-slate-400"/>
                          <span className="font-medium text-slate-700 dark:text-slate-200">Change Password</span>
                      </button>
                      <button onClick={handlePrivacyPolicy} className="w-full p-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left">
                          <Shield className="w-5 h-5 text-slate-500 dark:text-slate-400"/>
                          <span className="font-medium text-slate-700 dark:text-slate-200">Privacy Policy</span>
                      </button>
                  </div>
              </div>
              <div>
                  <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3 ml-1">Danger Zone</h3>
                  <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                      <button onClick={handleDeleteAccount} className="w-full p-4 flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left group">
                          <UserX className="w-5 h-5 text-red-500 group-hover:text-red-600"/>
                          <span className="font-medium text-red-500 group-hover:text-red-600">Delete Account</span>
                      </button>
                  </div>
              </div>
          </div>
      </div>
  );

  const renderMyPosts = () => {
      const myPosts = posts.filter(p => p.authorId === user.id);
      return (
          <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col pb-20">
              <div className="p-4 border-b bg-white dark:bg-slate-900 shadow-sm flex items-center gap-3 sticky top-0 z-10"><button onClick={() => setCurrentView('PROFILE')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" /></button><h1 className="text-xl font-bold text-slate-800 dark:text-white">My Posted Items</h1></div>
              <div className="p-4 space-y-4">
                  {myPosts.length === 0 ? (<div className="text-center py-20"><div className="bg-slate-200 dark:bg-slate-800 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4"><Archive className="w-8 h-8 text-slate-400" /></div><h3 className="font-bold text-slate-700 dark:text-slate-300">No Posts Yet</h3><p className="text-sm text-slate-500 mt-1">You haven't posted any lost or found items.</p></div>) : (myPosts.map(post => (
                          <div key={post.id} className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border overflow-hidden ${post.status === 'RESOLVED' ? 'border-teal-200 dark:border-teal-800' : post.status === 'INACTIVE' ? 'border-slate-200 dark:border-slate-700 opacity-75' : 'border-slate-200 dark:border-slate-700'}`}>
                              <div className="flex p-4 gap-4"><div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 rounded-lg shrink-0 overflow-hidden">{post.imageUrl ? <img src={post.imageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><ImageIcon className="w-8 h-8"/></div>}</div><div className="flex-1 min-w-0"><div className="flex justify-between items-start"><h3 className="font-bold text-slate-800 dark:text-slate-200 truncate">{post.title}</h3><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${post.type === 'LOST' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>{post.type}</span></div><p className="text-xs text-slate-500 mt-1">{post.city}, {post.area}</p><div className="mt-2 flex items-center gap-2">{post.status === 'RESOLVED' && <span className="bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Resolved</span>}{post.status === 'INACTIVE' && <span className="bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400 text-xs font-bold px-2 py-0.5 rounded">Inactive</span>}{post.status === 'OPEN' && <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 text-xs font-bold px-2 py-0.5 rounded">Active</span>}</div></div></div>
                              <div className="bg-slate-50 dark:bg-slate-750 p-2 flex divide-x divide-slate-200 dark:divide-slate-700 border-t border-slate-100 dark:border-slate-700">
                                  {post.status === 'OPEN' && (<><button onClick={() => handlePostStatusChange(post.id, 'RESOLVED')} className="flex-1 py-2 text-xs font-bold text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded transition-colors flex items-center justify-center gap-1"><CheckCircle className="w-3.5 h-3.5"/> {post.type === 'LOST' ? 'Received Item' : 'Delivered'}</button><button onClick={() => handlePostStatusChange(post.id, 'INACTIVE')} className="flex-1 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors">Deactivate</button></>)}
                                  {post.status === 'INACTIVE' && (<button onClick={() => handlePostStatusChange(post.id, 'OPEN')} className="flex-1 py-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors">Activate</button>)}
                                  <button onClick={() => handleDeleteOwnPost(post.id)} className="flex-1 py-2 text-xs font-bold text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors flex items-center justify-center gap-1"><Trash2 className="w-3.5 h-3.5"/> Delete</button>
                              </div>
                          </div>)))}
              </div>
          </div>
      );
  };

  // Other renders (Filter, Match, Resolved, Info, Donation, Home) are mostly static.
  // Including them to ensure full file integrity
  const renderFilter = () => ( <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col"><div className="p-4 border-b dark:border-slate-800 flex justify-between items-center bg-indigo-600 dark:bg-slate-900 text-white"><h2 className="font-bold text-lg text-white">Filters</h2><button onClick={() => setCurrentView('HOME')}><X /></button></div><div className="p-6 space-y-6 flex-1"><div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Category</label><select className="w-full p-3 border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 dark:text-white" value={activeCategory} onChange={e => { setActiveCategory(e.target.value); setActiveItemName(''); }}><option value="">All Categories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div><div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Item Name</label>{activeCategory ? (<select className="w-full p-3 border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 dark:text-white" value={activeItemName} onChange={e => setActiveItemName(e.target.value)}><option value="">All Items</option>{(categoryItems[activeCategory] || []).map(item => <option key={item} value={item}>{item}</option>)}</select>) : (<input type="text" className="w-full p-3 border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 dark:text-white" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name..." />)}</div><div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">City</label><select className="w-full p-3 border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 dark:text-white" value={activeCity} onChange={e => { setActiveCity(e.target.value); setActiveArea(''); }}><option value="">All Cities</option>{cities.map(c => <option key={c} value={c}>{c}</option>)}</select></div>{activeCity && (<div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Area</label><select className="w-full p-3 border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 dark:text-white" value={activeArea} onChange={e => setActiveArea(e.target.value)}><option value="">All Areas</option><option value="Other">Other</option>{Object.keys(locations[activeCity] || {}).sort().map(a => <option key={a} value={a}>{a}</option>)}</select></div>)}</div><div className="p-6 border-t dark:border-slate-800 flex gap-3"><button onClick={() => { setSearchQuery(''); setActiveCategory(''); setActiveCity(''); setActiveArea(''); setActiveItemName(''); }} className="flex-1 py-3 text-slate-600 dark:text-slate-300 font-bold border dark:border-slate-600 rounded-xl">Clear</button><button onClick={() => setCurrentView('HOME')} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl">Apply Filters</button></div></div> );
  const renderMatchCases = () => { /* Logic omitted but assumed present */ const lostItems = posts.filter(p => p.type === 'LOST' && p.status === 'OPEN'); const foundItems = posts.filter(p => p.type === 'FOUND' && p.status === 'OPEN'); const matches: { lost: ItemPost, found: ItemPost, score: number }[] = []; lostItems.forEach(lost => { foundItems.forEach(found => { let score = 0; if (lost.city === found.city) score++; if (lost.category === found.category) score++; if (lost.itemName && found.itemName && lost.itemName === found.itemName) score++; if (lost.area && found.area && lost.area === found.area) score++; if (score >= 2) { matches.push({ lost, found, score }); } }); }); const sortedMatches = matches.sort((a, b) => b.score - a.score); return (<div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col pb-20"><div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 sticky top-0 z-10 shadow-sm"><button onClick={() => setCurrentView('HOME')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" /></button><h1 className="text-xl font-bold text-indigo-900 dark:text-white flex items-center gap-2"><RefreshCw className="w-5 h-5 text-indigo-600"/> Match Cases</h1></div><div className="p-4 space-y-4"><p className="text-sm text-slate-500 dark:text-slate-400 mb-2 px-1">Showing {sortedMatches.length} pairs with at least 2 matching parameters (City, Area, Category, Item Name).</p>{sortedMatches.length === 0 ? (<div className="flex flex-col items-center justify-center py-20 text-center"><div className="bg-slate-200 dark:bg-slate-800 p-4 rounded-full mb-4"><LinkIcon className="w-8 h-8 text-slate-400" /></div><h3 className="font-bold text-slate-700 dark:text-slate-300">No Matches Found</h3><p className="text-xs text-slate-500 mt-1 max-w-xs">There are currently no items that strongly match each other based on city and category.</p></div>) : (sortedMatches.map((match, idx) => (<div key={idx} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden"><div className="bg-slate-50 dark:bg-slate-750 p-2 text-center text-xs font-bold text-indigo-600 dark:text-indigo-400 border-b border-slate-100 dark:border-slate-700">Match Score: {match.score}/4</div><div className="flex divide-x divide-slate-100 dark:divide-slate-700"><div className="flex-1 p-3"><div className="text-[10px] font-bold text-red-500 uppercase tracking-wide mb-1">Lost Item</div><h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm line-clamp-1">{match.lost.title}</h4><p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{match.lost.city}, {match.lost.area}</p><p className="text-[10px] text-slate-400 mt-0.5">{new Date(match.lost.date).toLocaleDateString()}</p><button onClick={() => {setSelectedItem(match.lost); setCurrentView('ITEM_DETAIL');}} className="mt-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline">View <ExternalLink className="w-3 h-3"/></button></div><div className="w-8 flex items-center justify-center bg-slate-50 dark:bg-slate-750"><LinkIcon className="w-4 h-4 text-slate-300" /></div><div className="flex-1 p-3"><div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide mb-1">Found Item</div><h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm line-clamp-1">{match.found.title}</h4><p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{match.found.city}, {match.found.area}</p><p className="text-[10px] text-slate-400 mt-0.5">{new Date(match.found.date).toLocaleDateString()}</p><button onClick={() => {setSelectedItem(match.found); setCurrentView('ITEM_DETAIL');}} className="mt-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline">View <ExternalLink className="w-3 h-3"/></button></div></div></div>)))}</div></div>); };
  const renderResolvedCases = () => { const resolvedPosts = posts.filter(p => p.status === 'RESOLVED'); return (<div className="p-4"><div className="flex items-center gap-3 mb-6 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 sticky top-0 z-10"><button onClick={() => setCurrentView('HOME')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" /></button><h1 className="text-xl font-bold text-teal-700 dark:text-teal-400 flex items-center gap-2"><CheckCircle className="w-6 h-6"/> Resolved Cases</h1></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{resolvedPosts.length === 0 ? (<div className="col-span-full text-center py-20"><div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-8 h-8 text-slate-400" /></div><h3 className="font-bold text-slate-700 dark:text-slate-300">No Resolved Cases Yet</h3><p className="text-sm text-slate-500 mt-1">Items marked as resolved will appear here.</p></div>) : (resolvedPosts.map(p => (<div key={p.id} className="opacity-75 grayscale hover:grayscale-0 transition-all duration-300 relative group"><div className="absolute inset-0 z-10 bg-white/10 hidden group-hover:block pointer-events-none"></div><ItemCard item={p} onContact={(item) => { setSelectedItem(item); setCurrentView('ITEM_DETAIL'); }} /><div className="absolute top-2 right-2 bg-teal-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm z-20">RESOLVED</div></div>)))}</div></div>); };
  
  const renderInfoScreen = () => (
    <div className="p-4 min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
        <div className="flex items-center gap-3 mb-6 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
            <button onClick={() => setCurrentView('HOME')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">{infoPageData.title}</h1>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 whitespace-pre-line text-slate-700 dark:text-slate-300 leading-relaxed">
            {infoPageData.content}
        </div>
    </div>
  );

  const renderContent = () => {
    switch (currentView) {
      case 'SPLASH': return renderSplash();
      case 'AUTH': return renderAuth();
      case 'ADMIN_DASHBOARD': return <AdminPanel db={db} onLogout={handleLogout} users={allUsers} posts={posts} />;
      case 'POST_FLOW': return postType ? renderPostFlow() : renderPostTypeSelection();
      case 'CHAT_LIST': return renderChatList();
      case 'CHAT_ROOM': return renderChatRoom();
      case 'ITEM_DETAIL': return renderItemDetail();
      case 'PROFILE': return renderProfile();
      case 'SETTINGS': return renderSettings();
      case 'MY_POSTS': return renderMyPosts();
      case 'FILTER': return renderFilter();
      case 'MATCH_CASES': return renderMatchCases();
      case 'RESOLVED_CASES': return renderResolvedCases();
      case 'INFO_SCREEN': return renderInfoScreen();
      case 'HOME':
      default:
        return (
          <div className="p-4">
             {/* Slider Banner */}
             <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-lg mb-6 relative w-full h-48 border border-slate-100 dark:border-slate-700">
                 {appSettings.sliderImages && appSettings.sliderImages.length > 0 ? (
                     <>
                         {appSettings.sliderImages.map((img, index) => (
                             <div 
                                 key={index} 
                                 className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100' : 'opacity-0'}`}
                             >
                                 <img src={img} alt={`Slide ${index + 1}`} className="w-full h-full object-cover" />
                             </div>
                         ))}
                         
                         {/* Dots Indicator */}
                         <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
                             {appSettings.sliderImages.map((_, index) => (
                                 <button 
                                     key={index} 
                                     onClick={() => setCurrentSlide(index)}
                                     className={`w-2 h-2 rounded-full transition-all ${index === currentSlide ? 'bg-white w-4' : 'bg-white/50 hover:bg-white/80'}`}
                                 />
                             ))}
                         </div>
                     </>
                 ) : (
                     /* Fallback Default Banner */
                     <div className="w-full h-full bg-gradient-to-r from-indigo-600 to-purple-600 relative p-6 text-white flex flex-col justify-center">
                         <div className="relative z-10">
                             <button onClick={() => setShowWelcomeBanner(false)} className="absolute -top-2 -right-2 p-1 hover:bg-white/20 rounded-full transition-colors"><X className="w-4 h-4 text-white/80" /></button>
                             <h2 className="text-2xl font-bold mb-1">Welcome to LOFO.PK!</h2>
                             <p className="text-indigo-100 text-sm max-w-xs">Centralized Platform - Save time recovering your items.</p>
                         </div>
                         <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4 pointer-events-none">
                             <Search className="w-32 h-32" />
                         </div>
                     </div>
                 )}
             </div>
             
             {/* Match Notification */}
             {matchNotification?.show && (
                 <div className="bg-indigo-900 text-white p-4 rounded-xl shadow-xl mb-6 flex items-center justify-between animate-pulse cursor-pointer border border-indigo-700" onClick={handleViewMatch}>
                     <div className="flex items-center gap-3">
                         <div className="bg-white/20 p-2 rounded-lg"><RefreshCw className="w-6 h-6 animate-spin"/></div>
                         <div>
                             <p className="font-bold text-sm">Potential Match Found!</p>
                             <p className="text-xs text-indigo-200">A new item matches your criteria.</p>
                         </div>
                     </div>
                     <button onClick={(e) => { e.stopPropagation(); handleDismissMatch(); }} className="p-2 hover:bg-white/10 rounded-full"><X className="w-4 h-4"/></button>
                 </div>
             )}
             
             {/* Search Bar */}
             <div className="flex gap-2 mb-6">
                 <div className="flex-1 relative">
                     <Search className="w-5 h-5 absolute left-3 top-3.5 text-slate-400" />
                     <input 
                        type="text" 
                        placeholder="Search lost or found items..." 
                        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 focus:border-indigo-300 outline-none transition-all dark:text-white"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                     />
                 </div>
                 <button onClick={() => setCurrentView('FILTER')} className={`p-3 rounded-xl border transition-all shadow-sm ${activeCategory || activeCity ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                     <SlidersHorizontal className="w-5 h-5" />
                 </button>
             </div>

             {/* Feed Tabs */}
             <div className="flex p-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 mb-6 shadow-sm">
                 <button onClick={() => setActiveTypeFilter('ALL')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTypeFilter === 'ALL' ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>All</button>
                 <button onClick={() => setActiveTypeFilter('LOST')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTypeFilter === 'LOST' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Lost</button>
                 <button onClick={() => setActiveTypeFilter('FOUND')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTypeFilter === 'FOUND' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Found</button>
             </div>

             {/* Feed List */}
             <div className="space-y-4 pb-20">
                 {posts
                    .filter(p => {
                        if (p.status !== 'OPEN') return false;
                        if (activeTypeFilter !== 'ALL' && p.type !== activeTypeFilter) return false;
                        if (activeCategory && p.category !== activeCategory) return false;
                        if (activeCity && p.city !== activeCity) return false;
                        if (activeArea && activeArea !== 'Other' && p.area !== activeArea) return false;
                        if (activeItemName && p.itemName !== activeItemName) return false;
                        if (searchQuery) {
                             const q = searchQuery.toLowerCase();
                             return p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
                        }
                        return true;
                    })
                    .map(post => (
                     <ItemCard 
                        key={post.id} 
                        item={post} 
                        onContact={(item) => { setSelectedItem(item); setCurrentView('ITEM_DETAIL'); }} 
                     />
                 ))}
                 {posts.length === 0 && <div className="text-center text-slate-400 dark:text-slate-500 py-10">No items found</div>}
             </div>
          </div>
        );
    }
  };

  return (
    <>
        <Layout 
            currentView={currentView}
            setCurrentView={setCurrentView}
            notificationCount={alertCount}
            unreadChatCount={unreadChatCount}
            user={user}
            onRestrictedAction={requireAuth}
            greenLogoUrl={appSettings.greenLogoUrl}
            redLogoUrl={appSettings.redLogoUrl}
            onSidebarAction={handleSidebarAction}
        >
            {renderContent()}
        </Layout>
        
        {/* Donation Modal */}
        {showDonationModal && (
            <div className="absolute inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowDonationModal(false)}>
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full relative animate-in zoom-in-95 shadow-2xl" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setShowDonationModal(false)} className="absolute top-4 right-4 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"><X className="w-5 h-5 text-slate-500"/></button>
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-pink-100 dark:bg-pink-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <HandHeart className="w-8 h-8 text-pink-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">Support LOFO.PK</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Your donations help us maintain servers and keep this service free for everyone.</p>
                    </div>
                    
                    <div className="space-y-3 bg-slate-50 dark:bg-slate-750 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div>
                            <p className="text-xs text-slate-400 font-bold uppercase">Bank Name</p>
                            <p className="font-bold text-slate-800 dark:text-white">{appSettings.donationInfo?.bankName || 'Meezan Bank'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-bold uppercase">Account Title</p>
                            <p className="font-bold text-slate-800 dark:text-white">{appSettings.donationInfo?.accountTitle || 'LOFO PK Welfare'}</p>
                        </div>
                        <div className="relative group cursor-pointer" onClick={() => handleCopy(appSettings.donationInfo?.accountNumber || 'Not Set', 'acc')}>
                            <p className="text-xs text-slate-400 font-bold uppercase">Account Number</p>
                            <p className="font-bold text-slate-800 dark:text-white font-mono flex items-center gap-2">
                                {appSettings.donationInfo?.accountNumber || '010101010101'} 
                                <Copy className="w-3 h-3 text-slate-400"/>
                            </p>
                            {copiedField === 'acc' && <span className="absolute right-0 top-0 text-xs bg-black text-white px-2 py-0.5 rounded">Copied!</span>}
                        </div>
                        <div className="relative group cursor-pointer" onClick={() => handleCopy(appSettings.donationInfo?.iban || 'Not Set', 'iban')}>
                            <p className="text-xs text-slate-400 font-bold uppercase">IBAN</p>
                            <p className="font-bold text-slate-800 dark:text-white font-mono flex items-center gap-2 text-xs break-all">
                                {appSettings.donationInfo?.iban || 'PK00MEZN0000000000000000'}
                                <Copy className="w-3 h-3 text-slate-400"/>
                            </p>
                            {copiedField === 'iban' && <span className="absolute right-0 top-0 text-xs bg-black text-white px-2 py-0.5 rounded">Copied!</span>}
                        </div>
                    </div>

                    <button className="w-full mt-6 bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-pink-200 dark:shadow-none">
                        I Have Donated
                    </button>
                </div>
            </div>
        )}

        {/* Forgot Password Modal */}
        {showForgotPassModal && (
            <div className="absolute inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForgotPassModal(false)}>
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full relative animate-in zoom-in-95 shadow-2xl" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setShowForgotPassModal(false)} className="absolute top-4 right-4 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"><X className="w-5 h-5 text-slate-500"/></button>
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Mail className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">Reset Password</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Enter your email address and we'll send you a link to reset your password.</p>
                    </div>
                    
                    <div className="space-y-4">
                        <input 
                            type="email" 
                            placeholder="Enter your email" 
                            className="w-full p-3 border dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                        />
                        <button 
                            onClick={handleSendResetEmail}
                            disabled={isSubmitting}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Reset Link'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Change Password Modal */}
        {showChangePassModal && (
            <div className="absolute inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowChangePassModal(false)}>
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full relative animate-in zoom-in-95 shadow-2xl" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setShowChangePassModal(false)} className="absolute top-4 right-4 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"><X className="w-5 h-5 text-slate-500"/></button>
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Lock className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">Change Password</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Create a new secure password for your account.</p>
                    </div>
                    
                    <div className="space-y-4">
                        <input 
                            type="password" 
                            placeholder="New Password (min 6 chars)" 
                            className="w-full p-3 border dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none"
                            value={newPass}
                            onChange={(e) => setNewPass(e.target.value)}
                        />
                        <input 
                            type="password" 
                            placeholder="Confirm New Password" 
                            className="w-full p-3 border dark:border-slate-600 dark:bg-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-100 outline-none"
                            value={confirmNewPass}
                            onChange={(e) => setConfirmNewPass(e.target.value)}
                        />
                        <button 
                            onClick={handleSubmitChangePassword}
                            disabled={isSubmitting}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Password'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {renderErrorPopup()}
        {renderToast()}
    </>
  );
};

export default App;