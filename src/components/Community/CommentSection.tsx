import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/services/firebase';
import { useAuth } from '@/src/hooks/useAuth';
import { Comment } from '@/src/types';
import { MessageSquare, Send, Calendar, Heart } from 'lucide-react';
import { sendNotification } from '@/src/utils/notifications';

interface CommentSectionProps {
  issueId: string;
  reportedBy?: string;
  issueTitle?: string;
}

export const CommentSection: React.FC<CommentSectionProps> = ({ issueId, reportedBy, issueTitle }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const commentsRef = collection(db, 'issues', issueId, 'comments');
    const q = query(commentsRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedComments: Comment[] = [];
      snapshot.forEach((doc) => {
        fetchedComments.push({
          id: doc.id,
          ...doc.data()
        } as Comment);
      });
      setComments(fetchedComments);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `issues/${issueId}/comments`);
    });

    return () => unsubscribe();
  }, [issueId]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newCommentText.trim()) return;

    setSubmitting(true);
    const text = newCommentText.trim();
    const commentsPath = `issues/${issueId}/comments`;

    try {
      // 1. Add comment to subcollection with likes initialized
      await addDoc(collection(db, 'issues', issueId, 'comments'), {
        userId: user.uid,
        userDisplayName: user.displayName,
        userPhotoURL: user.photoURL,
        text,
        timestamp: serverTimestamp(),
        likes: 0,
        likedBy: []
      });

      // 2. Award +3 points to user profile
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        points: increment(3)
      });

      // 3. Send notification to the original reporter
      if (reportedBy && issueTitle) {
        await sendNotification(
          reportedBy,
          user.uid,
          'New Comment on Your Issue',
          `${user.displayName} commented: "${text.length > 50 ? text.substring(0, 50) + '...' : text}"`,
          issueId,
          issueTitle,
          'comment'
        );
      }

      // Clear input
      setNewCommentText('');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, commentsPath);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeComment = async (commentId: string, currentLikes: number, likedBy: string[] = []) => {
    if (!user) return;

    const hasLiked = likedBy.includes(user.uid);
    const commentRef = doc(db, 'issues', issueId, 'comments', commentId);

    const updatedLikedBy = hasLiked
      ? likedBy.filter((uid) => uid !== user.uid)
      : [...likedBy, user.uid];

    const updatedLikes = hasLiked
      ? Math.max(0, currentLikes - 1)
      : currentLikes + 1;

    try {
      await updateDoc(commentRef, {
        likes: updatedLikes,
        likedBy: updatedLikedBy,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `issues/${issueId}/comments/${commentId}`);
    }
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return 'Just now';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div id="comment-section-box" className="space-y-4 font-sans">
      <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
        <MessageSquare className="w-5 h-5 text-emerald-600" />
        <h3 className="font-bold text-gray-900 text-sm">
          Neighbor Discussions ({comments.length})
        </h3>
      </div>

      {/* Comments List */}
      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
        {comments.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-xs">
            💬 No discussions yet. Ask a question or share coordinates below!
          </div>
        ) : (
          comments.map((comment) => {
            const commentLikedBy = comment.likedBy || [];
            const commentLikes = comment.likes || 0;
            const isLiked = user && commentLikedBy.includes(user.uid);

            return (
              <div key={comment.id} className="flex gap-3 text-left">
                <img
                  src={comment.userPhotoURL}
                  alt={comment.userDisplayName}
                  className="w-8 h-8 rounded-full bg-gray-100 object-cover shrink-0"
                />
                <div className="bg-gray-50 rounded-2xl p-3 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-900">{comment.userDisplayName}</span>
                      <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {formatTimestamp(comment.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed break-words">{comment.text}</p>
                  </div>

                  {/* Like/Support reaction system */}
                  <div className="mt-2.5 flex items-center justify-between border-t border-gray-200/50 pt-2">
                    <button
                      type="button"
                      onClick={() => handleLikeComment(comment.id, commentLikes, commentLikedBy)}
                      disabled={!user}
                      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                        isLiked
                          ? 'bg-rose-50 text-rose-600 border border-rose-100/60'
                          : user
                            ? 'text-gray-500 hover:bg-gray-200/50 hover:text-gray-700'
                            : 'text-gray-400 opacity-85'
                      }`}
                      title={user ? "Show solidarity / support" : "Sign in to support this comment"}
                    >
                      <Heart
                        className={`w-3 h-3 transition-transform ${
                          isLiked
                            ? 'fill-rose-500 text-rose-500 scale-105 animate-pulse'
                            : 'text-gray-400'
                        }`}
                      />
                      <span>
                        {isLiked ? 'Supported' : 'Support'}
                      </span>
                      {commentLikes > 0 && (
                        <span className="ml-0.5 font-bold font-mono text-gray-600 bg-gray-200/60 px-1 py-0.2 rounded-full text-[9px]">
                          {commentLikes}
                        </span>
                      )}
                    </button>

                    {commentLikes >= 3 && (
                      <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        🌟 Solidarity Solution
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Form */}
      {user ? (
        <form onSubmit={handleSubmitComment} className="flex gap-2 items-center">
          <input
            type="text"
            required
            placeholder="Type your comment here (earns +3 pts)..."
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-emerald-500 text-xs text-gray-800 transition-all"
          />
          <button
            type="submit"
            disabled={submitting || !newCommentText.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white p-2.5 rounded-xl flex items-center justify-center cursor-pointer shadow-sm transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      ) : (
        <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl text-center text-xs text-amber-800 font-medium">
          🔒 Please sign in to join the discussion.
        </div>
      )}
    </div>
  );
};
