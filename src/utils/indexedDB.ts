import { Issue } from '../types';

const DB_NAME = 'community-hero-db';
const DB_VERSION = 1;
const ISSUES_STORE = 'issues';
const OFFLINE_SUBMISSIONS_STORE = 'offline-submissions';

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ISSUES_STORE)) {
        db.createObjectStore(ISSUES_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(OFFLINE_SUBMISSIONS_STORE)) {
        db.createObjectStore(OFFLINE_SUBMISSIONS_STORE, { keyPath: 'tempId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Helper to sanitize Firestore structures (like Timestamps with methods) into plain serializable JSON
function serializeIssue(issue: Issue): any {
  const serialized = { ...issue };
  
  if (issue.reportedAt) {
    if (typeof issue.reportedAt.toDate === 'function') {
      serialized.reportedAt = {
        seconds: issue.reportedAt.seconds,
        nanoseconds: issue.reportedAt.nanoseconds,
        isTimestamp: true
      };
    } else if (issue.reportedAt.seconds !== undefined) {
      serialized.reportedAt = {
        seconds: issue.reportedAt.seconds,
        nanoseconds: issue.reportedAt.nanoseconds || 0,
        isTimestamp: true
      };
    } else {
      const dateVal = new Date(issue.reportedAt);
      if (!isNaN(dateVal.getTime())) {
        serialized.reportedAt = {
          seconds: Math.floor(dateVal.getTime() / 1000),
          nanoseconds: 0,
          isTimestamp: true
        };
      }
    }
  }

  return serialized;
}

// Helper to deserialize plain JSON back into Issue formats (with .toDate() matching Firestore)
function deserializeIssue(item: any): Issue {
  const issue = { ...item };
  
  if (item.reportedAt && item.reportedAt.isTimestamp) {
    issue.reportedAt = {
      seconds: item.reportedAt.seconds,
      nanoseconds: item.reportedAt.nanoseconds,
      toDate: () => new Date(item.reportedAt.seconds * 1000)
    };
  } else if (item.reportedAt && typeof item.reportedAt === 'object' && 'seconds' in item.reportedAt) {
    issue.reportedAt = {
      seconds: item.reportedAt.seconds,
      nanoseconds: item.reportedAt.nanoseconds || 0,
      toDate: () => new Date(item.reportedAt.seconds * 1000)
    };
  } else if (item.reportedAt) {
    const dateVal = new Date(item.reportedAt);
    issue.reportedAt = {
      seconds: Math.floor(dateVal.getTime() / 1000),
      nanoseconds: 0,
      toDate: () => dateVal
    };
  }
  
  return issue as Issue;
}

export async function saveIssuesLocal(issues: Issue[]): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ISSUES_STORE, 'readwrite');
    const store = tx.objectStore(ISSUES_STORE);
    
    store.clear();
    issues.forEach((issue) => {
      store.put(serializeIssue(issue));
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLocalIssues(): Promise<Issue[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ISSUES_STORE, 'readonly');
    const store = tx.objectStore(ISSUES_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.map(deserializeIssue));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflineSubmission(issueData: any): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_SUBMISSIONS_STORE, 'readwrite');
    const store = tx.objectStore(OFFLINE_SUBMISSIONS_STORE);
    store.put(issueData);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineSubmissions(): Promise<any[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_SUBMISSIONS_STORE, 'readonly');
    const store = tx.objectStore(OFFLINE_SUBMISSIONS_STORE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteOfflineSubmission(tempId: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_SUBMISSIONS_STORE, 'readwrite');
    const store = tx.objectStore(OFFLINE_SUBMISSIONS_STORE);
    store.delete(tempId);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
