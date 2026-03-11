import React, { useState, useEffect, useRef } from 'react';
import {
  UserRole, ViewState, Grievance, GrievanceCategory, GrievanceStatus,
  Priority, AdminLevel, User, Notification
} from './types';
import { refineGrievanceText, analyzeGrievance, suggestCategory } from './services/geminiService';
import { authService } from './services/authService';
import { notificationService } from './services/notificationService';
import { slaService } from './services/slaService';
import { escalationService } from './services/escalationService';
import { workflowService } from './services/workflowService';
import { Button } from './components/Button';
import { StatusBadge } from './components/StatusBadge';
import { SLABadge } from './components/SLABadge';
import { WorkflowTimeline } from './components/WorkflowTimeline';
import { SentimentChart } from './components/SentimentChart';

// Ticket number generator
let ticketCounter = parseInt(localStorage.getItem('gms_ticket_counter') || '1000', 10);
const nextTicket = (): string => {
  ticketCounter += 1;
  localStorage.setItem('gms_ticket_counter', String(ticketCounter));
  return `GMS-${ticketCounter}`;
};

// Mock data
const SEED_GRIEVANCES: Grievance[] = [
  {
    id: 'g1', ticketNumber: 'GMS-1001', citizenId: 'citizen-1', citizenName: 'Priya Sharma',
    title: 'Pothole on Main Market Road causing accidents',
    description: 'There is a large pothole (approx 2ft wide) on Main Market Road near bus stop no. 7. Two-wheelers have fallen. Issue persists for 3 weeks.',
    category: GrievanceCategory.ROADS, status: GrievanceStatus.IN_PROGRESS,
    priority: Priority.HIGH, currentLevel: AdminLevel.OFFICER,
    location: 'Main Market Road, Bus Stop No. 7',
    createdAt: Date.now() - 86400000 * 5, updatedAt: Date.now() - 86400000,
    adminResponse: 'Work order issued. Repair team scheduled.',
    workflow: [
      { id: 'w1', status: GrievanceStatus.SUBMITTED, label: 'Grievance Submitted', performedBy: 'Priya Sharma', performedById: 'citizen-1', timestamp: Date.now() - 86400000 * 5, automated: false },
      { id: 'w2', status: GrievanceStatus.ACKNOWLEDGED, label: 'Acknowledged by Officer', performedBy: 'Field Officer (Ramesh)', performedById: 'officer-1', timestamp: Date.now() - 86400000 * 4, automated: false },
      { id: 'w3', status: GrievanceStatus.IN_PROGRESS, label: 'Work In Progress', performedBy: 'Field Officer (Ramesh)', performedById: 'officer-1', note: 'Work order raised.', timestamp: Date.now() - 86400000, automated: false },
    ],
    escalations: [],
    aiAnalysis: { sentiment: 'Negative', summary: 'Pothole causing safety hazard on busy road.', suggestedPriority: 'High' }
  },
  {
    id: 'g2', ticketNumber: 'GMS-1002', citizenId: 'citizen-1', citizenName: 'Priya Sharma',
    title: 'No water supply in Ward 12 for 4 days',
    description: 'Ward 12 colony has had no piped water supply for 4 days. 200+ families affected, forced to buy from tankers.',
    category: GrievanceCategory.WATER, status: GrievanceStatus.ESCALATED,
    priority: Priority.CRITICAL, currentLevel: AdminLevel.SUPERVISOR,
    location: 'Ward 12, Sector B',
    createdAt: Date.now() - 86400000 * 8, updatedAt: Date.now() - 3600000 * 2,
    workflow: [
      { id: 'w4', status: GrievanceStatus.SUBMITTED, label: 'Grievance Submitted', performedBy: 'Priya Sharma', performedById: 'citizen-1', timestamp: Date.now() - 86400000 * 8, automated: false },
      { id: 'w5', status: GrievanceStatus.ACKNOWLEDGED, label: 'Acknowledged by Officer', performedBy: 'Field Officer (Ramesh)', performedById: 'officer-1', timestamp: Date.now() - 86400000 * 7, automated: false },
      { id: 'w6', status: GrievanceStatus.ESCALATED, label: 'Escalated to Higher Authority', performedBy: 'System (Automated)', timestamp: Date.now() - 3600000 * 2, automated: true, note: 'SLA deadline exceeded.' },
    ],
    escalations: [{ id: 'e1', fromLevel: AdminLevel.OFFICER, toLevel: AdminLevel.SUPERVISOR, reason: 'Auto-escalated: SLA exceeded', escalatedAt: Date.now() - 3600000 * 2, escalatedByName: 'System' }],
    aiAnalysis: { sentiment: 'Urgent', summary: 'Critical water supply disruption affecting 200+ families.', suggestedPriority: 'High' }
  },
  {
    id: 'g3', ticketNumber: 'GMS-1003', citizenId: 'citizen-1', citizenName: 'Priya Sharma',
    title: 'Street lights not working in residential colony',
    description: 'Street lights in B-Block have been non-functional for 2 weeks, causing security issues.',
    category: GrievanceCategory.ELECTRICITY, status: GrievanceStatus.RESOLVED,
    priority: Priority.MEDIUM, currentLevel: AdminLevel.OFFICER,
    location: 'B-Block Residential Colony',
    createdAt: Date.now() - 86400000 * 15, updatedAt: Date.now() - 86400000 * 2,
    adminResponse: 'All 12 streetlights repaired and functional.',
    workflow: [
      { id: 'w7', status: GrievanceStatus.SUBMITTED, label: 'Grievance Submitted', performedBy: 'Priya Sharma', performedById: 'citizen-1', timestamp: Date.now() - 86400000 * 15, automated: false },
      { id: 'w8', status: GrievanceStatus.ACKNOWLEDGED, label: 'Acknowledged by Officer', performedBy: 'Field Officer (Ramesh)', performedById: 'officer-1', timestamp: Date.now() - 86400000 * 14, automated: false },
      { id: 'w9', status: GrievanceStatus.IN_PROGRESS, label: 'Work In Progress', performedBy: 'Field Officer (Ramesh)', performedById: 'officer-1', timestamp: Date.now() - 86400000 * 5, automated: false },
      { id: 'w10', status: GrievanceStatus.RESOLVED, label: 'Issue Resolved', performedBy: 'Field Officer (Ramesh)', performedById: 'officer-1', note: 'All 12 streetlights repaired.', timestamp: Date.now() - 86400000 * 2, automated: false },
    ],
    escalations: [],
    aiAnalysis: { sentiment: 'Negative', summary: 'Streetlight outage causing safety concerns.', suggestedPriority: 'Medium' }
  },
  {
    id: 'g4', ticketNumber: 'GMS-1004', citizenId: 'citizen-1', citizenName: 'Priya Sharma',
    title: 'Garbage not collected for 10 days in Sector 5',
    description: 'Garbage collection has not happened in Sector 5 for the past 10 days. The area is filled with overflowing bins attracting stray animals.',
    category: GrievanceCategory.ENVIRONMENT, status: GrievanceStatus.PENDING,
    priority: Priority.MEDIUM, currentLevel: AdminLevel.OFFICER,
    location: 'Sector 5, Housing Colony',
    createdAt: Date.now() - 86400000 * 3, updatedAt: Date.now() - 86400000 * 3,
    workflow: [
      { id: 'w11', status: GrievanceStatus.SUBMITTED, label: 'Grievance Submitted', performedBy: 'Priya Sharma', performedById: 'citizen-1', timestamp: Date.now() - 86400000 * 3, automated: false },
    ],
    escalations: [],
    aiAnalysis: { sentiment: 'Negative', summary: 'Garbage collection failure causing hygiene issues in residential area.', suggestedPriority: 'Medium' }
  },
];

const timeAgo = (date: number) => {
  const s = Math.floor((Date.now() - date) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const priorityColor: Record<Priority, string> = {
  [Priority.CRITICAL]: 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-400',
  [Priority.HIGH]:     'text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-400',
  [Priority.MEDIUM]:   'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400',
  [Priority.LOW]:      'text-green-600 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400',
};

const isStaffRole = (role: UserRole) =>
  role === UserRole.OFFICER || role === UserRole.SUPERVISOR || role === UserRole.ADMIN;

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [view, setView] = useState<ViewState>('LOGIN');
  const [grievances, setGrievances] = useState<Grievance[]>(() => {
    const saved = localStorage.getItem('gms_grievances');
    return saved ? JSON.parse(saved) : SEED_GRIEVANCES;
  });
  const [selectedGrievanceId, setSelectedGrievanceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.CITIZEN);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<GrievanceCategory>(GrievanceCategory.OTHER);
  const [location, setLocation] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [proofFile, setProofFile] = useState<string | null>(null);
  const [proofType, setProofType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [escalatingId, setEscalatingId] = useState<string | null>(null);
  const [escalationReason, setEscalationReason] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [darkMode, setDarkMode] = useState(() =>
    document.documentElement.classList.contains('dark') || localStorage.theme === 'dark'
  );

  useEffect(() => { localStorage.setItem('gms_grievances', JSON.stringify(grievances)); }, [grievances]);

  const toggleTheme = () => {
    if (darkMode) { document.documentElement.classList.remove('dark'); localStorage.theme = 'light'; setDarkMode(false); }
    else { document.documentElement.classList.add('dark'); localStorage.theme = 'dark'; setDarkMode(true); }
  };

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user) { setCurrentUser(user); setView('DASHBOARD'); }
    setIsAuthLoading(false);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const load = () => setNotifications(notificationService.getUserNotifications(currentUser.id));
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [currentUser]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node))
        setShowNotifications(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthError(''); setIsAuthenticating(true);
    try {
      const user = authMode === 'LOGIN'
        ? await authService.login(email, password)
        : await authService.register(fullName, email, password, selectedRole);
      setCurrentUser(user); setView('DASHBOARD');
      setEmail(''); setPassword(''); setFullName('');
    } catch (err: any) { setAuthError(err.message || 'Authentication failed'); }
    finally { setIsAuthenticating(false); }
  };

  const handleLogout = () => { authService.logout(); setCurrentUser(null); setView('LOGIN'); };
  const refreshNotifs = () => { if (currentUser) setNotifications(notificationService.getUserNotifications(currentUser.id)); };
  const markRead = (id: string) => { notificationService.markAsRead(id); refreshNotifs(); };
  const markAllRead = () => { if (currentUser) { notificationService.markAllAsRead(currentUser.id); refreshNotifs(); } };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('File too large. Max 5MB.'); return; }
    const reader = new FileReader();
    reader.onloadend = () => { setProofFile(reader.result as string); setProofType(file.type); };
    reader.readAsDataURL(file);
  };
  const clearFile = () => { setProofFile(null); setProofType(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

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
    const g = grievances.find(gr => gr.id === id); if (!g) return;
    setIsAnalyzing(true);
    const analysis = await analyzeGrievance(g.title, g.description);
    setGrievances(prev => prev.map(gr => gr.id === id ? { ...gr, aiAnalysis: analysis } : gr));
    setIsAnalyzing(false);
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setCategory(GrievanceCategory.OTHER);
    setLocation(''); setEditingId(null); clearFile();
  };

  const handleEditClick = (g: Grievance) => {
    setTitle(g.title); setDescription(g.description); setCategory(g.category);
    setLocation(g.location || ''); setProofFile(g.proof || null); setProofType(g.proofType || null);
    setEditingId(g.id); setView('SUBMIT_NEW');
  };

  const handleSubmitGrievance = async (e: React.FormEvent) => {
    e.preventDefault(); if (!currentUser) return;
    setIsSubmitting(true);
    const analysis = await analyzeGrievance(title, description);
    if (editingId) {
      setGrievances(prev => prev.map(g =>
        g.id === editingId ? { ...g, title, description, category, location, updatedAt: Date.now(), aiAnalysis: analysis, proof: proofFile || undefined, proofType: proofType || undefined } : g
      ));
    } else {
      const firstStep = workflowService.makeStep(GrievanceStatus.SUBMITTED, currentUser.name, currentUser.id);
      const priorityMap: Record<string, Priority> = { High: Priority.HIGH, Medium: Priority.MEDIUM, Low: Priority.LOW };
      const newG: Grievance = {
        id: Math.random().toString(36).substring(7), ticketNumber: nextTicket(),
        citizenId: currentUser.id, citizenName: currentUser.name,
        title, description, category, location,
        status: GrievanceStatus.SUBMITTED,
        priority: priorityMap[analysis?.suggestedPriority || 'Medium'] ?? Priority.MEDIUM,
        currentLevel: AdminLevel.OFFICER,
        createdAt: Date.now(), updatedAt: Date.now(), aiAnalysis: analysis,
        workflow: [firstStep], escalations: [],
        proof: proofFile || undefined, proofType: proofType || undefined,
      };
      setGrievances(prev => [newG, ...prev]);
      authService.getStaff().forEach(staff => {
        notificationService.createNotification(staff.id, `New grievance ${newG.ticketNumber} by ${currentUser.name}: "${title}"`, 'NEW_GRIEVANCE', newG.id);
      });
    }
    setIsSubmitting(false); resetForm(); setView('DASHBOARD');
  };

  const handleStatusChange = (id: string, newStatus: GrievanceStatus, note?: string) => {
    if (!currentUser) return;
    const step = workflowService.makeStep(newStatus, currentUser.name, currentUser.id, note);
    setGrievances(prev => prev.map(g => {
      if (g.id !== id) return g;
      notificationService.createNotification(g.citizenId, `Your grievance "${g.title}" (${g.ticketNumber}) status: ${newStatus.replace(/_/g, ' ')}.`, 'STATUS_CHANGE', g.id);
      return { ...g, status: newStatus, updatedAt: Date.now(), workflow: [...g.workflow, step] };
    }));
  };

  const handleSubmitReply = (id: string) => {
    if (!replyText.trim()) return;
    const g = grievances.find(gr => gr.id === id);
    setGrievances(prev => prev.map(gr => gr.id === id ? { ...gr, adminResponse: replyText, updatedAt: Date.now() } : gr));
    if (g) notificationService.createNotification(g.citizenId, `Official response added to "${g.title}" (${g.ticketNumber}).`, 'ADMIN_REPLY', g.id);
    setReplyingId(null); setReplyText('');
  };

  const handleEscalate = (id: string) => {
    if (!currentUser || !escalationReason.trim()) return;
    const g = grievances.find(gr => gr.id === id); if (!g) return;
    const allUsers = authService.getAllUsers();
    const updated = escalationService.escalate(g, escalationReason, currentUser.name, currentUser.id, allUsers);
    setGrievances(prev => prev.map(gr => gr.id === id ? updated : gr));
    setEscalatingId(null); setEscalationReason('');
  };

  useEffect(() => {
    if (!currentUser || !isStaffRole(currentUser.role)) return;
    const allUsers = authService.getAllUsers();
    const updated = escalationService.autoEscalateAll(grievances, allUsers);
    const changed = updated.some((g, i) => g.status !== grievances[i]?.status);
    if (changed) setGrievances(updated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const handleViewDetail = (id: string) => { setSelectedGrievanceId(id); setView('GRIEVANCE_DETAIL'); };

  // ─ LOGIN ─────────────────────────────────────────────────────────────────
  const renderLogin = () => (
    <div className="min-h-screen flex bg-white dark:bg-slate-900">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center relative overflow-hidden bg-indigo-900 text-white px-16">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-700 to-violet-900 z-10" />
        <div className="relative z-20 space-y-10">
          <div>
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-6">
              <svg className="h-9 w-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            </div>
            <h1 className="text-5xl font-bold font-display mb-3">GrievanceMS</h1>
            <p className="text-indigo-200 text-lg max-w-sm leading-relaxed">
              Citizens Grievance Management System — transparency, accountability & timely resolution.
            </p>
          </div>
          <div className="space-y-4">
            {[
              { icon: '📋', text: 'Submit & track complaints with unique ticket IDs' },
              { icon: '⏱️', text: 'SLA-driven resolution with automatic escalation' },
              { icon: '��', text: 'Real-time notifications on every status change' },
              { icon: '📊', text: 'Public transparency report for accountability' },
              { icon: '🤖', text: 'AI-powered grievance analysis & polishing' },
            ].map(item => (
              <div key={item.text} className="flex items-center gap-3 text-indigo-100 text-sm">
                <span className="text-xl">{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-gray-50 dark:bg-slate-950 relative">
        <div className="absolute top-5 right-5">
          <button onClick={toggleTheme} className="p-2 rounded-lg text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-800 transition-colors">
            {darkMode
              ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>}
          </button>
        </div>
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-gray-100 dark:border-slate-700 p-8 sm:p-10">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white font-display">
                {authMode === 'LOGIN' ? 'Welcome Back' : 'Create Account'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
                {authMode === 'LOGIN' ? 'Sign in to your GrievanceMS account' : 'Register to submit grievances'}
              </p>
            </div>
            {authError && (
              <div className="mb-5 flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {authError}
              </div>
            )}
            <form onSubmit={handleAuthSubmit} className="space-y-5">
              {authMode === 'REGISTER' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Full Name</label>
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    placeholder="Your full name" required />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  placeholder="you@example.com" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  placeholder="••••••••" required minLength={6} />
              </div>
              <Button type="submit" isLoading={isAuthenticating} className="w-full justify-center py-3.5 text-base">
                {authMode === 'LOGIN' ? 'Sign In' : 'Create Account'}
              </Button>
            </form>
            <p className="text-center text-sm text-gray-500 dark:text-slate-400 mt-5">
              {authMode === 'LOGIN' ? "Don't have an account? " : 'Already have an account? '}
              <button onClick={() => { setAuthMode(m => m === 'LOGIN' ? 'REGISTER' : 'LOGIN'); setAuthError(''); }}
                className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500">
                {authMode === 'LOGIN' ? 'Register' : 'Sign in'}
              </button>
            </p>
            {authMode === 'LOGIN' && (
              <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-700">
                <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">Demo Accounts — click to fill</p>
                <div className="space-y-2">
                  {[
                    { role: 'Citizen',    email: 'citizen@example.com',  pass: 'citizen123',    badge: 'bg-green-100 text-green-700' },
                    { role: 'Officer',    email: 'officer@gov.in',       pass: 'officer123',    badge: 'bg-blue-100 text-blue-700' },
                    { role: 'Supervisor', email: 'supervisor@gov.in',    pass: 'supervisor123', badge: 'bg-purple-100 text-purple-700' },
                    { role: 'Admin',      email: 'admin@gov.in',         pass: 'admin123',      badge: 'bg-rose-100 text-rose-700' },
                  ].map(d => (
                    <button key={d.role} type="button" onClick={() => { setEmail(d.email); setPassword(d.pass); }}
                      className="w-full flex justify-between items-center text-xs px-3 py-2.5 bg-gray-50 dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl border border-gray-100 dark:border-slate-700 transition-colors group">
                      <span className={`font-bold px-2 py-0.5 rounded-md ${d.badge}`}>{d.role}</span>
                      <span className="font-mono text-gray-400 dark:text-slate-500">{d.email}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ─ FORM ──────────────────────────────────────────────────────────────────
  const renderForm = () => (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-display">
            {editingId ? 'Edit Grievance' : 'Submit New Grievance'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Describe your issue clearly. AI can help refine and categorize it.
          </p>
        </div>
        <Button variant="secondary" onClick={() => { setView('DASHBOARD'); resetForm(); }}>Cancel</Button>
      </div>
      <div className="flex flex-col lg:flex-row gap-8">
        <form onSubmit={handleSubmitGrievance} className="flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-8 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
              placeholder="E.g. Pothole on MG Road near Bus Stop 4" required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Category *</label>
              <div className="relative">
                <select value={category} onChange={e => setCategory(e.target.value as GrievanceCategory)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none appearance-none">
                  {Object.values(GrievanceCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Location / Address</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                placeholder="Street / Area / Ward" />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-end mb-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300">Description *</label>
              <Button type="button" variant="ai" size="sm" onClick={handleRefineText}
                disabled={isRefining || description.length < 10} isLoading={isRefining}>
                <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                Polish with AI
              </Button>
            </div>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all h-44 resize-none leading-relaxed"
              placeholder="Describe your grievance — include dates, frequency, and number of people affected..." required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Supporting Evidence (Optional)</label>
            <div className="border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-xl p-5 text-center hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors relative group">
              <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              {proofFile ? (
                <div className="relative z-20 flex flex-col items-center pointer-events-none">
                  {proofType?.startsWith('image/') ? (
                    <img src={proofFile} alt="Preview" className="h-36 object-contain rounded-lg shadow-sm mb-2" />
                  ) : (
                    <div className="h-20 w-20 bg-gray-100 dark:bg-slate-700 rounded-lg flex items-center justify-center mb-2 text-3xl">🎥</div>
                  )}
                  <div className="flex items-center gap-2 pointer-events-auto">
                    <span className="text-sm text-gray-600 dark:text-slate-300">File attached</span>
                    <button type="button" onClick={e => { e.preventDefault(); clearFile(); }}
                      className="text-xs text-red-500 hover:text-red-600 font-bold px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20">Remove</button>
                  </div>
                </div>
              ) : (
                <div className="text-gray-400 dark:text-slate-500 pointer-events-none">
                  <svg className="mx-auto h-10 w-10 mb-2 text-gray-300 dark:text-slate-600 group-hover:text-indigo-400 transition-colors" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-sm font-medium">Click or drag to upload photo/video (Max 5MB)</p>
                </div>
              )}
            </div>
          </div>
          <div className="pt-4 border-t border-gray-100 dark:border-slate-700 flex justify-end">
            <Button type="submit" isLoading={isSubmitting} className="px-8 shadow-lg shadow-indigo-200 dark:shadow-none">
              {editingId ? 'Update Grievance' : 'Submit Grievance'}
            </Button>
          </div>
        </form>
        <div className="w-full lg:w-72 space-y-5">
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-5 border border-indigo-100 dark:border-indigo-900/40">
            <h3 className="font-bold text-indigo-900 dark:text-indigo-300 mb-3 flex items-center gap-2 text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Writing Tips
            </h3>
            <ul className="text-sm text-indigo-800 dark:text-indigo-200 space-y-2.5">
              {['Be specific about location and dates.', 'Mention how many people are affected.', 'Keep it factual and objective.', 'Use AI to improve tone and clarity.'].map(tip => (
                <li key={tip} className="flex items-start gap-2"><span className="text-indigo-400 font-bold mt-0.5">•</span>{tip}</li>
              ))}
            </ul>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-5 border border-amber-100 dark:border-amber-900/40">
            <h3 className="font-bold text-amber-900 dark:text-amber-300 mb-2 text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              SLA Policy
            </h3>
            <ul className="text-xs text-amber-800 dark:text-amber-200 space-y-1.5">
              <li>🔴 Critical — Resolve within <b>4 hours</b></li>
              <li>🟠 High — Resolve within <b>1 day</b></li>
              <li>🟡 Medium — Resolve within <b>3 days</b></li>
              <li>🟢 Low — Resolve within <b>7 days</b></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  // ─ CARD ──────────────────────────────────────────────────────────────────
  const renderCard = (g: Grievance) => {
    const isOwner = currentUser?.id === g.citizenId;
    const canEdit = isOwner && (g.status === GrievanceStatus.SUBMITTED || g.status === GrievanceStatus.PENDING);
    const sla = slaService.computeSLA(g);
    const canCitizenEscalate = currentUser?.role === UserRole.CITIZEN && escalationService.canCitizenEscalate(g) && g.citizenId === currentUser.id;

    return (
      <div key={g.id} className="group bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 transition-all hover:shadow-lg hover:-translate-y-0.5 relative overflow-hidden">
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl ${
          g.status === GrievanceStatus.ESCALATED ? 'bg-orange-400' :
          g.status === GrievanceStatus.RESOLVED || g.status === GrievanceStatus.CLOSED ? 'bg-emerald-400' :
          g.status === GrievanceStatus.REJECTED ? 'bg-rose-400' :
          g.priority === Priority.CRITICAL ? 'bg-rose-500' :
          g.priority === Priority.HIGH ? 'bg-orange-400' : 'bg-indigo-400'}`} />
        <div className="pl-3">
          <div className="flex justify-between items-start mb-3 gap-3">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-gray-400 dark:text-slate-500">{g.ticketNumber}</span>
                <StatusBadge status={g.status} />
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${priorityColor[g.priority]}`}>{g.priority}</span>
              </div>
              <h3 onClick={() => handleViewDetail(g.id)}
                className="text-base font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 cursor-pointer transition-colors line-clamp-1">
                {g.title}
              </h3>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 rounded-md font-medium text-gray-600 dark:text-slate-300">{g.category}</span>
                {g.location && <><span>·</span><span className="truncate max-w-xs">{g.location}</span></>}
              </div>
            </div>
            <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">{timeAgo(g.createdAt)}</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">{g.description}</p>
          <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-slate-700/50">
            <SLABadge sla={sla} showTime={true} />
            <div className="flex gap-2">
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => handleEditClick(g)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-600 border-indigo-200 hover:bg-indigo-50">Edit</Button>
              )}
              {canCitizenEscalate && (
                <Button variant="danger" size="sm" onClick={() => setEscalatingId(g.id)}>Escalate</Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => handleViewDetail(g.id)}
                className="group-hover:border-indigo-200 group-hover:text-indigo-600">
                Details <svg className="w-3.5 h-3.5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Button>
            </div>
          </div>
        </div>
        {escalatingId === g.id && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1">Escalate Grievance</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
                Escalating <b>{g.ticketNumber}</b> to <b>{escalationService.levelLabel((g.currentLevel + 1) as AdminLevel)}</b>
              </p>
              <textarea value={escalationReason} onChange={e => setEscalationReason(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none h-28 text-sm mb-4"
                placeholder="Reason for escalation (e.g. no action taken in 3 days)..." />
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => { setEscalatingId(null); setEscalationReason(''); }}>Cancel</Button>
                <Button variant="danger" disabled={!escalationReason.trim()} onClick={() => handleEscalate(g.id)}>Confirm Escalation</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─ DETAIL ────────────────────────────────────────────────────────────────
  const renderDetail = () => {
    const g = grievances.find(gr => gr.id === selectedGrievanceId);
    if (!g) return <div className="text-center py-20 text-gray-400">Grievance not found.</div>;
    const sla = slaService.computeSLA(g);
    const allowedTransitions = currentUser ? workflowService.getAllowedTransitions(g.status, currentUser.role) : [];
    const canCitizenEscalate = currentUser?.role === UserRole.CITIZEN && escalationService.canCitizenEscalate(g) && g.citizenId === currentUser.id;
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => setView('DASHBOARD')} className="pl-0 hover:bg-transparent hover:text-indigo-600">
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back
          </Button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 sm:p-8">
              <div className="flex justify-between items-start gap-4 mb-6">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <span className="font-mono text-sm text-gray-400">{g.ticketNumber}</span>
                    <StatusBadge status={g.status} />
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${priorityColor[g.priority]}`}>{g.priority}</span>
                    <span className="px-2.5 py-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-full text-xs font-semibold">{g.category}</span>
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-display">{g.title}</h1>
                  {g.location && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      {g.location}
                    </div>
                  )}
                </div>
                <div className="text-right text-sm text-gray-400">
                  <p>Submitted {timeAgo(g.createdAt)}</p>
                  <p className="text-xs mt-0.5">{new Date(g.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</h3>
                <p className="text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap bg-gray-50 dark:bg-slate-900/60 p-4 rounded-xl border border-gray-100 dark:border-slate-700 text-sm">{g.description}</p>
              </div>
              {g.proof && (
                <div className="mt-5">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Evidence</h3>
                  <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700">
                    {g.proofType?.startsWith('video/')
                      ? <video controls className="w-full max-h-80"><source src={g.proof} type={g.proofType} /></video>
                      : <img src={g.proof} alt="Evidence" className="w-full max-h-80 object-contain bg-gray-100 dark:bg-slate-900" />}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/30">
                <h3 className="font-bold text-gray-900 dark:text-white">Official Response</h3>
                {isStaffRole(currentUser?.role || UserRole.CITIZEN) && !replyingId && (
                  <Button size="sm" variant="secondary" onClick={() => { setReplyingId(g.id); setReplyText(g.adminResponse || ''); }}>
                    {g.adminResponse ? 'Edit Response' : 'Write Response'}
                  </Button>
                )}
              </div>
              <div className="p-6">
                {isStaffRole(currentUser?.role || UserRole.CITIZEN) && replyingId === g.id ? (
                  <div>
                    <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm resize-y min-h-[120px] mb-4"
                      placeholder="Type official response..." autoFocus />
                    <div className="flex justify-end gap-3">
                      <Button variant="ghost" onClick={() => { setReplyingId(null); setReplyText(''); }}>Cancel</Button>
                      <Button onClick={() => handleSubmitReply(g.id)}>Publish Response</Button>
                    </div>
                  </div>
                ) : g.adminResponse ? (
                  <div className="flex gap-4">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    </div>
                    <div className="flex-1">
                      <div className="bg-blue-50 dark:bg-blue-900/10 rounded-2xl rounded-tl-none p-5 border border-blue-100 dark:border-blue-900/30">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-bold text-blue-900 dark:text-blue-300">Administration</span>
                          <span className="text-xs text-blue-400">{timeAgo(g.updatedAt)}</span>
                        </div>
                        <p className="text-sm text-gray-800 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{g.adminResponse}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 text-gray-400">
                    <svg className="w-10 h-10 mx-auto mb-2 text-gray-200 dark:text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.066 8.066 0 01-5.058-1.79L3 19l.93-3.66A8.064 8.064 0 012 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" /></svg>
                    <p className="text-sm">No official response yet.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6">
              <h3 className="font-bold text-gray-900 dark:text-white mb-5">Progress Timeline</h3>
              <WorkflowTimeline steps={g.workflow} />
            </div>
          </div>

          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">SLA Status</h3>
              <SLABadge sla={sla} showTime showBar />
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Deadline</span>
                  <span className="font-medium text-gray-900 dark:text-white text-xs">{new Date(sla.deadline).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Elapsed</span>
                  <span className="font-medium text-gray-900 dark:text-white">{sla.percentElapsed}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Admin Level</span>
                  <span className="font-medium text-gray-900 dark:text-white">{escalationService.levelLabel(g.currentLevel)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Submitted by</span>
                  <span className="font-medium text-gray-900 dark:text-white">{g.citizenName}</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl text-white p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-white opacity-10 rounded-full blur-2xl -mr-4 -mt-4" />
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-4 h-4 text-yellow-300" fill="currentColor" viewBox="0 0 24 24"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                <h3 className="text-sm font-bold uppercase tracking-wide text-indigo-100">AI Intelligence</h3>
              </div>
              {!g.aiAnalysis ? (
                <div className="text-center py-4">
                  <p className="text-indigo-200 text-sm mb-4">Generate AI insights for this grievance.</p>
                  {isStaffRole(currentUser?.role || UserRole.CITIZEN) && (
                    <Button onClick={() => handleGenerateAnalysis(g.id)} isLoading={isAnalyzing}
                      className="w-full bg-white text-indigo-600 hover:bg-indigo-50 border-none">
                      Generate Analysis
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-white/10 rounded-xl p-3">
                    <span className="text-xs font-bold text-indigo-200 uppercase block mb-1">Summary</span>
                    <p className="text-sm leading-snug">{g.aiAnalysis.summary}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/10 rounded-xl p-3 text-center">
                      <span className="text-xs text-indigo-200 font-bold uppercase block mb-1">Priority</span>
                      <span className={`font-bold text-sm ${g.aiAnalysis.suggestedPriority === 'High' ? 'text-rose-300' : g.aiAnalysis.suggestedPriority === 'Low' ? 'text-emerald-300' : 'text-amber-200'}`}>{g.aiAnalysis.suggestedPriority}</span>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3 text-center">
                      <span className="text-xs text-indigo-200 font-bold uppercase block mb-1">Sentiment</span>
                      <span className="font-bold text-sm text-amber-200">{g.aiAnalysis.sentiment}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {g.escalations.length > 0 && (
              <div className="bg-orange-50 dark:bg-orange-900/10 rounded-2xl border border-orange-100 dark:border-orange-900/30 p-5">
                <h3 className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider mb-3">Escalation History</h3>
                <div className="space-y-3">
                  {g.escalations.map(esc => (
                    <div key={esc.id} className="text-xs text-orange-800 dark:text-orange-200">
                      <p className="font-semibold">{escalationService.levelLabel(esc.fromLevel)} → {escalationService.levelLabel(esc.toLevel)}</p>
                      <p className="text-orange-600 dark:text-orange-300 mt-0.5">{esc.reason}</p>
                      <p className="text-orange-400 mt-0.5">{timeAgo(esc.escalatedAt)} · {esc.escalatedByName}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isStaffRole(currentUser?.role || UserRole.CITIZEN) && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-5">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Staff Actions</h3>
                <div className="space-y-2.5">
                  {allowedTransitions.map(status => (
                    <Button key={status}
                      variant={status === GrievanceStatus.REJECTED ? 'danger' : status === GrievanceStatus.RESOLVED || status === GrievanceStatus.CLOSED ? 'primary' : 'secondary'}
                      className="w-full justify-center"
                      onClick={() => {
                        const note = window.prompt(`Optional note for status "${status.replace(/_/g, ' ')}":`) ?? undefined;
                        handleStatusChange(g.id, status, note);
                        setView('DASHBOARD');
                      }}>
                      → {status.replace(/_/g, ' ')}
                    </Button>
                  ))}
                  {allowedTransitions.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-2">No transitions available</p>
                  )}
                </div>
              </div>
            )}

            {canCitizenEscalate && (
              <Button variant="danger" className="w-full justify-center" onClick={() => setEscalatingId(g.id)}>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                Escalate to Higher Authority
              </Button>
            )}
          </div>
        </div>

        {escalatingId === g.id && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1">Escalate Grievance</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Escalating to <b>{escalationService.levelLabel((g.currentLevel + 1) as AdminLevel)}</b></p>
              <textarea value={escalationReason} onChange={e => setEscalationReason(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none h-28 text-sm mb-4"
                placeholder="Reason for escalation..." />
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => { setEscalatingId(null); setEscalationReason(''); }}>Cancel</Button>
                <Button variant="danger" disabled={!escalationReason.trim()} onClick={() => handleEscalate(g.id)}>Confirm Escalation</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─ PUBLIC REPORT ─────────────────────────────────────────────────────────
  const renderReport = () => {
    const total = grievances.length;
    const resolved = grievances.filter(g => g.status === GrievanceStatus.RESOLVED || g.status === GrievanceStatus.CLOSED).length;
    const pending = grievances.filter(g => [GrievanceStatus.PENDING, GrievanceStatus.SUBMITTED, GrievanceStatus.ACKNOWLEDGED].includes(g.status)).length;
    const inProgress = grievances.filter(g => g.status === GrievanceStatus.IN_PROGRESS).length;
    const escalated = grievances.filter(g => g.status === GrievanceStatus.ESCALATED).length;
    const resolutionRate = total ? Math.round((resolved / total) * 100) : 0;
    const byCat = Object.values(GrievanceCategory).map(cat => ({ category: cat, count: grievances.filter(g => g.category === cat).length })).filter(x => x.count > 0).sort((a, b) => b.count - a.count);
    const sentimentCounts = { Urgent: 0, Negative: 0, Neutral: 0, Positive: 0, Unanalyzed: 0 };
    grievances.forEach(g => {
      if (g.aiAnalysis?.sentiment && (sentimentCounts as any)[g.aiAnalysis.sentiment] !== undefined)
        (sentimentCounts as any)[g.aiAnalysis.sentiment]++;
      else sentimentCounts.Unanalyzed++;
    });
    const chartData = [
      { label: 'Urgent', value: sentimentCounts.Urgent, colorClass: 'text-rose-500' },
      { label: 'Negative', value: sentimentCounts.Negative, colorClass: 'text-amber-500' },
      { label: 'Neutral', value: sentimentCounts.Neutral, colorClass: 'text-gray-400' },
      { label: 'Positive', value: sentimentCounts.Positive, colorClass: 'text-emerald-500' },
      { label: 'Unanalyzed', value: sentimentCounts.Unanalyzed, colorClass: 'text-gray-200 dark:text-slate-600' },
    ];
    return (
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center bg-gradient-to-r from-indigo-600 to-violet-700 rounded-3xl p-10 text-white">
          <h2 className="text-4xl font-bold font-display mb-2">Public Transparency Report</h2>
          <p className="text-indigo-200 text-lg">Real-time grievance resolution statistics</p>
          <p className="text-indigo-300 text-sm mt-1">Data as of {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Complaints', value: total, color: 'text-gray-900 dark:text-white', bg: 'bg-white dark:bg-slate-800' },
            { label: 'Resolved', value: resolved, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
            { label: 'In Progress', value: inProgress + pending, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
            { label: 'Escalated', value: escalated, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-5 border border-gray-100 dark:border-slate-700 text-center shadow-sm`}>
              <p className={`text-4xl font-bold font-display ${s.color}`}>{s.value}</p>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-gray-900 dark:text-white">Overall Resolution Rate</h3>
            <span className="text-3xl font-bold text-indigo-600">{resolutionRate}%</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-4 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-1000" style={{ width: `${resolutionRate}%` }} />
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">{resolved} out of {total} complaints resolved</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 dark:text-white mb-5">Complaints by Category</h3>
            <div className="space-y-3">
              {byCat.map(item => (
                <div key={item.category}>
                  <div className="flex justify-between items-center text-sm mb-1">
                    <span className="text-gray-700 dark:text-slate-300 font-medium">{item.category}</span>
                    <span className="font-bold text-gray-900 dark:text-white">{item.count}</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full transition-all duration-700" style={{ width: `${Math.round((item.count / total) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <SentimentChart data={chartData} title="Public Sentiment Analysis" />
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm">
          <h3 className="font-bold text-gray-900 dark:text-white mb-5">Recently Resolved</h3>
          <div className="space-y-3">
            {grievances.filter(g => g.status === GrievanceStatus.RESOLVED || g.status === GrievanceStatus.CLOSED).slice(0, 5).map(g => (
              <div key={g.id} className="flex items-start justify-between gap-4 py-3 border-b border-gray-50 dark:border-slate-700/50 last:border-0">
                <div>
                  <p className="font-medium text-sm text-gray-900 dark:text-white">{g.title}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs text-gray-400 font-mono">{g.ticketNumber}</span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-500">{g.category}</span>
                  </div>
                </div>
                <StatusBadge status={g.status} />
              </div>
            ))}
            {grievances.filter(g => g.status === GrievanceStatus.RESOLVED).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No resolved grievances yet.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─ DASHBOARD ─────────────────────────────────────────────────────────────
  const renderDashboard = () => {
    if (!currentUser) return null;
    const isStaff = isStaffRole(currentUser.role);
    const relevantGrievances = currentUser.role === UserRole.CITIZEN
      ? grievances.filter(g => g.citizenId === currentUser.id)
      : grievances;
    const filtered = relevantGrievances.filter(g => {
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || g.title.toLowerCase().includes(q) || g.ticketNumber.toLowerCase().includes(q) || g.citizenName.toLowerCase().includes(q) || g.category.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'ALL' || g.status === statusFilter;
      const matchCategory = categoryFilter === 'ALL' || g.category === categoryFilter;
      return matchSearch && matchStatus && matchCategory;
    });
    const stats = {
      total: relevantGrievances.length,
      pending: relevantGrievances.filter(g => [GrievanceStatus.SUBMITTED, GrievanceStatus.PENDING, GrievanceStatus.ACKNOWLEDGED].includes(g.status)).length,
      inProgress: relevantGrievances.filter(g => g.status === GrievanceStatus.IN_PROGRESS).length,
      escalated: relevantGrievances.filter(g => g.status === GrievanceStatus.ESCALATED).length,
      resolved: relevantGrievances.filter(g => g.status === GrievanceStatus.RESOLVED || g.status === GrievanceStatus.CLOSED).length,
    };
    const sentimentCounts = { Urgent: 0, Negative: 0, Neutral: 0, Positive: 0, Unanalyzed: 0 };
    if (isStaff) {
      relevantGrievances.forEach(g => {
        if (g.aiAnalysis?.sentiment && (sentimentCounts as any)[g.aiAnalysis.sentiment] !== undefined)
          (sentimentCounts as any)[g.aiAnalysis.sentiment]++;
        else sentimentCounts.Unanalyzed++;
      });
    }
    const chartData = [
      { label: 'Urgent', value: sentimentCounts.Urgent, colorClass: 'text-rose-500' },
      { label: 'Negative', value: sentimentCounts.Negative, colorClass: 'text-amber-500' },
      { label: 'Neutral', value: sentimentCounts.Neutral, colorClass: 'text-gray-400' },
      { label: 'Positive', value: sentimentCounts.Positive, colorClass: 'text-emerald-500' },
      { label: 'Unanalyzed', value: sentimentCounts.Unanalyzed, colorClass: 'text-gray-200 dark:text-slate-600' },
    ];
    return (
      <div className="space-y-8">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-700 rounded-3xl p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 font-bold uppercase tracking-wide">
                  {currentUser.role === UserRole.CITIZEN ? 'Citizen' : currentUser.role === UserRole.OFFICER ? 'Field Officer' : currentUser.role === UserRole.SUPERVISOR ? 'Supervisor' : 'Administrator'}
                </span>
              </div>
              <h2 className="text-3xl font-bold font-display">
                {isStaff ? 'Grievance Management Dashboard' : 'My Complaints'}
              </h2>
              <p className="text-indigo-200 mt-1">
                {isStaff ? `Managing ${stats.total} complaints · ${stats.escalated} escalated` : `Welcome, ${currentUser.name}. Track your submitted grievances.`}
              </p>
            </div>
            <div className="flex gap-3 flex-wrap">
              {currentUser.role === UserRole.CITIZEN && (
                <Button onClick={() => { setView('SUBMIT_NEW'); resetForm(); }} className="bg-white text-indigo-600 hover:bg-indigo-50 border-none shadow-lg">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  New Complaint
                </Button>
              )}
              <Button onClick={() => setView('PUBLIC_REPORT')} className="bg-white/10 text-white hover:bg-white/20 border border-white/20">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Public Report
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total', value: stats.total, color: 'text-gray-900 dark:text-white', icon: '📋' },
            { label: 'Pending', value: stats.pending, color: 'text-amber-600', icon: '⏳' },
            { label: 'In Progress', value: stats.inProgress, color: 'text-blue-600', icon: '🔧' },
            { label: 'Escalated', value: stats.escalated, color: 'text-orange-600', icon: '🚨' },
            { label: 'Resolved', value: stats.resolved, color: 'text-emerald-600', icon: '✅' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">{s.label}</p>
                  <p className={`text-3xl font-bold font-display ${s.color}`}>{s.value}</p>
                </div>
                <span className="text-2xl">{s.icon}</span>
              </div>
            </div>
          ))}
        </div>

        {isStaff && relevantGrievances.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SentimentChart data={chartData} />
            <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800 rounded-2xl border border-indigo-100 dark:border-slate-700 p-8 flex flex-col justify-center">
              <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-4 text-white shadow-lg">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-indigo-900 dark:text-white mb-2">AI Insights</h3>
              <p className="text-indigo-700 dark:text-slate-400 mb-5 text-sm">
                {sentimentCounts.Urgent > 0 ? `⚠️ ${sentimentCounts.Urgent} urgent grievance(s) need immediate attention.` : '✅ No urgent grievances. Resolution is on track.'}
              </p>
              <div className="space-y-3">
                {[
                  { label: 'Resolution Rate', val: stats.total ? Math.round((stats.resolved / stats.total) * 100) : 0, bar: 'bg-indigo-500', text: 'text-indigo-900 dark:text-indigo-300' },
                  { label: 'Escalation Rate', val: stats.total ? Math.round((stats.escalated / stats.total) * 100) : 0, bar: 'bg-orange-400', text: 'text-orange-900 dark:text-orange-300' },
                ].map(m => (
                  <div key={m.label} className="bg-white/60 dark:bg-black/20 rounded-xl p-4">
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className={`font-medium ${m.text}`}>{m.label}</span>
                      <span className={`font-bold ${m.text}`}>{m.val}%</span>
                    </div>
                    <div className="w-full bg-indigo-100 dark:bg-slate-700 rounded-full h-2">
                      <div className={`${m.bar} h-2 rounded-full`} style={{ width: `${m.val}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <h3 className="font-bold text-gray-900 dark:text-white text-lg">
              Grievances {filtered.length !== relevantGrievances.length && <span className="ml-2 text-sm font-normal text-gray-400">({filtered.length} shown)</span>}
            </h3>
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative">
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                  className="pl-3 pr-8 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 appearance-none outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                  <option value="ALL">All Categories</option>
                  {Object.values(GrievanceCategory).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-gray-400"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></div>
              </div>
              <div className="relative">
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                  className="pl-3 pr-8 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 appearance-none outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                  <option value="ALL">All Statuses</option>
                  {Object.values(GrievanceStatus).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
                <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-gray-400"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></div>
              </div>
              <div className="relative w-full sm:w-64">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  placeholder="Search ticket, title, citizen..." />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filtered.length === 0 ? (
              <div className="col-span-full text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-slate-700">
                <div className="text-5xl mb-4">📭</div>
                <p className="text-gray-500 dark:text-slate-400 font-medium text-lg">No grievances found</p>
                {!searchQuery && statusFilter === 'ALL' && currentUser.role === UserRole.CITIZEN && (
                  <Button variant="ghost" className="mt-3 text-indigo-600 hover:bg-indigo-50" onClick={() => { setView('SUBMIT_NEW'); resetForm(); }}>
                    Submit your first complaint
                  </Button>
                )}
              </div>
            ) : filtered.map(renderCard)}
          </div>
        </div>
      </div>
    );
  };

  // ─ LOADING ───────────────────────────────────────────────────────────────
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  if (!currentUser || view === 'LOGIN') return renderLogin();

  const unreadCount = notifications.filter(n => !n.read).length;

  // ─ SHELL ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center cursor-pointer gap-3" onClick={() => setView('DASHBOARD')}>
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200 dark:shadow-none">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
              </div>
              <span className="font-bold text-xl text-gray-900 dark:text-white font-display">GrievanceMS</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setView('PUBLIC_REPORT')}
                className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Report
              </button>
              <button onClick={toggleTheme} className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                {darkMode
                  ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>}
              </button>
              <div className="relative" ref={notificationRef}>
                <button className="relative p-2 rounded-lg text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => setShowNotifications(s => !s)}>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && <span className="absolute top-1 right-1 block h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />}
                </button>
                {showNotifications && (
                  <div className="absolute right-0 mt-3 w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-50 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/30">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">Notifications</h3>
                      {unreadCount > 0 && <button onClick={markAllRead} className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline">Mark all read</button>}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-10 text-center text-gray-400 text-sm">
                          <svg className="w-10 h-10 mx-auto mb-2 text-gray-200 dark:text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                          No notifications
                        </div>
                      ) : notifications.map(n => (
                        <div key={n.id}
                          className={`px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer border-b border-gray-50 dark:border-slate-700/50 last:border-0 transition-colors ${!n.read ? 'bg-indigo-50/30 dark:bg-indigo-900/5' : ''}`}
                          onClick={() => { markRead(n.id); if (n.relatedGrievanceId) handleViewDetail(n.relatedGrievanceId); }}>
                          <div className="flex gap-2.5">
                            <div className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${!n.read ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-slate-600'}`} />
                            <div>
                              <p className={`text-xs mb-0.5 ${!n.read ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-slate-400'}`}>{n.message}</p>
                              <p className="text-xs text-gray-400 dark:text-slate-500">{timeAgo(n.createdAt)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="h-6 w-px bg-gray-200 dark:bg-slate-700 hidden sm:block" />
              <div className="flex items-center gap-2.5">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{currentUser.name}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    {currentUser.role === UserRole.CITIZEN ? 'Citizen' : currentUser.role === UserRole.OFFICER ? 'Field Officer' : currentUser.role === UserRole.SUPERVISOR ? 'Supervisor' : 'Administrator'}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                  {currentUser.name[0].toUpperCase()}
                </div>
                <button onClick={handleLogout} className="p-2 rounded-lg text-gray-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
        {view === 'DASHBOARD'        && renderDashboard()}
        {view === 'SUBMIT_NEW'       && renderForm()}
        {view === 'GRIEVANCE_DETAIL' && renderDetail()}
        {view === 'PUBLIC_REPORT'    && (
          <div>
            <div className="mb-5">
              <Button variant="ghost" onClick={() => setView('DASHBOARD')} className="pl-0 hover:bg-transparent hover:text-indigo-600">
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to Dashboard
              </Button>
            </div>
            {renderReport()}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
