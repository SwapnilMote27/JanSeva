import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/services/firebase';

/**
 * Creates a notification document in the target user's notifications subcollection.
 * Avoids sending a notification to the action performer if they are the target user.
 * 
 * @param targetUserId The UID of the user who should receive the notification (e.g. the original reporter)
 * @param actionPerformerId The UID of the user performing the action (e.g. the commenter or verifier)
 * @param title The title of the alert
 * @param message The detailed notification message
 * @param issueId The ID of the related civic issue
 * @param issueTitle The title of the related civic issue
 * @param type The category of notification
 */
export async function sendNotification(
  targetUserId: string,
  actionPerformerId: string | undefined,
  title: string,
  message: string,
  issueId: string,
  issueTitle: string,
  type: 'status_update' | 'comment' | 'verification'
) {
  // Never notify oneself
  if (targetUserId === actionPerformerId) {
    return;
  }

  try {
    const notificationsRef = collection(db, 'users', targetUserId, 'notifications');
    await addDoc(notificationsRef, {
      title,
      message,
      issueId,
      issueTitle,
      type,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    // Gracefully handle error and log to firestore error handler
    try {
      handleFirestoreError(error, OperationType.CREATE, `users/${targetUserId}/notifications`);
    } catch (e) {
      console.error('Failed to send notification:', e);
    }
  }
}
