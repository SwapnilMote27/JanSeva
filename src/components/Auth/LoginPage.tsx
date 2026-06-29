import React, { useEffect } from 'react';
import { useAuth } from '@/src/hooks/useAuth';
import { HeartHandshake, LogIn } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export const LoginPage: React.FC = () => {
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/';

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleSignIn = async () => {
    try {
      await signIn();
    } catch (err) {
      console.error('Sign in failed:', err);
    }
  };

  return (
    <div id="login-page-container" className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 px-4 sm:px-6 lg:px-8 font-sans transition-colors duration-200">
      <div id="login-card" className="max-w-md w-full space-y-8 bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-slate-800 text-center transition-all">
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 bg-gradient-to-tr from-emerald-600 to-teal-500 text-white rounded-3xl flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-6 transform hover:scale-105 transition-transform duration-300">
            <HeartHandshake className="w-11 h-11" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
            JanSeva
          </h1>
          <p className="mt-3.5 text-xs text-emerald-600 dark:text-emerald-400 font-extrabold uppercase tracking-widest font-mono">
            Apki awaaz, Apka samadhan
          </p>
          <p className="mt-4 text-xs text-gray-500 dark:text-slate-400 max-w-xs leading-relaxed">
            Connect with your neighbors, report local civic issues in seconds using AI, and earn reputation points by helping solve them.
          </p>
        </div>

        <div className="mt-8">
          <button
            id="google-login-btn"
            onClick={handleSignIn}
            disabled={loading}
            className="group relative w-full flex justify-center py-3.5 px-4 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 shadow-sm transition-all duration-200 disabled:opacity-50"
          >
            <span className="absolute left-0 inset-y-0 flex items-center pl-3">
              <LogIn className="h-5 w-5 text-gray-400 dark:text-slate-500 group-hover:text-gray-500 dark:group-hover:text-slate-400 transition-colors" />
            </span>
            {loading ? 'Signing in...' : 'Sign in with Google'}
          </button>
        </div>

        <div className="text-xs text-gray-400 dark:text-slate-500 pt-2 border-t border-gray-50 dark:border-slate-800/60 font-mono">
          Vibe2Ship Hackathon Project
        </div>
      </div>
    </div>
  );
};
