import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/services/firebase';
import { Issue } from '@/src/types';
import { getLocalIssues, saveIssuesLocal } from '@/src/utils/indexedDB';

export function useIssues() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Instantly load from local IndexedDB cache so user can view issues immediately offline/poor connection
    getLocalIssues()
      .then((cached) => {
        if (cached && cached.length > 0) {
          setIssues(cached);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn('[IndexedDB] Error reading cached issues:', err);
      });

    // 2. Setup real-time listener
    const issuesRef = collection(db, 'issues');
    const q = query(issuesRef, orderBy('reportedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedIssues: Issue[] = [];
      snapshot.forEach((doc) => {
        fetchedIssues.push({
          id: doc.id,
          ...doc.data()
        } as Issue);
      });
      setIssues(fetchedIssues);
      setLoading(false);

      // 3. Cache fetched issues to IndexedDB
      saveIssuesLocal(fetchedIssues).catch((err) => {
        console.warn('[IndexedDB] Error updating cached issues:', err);
      });
    }, (error) => {
      // Offline fallback: handled by snapshot listener error, but keep the local ones
      console.warn('[Firestore] Realtime snapshot error (likely offline):', error);
      getLocalIssues()
        .then((cached) => {
          if (cached && cached.length > 0) {
            setIssues(cached);
          }
          setLoading(false);
        });
    });

    return () => unsubscribe();
  }, []);

  return { issues, loading };
}
