import React from 'react';
import { BADGES, Badge } from '@/src/config/badges';
import { Award, Lock, CheckCircle2, Trophy, Shield, HelpCircle } from 'lucide-react';

interface BadgeGridProps {
  user: {
    totalReports: number;
    resolvedIssues: number;
    points: number;
  };
  rank?: number;
}

export const BadgeGrid: React.FC<BadgeGridProps> = ({ user, rank }) => {
  const earnedCount = BADGES.filter((badge) => badge.condition({ ...user, rank })).length;
  const totalCount = BADGES.length;
  const completionPercentage = Math.round((earnedCount / totalCount) * 100);

  // Helper to calculate specific progress details for each badge
  const getBadgeProgress = (badgeId: string): { text: string; percentage: number } => {
    const reports = user.totalReports;
    const resolved = user.resolvedIssues;
    const xp = user.points;

    switch (badgeId) {
      case 'first_reporter':
        return {
          text: `${reports} / 1 civic report`,
          percentage: Math.min(reports, 1) * 100,
        };
      case 'community_guardian':
        return {
          text: `${resolved} / 3 resolved reports`,
          percentage: Math.round((Math.min(resolved, 3) / 3) * 100),
        };
      case 'expert_analyst': {
        const xpProgress = Math.min(xp, 1000) / 1000;
        const resProgress = Math.min(resolved, 1) / 1;
        const totalProgress = Math.round((xpProgress * 0.7 + resProgress * 0.3) * 100);
        return {
          text: `${xp} / 1000 XP & ${resolved} / 1 resolved report`,
          percentage: totalProgress,
        };
      }
      case 'community_watch':
        return {
          text: `${reports} / 10 civic reports`,
          percentage: Math.round((Math.min(reports, 10) / 10) * 100),
        };
      case 'problem_solver':
        return {
          text: `${resolved} / 5 resolved reports`,
          percentage: Math.round((Math.min(resolved, 5) / 5) * 100),
        };
      case 'neighborhood_hero':
        return {
          text: `${xp} / 500 XP`,
          percentage: Math.round((Math.min(xp, 500) / 500) * 100),
        };
      case 'top_reporter': {
        const isTop3 = typeof rank === 'number' && rank <= 3;
        return {
          text: isTop3 
            ? `Leaderboard rank: #${rank}` 
            : (rank ? `Rank: #${rank} (Target: Top 3)` : 'No leaderboard rank yet'),
          percentage: isTop3 ? 100 : 0,
        };
      }
      default:
        return {
          text: 'Unknown requirement',
          percentage: 0,
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Overall Completion Card */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-100/60 dark:border-emerald-950/30 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500 animate-bounce" />
            <h3 className="text-sm font-extrabold text-gray-850 dark:text-slate-100 uppercase tracking-wide font-mono">
              Citizen Milestone Progress
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 max-w-md leading-relaxed">
            Every civic report you file, upvote you receive, or public issue you help resolve pushes you closer to earning legendary badges. Keep building a safer, cleaner community!
          </p>
        </div>

        {/* Circular / Horizontal combined visual badge summary */}
        <div className="w-full md:w-64 space-y-2 shrink-0">
          <div className="flex justify-between items-end text-xs">
            <span className="font-bold text-gray-700 dark:text-slate-300">Achievements Unlocked</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {earnedCount} / {totalCount} ({completionPercentage}%)
            </span>
          </div>
          
          <div className="h-3 bg-gray-100 dark:bg-slate-950 rounded-full overflow-hidden border border-gray-200/50 dark:border-slate-800/40">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-1000 ease-out"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Badges List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {BADGES.map((badge) => {
          const isEarned = badge.condition({ ...user, rank });
          const progress = getBadgeProgress(badge.id);

          return (
            <div
              key={badge.id}
              className={`border rounded-2xl p-5 flex gap-4 items-start relative overflow-hidden transition-all duration-300 ${
                isEarned
                  ? 'bg-white dark:bg-slate-900 border-emerald-500/30 dark:border-emerald-500/20 shadow-md shadow-emerald-500/5 dark:shadow-none hover:scale-[1.01]'
                  : 'bg-gray-50/50 dark:bg-slate-950/40 border-gray-100 dark:border-slate-900'
              }`}
            >
              {/* Corner accent for earned badges */}
              {isEarned && (
                <div className="absolute top-0 right-0 w-8 h-8 bg-emerald-500/10 rounded-bl-2xl flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}

              {/* Icon container */}
              <div 
                className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-sm shrink-0 transition-transform ${
                  isEarned
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 scale-105'
                    : 'bg-gray-100 dark:bg-slate-900 border border-gray-200/50 dark:border-slate-850 opacity-50'
                }`}
              >
                {isEarned ? badge.icon : '🔒'}
              </div>

              {/* Badge Details */}
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 
                    className={`text-sm font-extrabold truncate ${
                      isEarned 
                        ? 'text-gray-900 dark:text-white' 
                        : 'text-gray-400 dark:text-slate-500 font-semibold'
                    }`}
                  >
                    {badge.name}
                  </h4>
                  {!isEarned && (
                    <span className="inline-flex items-center text-[9px] bg-gray-100 dark:bg-slate-900 text-gray-500 font-semibold font-mono uppercase px-1.5 py-0.5 rounded tracking-wider border border-gray-200/30 dark:border-slate-800">
                      Locked
                    </span>
                  )}
                </div>

                <p 
                  className={`text-xs leading-relaxed line-clamp-2 ${
                    isEarned ? 'text-gray-600 dark:text-slate-350' : 'text-gray-400 dark:text-slate-500'
                  }`}
                >
                  {badge.description}
                </p>

                {/* Progress bar / Unlock criteria */}
                <div className="pt-2">
                  <div className="flex justify-between items-center text-[10px] font-mono mb-1">
                    <span className={isEarned ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-400 dark:text-slate-500'}>
                      {isEarned ? 'Requirement Met ✓' : 'Progress'}
                    </span>
                    <span className={isEarned ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-400 dark:text-slate-500'}>
                      {progress.text}
                    </span>
                  </div>

                  <div className="h-1.5 bg-gray-100 dark:bg-slate-900 rounded-full overflow-hidden border border-gray-200/20 dark:border-slate-800/20">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isEarned 
                          ? 'bg-emerald-500' 
                          : 'bg-emerald-400/50 dark:bg-emerald-500/30'
                      }`}
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
