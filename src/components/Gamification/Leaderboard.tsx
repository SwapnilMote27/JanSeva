import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/services/firebase';
import { useAuth } from '@/src/hooks/useAuth';
import { BadgeDisplay } from '@/src/components/Gamification/BadgeDisplay';
import { Trophy, Award, Medal, ShieldAlert } from 'lucide-react';

interface LeaderboardUser {
  id: string;
  displayName: string;
  photoURL: string;
  points: number;
  totalReports: number;
  resolvedIssues: number;
  role: string;
}

export const Leaderboard: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('points', 'desc'), limit(20));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedUsers: LeaderboardUser[] = [];
      snapshot.forEach((doc) => {
        fetchedUsers.push({
          id: doc.id,
          ...doc.data()
        } as LeaderboardUser);
      });
      setUsers(fetchedUsers);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 font-sans">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-gray-500 font-medium mt-3">Loading community rankings...</p>
      </div>
    );
  }

  return (
    <div id="leaderboard-panel" className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden font-sans text-left">
      
      {/* Leaderboard Header banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-8 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-7 h-7 text-amber-300 animate-pulse" /> Community Leaderboard
          </h2>
          <p className="text-emerald-100 text-xs mt-1.5">
            Top local problem solvers and contributors. Report issues and collaborate to earn points!
          </p>
        </div>
        {currentUser && (
          <div className="bg-white/10 backdrop-blur-sm px-4 py-2.5 rounded-xl text-center border border-white/10 shrink-0">
            <p className="text-[10px] uppercase font-mono tracking-wider text-emerald-100">Your Points</p>
            <p className="text-lg font-bold text-amber-300 font-mono">{currentUser.points} XP</p>
          </div>
        )}
      </div>

      {/* Leaderboard table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wider text-gray-500 font-mono font-bold">
              <th className="py-4 px-6 text-center w-20">Rank</th>
              <th className="py-4 px-4">Hero Name</th>
              <th className="py-4 px-4 text-center">Score</th>
              <th className="py-4 px-6">Earned Badges</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-sm">
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-400">
                  No heroes registered yet. Be the first to report and lead the board! 🦸
                </td>
              </tr>
            ) : (
              users.map((u, index) => {
                const rank = index + 1;
                const isSelf = currentUser && currentUser.uid === u.id;

                // Rank highlight colors
                let rankWidget = <span className="font-mono font-bold text-gray-500">{rank}</span>;
                let rowBg = 'hover:bg-gray-50/50';

                if (rank === 1) {
                  rankWidget = (
                    <div className="mx-auto w-7 h-7 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center font-bold">
                      🏆
                    </div>
                  );
                  rowBg = 'bg-amber-50/10 hover:bg-amber-50/25';
                } else if (rank === 2) {
                  rankWidget = (
                    <div className="mx-auto w-7 h-7 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center font-bold">
                      🥈
                    </div>
                  );
                  rowBg = 'bg-slate-50/10 hover:bg-slate-50/25';
                } else if (rank === 3) {
                  rankWidget = (
                    <div className="mx-auto w-7 h-7 bg-amber-50 text-amber-800 rounded-full flex items-center justify-center font-bold">
                      🥉
                    </div>
                  );
                  rowBg = 'bg-amber-50/5 hover:bg-amber-50/15';
                }

                if (isSelf) {
                  rowBg = 'bg-emerald-50/20 hover:bg-emerald-50/35 border-l-4 border-l-emerald-600';
                }

                return (
                  <tr key={u.id} className={`${rowBg} transition-colors`}>
                    <td className="py-4 px-6 text-center font-medium">{rankWidget}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={u.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150'}
                          alt={u.displayName}
                          className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm shrink-0 bg-gray-100"
                        />
                        <div>
                          <div className="font-bold text-gray-900 flex items-center gap-1">
                            {u.displayName}
                            {isSelf && (
                              <span className="text-[10px] font-mono font-bold bg-emerald-600 text-white px-1.5 py-0.5 rounded uppercase">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-500 flex items-center gap-2">
                            <span>📢 {u.totalReports} Reports</span>
                            <span>•</span>
                            <span>🔧 {u.resolvedIssues} Resolved</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center font-bold font-mono text-emerald-700">
                      {u.points} XP
                    </td>
                    <td className="py-4 px-6">
                      <BadgeDisplay user={u} rank={rank} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
