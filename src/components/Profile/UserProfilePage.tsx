import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/services/firebase';
import { useAuth } from '@/src/hooks/useAuth';
import { useIssues } from '@/src/hooks/useIssues';
import { useLanguage } from '@/src/hooks/useLanguage';
import { useTheme } from '@/src/hooks/useTheme';
import { BadgeDisplay } from '@/src/components/Gamification/BadgeDisplay';
import { BadgeGrid } from '@/src/components/Gamification/BadgeGrid';
import { compressImage } from '@/src/utils/imageUtils';
import { 
  User, 
  Settings, 
  Award, 
  History, 
  Mail, 
  Phone, 
  Calendar, 
  Sparkles, 
  Check, 
  Edit3, 
  ShieldAlert, 
  AlertTriangle, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  ChevronRight, 
  Upload, 
  Info, 
  RefreshCw, 
  Bell, 
  BookOpen, 
  TrendingUp,
  Image as ImageIcon
} from 'lucide-react';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150', // Default Blue
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&q=80&w=150', // Tech Guy
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150', // Casual Woman
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150', // Creative Guy
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=150', // Professional Woman
  'https://images.unsplash.com/photo-1628157582853-a796fa650a6a?auto=format&fit=crop&q=80&w=150', // Tech Kid
];

export const UserProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { issues, loading: issuesLoading } = useIssues();
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const navigate = useNavigate();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'history' | 'badges' | 'settings'>('history');

  // Personal Settings states
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [weeklyEmailSummaryEnabled, setWeeklyEmailSummaryEnabled] = useState(true);
  const [photoURL, setPhotoURL] = useState('');

  // Email test statuses
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailSuccess, setTestEmailSuccess] = useState<string | null>(null);

  // Statuses
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // History filtering states
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Real-time rank calculation
  const [rank, setRank] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('points', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let index = 0;
      let calculatedRank = undefined;
      snapshot.forEach((uDoc) => {
        index++;
        if (uDoc.id === user.uid) {
          calculatedRank = index;
        }
      });
      setRank(calculatedRank);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Sync inputs with user values
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      setPhone(user.phone || '');
      setNotificationsEnabled(user.notificationsEnabled ?? true);
      setWeeklyEmailSummaryEnabled(user.weeklyEmailSummaryEnabled ?? true);
      setPhotoURL(user.photoURL || PRESET_AVATARS[0]);
    }
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center font-sans">
        <ShieldAlert className="w-12 h-12 text-red-500 mb-3" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Access Denied</h3>
        <p className="text-xs text-gray-500 max-w-sm mt-1">Please sign in to view and manage your JanSeva profile.</p>
        <button
          onClick={() => navigate('/login')}
          className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-colors"
        >
          Sign In
        </button>
      </div>
    );
  }

  // Filter issues for current user
  const myIssues = issues.filter((issue) => issue.reportedBy === user.uid);

  // Filter history list based on search and category
  const filteredIssues = myIssues.filter((issue) => {
    const matchesSearch = issue.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          issue.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          issue.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || issue.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!displayName.trim()) {
      setErrorMsg('Display name cannot be empty.');
      return;
    }

    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: displayName.trim(),
        bio: bio.trim(),
        phone: phone.trim(),
        notificationsEnabled,
        weeklyEmailSummaryEnabled,
        photoURL,
      });
      setSuccessMsg(t('updateSuccess') || 'Profile updated successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Error updating profile:", err);
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setErrorMsg(null);
    try {
      const base64Str = await compressImage(file, 200);
      setPhotoURL(`data:image/jpeg;base64,${base64Str}`);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to process uploaded image.');
    } finally {
      setUploading(false);
    }
  };

  const sendTestWeeklySummary = async () => {
    if (!user) return;
    setTestingEmail(true);
    setTestEmailSuccess(null);
    setErrorMsg(null);
    try {
      const response = await fetch('/api/issues/send-weekly-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.uid, forceSingle: true }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send weekly summary.');
      }
      setTestEmailSuccess(data.message || 'Weekly summary email generated and sent!');
      setTimeout(() => setTestEmailSuccess(null), 8000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to trigger weekly summary email.');
    } finally {
      setTestingEmail(false);
    }
  };

  // Status helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Resolved':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/40 font-mono uppercase">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            {t('resolved')}
          </span>
        );
      case 'In Progress':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-900/40 font-mono uppercase">
            <Clock className="w-3 h-3 text-blue-500 animate-spin" />
            In Progress
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-100 dark:border-amber-900/40 font-mono uppercase">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            {t('open')}
          </span>
        );
    }
  };

  // Severity helper
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'Critical':
        return <span className="text-[10px] font-bold text-red-600 dark:text-red-400 font-mono bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded">🔴 {severity}</span>;
      case 'High':
        return <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 font-mono bg-orange-50 dark:bg-orange-950/30 px-1.5 py-0.5 rounded">🟠 {severity}</span>;
      case 'Medium':
        return <span className="text-[10px] font-bold text-yellow-600 dark:text-yellow-500 font-mono bg-yellow-50 dark:bg-yellow-950/30 px-1.5 py-0.5 rounded">🟡 {severity}</span>;
      default:
        return <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 font-mono bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded">🟢 {severity}</span>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 font-sans text-left">
      
      {/* 1. Hero Summary Profile Card */}
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden mb-8 transition-colors">
        {/* Aesthetic background mesh */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -z-10" />
        <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-amber-500/5 rounded-full blur-3xl -z-10" />

        <div className="flex flex-col md:flex-row md:items-center gap-6 justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Avatar block */}
            <div className="relative group shrink-0">
              <img
                src={photoURL}
                alt={displayName}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-100 border-4 border-white dark:border-slate-850 shadow-md object-cover"
              />
              <div className="absolute bottom-0 right-0 bg-emerald-600 text-white p-1.5 rounded-full shadow border-2 border-white dark:border-slate-850">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Profile info text */}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white leading-tight">
                  {displayName || 'Anonymous Citizen'}
                </h1>
                <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono uppercase tracking-wide border border-emerald-100 dark:border-emerald-900/40">
                  {user.role || 'Citizen'}
                </span>
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1 font-mono">{user.email}</p>
              
              {bio && (
                <p className="text-xs text-gray-600 dark:text-slate-350 italic mt-2.5 line-clamp-2 max-w-md bg-gray-50/50 dark:bg-slate-950/20 px-3 py-1.5 rounded-xl border border-gray-100/40 dark:border-slate-800/40">
                  "{bio}"
                </p>
              )}
            </div>
          </div>

          {/* XP & Level Status Grid */}
          <div className="grid grid-cols-3 gap-3 bg-gray-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-gray-100/60 dark:border-slate-800/60 self-start md:self-center shrink-0 w-full md:w-auto">
            <div className="text-center px-2">
              <p className="text-[10px] uppercase font-mono tracking-wider font-bold text-gray-400 dark:text-slate-500">{t('pointsEarned')}</p>
              <p className="text-lg font-bold text-amber-500 font-mono mt-0.5">{user.points} XP</p>
            </div>
            <div className="text-center px-2 border-x border-gray-200/50 dark:border-slate-800/50">
              <p className="text-[10px] uppercase font-mono tracking-wider font-bold text-gray-400 dark:text-slate-500">{t('yourRank')}</p>
              <p className="text-lg font-bold text-teal-600 dark:text-teal-400 font-mono mt-0.5">
                {rank ? `#${rank}` : '—'}
              </p>
            </div>
            <div className="text-center px-2">
              <p className="text-[10px] uppercase font-mono tracking-wider font-bold text-gray-400 dark:text-slate-500">Reports</p>
              <p className="text-lg font-bold text-emerald-600 font-mono mt-0.5">{myIssues.length}</p>
            </div>
          </div>
        </div>

        {/* Badges block */}
        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-800">
          <p className="text-[10px] uppercase font-bold text-gray-400 dark:text-slate-500 font-mono tracking-wider mb-2">Earned Badges</p>
          <BadgeDisplay user={{ totalReports: myIssues.length, resolvedIssues: user.resolvedIssues || 0, points: user.points }} rank={rank} />
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex border-b border-gray-200 dark:border-slate-800 mb-6 overflow-x-auto whitespace-nowrap scrollbar-none">
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer shrink-0 ${
            activeTab === 'history'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-gray-400 hover:text-gray-700 dark:hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          {t('submissions')}
        </button>
        <button
          onClick={() => setActiveTab('badges')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer shrink-0 ${
            activeTab === 'badges'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-gray-400 hover:text-gray-700 dark:hover:text-slate-200'
          }`}
        >
          <Award className="w-4 h-4" />
          {t('badgesTab') || 'Badges & Achievements'}
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer shrink-0 ${
            activeTab === 'settings'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-gray-400 hover:text-gray-700 dark:hover:text-slate-200'
          }`}
        >
          <Settings className="w-4 h-4" />
          {t('personalSettings')}
        </button>
      </div>

      {/* 3. Tab Contents */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          
          {/* Submission search & filter controls */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search reported issues..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs font-medium pl-4 pr-10 py-3 rounded-xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors shadow-sm"
              />
            </div>
            
            <div className="sm:w-48">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full text-xs font-medium px-3 py-3 rounded-xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors shadow-sm cursor-pointer"
              >
                <option value="All">All Categories</option>
                <option value="Pothole">Potholes 🕳️</option>
                <option value="Water Leakage">Water Leakages 💧</option>
                <option value="Broken Streetlight">Streetlights 💡</option>
                <option value="Waste/Garbage">Waste & Garbage 🗑️</option>
                <option value="Other">Others 🌐</option>
              </select>
            </div>
          </div>

          {/* History List */}
          {issuesLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-2" />
              <p className="text-xs text-gray-500 font-medium">Loading submission history...</p>
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-2xl p-10 text-center shadow-sm">
              <BookOpen className="w-12 h-12 text-gray-300 dark:text-slate-700 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-gray-700 dark:text-slate-350">No Submissions Found</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                {searchTerm || categoryFilter !== 'All' 
                  ? "We couldn't find any issues matching your active search filters."
                  : "You haven't reported any civic issues yet! Be a citizen leader with JanSeva by starting today."}
              </p>
              
              {!searchTerm && categoryFilter === 'All' && (
                <button
                  onClick={() => navigate('/report')}
                  className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-colors"
                >
                  Report Your First Issue
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredIssues.map((issue) => (
                <div
                  key={issue.id}
                  onClick={() => navigate('/', { state: { focusIssueId: issue.id, lat: issue.location.lat, lng: issue.location.lng } })}
                  className="group bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-850 rounded-2xl p-4 shadow-sm hover:shadow hover:border-gray-200 dark:hover:border-slate-700 transition-all duration-150 cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5">
                    {/* Tiny issue preview */}
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-50 dark:bg-slate-950 border border-gray-100 dark:border-slate-800 shrink-0 relative">
                      {issue.imageBase64 ? (
                        <img
                          src={`data:image/jpeg;base64,${issue.imageBase64}`}
                          alt={issue.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-300 dark:text-slate-800">
                          📷
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-gray-800 dark:text-slate-200 line-clamp-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {issue.title}
                      </h4>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-gray-500 dark:text-slate-400 font-mono">{issue.category}</span>
                        <span>•</span>
                        <span>Spotted on: {issue.incidentDate ? new Date(issue.incidentDate).toLocaleDateString() : (issue.reportedAt?.toDate ? new Date(issue.reportedAt.toDate()).toLocaleDateString() : 'Recent')}</span>
                        <span>•</span>
                        <span className="text-gray-400 dark:text-slate-500 font-medium">Reported: {issue.reportedAt?.toDate ? new Date(issue.reportedAt.toDate()).toLocaleDateString() : 'Recent'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    {getSeverityBadge(issue.severity)}
                    {getStatusBadge(issue.status)}
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-500 transition-colors hidden sm:block" />
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {activeTab === 'badges' && (
        <BadgeGrid user={{ totalReports: myIssues.length, resolvedIssues: user.resolvedIssues || 0, points: user.points }} rank={rank} />
      )}

      {activeTab === 'settings' && (
        <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 transition-colors">
          
          {/* Header notifications feedback */}
          {successMsg && (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/45 text-xs font-semibold p-4 rounded-xl flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500" />
              {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-400 border border-red-100 dark:border-red-900/45 text-xs font-semibold p-4 rounded-xl flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              {errorMsg}
            </div>
          )}

          {/* Preset Avatar Chooser */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider font-mono">
              {t('chooseAvatar') || 'Choose Avatar'}
            </label>
            <div className="flex flex-wrap gap-2.5 items-center">
              {PRESET_AVATARS.map((url, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => setPhotoURL(url)}
                  className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 transition-all cursor-pointer bg-gray-50 dark:bg-slate-800 ${
                    photoURL === url
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 scale-95 shadow-sm'
                      : 'border-transparent hover:border-gray-200 dark:hover:border-slate-700'
                  }`}
                >
                  <img src={url} alt={`Preset Avatar ${idx + 1}`} className="w-full h-full object-cover" />
                  {photoURL === url && (
                    <div className="absolute inset-0 bg-black/25 flex items-center justify-center text-white">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                </button>
              ))}

              {/* Upload custom avatar */}
              <label className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-dashed border-gray-300 dark:border-slate-700 hover:border-emerald-500 transition-colors flex items-center justify-center bg-gray-50/50 dark:bg-slate-900/50 cursor-pointer">
                {uploading ? (
                  <RefreshCw className="w-4 h-4 text-emerald-500 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 text-gray-400" />
                )}
                <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={uploading} />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Display Name Input */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider font-mono">
                Citizen Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs font-medium text-gray-800 dark:text-slate-100 transition-all"
              />
            </div>

            {/* Phone Input */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider font-mono">
                {t('phoneLabel') || 'Phone Number'}
              </label>
              <input
                type="text"
                placeholder="+1 (555) 019-9234"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs font-medium text-gray-800 dark:text-slate-100 transition-all"
              />
            </div>
          </div>

          {/* Bio Input */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider font-mono">
              {t('bioLabel') || 'Bio / Contribution Statement'}
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Dedicated hyper-local activist helping clean public parks..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs font-medium text-gray-800 dark:text-slate-100 transition-all resize-none"
            />
          </div>

          {/* Email read-only */}
          <div className="space-y-1 bg-gray-50/50 dark:bg-slate-950/20 px-4 py-3 rounded-xl border border-gray-100 dark:border-slate-800/60">
            <p className="text-[10px] uppercase font-bold text-gray-400 dark:text-slate-500 font-mono tracking-wider">Account Email (ReadOnly)</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mt-0.5">{user.email}</p>
          </div>

          {/* Notification & Weekly Email settings toggles */}
          <div className="border-t border-gray-100 dark:border-slate-800 pt-6 space-y-6">
            <h4 className="text-xs font-bold text-gray-800 dark:text-slate-200 uppercase tracking-wider font-mono">Preferences</h4>
            
            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => setNotificationsEnabled(e.target.checked)}
                  className="mt-0.5 w-4.5 h-4.5 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    {t('notificationsEnabledLabel') || 'Enable Alerts'}
                  </span>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500">Receive instant updates regarding reported civic blockages or department classification overrides.</p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={weeklyEmailSummaryEnabled}
                  onChange={(e) => setWeeklyEmailSummaryEnabled(e.target.checked)}
                  className="mt-0.5 w-4.5 h-4.5 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-gray-700 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    Weekly Email Summary 📧
                  </span>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500">
                    Receive an automated weekly email listing updates, resolution progress, and department responses for issues you have reported.
                  </p>
                </div>
              </label>
            </div>

            {/* Manual test sandbox panel */}
            <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-gray-100 dark:border-slate-800 space-y-3">
              <h5 className="text-[10px] uppercase font-bold text-gray-500 dark:text-slate-400 font-mono tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                Email Summary Sandbox
              </h5>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 leading-relaxed">
                Want to test the automated summary right now? Click the button below to fetch all your reported issues and generate/send a weekly progress summary email.
              </p>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={sendTestWeeklySummary}
                  disabled={testingEmail}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 text-xs font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {testingEmail ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Summary...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-3.5 h-3.5" />
                      <span>Send Summary Report Now</span>
                    </>
                  )}
                </button>

                {testEmailSuccess && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                    ✅ {testEmailSuccess}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Submit button */}
          <div className="border-t border-gray-100 dark:border-slate-800 pt-6">
            <button
              type="submit"
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/60 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving Profile...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{t('saveChanges')}</span>
                </>
              )}
            </button>
          </div>

        </form>
      )}

    </div>
  );
};
