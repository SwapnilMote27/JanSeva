import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, writeBatch, doc, updateDoc, deleteDoc, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/services/firebase';
import { useAuth } from '@/src/hooks/useAuth';
import { Notification } from '@/src/types';
import { Bell, MessageSquare, CheckSquare, Trash2, CheckCircle2, Clock, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const NotificationCenter: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const notificationsRef = collection(db, 'users', user.uid, 'notifications');
    const q = query(notificationsRef, orderBy('createdAt', 'desc'), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: Notification[] = [];
      snapshot.forEach((docSnap) => {
        fetched.push({
          id: docSnap.id,
          ...docSnap.data()
        } as Notification);
      });
      setNotifications(fetched);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/notifications`);
    });

    return () => unsubscribe();
  }, [user]);

  // Handle clicking outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNotificationClick = async (notification: Notification) => {
    setIsOpen(false);
    navigate(`/issue/${notification.issueId}`);
    
    if (!notification.read && user) {
      try {
        const docRef = doc(db, 'users', user.uid, 'notifications', notification.id);
        await updateDoc(docRef, { read: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/notifications/${notification.id}`);
      }
    }
  };

  const handleMarkAsRead = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'notifications', notificationId);
      await updateDoc(docRef, { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/notifications/${notificationId}`);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user || unreadCount === 0) return;
    try {
      const batch = writeBatch(db);
      notifications.forEach((n) => {
        if (!n.read) {
          const ref = doc(db, 'users', user.uid, 'notifications', n.id);
          batch.update(ref, { read: true });
        }
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/notifications`);
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'notifications', notificationId);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/notifications/${notificationId}`);
    }
  };

  const formatTimeAgo = (ts: any): string => {
    if (!ts) return 'Just now';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'status_update':
        return (
          <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        );
      case 'comment':
        return (
          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <MessageSquare className="w-4 h-4" />
          </div>
        );
      case 'verification':
        return (
          <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <CheckSquare className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-600 shrink-0">
            <Bell className="w-4 h-4" />
          </div>
        );
    }
  };

  if (!user) return null;

  return (
    <div ref={dropdownRef} className="relative z-40">
      {/* Bell Button */}
      <button
        id="notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-gray-500 hover:text-emerald-700 hover:bg-gray-50 border border-gray-100 bg-white transition-all cursor-pointer shadow-sm flex items-center justify-center"
        aria-label="Notification center"
      >
        <Bell className={`w-4 h-4 ${unreadCount > 0 ? 'animate-[swing_1.5s_ease-in-out_infinite]' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm font-mono">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-80 sm:w-96 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 text-left font-sans flex flex-col overflow-hidden max-h-[480px]">
          {/* Panel Header */}
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
            <div>
              <h4 className="text-xs font-bold text-gray-900">Neighborhood Alerts</h4>
              <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                {unreadCount} unread {unreadCount === 1 ? 'alert' : 'alerts'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          {/* Panel Body (Notifications list) */}
          <div className="overflow-y-auto divide-y divide-gray-50 flex-1 max-h-[360px]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs space-y-2">
                <div className="text-2xl">🔔</div>
                <p className="font-semibold text-gray-600">All quiet for now</p>
                <p className="text-[10px] text-gray-400">We'll alert you when there is an update on your community reports.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3.5 flex gap-3 transition-colors cursor-pointer group text-left ${
                    !n.read ? 'bg-emerald-50/20 hover:bg-emerald-50/40' : 'bg-white hover:bg-gray-50/70'
                  }`}
                >
                  {getNotificationIcon(n.type)}
                  
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-start justify-between gap-1">
                      <p className={`text-xs text-gray-900 leading-tight truncate-two-lines ${!n.read ? 'font-bold' : 'font-medium'}`}>
                        {n.title}
                      </p>
                      <span className="text-[9px] text-gray-400 font-mono flex items-center gap-0.5 shrink-0 whitespace-nowrap">
                        <Clock className="w-2.5 h-2.5" /> {formatTimeAgo(n.createdAt)}
                      </span>
                    </div>
                    
                    <p className="text-[11px] text-gray-500 leading-relaxed break-words line-clamp-2">
                      {n.message}
                    </p>

                    <p className="text-[10px] text-emerald-600 font-semibold truncate hover:underline mt-1 font-mono">
                      📍 {n.issueTitle}
                    </p>
                  </div>

                  {/* Actions (Mark read / Delete) */}
                  <div className="flex flex-col items-center justify-between shrink-0 gap-2">
                    {!n.read ? (
                      <button
                        onClick={(e) => handleMarkAsRead(e, n.id)}
                        className="p-1 rounded-md text-gray-400 hover:text-emerald-600 hover:bg-emerald-50/50 cursor-pointer"
                        title="Mark as read"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <div className="w-5.5 h-5.5" /> /* spacer */
                    )}
                    
                    <button
                      onClick={(e) => handleDeleteNotification(e, n.id)}
                      className="p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      title="Delete alert"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
