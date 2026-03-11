import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// ==========================================
// 1. TYPES
// ==========================================

enum UserRole {
  GUEST = 'GUEST',
  STUDENT = 'STUDENT',
  ADMIN = 'ADMIN',
}

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  passwordHash?: string; 
}

enum GrievanceStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
}

enum GrievanceCategory {
  ACADEMIC = 'ACADEMIC',
  INFRASTRUCTURE = 'INFRASTRUCTURE',
  HOSTEL = 'HOSTEL',
  HARASSMENT = 'HARASSMENT',
  OTHER = 'OTHER',
}

interface Grievance {
  id: string;
  studentId: string;
  studentName?: string;
  title: string;
  description: string;
  category: GrievanceCategory;
  status: GrievanceStatus;
  createdAt: number;
  updatedAt: number;
  aiAnalysis?: {
    sentiment: 'Positive' | 'Neutral' | 'Negative' | 'Urgent';
    summary: string;
    suggestedPriority: 'High' | 'Medium' | 'Low';
  };
  adminResponse?: string;
}

type ViewState = 'LOGIN' | 'DASHBOARD' | 'SUBMIT_NEW' | 'GRIEVANCE_DETAIL';

interface Notification {
  id: string;
  userId: string;
  message: string;
  type: 'STATUS_CHANGE' | 'ADMIN_REPLY' | 'NEW_GRIEVANCE';
  relatedGrievanceId?: string;
  read: boolean;
  createdAt: number;
}

// ==========================================
// 2. SERVICES
// ==========================================

// --- Gemini Service ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL_NAME = 'gemini-2.5-flash';

const refineGrievanceText = async (draft: string): Promise<string> => {
  if (!draft || draft.trim().length < 10) return draft;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Rewrite the following student grievance text to be professional, clear, and concise, suitable for submission to a university administration. Maintain the original meaning and facts. Text: "${draft}"`,
    });
    return response.text || draft;
  } catch (error) {
    console.error("Error refining text:", error);
    return draft;
  }
};

const analyzeGrievance = async (title: string, description: string) => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Analyze this student grievance. Title: "${title}". Description: "${description}". Provide a brief summary, sentiment (Positive, Neutral, Negative, Urgent), and suggested priority (High, Medium, Low).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            sentiment: { type: Type.STRING, enum: ["Positive", "Neutral", "Negative", "Urgent"] },
            suggestedPriority: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
          },
          required: ["summary", "sentiment", "suggestedPriority"],
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No text returned from Gemini");
    
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Error analyzing grievance:", error);
    return {
      summary: "Analysis unavailable",
      sentiment: "Neutral",
      suggestedPriority: "Medium",
    };
  }
};

const suggestCategory = async (text: string): Promise<GrievanceCategory> => {
  try {
    const categories = Object.values(GrievanceCategory);
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Classify the following grievance text into exactly one of these categories: ${categories.join(', ')}. Text: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING, enum: categories },
          },
        },
      },
    });
    
    const result = JSON.parse(response.text || "{}");
    return result.category as GrievanceCategory || GrievanceCategory.OTHER;
  } catch (error) {
    console.error("Error suggesting category:", error);
    return GrievanceCategory.OTHER;
  }
};

// --- Auth Service ---
const USERS_KEY = 'campus_voice_users';
const SESSION_KEY = 'campus_voice_session';

const hashPassword = async (password: string): Promise<string> => {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const seedUsers = async () => {
  if (localStorage.getItem(USERS_KEY)) return;
  const adminPass = await hashPassword('admin123');
  const studentPass = await hashPassword('student123');
  const initialUsers: User[] = [
    {
      id: 'admin-1',
      name: 'System Administrator',
      email: 'admin@college.edu',
      role: UserRole.ADMIN,
      passwordHash: adminPass
    },
    {
      id: 'student-1',
      name: 'Alex Student',
      email: 'student@college.edu',
      role: UserRole.STUDENT,
      passwordHash: studentPass
    }
  ];
  localStorage.setItem(USERS_KEY, JSON.stringify(initialUsers));
};
seedUsers().catch(console.error);

const getUsers = (): User[] => {
  const usersStr = localStorage.getItem(USERS_KEY);
  return usersStr ? JSON.parse(usersStr) : [];
};

const saveUsers = (users: User[]) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

const authService = {
  async login(email: string, password: string): Promise<User> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const users = getUsers();
    const targetUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!targetUser || !targetUser.passwordHash) throw new Error('Invalid email or password');
    const providedHash = await hashPassword(password);
    if (providedHash !== targetUser.passwordHash) throw new Error('Invalid email or password');
    const { passwordHash, ...safeUser } = targetUser;
    localStorage.setItem(SESSION_KEY, JSON.stringify(safeUser));
    return safeUser;
  },
  async register(name: string, email: string, password: string, role: UserRole): Promise<User> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const users = getUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) throw new Error('User with this email already exists');
    const hashedPassword = await hashPassword(password);
    const newUser: User = {
      id: Math.random().toString(36).substring(7),
      name,
      email,
      role,
      passwordHash: hashedPassword
    };
    users.push(newUser);
    saveUsers(users);
    const { passwordHash, ...safeUser } = newUser;
    localStorage.setItem(SESSION_KEY, JSON.stringify(safeUser));
    return safeUser;
  },
  logout() {
    localStorage.removeItem(SESSION_KEY);
  },
  getCurrentUser(): User | null {
    const sessionStr = localStorage.getItem(SESSION_KEY);
    return sessionStr ? JSON.parse(sessionStr) : null;
  },
  getAdmins(): User[] {
    const users = getUsers();
    return users.filter(u => u.role === UserRole.ADMIN);
  }
};

// --- Notification Service ---
const NOTIFICATIONS_KEY = 'campus_voice_notifications';

const getNotificationsRaw = (): Notification[] => {
  const str = localStorage.getItem(NOTIFICATIONS_KEY);
  return str ? JSON.parse(str) : [];
};

const saveNotifications = (notifications: Notification[]) => {
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
};

const notificationService = {
  getUserNotifications(userId: string): Notification[] {
    const all = getNotificationsRaw();
    return all.filter(n => n.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
  },
  getUnreadCount(userId: string): number {
    return this.getUserNotifications(userId).filter(n => !n.read).length;
  },
  createNotification(userId: string, message: string, type: Notification['type'], relatedGrievanceId?: string) {
    const all = getNotificationsRaw();
    const newNotification: Notification = {
      id: Math.random().toString(36).substring(7),
      userId,
      message,
      type,
      relatedGrievanceId,
      read: false,
      createdAt: Date.now(),
    };
    all.push(newNotification);
    saveNotifications(all);
    return newNotification;
  },
  markAsRead(notificationId: string) {
    const all = getNotificationsRaw();
    const updated = all.map(n => n.id === notificationId ? { ...n, read: true } : n);
    saveNotifications(updated);
  },
  markAllAsRead(userId: string) {
    const all = getNotificationsRaw();
    const updated = all.map(n => n.userId === userId ? { ...n, read: true } : n);
    saveNotifications(updated);
  }
};

// ==========================================
// 3. UI COMPONENTS
// ==========================================

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost' | 'ai';
  isLoading?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const Button: React.FC<ButtonProps> = ({ 
  children, variant = 'primary', className = '', isLoading = false, disabled, size = 'md', ...props 
}) => {
  const baseStyles = "font-medium transition-all duration-200 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm active:scale-95";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-5 py-2.5 text-sm", lg: "px-6 py-3 text-base" };
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 shadow-indigo-200 dark:shadow-none hover:shadow-indigo-300 hover:-translate-y-0.5",
    secondary: "bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 focus:ring-gray-200 hover:border-gray-300 dark:hover:border-slate-600 hover:text-gray-900 dark:hover:text-white",
    danger: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 focus:ring-red-500 border border-red-100 dark:border-red-900/30",
    outline: "bg-transparent border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 focus:ring-gray-500",
    ghost: "bg-transparent text-gray-600 dark:text-slate-400 hover:bg-gray-100/50 dark:hover:bg-slate-800/50 hover:text-gray-900 dark:hover:text-white focus:ring-gray-500 shadow-none",
    ai: "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 shadow-violet-200 dark:shadow-none hover:shadow-violet-300 border-0",
  };
  return (
    <button className={`${baseStyles} ${sizes[size]} ${variants[variant]} ${className}`} disabled={disabled || isLoading} {...props}>
      {isLoading ? (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      ) : null}
      {children}
    </button>
  );
};

const StatusBadge: React.FC<{ status: GrievanceStatus }> = ({ status }) => {
  const config = {
    [GrievanceStatus.PENDING]: { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-400", border: "border-amber-100 dark:border-amber-900/30", dot: "bg-amber-500" },
    [GrievanceStatus.IN_PROGRESS]: { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-400", border: "border-blue-100 dark:border-blue-900/30", dot: "bg-blue-500" },
    [GrievanceStatus.RESOLVED]: { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-400", border: "border-emerald-100 dark:border-emerald-900/30", dot: "bg-emerald-500" },
    [GrievanceStatus.REJECTED]: { bg: "bg-rose-50 dark:bg-rose-900/20", text: "text-rose-700 dark:text-rose-400", border: "border-rose-100 dark:border-rose-900/30", dot: "bg-rose-500" },
  };
  const style = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${style.bg} ${style.text} ${style.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`}></span>
      {status.replace('_', ' ')}
    </span>
  );
};

interface SentimentData { label: string; value: number; colorClass: string; }
const SentimentChart: React.FC<{ data: SentimentData[]; title?: string }> = ({ data, title = "Sentiment Analysis" }) => {
  const total = data.reduce((acc, curr) => acc + curr.value, 0);
  let accumulatedPercent = 0;
  const size = 200;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  if (total === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 sm:p-8 flex flex-col h-full">
      <div className="mb-6">
        <h3 className="font-bold text-gray-900 dark:text-white text-lg">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400">Distribution by AI-detected sentiment</p>
      </div>
      <div className="flex flex-col md:flex-row items-center justify-center gap-8 lg:gap-12 flex-1">
        <div className="relative w-48 h-48 flex-shrink-0">
          <svg viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90 w-full h-full">
            <circle r={radius} cx={center} cy={center} fill="transparent" stroke="currentColor" strokeWidth={strokeWidth} className="text-gray-100 dark:text-slate-700/50"/>
            {data.map((item) => {
              if (item.value === 0) return null;
              const percent = item.value / total;
              const dashArray = `${percent * circumference} ${circumference}`;
              const dashOffset = -accumulatedPercent * circumference;
              accumulatedPercent += percent;
              return <circle key={item.label} r={radius} cx={center} cy={center} fill="transparent" stroke="currentColor" strokeWidth={strokeWidth} strokeDasharray={dashArray} strokeDashoffset={dashOffset} className={`${item.colorClass} transition-all duration-1000 ease-out hover:opacity-80`}/>;
            })}
            <text x="50%" y="45%" dominantBaseline="middle" textAnchor="middle" className="transform rotate-90 fill-gray-900 dark:fill-white text-4xl font-bold font-display">{total}</text>
            <text x="50%" y="65%" dominantBaseline="middle" textAnchor="middle" className="transform rotate-90 fill-gray-400 dark:fill-slate-500 text-xs font-semibold uppercase tracking-wider">Total</text>
          </svg>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 w-full">
          {data.map((item) => (
            <div key={item.label} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
               <div className={`w-3 h-3 rounded-full shadow-sm ${item.colorClass.replace('text-', 'bg-')}`}></div>
               <div className="flex-1">
                 <div className="flex justify-between items-baseline mb-0.5">
                    <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">{item.label}</span>
                    <span className="text-xs font-medium text-gray-400 dark:text-slate-500">{Math.round((item.value/total)*100)}%</span>
                 </div>
                 <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-full rounded-full ${item.colorClass.replace('text-', 'bg-')}`} style={{ width: `${(item.value/total)*100}%` }}></div>
                 </div>
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 4. MAIN APP
// ==========================================

const INITIAL_GRIEVANCES: Grievance[] = [
  {
    id: '1',
    studentId: 'student-1',
    studentName: 'Alex Student',
    title: 'Broken Fan in Room 304',
    description: 'The ceiling fan in room 304 of Block A has been making a loud noise and vibrating dangerously for the last 3 days. It is impossible to sleep.',
    category: GrievanceCategory.HOSTEL,
    status: GrievanceStatus.PENDING,
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now(),
    aiAnalysis: {
      sentiment: 'Negative',
      summary: 'Ceiling fan malfunction in Block A Room 304 creating noise and safety hazard.',
      suggestedPriority: 'Medium'
    }
  },
  {
    id: '2',
    studentId: 'student-1',
    studentName: 'Alex Student',
    title: 'Outdated Library Books for CS',
    description: 'The computer science section needs newer editions. Most books are from 2015.',
    category: GrievanceCategory.ACADEMIC,
    status: GrievanceStatus.RESOLVED,
    createdAt: Date.now() - 86400000 * 10,
    updatedAt: Date.now() - 86400000 * 1,
    adminResponse: "We have ordered new books for the upcoming semester."
  }
];

const timeAgo = (date: number) => {
  const seconds = Math.floor((Date.now() - date) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const App: React.FC = () => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // View State
  const [view, setView] = useState<ViewState>('LOGIN');
  
  // Data State
  const [grievances, setGrievances] = useState<Grievance[]>(INITIAL_GRIEVANCES);
  const [selectedGrievanceId, setSelectedGrievanceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'CLOSED'>('ALL');
  
  // Login/Register Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.STUDENT);

  // Grievance Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<GrievanceCategory>(GrievanceCategory.OTHER);
  const [isRefining, setIsRefining] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Admin Reply State
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Notification State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Theme State
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (document.documentElement.classList.contains('dark')) {
      setDarkMode(true);
    }
  }, []);

  const toggleTheme = () => {
    if (darkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
      setDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
      setDarkMode(true);
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      const user = authService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        setView('DASHBOARD');
      }
      setIsAuthLoading(false);
    };
    checkSession();
  }, []);

  useEffect(() => {
    if (currentUser) {
      const loadNotifications = () => {
        setNotifications(notificationService.getUserNotifications(currentUser.id));
      };
      loadNotifications();
      const interval = setInterval(loadNotifications, 5000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthenticating(true);
    try {
      let user: User;
      if (authMode === 'LOGIN') {
        user = await authService.login(email, password);
      } else {
        user = await authService.register(fullName, email, password, selectedRole);
      }
      setCurrentUser(user);
      setView('DASHBOARD');
      setEmail('');
      setPassword('');
      setFullName('');
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setView('LOGIN');
  };

  const markNotificationRead = (id: string) => {
    notificationService.markAsRead(id);
    if (currentUser) setNotifications(notificationService.getUserNotifications(currentUser.id));
  };

  const markAllNotificationsRead = () => {
    if (currentUser) {
      notificationService.markAllAsRead(currentUser.id);
      setNotifications(notificationService.getUserNotifications(currentUser.id));
    }
  };

  const handleRefineText = async () => {
    if (!description) return;
    setIsRefining(true);
    const refined = await refineGrievanceText(description);
    setDescription(refined);
    const suggestedCat = await suggestCategory(refined);
    setCategory(suggestedCat);
    setIsRefining(false);
  };

  const handleGenerateAnalysis = async (id: string) => {
    const grievance = grievances.find(g => g.id === id);
    if (!grievance) return;
    setIsAnalyzing(true);
    const analysis = await analyzeGrievance(grievance.title, grievance.description);
    setGrievances(prev => prev.map(g => g.id === id ? { ...g, aiAnalysis: analysis } : g));
    setIsAnalyzing(false);
  };

  const handleEditClick = (g: Grievance) => {
    setTitle(g.title);
    setDescription(g.description);
    setCategory(g.category);
    setEditingId(g.id);
    setView('SUBMIT_NEW');
  };

  const handleSubmitGrievance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSubmitting(true);
    const analysis = await analyzeGrievance(title, description);

    if (editingId) {
      setGrievances(prev => prev.map(g => 
        g.id === editingId ? { ...g, title, description, category, updatedAt: Date.now(), aiAnalysis: analysis } : g
      ));
    } else {
      const newGrievance: Grievance = {
        id: Math.random().toString(36).substring(7),
        studentId: currentUser.id,
        studentName: currentUser.name,
        title,
        description,
        category,
        status: GrievanceStatus.PENDING,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        aiAnalysis: analysis
      };
      setGrievances([newGrievance, ...grievances]);
      const admins = authService.getAdmins();
      admins.forEach(admin => {
        notificationService.createNotification(admin.id, `New grievance submitted by ${currentUser.name}: "${title}"`, 'NEW_GRIEVANCE', newGrievance.id);
      });
    }
    setIsSubmitting(false);
    setTitle('');
    setDescription('');
    setCategory(GrievanceCategory.OTHER);
    setEditingId(null);
    setView('DASHBOARD');
  };

  const handleStatusChange = (id: string, newStatus: GrievanceStatus) => {
    const grievance = grievances.find(g => g.id === id);
    setGrievances(prev => prev.map(g => g.id === id ? { ...g, status: newStatus, updatedAt: Date.now() } : g));
    if (grievance) {
      notificationService.createNotification(grievance.studentId, `Your grievance "${grievance.title}" has been marked as ${newStatus.replace('_', ' ')}.`, 'STATUS_CHANGE', grievance.id);
    }
  };

  const handleViewDetail = (id: string) => {
    setSelectedGrievanceId(id);
    setView('GRIEVANCE_DETAIL');
  };

  const handleStartReply = (g: Grievance) => {
    setReplyingId(g.id);
    setReplyText(g.adminResponse || '');
  };

  const handleCancelReply = () => {
    setReplyingId(null);
    setReplyText('');
  };

  const handleSubmitReply = (id: string) => {
    if (!replyText.trim()) return;
    const grievance = grievances.find(g => g.id === id);
    setGrievances(prev => prev.map(g => g.id === id ? { ...g, adminResponse: replyText, updatedAt: Date.now() } : g));
    if (grievance) {
      notificationService.createNotification(grievance.studentId, `Admin responded to your grievance "${grievance.title}".`, 'ADMIN_REPLY', grievance.id);
    }
    setReplyingId(null);
    setReplyText('');
  };

  const renderLogin = () => (
    <div className="min-h-screen flex bg-white dark:bg-slate-900">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-indigo-900 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-violet-900 opacity-90 z-10"></div>
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1523050854058-8df90110c9f1?ixlib=rb-4.0.3&auto=format&fit=crop&w=1350&q=80')] bg-cover bg-center"></div>
        <div className="relative z-20 flex flex-col justify-center px-16">
          <div className="mb-8">
             <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
                <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
             </div>
             <h1 className="text-5xl font-bold font-display mb-4 leading-tight">CampusVoice</h1>
             <p className="text-indigo-100 text-lg max-w-md leading-relaxed">Empowering our campus community through transparent, AI-assisted grievance resolution.</p>
          </div>
        </div>
      </div>
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-gray-50/50 dark:bg-slate-900 relative">
        <div className="absolute top-6 right-6">
          <button onClick={toggleTheme} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors">
             {darkMode ? (<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>) : (<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>)}
          </button>
        </div>
        <div className="w-full max-w-md space-y-8 bg-white dark:bg-slate-800 p-8 sm:p-10 rounded-3xl shadow-xl border border-gray-100 dark:border-slate-700">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{authMode === 'LOGIN' ? 'Welcome back' : 'Create account'}</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">{authMode === 'LOGIN' ? 'Please enter your details to sign in' : 'Join the community to voice your concerns'}</p>
          </div>
          {authError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {authError}
            </div>
          )}
          <form onSubmit={handleAuthSubmit} className="space-y-5">
            {authMode === 'REGISTER' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Full Name</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50/50 dark:bg-slate-900 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" placeholder="John Doe" required />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50/50 dark:bg-slate-900 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" placeholder="you@college.edu" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50/50 dark:bg-slate-900 text-gray-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" placeholder="••••••••" required minLength={6} />
            </div>
            {authMode === 'REGISTER' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">I am a...</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setSelectedRole(UserRole.STUDENT)} className={`py-3 px-4 rounded-xl text-sm font-medium border-2 transition-all ${selectedRole === UserRole.STUDENT ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-600 text-indigo-700 dark:text-indigo-300' : 'border-gray-100 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}>Student</button>
                  <button type="button" onClick={() => setSelectedRole(UserRole.ADMIN)} className={`py-3 px-4 rounded-xl text-sm font-medium border-2 transition-all ${selectedRole === UserRole.ADMIN ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-600 text-indigo-700 dark:text-indigo-300' : 'border-gray-100 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'}`}>Administrator</button>
                </div>
              </div>
            )}
            <Button type="submit" isLoading={isAuthenticating} className="w-full justify-center py-3.5 text-base shadow-lg shadow-indigo-500/20">{authMode === 'LOGIN' ? 'Sign In' : 'Create Account'}</Button>
          </form>
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-slate-400">{authMode === 'LOGIN' ? "Don't have an account? " : "Already have an account? "} <button onClick={() => { setAuthMode(authMode === 'LOGIN' ? 'REGISTER' : 'LOGIN'); setAuthError(''); }} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors">{authMode === 'LOGIN' ? 'Sign up' : 'Sign in'}</button></p>
          </div>
          {authMode === 'LOGIN' && (
            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-700">
               <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-xs text-blue-800 dark:text-blue-300 space-y-1 border border-blue-100 dark:border-blue-900/30">
                 <p className="font-bold uppercase tracking-wide mb-2 text-blue-600 dark:text-blue-400">Demo Access</p>
                 <div className="flex justify-between"><span>Student:</span><span className="font-mono text-gray-900 dark:text-slate-300">student@college.edu / student123</span></div>
                 <div className="flex justify-between"><span>Admin:</span><span className="font-mono text-gray-900 dark:text-slate-300">admin@college.edu / admin123</span></div>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderForm = () => (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{editingId ? 'Edit Grievance' : 'Submit New Grievance'}</h2>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">{editingId ? 'Update your concern details.' : 'Voice your concern and we will help you frame it.'}</p>
        </div>
        <Button variant="secondary" onClick={() => { setView('DASHBOARD'); setEditingId(null); setTitle(''); setDescription(''); setCategory(GrievanceCategory.OTHER); }}>Cancel</Button>
      </div>
      <div className="flex flex-col lg:flex-row gap-8">
        <form onSubmit={handleSubmitGrievance} className="flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-8 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" placeholder="E.g. Broken equipment in Lab 2" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Category</label>
            <div className="relative">
              <select value={category} onChange={e => setCategory(e.target.value as GrievanceCategory)} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none appearance-none">
                {Object.values(GrievanceCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between items-end mb-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300">Description</label>
              <Button type="button" variant="ai" size="sm" onClick={handleRefineText} disabled={isRefining || !description || description.length < 10} isLoading={isRefining} className="text-xs"><svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>Polish with AI</Button>
            </div>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all h-48 resize-none leading-relaxed" placeholder="Describe your grievance in detail. Don't worry about the tone, our AI can help polish it for you." required />
          </div>
          <div className="pt-4 flex justify-end border-t border-gray-100 dark:border-slate-700">
            <Button type="submit" isLoading={isSubmitting} className="w-full sm:w-auto shadow-lg shadow-indigo-200 dark:shadow-none">{editingId ? 'Update Grievance' : 'Submit Grievance'}</Button>
          </div>
        </form>
        <div className="w-full lg:w-80 space-y-6">
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-6 border border-indigo-100 dark:border-indigo-900/30">
            <h3 className="font-bold text-indigo-900 dark:text-indigo-300 mb-2 flex items-center"><svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Writing Tips</h3>
            <ul className="text-sm text-indigo-800 dark:text-indigo-200 space-y-3 pl-1">
              <li className="flex items-start gap-2"><span className="text-indigo-500 dark:text-indigo-400 font-bold">•</span>Be specific about locations and dates.</li>
              <li className="flex items-start gap-2"><span className="text-indigo-500 dark:text-indigo-400 font-bold">•</span>Keep it objective and factual.</li>
              <li className="flex items-start gap-2"><span className="text-indigo-500 dark:text-indigo-400 font-bold">•</span>Use the AI tool to fix grammar and tone.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderGrievanceCard = (g: Grievance) => {
    const isOwner = currentUser?.id === g.studentId;
    const canEdit = isOwner && g.status === GrievanceStatus.PENDING;
    return (
      <div key={g.id} className="group bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 transition-all hover:shadow-xl hover:shadow-indigo-100/50 dark:hover:shadow-slate-900/50 hover:-translate-y-1 hover:border-indigo-100 dark:hover:border-indigo-900 relative overflow-hidden">
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${g.status === GrievanceStatus.PENDING ? 'bg-amber-400' : g.status === GrievanceStatus.RESOLVED ? 'bg-emerald-400' : g.status === GrievanceStatus.REJECTED ? 'bg-rose-400' : 'bg-blue-400'}`}></div>
        <div className="pl-3">
          <div className="flex justify-between items-start mb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="px-2.5 py-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-lg text-xs font-semibold tracking-wide uppercase">{g.category}</span>
                <StatusBadge status={g.status} />
              </div>
              <h3 onClick={() => handleViewDetail(g.id)} className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 cursor-pointer transition-colors line-clamp-1">{g.title}</h3>
            </div>
            <span className="text-xs font-medium text-gray-400 whitespace-nowrap">{timeAgo(g.createdAt)}</span>
          </div>
          <p className="text-gray-600 dark:text-slate-400 mb-5 line-clamp-2 text-sm leading-relaxed">{g.description}</p>
          <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-slate-700">
             <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-500">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">{g.studentName?.[0] || 'U'}</div>
                    <span className="font-medium">{g.studentName || 'Anonymous'}</span>
                </div>
                {g.aiAnalysis && (
                  <div className="hidden sm:flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 font-medium bg-violet-50 dark:bg-violet-900/20 px-2 py-0.5 rounded-md">
                     <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm1-13h-2v6h6v-2h-4z"/></svg>AI Analyzed
                  </div>
                )}
             </div>
             <div className="flex gap-2">
               {canEdit && (
                 <Button variant="outline" size="sm" onClick={() => handleEditClick(g)} className="opacity-0 group-hover:opacity-100 transition-opacity border-indigo-200 text-indigo-600 hover:bg-indigo-50">Edit</Button>
               )}
               <Button variant="secondary" size="sm" className="group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:border-indigo-200 dark:group-hover:border-indigo-900/50" onClick={() => handleViewDetail(g.id)}>
                 Details<svg className="w-4 h-4 ml-1 text-gray-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
               </Button>
             </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDetailView = () => {
    const g = grievances.find(item => item.id === selectedGrievanceId);
    if (!g) return <div>Grievance not found</div>;
    return (
      <div className="max-w-6xl mx-auto animate-fade-in">
        <div className="mb-8">
          <Button variant="ghost" onClick={() => setView('DASHBOARD')} className="pl-0 hover:bg-transparent hover:text-indigo-600 dark:hover:text-indigo-400">
            <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>Back to Dashboard
          </Button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
             <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 sm:p-8">
                <div className="flex justify-between items-start gap-4 mb-6">
                   <div>
                      <div className="flex gap-2 mb-3">
                        <StatusBadge status={g.status} />
                        <span className="px-2.5 py-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-full text-xs font-bold tracking-wide uppercase">{g.category}</span>
                      </div>
                      <h1 className="text-3xl font-bold text-gray-900 dark:text-white leading-tight">{g.title}</h1>
                   </div>
                   <span className="text-sm text-gray-500 dark:text-slate-400 font-medium whitespace-nowrap">{new Date(g.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="prose prose-indigo dark:prose-invert max-w-none">
                   <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</h3>
                   <p className="text-gray-700 dark:text-slate-300 text-lg leading-relaxed whitespace-pre-wrap bg-gray-50/50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700">{g.description}</p>
                </div>
             </div>
             <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/30">
                   <h3 className="text-lg font-bold text-gray-900 dark:text-white">Discussion & Action</h3>
                   {currentUser?.role === UserRole.ADMIN && !replyingId && (
                      <Button size="sm" variant="secondary" onClick={() => handleStartReply(g)}>
                         <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>{g.adminResponse ? 'Edit Response' : 'Write Response'}
                      </Button>
                   )}
                </div>
                <div className="p-6 sm:p-8">
                   {currentUser?.role === UserRole.ADMIN && replyingId === g.id ? (
                      <div className="animate-fade-in">
                         <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Official Response</label>
                         <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-y min-h-[150px] mb-4" placeholder="Write your official response to the student..." autoFocus />
                         <div className="flex justify-end gap-3">
                            <Button variant="ghost" onClick={handleCancelReply}>Cancel</Button>
                            <Button variant="primary" onClick={() => handleSubmitReply(g.id)}>{g.adminResponse ? 'Update' : 'Publish Response'}</Button>
                         </div>
                      </div>
                   ) : (
                      g.adminResponse ? (
                         <div className="flex gap-4">
                            <div className="flex-shrink-0">
                               <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
                                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                               </div>
                            </div>
                            <div className="flex-grow">
                               <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl rounded-tl-none p-6 border border-blue-100 dark:border-blue-900/30">
                                  <div className="flex justify-between items-center mb-2">
                                     <span className="font-bold text-blue-900 dark:text-blue-300 text-sm">Administration</span>
                                     <span className="text-xs text-blue-400">{timeAgo(g.updatedAt)}</span>
                                  </div>
                                  <p className="text-gray-800 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{g.adminResponse}</p>
                               </div>
                            </div>
                         </div>
                      ) : (
                         <div className="text-center py-12 opacity-60">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
                               <svg className="w-8 h-8 text-gray-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.066 8.066 0 01-5.058-1.79L3 19l.93-3.66A8.064 8.064 0 012 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" /></svg>
                            </div>
                            <p className="text-gray-500 dark:text-slate-400 font-medium">No response yet</p>
                         </div>
                      )
                   )}
                </div>
             </div>
          </div>
          <div className="space-y-6">
             <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl shadow-xl text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
                <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-24 h-24 bg-indigo-400 opacity-20 rounded-full blur-xl"></div>
                <div className="p-6 relative z-10">
                   <div className="flex items-center gap-2 mb-4">
                      <svg className="w-5 h-5 text-yellow-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm1-13h-2v6h6v-2h-4z"/></svg>
                      <h3 className="font-bold tracking-wide text-sm uppercase text-indigo-100">AI Intelligence</h3>
                   </div>
                   {!g.aiAnalysis ? (
                      <div className="text-center py-6">
                         <p className="text-indigo-200 text-sm mb-4">Generate insights to categorize and prioritize this grievance.</p>
                         {currentUser?.role === UserRole.ADMIN && (
                            <Button onClick={() => handleGenerateAnalysis(g.id)} isLoading={isAnalyzing} className="w-full bg-white text-indigo-600 hover:bg-indigo-50 border-none">Generate Analysis</Button>
                         )}
                      </div>
                   ) : (
                      <div className="space-y-4">
                         <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                            <span className="text-xs font-bold text-indigo-200 uppercase block mb-1">Summary</span>
                            <p className="text-sm leading-snug">{g.aiAnalysis.summary}</p>
                         </div>
                         <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center border border-white/10">
                               <span className="text-xs font-bold text-indigo-200 uppercase block mb-1">Priority</span>
                               <span className={`font-bold ${g.aiAnalysis.suggestedPriority === 'High' ? 'text-rose-300' : 'text-emerald-300'}`}>{g.aiAnalysis.suggestedPriority}</span>
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center border border-white/10">
                               <span className="text-xs font-bold text-indigo-200 uppercase block mb-1">Sentiment</span>
                               <span className="font-bold text-amber-200">{g.aiAnalysis.sentiment}</span>
                            </div>
                         </div>
                      </div>
                   )}
                </div>
             </div>
             <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4 text-sm uppercase tracking-wide">Details</h3>
                <div className="space-y-4">
                   <div className="flex justify-between items-center pb-3 border-b border-gray-50 dark:border-slate-700"><span className="text-gray-500 dark:text-slate-400 text-sm">Reporter</span><span className="font-medium text-gray-900 dark:text-white text-sm">{g.studentName}</span></div>
                   <div className="flex justify-between items-center pb-3 border-b border-gray-50 dark:border-slate-700"><span className="text-gray-500 dark:text-slate-400 text-sm">ID</span><span className="font-mono text-gray-600 dark:text-slate-300 text-xs bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded">{g.id}</span></div>
                   <div className="flex justify-between items-center"><span className="text-gray-500 dark:text-slate-400 text-sm">Last Updated</span><span className="font-medium text-gray-900 dark:text-white text-sm">{timeAgo(g.updatedAt)}</span></div>
                </div>
                {currentUser?.role === UserRole.ADMIN && (
                   <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-700 flex flex-col gap-3">
                      {g.status === GrievanceStatus.PENDING && (
                         <Button variant="danger" className="w-full justify-center" onClick={() => { handleStatusChange(g.id, GrievanceStatus.REJECTED); setView('DASHBOARD'); }}>Reject Grievance</Button>
                      )}
                      {g.status !== GrievanceStatus.RESOLVED && (
                         <Button variant="primary" className="w-full justify-center" onClick={() => { handleStatusChange(g.id, GrievanceStatus.RESOLVED); setView('DASHBOARD'); }}>Mark as Resolved</Button>
                      )}
                   </div>
                )}
             </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    const relevantGrievances = currentUser?.role === UserRole.STUDENT ? grievances.filter(g => g.studentId === currentUser.id) : grievances;
    const filteredGrievances = relevantGrievances.filter(g => {
       const query = searchQuery.toLowerCase();
       const matchesSearch = !searchQuery.trim() || (g.title.toLowerCase().includes(query) || g.description.toLowerCase().includes(query) || (g.studentName && g.studentName.toLowerCase().includes(query)));
       let matchesStatus = true;
       if (statusFilter === 'ACTIVE') matchesStatus = g.status === GrievanceStatus.PENDING || g.status === GrievanceStatus.IN_PROGRESS;
       else if (statusFilter === 'CLOSED') matchesStatus = g.status === GrievanceStatus.RESOLVED || g.status === GrievanceStatus.REJECTED;
       return matchesSearch && matchesStatus;
    });

    const pendingCount = relevantGrievances.filter(g => g.status === GrievanceStatus.PENDING).length;
    const resolvedCount = relevantGrievances.filter(g => g.status === GrievanceStatus.RESOLVED).length;
    
    const sentimentCounts = { Urgent: 0, Negative: 0, Neutral: 0, Positive: 0, Unanalyzed: 0 };
    if (currentUser?.role === UserRole.ADMIN) {
      relevantGrievances.forEach(g => {
        if (g.aiAnalysis?.sentiment) {
           // @ts-ignore
           if (sentimentCounts[g.aiAnalysis.sentiment] !== undefined) sentimentCounts[g.aiAnalysis.sentiment]++;
           else sentimentCounts.Unanalyzed++;
        } else sentimentCounts.Unanalyzed++;
      });
    }
    const chartData = [
      { label: 'Urgent', value: sentimentCounts.Urgent, colorClass: 'text-rose-500' },
      { label: 'Negative', value: sentimentCounts.Negative, colorClass: 'text-amber-500' },
      { label: 'Neutral', value: sentimentCounts.Neutral, colorClass: 'text-gray-400 dark:text-slate-400' },
      { label: 'Positive', value: sentimentCounts.Positive, colorClass: 'text-emerald-500' },
      { label: 'Unanalyzed', value: sentimentCounts.Unanalyzed, colorClass: 'text-gray-200 dark:text-slate-600' },
    ];

    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-indigo-600 to-violet-700 p-8 rounded-3xl shadow-xl text-white relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -mr-16 -mt-16"></div>
           <div className="relative z-10">
              <h2 className="text-3xl font-bold font-display">{currentUser?.role === UserRole.ADMIN ? 'Admin Dashboard' : 'My Grievances'}</h2>
              <p className="text-indigo-100 mt-1 text-lg">{currentUser?.role === UserRole.ADMIN ? 'Overview of all campus issues' : `Welcome back, ${currentUser?.name}.`}</p>
           </div>
           {currentUser?.role === UserRole.STUDENT && (
            <div className="relative z-10">
              <Button onClick={() => { setView('SUBMIT_NEW'); setEditingId(null); setTitle(''); setDescription(''); setCategory(GrievanceCategory.OTHER); }} className="bg-white text-indigo-600 hover:bg-indigo-50 border-none shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>New Grievance
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
              <div><p className="text-sm text-gray-500 dark:text-slate-400 font-medium">Total Issues</p><p className="text-3xl font-bold text-gray-900 dark:text-white">{relevantGrievances.length}</p></div>
              <div className="p-3 bg-gray-50 dark:bg-slate-700 rounded-xl text-gray-600 dark:text-slate-300"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2-2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg></div>
           </div>
           <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
              <div><p className="text-sm text-gray-500 dark:text-slate-400 font-medium">Pending</p><p className="text-3xl font-bold text-amber-600 dark:text-amber-500">{pendingCount}</p></div>
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-amber-600 dark:text-amber-500"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
           </div>
           <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
              <div><p className="text-sm text-gray-500 dark:text-slate-400 font-medium">Resolved</p><p className="text-3xl font-bold text-emerald-600 dark:text-emerald-500">{resolvedCount}</p></div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600 dark:text-emerald-500"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
           </div>
           <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
              <div><p className="text-sm text-gray-500 dark:text-slate-400 font-medium">Response Rate</p><p className="text-3xl font-bold text-blue-600 dark:text-blue-500">{relevantGrievances.length ? Math.round((resolvedCount / relevantGrievances.length) * 100) : 0}%</p></div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-500"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg></div>
           </div>
        </div>

        {currentUser?.role === UserRole.ADMIN && relevantGrievances.length > 0 && (
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <SentimentChart data={chartData} />
             <div className="bg-gradient-to-br from-violet-100 to-indigo-50 dark:from-slate-800 dark:to-slate-800 rounded-2xl border border-indigo-100 dark:border-slate-700 p-8 flex flex-col justify-center items-start">
                <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-4 text-white shadow-lg shadow-indigo-200 dark:shadow-none"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>
                <h3 className="text-xl font-bold text-indigo-900 dark:text-white mb-2">AI Insights</h3>
                <p className="text-indigo-700 dark:text-slate-400 mb-6">{sentimentCounts.Urgent > 0 ? `Attention Needed: ${sentimentCounts.Urgent} urgent issues detected requiring immediate action.` : "Great job! No urgent issues detected at the moment."}</p>
                <div className="w-full bg-white/60 dark:bg-black/20 rounded-xl p-4 backdrop-blur-sm">
                   <div className="flex justify-between text-sm mb-1"><span className="font-medium text-indigo-900 dark:text-indigo-300">Negative Sentiment</span><span className="font-bold text-indigo-900 dark:text-indigo-300">{Math.round((sentimentCounts.Negative / relevantGrievances.length) * 100)}%</span></div>
                   <div className="w-full bg-indigo-100 dark:bg-slate-700 rounded-full h-2"><div className="bg-indigo-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${(sentimentCounts.Negative / relevantGrievances.length) * 100}%` }}></div></div>
                </div>
             </div>
           </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
             <h3 className="font-bold text-gray-900 dark:text-white text-lg">{statusFilter === 'ALL' ? 'Recent Activity' : statusFilter === 'ACTIVE' ? 'Active Issues' : 'Past History'}</h3>
             <div className="flex flex-col sm:flex-row w-full lg:w-auto gap-4">
               <div className="flex p-1.5 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm w-full sm:w-auto">
                  {(['ALL', 'ACTIVE', 'CLOSED'] as const).map((filter) => (
                    <button key={filter} onClick={() => setStatusFilter(filter)} className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${statusFilter === filter ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                      {filter === 'ALL' ? 'All' : filter === 'ACTIVE' ? 'Active' : 'Closed'}
                    </button>
                  ))}
               </div>
               <div className="relative w-full sm:w-72">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><svg className="h-5 w-5 text-gray-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></div>
                  <input type="text" className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl leading-5 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all sm:text-sm shadow-sm" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
               </div>
             </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredGrievances.length === 0 ? (
              <div className="col-span-full text-center py-16 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-gray-200 dark:border-slate-700">
                <div className="w-20 h-20 bg-gray-50 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-10 h-10 text-gray-300 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
                <p className="text-gray-500 dark:text-slate-400 text-lg font-medium">{searchQuery ? 'No grievances found matching your search.' : statusFilter === 'ACTIVE' ? 'No active grievances.' : statusFilter === 'CLOSED' ? 'No closed grievances history.' : 'No grievances found.'}</p>
                {!searchQuery && statusFilter === 'ALL' && currentUser?.role === UserRole.STUDENT && (
                   <Button variant="ghost" className="mt-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20" onClick={() => { setView('SUBMIT_NEW'); setEditingId(null); setTitle(''); setDescription(''); setCategory(GrievanceCategory.OTHER); }}>Submit your first grievance</Button>
                )}
              </div>
            ) : (
              filteredGrievances.map(renderGrievanceCard)
            )}
          </div>
        </div>
      </div>
    );
  };

  if (isAuthLoading) {
      return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 text-indigo-600"><svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>;
  }

  if (!currentUser || view === 'LOGIN') return renderLogin();
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <div className="flex items-center cursor-pointer" onClick={() => setView('DASHBOARD')}>
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center mr-3 shadow-lg shadow-indigo-200 dark:shadow-none"><svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg></div>
              <span className="font-bold text-2xl text-gray-900 dark:text-white tracking-tight font-display">CampusVoice</span>
            </div>
            <div className="flex items-center space-x-6">
              <button onClick={toggleTheme} className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors focus:outline-none">
                 {darkMode ? (<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>) : (<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>)}
              </button>
              <div className="relative" ref={notificationRef}>
                <button className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 focus:outline-none relative transition-colors" onClick={() => setShowNotifications(!showNotifications)}>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                  {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 block h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse"></span>}
                </button>
                {showNotifications && (
                  <div className="absolute right-0 mt-4 w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-xl py-2 border border-gray-100 dark:border-slate-700 z-50 origin-top-right animate-fade-in">
                    <div className="px-5 py-4 border-b border-gray-50 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/30">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">Notifications</h3>
                      {unreadCount > 0 && <button onClick={markAllNotificationsRead} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300">Mark all read</button>}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-12 text-center text-gray-400 dark:text-slate-500 text-sm"><svg className="w-12 h-12 mx-auto mb-3 text-gray-200 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>No notifications yet</div>
                      ) : (
                        notifications.map(n => (
                          <div key={n.id} className={`px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer border-b border-gray-50 dark:border-slate-700 last:border-0 transition-colors ${!n.read ? 'bg-indigo-50/40 dark:bg-indigo-900/10' : ''}`} onClick={() => { markNotificationRead(n.id); if (n.relatedGrievanceId) handleViewDetail(n.relatedGrievanceId); }}>
                            <div className="flex gap-3"><div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${!n.read ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-slate-600'}`}></div><div><p className={`text-sm mb-1 ${!n.read ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-600 dark:text-slate-400'}`}>{n.message}</p><p className="text-xs text-gray-400 dark:text-slate-500">{timeAgo(n.createdAt)}</p></div></div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="h-8 w-px bg-gray-200 dark:bg-slate-700 hidden sm:block"></div>
              <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block"><p className="text-sm font-bold text-gray-900 dark:text-white">{currentUser.name}</p><p className="text-xs text-gray-500 dark:text-slate-400 font-medium capitalize">{currentUser.role === UserRole.ADMIN ? 'Administrator' : 'Student'}</p></div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-md">{currentUser.name[0]}</div>
                  <Button variant="ghost" onClick={handleLogout} className="text-gray-400 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 px-2"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></Button>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-20">
        {view === 'DASHBOARD' && renderDashboard()}
        {view === 'SUBMIT_NEW' && renderForm()}
        {view === 'GRIEVANCE_DETAIL' && renderDetailView()}
      </main>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}
const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);