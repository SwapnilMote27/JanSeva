import React, { useEffect, useState } from 'react';
import { getOfflineSubmissions, deleteOfflineSubmission } from '@/src/utils/indexedDB';
import { collection, addDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/src/services/firebase';
import { useAuth } from '@/src/hooks/useAuth';
import { Wifi } from 'lucide-react';

export const SyncManager: React.FC = () => {
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [syncedCount, setSyncedCount] = useState(0);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (!user) return;

    const runSync = async () => {
      if (!navigator.onLine || syncing) return;

      try {
        const offlineSubmissions = await getOfflineSubmissions();
        if (offlineSubmissions.length === 0) return;

        setSyncing(true);
        let successCount = 0;

        for (const submission of offlineSubmissions) {
          // Sync any report created by the current user
          if (submission.reportedBy === user.uid) {
            try {
              const payload = { ...submission };
              delete payload.tempId;
              delete payload.isOfflinePending;
              delete payload.id;
              
              // Use local date at sync time
              payload.reportedAt = new Date();

              // 1. Sync to firestore
              await addDoc(collection(db, 'issues'), payload);

              // 2. Increment user rewards
              const userRef = doc(db, 'users', user.uid);
              await updateDoc(userRef, {
                totalReports: increment(1),
                points: increment(10)
              });

              // 3. Remove local copy from IndexedDB queue
              await deleteOfflineSubmission(submission.tempId);
              successCount++;
            } catch (singleErr) {
              console.error('[SyncManager] Failed to sync individual submission:', singleErr);
            }
          }
        }

        if (successCount > 0) {
          setSyncedCount(successCount);
          setShowToast(true);
          // Hide toast after 6 seconds
          setTimeout(() => setShowToast(false), 6000);
        }
      } catch (err) {
        console.error('[SyncManager] Error in sync process:', err);
      } finally {
        setSyncing(false);
      }
    };

    // Run on startup
    runSync();

    // Listener for connection restored
    window.addEventListener('online', runSync);
    return () => {
      window.removeEventListener('online', runSync);
    };
  }, [user, syncing]);

  if (!showToast) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-500 dark:to-teal-500 text-white px-5 py-4 rounded-2xl shadow-2xl border border-emerald-500/30 flex items-center gap-4 max-w-sm animate-bounce">
      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
        <Wifi className="w-5 h-5 text-white animate-pulse" />
      </div>
      <div>
        <h4 className="text-xs font-extrabold tracking-wider uppercase font-mono">Sync Successful! 🛰️</h4>
        <p className="text-xs text-emerald-50 mt-0.5 font-medium leading-relaxed">
          Uploaded {syncedCount} report{syncedCount > 1 ? 's' : ''} saved offline. Your points (+{syncedCount * 10} XP) are added!
        </p>
      </div>
      <button 
        onClick={() => setShowToast(false)} 
        className="text-white/60 hover:text-white text-xs font-bold pl-2 cursor-pointer font-mono shrink-0"
      >
        ✕
      </button>
    </div>
  );
};
