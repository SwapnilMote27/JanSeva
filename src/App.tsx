import React, { useState } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Link, 
  Navigate, 
  useLocation, 
  useNavigate 
} from 'react-router-dom';
import { AuthProvider, useAuth } from '@/src/hooks/useAuth';
import { ThemeProvider, useTheme } from '@/src/hooks/useTheme';
import { LanguageProvider, useLanguage, languages } from '@/src/hooks/useLanguage';
import { LoginPage } from '@/src/components/Auth/LoginPage';
import { ReportForm } from '@/src/components/Issues/ReportForm';
import { MapDashboard } from '@/src/components/Map/MapDashboard';
import { IssueDetailPage } from '@/src/components/Issues/IssueDetailPage';
import { Leaderboard } from '@/src/components/Gamification/Leaderboard';
import { ImpactDashboard } from '@/src/components/Impact/ImpactDashboard';
import { NotificationCenter } from '@/src/components/Community/NotificationCenter';
import { UserProfilePage } from '@/src/components/Profile/UserProfilePage';
import { SyncManager } from '@/src/components/Offline/SyncManager';
import { AnimatePresence } from 'motion/react';
import { PageTransition } from '@/src/components/Common/PageTransition';
import { 
  Map, 
  PlusSquare, 
  Trophy, 
  BarChart3, 
  ShieldCheck, 
  LogOut, 
  Menu, 
  X, 
  Sparkles,
  User,
  Sun,
  Moon,
  Languages,
  HeartHandshake
} from 'lucide-react';

// Protected Route Guard
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center font-sans transition-colors duration-200">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mt-3">Verifying credentials...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// Layout with Navigation
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const navLinks = [
    { to: '/', label: t('map'), icon: Map },
    { to: '/report', label: t('report'), icon: PlusSquare },
    { to: '/leaderboard', label: t('leaderboard'), icon: Trophy },
    { to: '/impact', label: t('impact'), icon: BarChart3 }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-slate-950 text-gray-800 dark:text-slate-100 font-sans transition-colors duration-200">
      <SyncManager />
      {/* Navbar header */}
      <header className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 shadow-sm sticky top-0 z-[2000] transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo */}
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
              <div className="w-11 h-11 bg-gradient-to-tr from-emerald-600 to-teal-500 dark:from-emerald-500 dark:to-teal-400 rounded-2xl flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-all duration-200">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <div className="flex flex-col justify-center">
                <span className="font-extrabold text-2xl tracking-tight text-gray-900 dark:text-white leading-none">
                  {t('appName')}
                </span>
                <span className="text-[9px] font-mono font-extrabold tracking-wider uppercase text-emerald-600 dark:text-emerald-400 mt-1.5 leading-none">
                  {t('tagline')}
                </span>
              </div>
            </div>

            {/* Desktop Nav links */}
            <nav className="hidden md:flex items-center gap-1.5">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.to;

                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      isActive
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400'
                        : 'text-gray-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-gray-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right side controls */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Language Selector Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setLangOpen(!langOpen)}
                  title="Change Language / भाषा बदला"
                  className="p-2 rounded-xl bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 border border-gray-100 dark:border-slate-700 transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <Languages className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase font-mono hidden sm:inline">
                    {language}
                  </span>
                </button>

                {langOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xl py-2 z-[2010] text-left font-sans animate-[fadeIn_0.15s_ease-out]">
                    <div className="px-3 py-1 border-b border-gray-50 dark:border-slate-800 pb-1.5 mb-1.5">
                      <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider font-mono">Language / भाषा</p>
                    </div>
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code);
                          setLangOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-xs font-semibold flex items-center justify-between transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer ${
                          language === lang.code
                            ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/55 dark:bg-emerald-950/20'
                            : 'text-gray-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span>{lang.flag}</span>
                          <span>{lang.name}</span>
                        </span>
                        {language === lang.code && <span className="text-xs text-emerald-600 dark:text-emerald-400">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className="p-2 rounded-xl bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 border border-gray-100 dark:border-slate-700 transition-all cursor-pointer flex items-center justify-center"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400 animate-[spin_8s_linear_infinite]" />
                ) : (
                  <Moon className="w-4 h-4 text-emerald-600" />
                )}
              </button>

              {user && <NotificationCenter />}
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2.5 px-3 py-1.5 border border-gray-100 dark:border-slate-850 rounded-2xl bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-750 transition-colors text-left cursor-pointer"
                  >
                    <img
                      src={user.photoURL}
                      alt={user.displayName}
                      className="w-8 h-8 rounded-full bg-gray-200 object-cover border-2 border-white dark:border-slate-800 shadow-sm shrink-0"
                    />
                    <div className="hidden sm:block">
                      <p className="text-xs font-bold text-gray-800 dark:text-slate-200 max-w-[120px] truncate">{user.displayName}</p>
                      <p className="text-[10px] text-amber-600 dark:text-amber-500 font-bold font-mono">🏆 {user.points} XP</p>
                    </div>
                  </button>

                  {/* Profile Dropdown */}
                  {profileOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-xl py-3 z-[2010] text-left font-sans animate-[fadeIn_0.15s_ease-out]">
                      <div className="px-4 py-2 border-b border-gray-50 dark:border-slate-800 pb-2.5 mb-2">
                        <p className="text-xs font-bold text-gray-900 dark:text-white">{user.displayName}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">{user.email}</p>
                        <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400 border border-amber-100 dark:border-amber-900 uppercase">
                          <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" /> {user.points} {t('heroPoints')}
                        </div>
                      </div>

                      <Link
                        to="/profile"
                        onClick={() => setProfileOpen(false)}
                        className="w-full px-4 py-2.5 text-xs text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800/60 font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <User className="w-4 h-4 text-emerald-600 dark:text-emerald-450" />
                        {t('viewProfile') || 'View Profile'}
                      </Link>

                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          signOut();
                        }}
                        className="w-full px-4 py-2.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-950/20 font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-red-500" />
                        {t('signOut')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to="/login"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  <User className="w-4 h-4" />
                  Sign In
                </Link>
              )}

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="md:hidden bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 space-y-1.5 text-left z-[2010] relative">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;

              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400'
                      : 'text-gray-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-gray-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {/* Main page content area */}
      <main className="flex-1 w-full relative">
        {children}
      </main>

      {/* Small Hackathon Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-gray-50 dark:border-slate-800 py-4 text-center text-xs text-gray-400 dark:text-slate-500 font-mono tracking-wider transition-colors duration-200">
        CodingNinjas × Google for Developers | Vibe2Ship Hackathon
      </footer>
    </div>
  );
};

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <div key={location.pathname} className="contents">
        <Routes location={location}>
          {/* Public Login page */}
          <Route path="/login" element={<PageTransition><LoginPage /></PageTransition>} />

          {/* Core App routes inside Layout wrapper */}
          <Route path="/" element={<AppLayout><PageTransition><MapDashboard /></PageTransition></AppLayout>} />
          <Route path="/impact" element={<AppLayout><PageTransition><ImpactDashboard /></PageTransition></AppLayout>} />
          
          {/* Protected Civic Routes */}
          <Route path="/report" element={<ProtectedRoute><AppLayout><PageTransition><ReportForm /></PageTransition></AppLayout></ProtectedRoute>} />
          <Route path="/issues/:id" element={<ProtectedRoute><AppLayout><PageTransition><IssueDetailPage /></PageTransition></AppLayout></ProtectedRoute>} />
          <Route path="/leaderboard" element={<ProtectedRoute><AppLayout><PageTransition><Leaderboard /></PageTransition></AppLayout></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><AppLayout><PageTransition><UserProfilePage /></PageTransition></AppLayout></ProtectedRoute>} />

          {/* Catch-all redirection */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <Router>
            <AnimatedRoutes />
          </Router>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

