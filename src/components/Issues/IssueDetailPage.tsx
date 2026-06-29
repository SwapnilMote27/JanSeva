import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, arrayUnion, serverTimestamp, increment, getDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/services/firebase';
import { useAuth } from '@/src/hooks/useAuth';
import { Issue, StatusType } from '@/src/types';
import { StatusTimeline } from '@/src/components/Issues/StatusTimeline';
import { CommentSection } from '@/src/components/Community/CommentSection';
import { getSeverityColor } from '@/src/utils/severityColors';
import { ThumbsUp, CheckSquare, Share2, MapPin, User, ShieldCheck, ArrowLeft, Cpu, Compass, Globe, Calendar } from 'lucide-react';
import { sendNotification } from '@/src/utils/notifications';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { StreetViewViewer } from '@/src/components/Map/StreetViewViewer';

export const IssueDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [locationTab, setLocationTab] = useState<'map' | 'streetview'>('map');
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const issueIcon = L.divIcon({
    html: `<div style="font-size: 26px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));">📍</div>`,
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

  useEffect(() => {
    if (!id) return;

    const issueRef = doc(db, 'issues', id);
    const unsubscribe = onSnapshot(issueRef, (snapshot) => {
      if (snapshot.exists()) {
        setIssue({
          id: snapshot.id,
          ...snapshot.data()
        } as Issue);
      } else {
        setIssue(null);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `issues/${id}`);
    });

    return () => unsubscribe();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center font-sans">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-gray-500 font-medium mt-3">Loading report details...</p>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center font-sans p-6 text-center">
        <span className="text-4xl">🔍</span>
        <h2 className="text-xl font-bold text-gray-900 mt-2">Civic Report Not Found</h2>
        <p className="text-sm text-gray-500 mt-1">This issue may have been removed or does not exist.</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2 px-4 rounded-xl shadow-sm"
        >
          Return to Map Dashboard
        </button>
      </div>
    );
  }

  const hasUpvoted = user && issue.upvotedBy.includes(user.uid);
  const hasVerified = user && issue.verifiedBy.includes(user.uid);
  const hasVerifiedResolved = user && issue.resolvedVerifiedBy?.includes(user.uid);

  const handleVerifyResolved = async () => {
    if (!user || !id) return;
    try {
      const issueRef = doc(db, 'issues', id);
      const currentResolvedVerifications = issue.resolvedVerifications || 0;
      const nextResolvedVerifications = currentResolvedVerifications + 1;
      
      // If 3 users have verified it, delete/remove from issues
      if (nextResolvedVerifications >= 3) {
        await deleteDoc(issueRef);
        navigate('/');
        return;
      }

      await updateDoc(issueRef, {
        resolvedVerifications: increment(1),
        resolvedVerifiedBy: arrayUnion(user.uid)
      });

      // Award +5 points to the user for verifying resolution
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        points: increment(5)
      });

      // Send verification notification to the original reporter
      await sendNotification(
        issue.reportedBy,
        user.uid,
        'Resolution Confirmed! 🎉',
        `A neighbor verified that your reported issue "${issue.title}" has been successfully resolved.`,
        id,
        issue.title,
        'verification'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `issues/${id}`);
    }
  };

  const handleUpvote = async () => {
    if (!user || !id) return;
    try {
      const issueRef = doc(db, 'issues', id);
      // 1. Upvote the issue
      await updateDoc(issueRef, {
        upvotes: increment(1),
        upvotedBy: arrayUnion(user.uid)
      });

      // 2. Award +2 points to the upvoter
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        points: increment(2)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `issues/${id}`);
    }
  };

  const handleVerify = async () => {
    if (!user || !id) return;
    try {
      const issueRef = doc(db, 'issues', id);
      const isVerifiedNow = (issue.verifications + 1) >= 3;

      const updatePayload: any = {
        verifications: increment(1),
        verifiedBy: arrayUnion(user.uid)
      };

      if (isVerifiedNow && issue.status === 'Reported') {
        updatePayload.status = 'Verified';
      }

      // 1. Update issue verifications
      await updateDoc(issueRef, updatePayload);

      // 2. Award +5 points to user for local verification
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        points: increment(5)
      });

      // 3. Send verification notification to the original reporter
      await sendNotification(
        issue.reportedBy,
        user.uid,
        'Issue Confirmed by Neighbor',
        `${user.displayName || 'A neighbor'} verified your reported issue: "${issue.title}"`,
        id,
        issue.title,
        'verification'
      );

      // 4. Send status update notification if it became verified
      if (isVerifiedNow && issue.status === 'Reported') {
        await sendNotification(
          issue.reportedBy,
          user.uid,
          'Issue Verified 🌟',
          `Your reported issue "${issue.title}" is now officially Verified after community confirmation!`,
          id,
          issue.title,
          'status_update'
        );
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `issues/${id}`);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: issue.title,
      text: `Civic Report: ${issue.title} (${issue.category}) - help resolve it!`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Clipboard copy failed:', err);
      }
    }
  };

  // Admin status update handler with rewards payout
  const handleAdminStatusChange = async (newStatus: StatusType) => {
    if (!user || user.role !== 'admin' || !id) return;

    setUpdating(true);
    try {
      const issueRef = doc(db, 'issues', id);
      const updatePayload: any = { status: newStatus };

      if (newStatus === 'Resolved') {
        updatePayload.resolvedAt = serverTimestamp();
      }

      // 1. Update status
      await updateDoc(issueRef, updatePayload);

      // 2. If transitioning to "Resolved", find the original reporter and reward them +25 points and +1 resolvedIssues
      if (newStatus === 'Resolved' && issue.status !== 'Resolved') {
        const reporterRef = doc(db, 'users', issue.reportedBy);
        // Safely check if reporter exists
        const reporterSnap = await getDoc(reporterRef);
        if (reporterSnap.exists()) {
          await updateDoc(reporterRef, {
            points: increment(25),
            resolvedIssues: increment(1),
          });
        }
      }

      // 3. Send status update notification to the original reporter
      await sendNotification(
        issue.reportedBy,
        user.uid,
        'Issue Status Updated 📢',
        `The status of your reported issue "${issue.title}" has been updated to "${newStatus}".`,
        id,
        issue.title,
        'status_update'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `issues/${id}`);
    } finally {
      setUpdating(false);
    }
  };

  const sevColors = getSeverityColor(issue.severity);

  return (
    <div id="issue-detail-page-container" className="max-w-5xl mx-auto px-4 py-8 font-sans">
      
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="mb-6 flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-emerald-600 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Live Map
      </button>

      {/* Main Grid: Left Side (Image & details), Right Side (Progress, verification & Comments) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
        
        {/* Left Side (8 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Main Card */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            
            {/* Header elements */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-50 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-mono uppercase bg-gray-100 text-gray-600 px-2.5 py-1 rounded">
                  {issue.category}
                </span>
                <span
                  className={`text-xs font-bold uppercase px-2.5 py-1 rounded border ${sevColors.border} ${sevColors.text}`}
                >
                  {issue.severity}
                </span>
              </div>

              {issue.aiConfidence > 0 && (
                <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-semibold">
                  <Cpu className="w-3.5 h-3.5 animate-pulse" />
                  AI Verified ({(issue.aiConfidence * 100).toFixed(0)}%)
                </span>
              )}
            </div>

            {/* Title & Description */}
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{issue.title}</h1>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{issue.description}</p>

            {/* Image display */}
            {issue.imagesBase64 && issue.imagesBase64.length > 0 ? (
              <div className="space-y-3">
                <div className="border border-gray-100 rounded-xl overflow-hidden max-h-[420px] aspect-video bg-gray-50 relative flex items-center justify-center">
                  <img
                    src={`data:image/jpeg;base64,${issue.imagesBase64[activeImageIndex < issue.imagesBase64.length ? activeImageIndex : 0]}`}
                    alt={`${issue.title} - Image ${(activeImageIndex < issue.imagesBase64.length ? activeImageIndex : 0) + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  {issue.imagesBase64.length > 1 && (
                    <span className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-md shadow font-mono">
                      {(activeImageIndex < issue.imagesBase64.length ? activeImageIndex : 0) + 1} / {issue.imagesBase64.length}
                    </span>
                  )}
                </div>
                {issue.imagesBase64.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                    {issue.imagesBase64.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveImageIndex(idx)}
                        className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                          activeImageIndex === idx
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20 scale-95 shadow-sm'
                            : 'border-transparent hover:border-gray-300'
                        }`}
                      >
                        <img
                          src={`data:image/jpeg;base64,${img}`}
                          alt={`Thumbnail ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : issue.imageBase64 ? (
              <div className="border border-gray-100 rounded-xl overflow-hidden max-h-[360px] bg-gray-50">
                <img
                  src={`data:image/jpeg;base64,${issue.imageBase64}`}
                  alt={issue.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="bg-gray-100 rounded-xl h-48 flex items-center justify-center text-gray-400 text-xs">
                🖼️ No image uploaded for this issue.
              </div>
            )}

            {/* Video evidence display */}
            {issue.videoBase64 && (
              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-bold font-mono uppercase text-gray-500 dark:text-slate-400 tracking-wider flex items-center gap-1.5">
                  🎥 Video Evidence
                </h3>
                <div className="border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden aspect-video bg-black relative shadow-sm max-h-[360px] flex items-center justify-center">
                  <video 
                    src={issue.videoBase64} 
                    controls 
                    className="w-full h-full max-h-[360px] object-contain"
                    preload="metadata"
                  />
                </div>
                {issue.videoName && (
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 font-mono italic">
                    File: {issue.videoName}
                  </p>
                )}
              </div>
            )}

            {/* Meta & Location Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-gray-100 pt-4 text-xs text-gray-500">
              <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-xl">
                <img
                  src={issue.reportedByPhoto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150'}
                  alt={issue.reportedByName}
                  className="w-8 h-8 rounded-full object-cover border border-white shrink-0"
                />
                <div>
                  <p className="font-semibold text-gray-800 line-clamp-1">{issue.reportedByName}</p>
                  <p className="text-[10px] text-gray-400">Reporter</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 bg-gray-50 p-3 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-800 font-mono">
                    {issue.location.lat.toFixed(4)}, {issue.location.lng.toFixed(4)}
                  </p>
                  <p className="text-[10px] text-gray-400">📍 Coordinates</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 bg-gray-50 p-3 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-800 font-mono">
                    {issue.incidentDate ? new Date(issue.incidentDate).toLocaleDateString(undefined, { dateStyle: 'medium' }) : (issue.reportedAt?.toDate ? new Date(issue.reportedAt.toDate()).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Recent')}
                  </p>
                  <p className="text-[10px] text-gray-400">📅 Date of Incident</p>
                </div>
              </div>
            </div>

            {/* Community Buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                id="upvote-issue-btn"
                onClick={handleUpvote}
                disabled={!user || hasUpvoted}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5 cursor-pointer transition-all ${
                  hasUpvoted
                    ? 'bg-gray-100 text-gray-400 border border-gray-100'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100'
                }`}
              >
                <ThumbsUp className="w-4 h-4" />
                {hasUpvoted ? 'Upvoted ✓' : 'Upvote Issue (+2 pts)'} ({issue.upvotes})
              </button>

              {issue.status === 'Resolved' ? (
                <button
                  id="verify-resolved-btn"
                  onClick={handleVerifyResolved}
                  disabled={!user || hasVerifiedResolved}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5 cursor-pointer transition-all ${
                    hasVerifiedResolved
                      ? 'bg-gray-100 text-gray-400 border border-gray-100'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100'
                  }`}
                >
                  <CheckSquare className="w-4 h-4" />
                  {hasVerifiedResolved ? 'Resolution Verified ✓' : 'Verify Resolution is Correct (+5 pts)'} ({issue.resolvedVerifications || 0}/3)
                </button>
              ) : (
                <button
                  id="verify-issue-btn"
                  onClick={handleVerify}
                  disabled={!user || hasVerified}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5 cursor-pointer transition-all ${
                    hasVerified
                      ? 'bg-gray-100 text-gray-400 border border-gray-100'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-100'
                  }`}
                >
                  <CheckSquare className="w-4 h-4" />
                  {hasVerified ? 'Verified ✓' : 'Confirm Issue Exists (+5 pts)'} ({issue.verifications}/3)
                </button>
              )}

              <button
                id="share-issue-btn"
                onClick={handleShare}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer transition-all ml-auto"
              >
                <Share2 className="w-4 h-4" />
                {copied ? 'Link Copied!' : 'Share'}
              </button>
            </div>

          </div>

          {/* Admin Controls Panel */}
          {user && user.role === 'admin' && (
            <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-1.5 text-purple-900 font-bold text-sm">
                <ShieldCheck className="w-5 h-5 text-purple-700" />
                <span>Admin Resolution Console 🛡️</span>
              </div>
              <p className="text-xs text-purple-600">
                Authorized Admin privileges. Advance status to 'Resolved' to trigger automated reputation payouts (+25 pts) to the original reporter.
              </p>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-purple-800">Update Status:</label>
                <select
                  disabled={updating}
                  value={issue.status}
                  onChange={(e) => handleAdminStatusChange(e.target.value as StatusType)}
                  className="bg-white border border-purple-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-950 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="Reported">Reported</option>
                  <option value="Verified">Verified</option>
                  <option value="Assigned">Assigned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                </select>
                {updating && <span className="text-[10px] text-purple-500 animate-pulse">Syncing...</span>}
              </div>
            </div>
          )}

        </div>

        {/* Right Side (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Geographical Map & Street View Section */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-50 pb-3">
              <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-600 animate-bounce" />
                Geographical Location
              </h3>
              
              {/* Toggle controls */}
              <div className="bg-gray-100 p-1 rounded-xl flex items-center gap-1">
                <button
                  onClick={() => setLocationTab('map')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    locationTab === 'map'
                      ? 'bg-white text-gray-800 shadow-xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Map 🗺️
                </button>
                <button
                  onClick={() => setLocationTab('streetview')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    locationTab === 'streetview'
                      ? 'bg-white text-gray-800 shadow-xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  Street View 📸
                </button>
              </div>
            </div>

            {(() => {
              const defaultLat = 20.5937;
              const defaultLng = 78.9629;
              const issueLat = (issue && issue.location && typeof issue.location.lat === 'number' && !isNaN(issue.location.lat)) ? issue.location.lat : defaultLat;
              const issueLng = (issue && issue.location && typeof issue.location.lng === 'number' && !isNaN(issue.location.lng)) ? issue.location.lng : defaultLng;

              return locationTab === 'map' ? (
                <div className="h-[280px] rounded-2xl overflow-hidden border border-gray-150 relative z-10 shadow-sm">
                  <MapContainer
                    center={[issueLat, issueLng]}
                    zoom={15}
                    className="w-full h-full"
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={true}
                  >
                    <TileLayer
                      key={isDark ? 'dark' : 'light'}
                      url={isDark
                        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"}
                      attribution='&copy; OpenStreetMap &copy; CARTO'
                    />
                    <Marker
                      position={[issueLat, issueLng]}
                      icon={issueIcon}
                    />
                  </MapContainer>
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden shadow-sm">
                  <StreetViewViewer
                    lat={issueLat}
                    lng={issueLng}
                    title={issue.title}
                  />
                </div>
              );
            })()}
            
            <p className="text-[11px] text-gray-400 font-mono text-center">
              Coordinates: {(issue.location && typeof issue.location.lat === 'number' && !isNaN(issue.location.lat) ? issue.location.lat : 20.5937).toFixed(6)}, {(issue.location && typeof issue.location.lng === 'number' && !isNaN(issue.location.lng) ? issue.location.lng : 78.9629).toFixed(6)}
            </p>
          </div>

          {/* Progress Timeline Panel */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-sm">
            <StatusTimeline status={issue.status} />
          </div>

          {/* Community Discussion Panel */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-sm">
            <CommentSection issueId={issue.id} reportedBy={issue.reportedBy} issueTitle={issue.title} />
          </div>

        </div>

      </div>
    </div>
  );
};
