
export type PostType = 'LOST' | 'FOUND';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  isGuest: boolean;
  fathersName?: string;
  age?: string;
  city?: string; // Important for city-based alerts
  phone?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  isBlocked?: boolean;
  readNotificationIds?: string[]; // Array of alert IDs read by user
  deletedNotificationIds?: string[]; // Array of alert IDs deleted by user
}

export interface ItemPost {
  id: string;
  type: PostType;
  title: string;
  itemName?: string; // Specific sub-category item name
  description: string;
  category: string;
  city: string;
  area: string;
  subArea1?: string;
  subArea2?: string;
  date: string;
  imageUrl?: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string; // Added avatar URL
  contactPhone?: string;
  status: 'OPEN' | 'RESOLVED' | 'INACTIVE';
}

export interface CityAlert {
  id: string;
  message: string;
  city: string;
  type: 'LOST' | 'FOUND';
  timestamp: number;
  postId?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  imageUrl?: string;
  replyTo?: {
    id: string;
    text: string;
    senderName: string;
  };
  reactions?: Record<string, string[]>;
}

export interface ChatSession {
  id: string;
  itemId: string;
  participants: string[]; // [userId, userId]
  itemTitle: string;
  lastMessage: string;
  lastMessageTime: number;
  unreadCounts?: Record<string, number>; // { userId: number_of_unread_msgs }
}

export interface Report {
  id: string;
  reporterId: string;
  reportedUserId: string;
  reason: string;
  timestamp: number;
  status: 'PENDING' | 'RESOLVED';
}

export interface AppSettings {
  redLogoUrl?: string;
  greenLogoUrl?: string;
  sliderImages?: string[]; 
  aboutUs?: string;
  contactUs?: string;
  howItWorks?: string;
  donationInfo?: {
    bankName: string;
    accountTitle: string;
    accountNumber: string;
    iban: string;
  };
  customCategories?: string[];
  categoryItems?: Record<string, string[]>; 
  customLocations?: any; 
}

export type AppView = 'SPLASH' | 'AUTH' | 'HOME' | 'POST_FLOW' | 'CHAT_LIST' | 'CHAT_ROOM' | 'FILTER' | 'PROFILE' | 'ITEM_DETAIL' | 'ADMIN_DASHBOARD' | 'MATCH_CASES' | 'INFO_SCREEN' | 'RESOLVED_CASES' | 'SETTINGS' | 'MY_POSTS';
