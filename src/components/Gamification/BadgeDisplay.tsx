import React from 'react';
import { BADGES } from '@/src/config/badges';

interface BadgeDisplayProps {
  user: {
    totalReports: number;
    resolvedIssues: number;
    points: number;
  };
  rank?: number;
}

export const BadgeDisplay: React.FC<BadgeDisplayProps> = ({ user, rank }) => {
  return (
    <div className="flex flex-wrap gap-1.5 justify-start">
      {BADGES.map((badge) => {
        const isEarned = badge.condition({ ...user, rank });

        return (
          <div
            key={badge.id}
            title={`${badge.name}: ${badge.description}`}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide transition-all ${
              isEarned
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-100 hover:scale-105'
                : 'bg-gray-50 text-gray-400 border border-gray-100 opacity-60'
            }`}
          >
            <span>{isEarned ? badge.icon : '🔒'}</span>
            <span>{badge.name}</span>
          </div>
        );
      })}
    </div>
  );
};
