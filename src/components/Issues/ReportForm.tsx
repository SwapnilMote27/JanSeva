import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, addDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/src/hooks/useAuth';
import { useGeolocation } from '@/src/hooks/useGeolocation';
import { useTheme } from '@/src/hooks/useTheme';
import { useLanguage } from '@/src/hooks/useLanguage';
import { compressImage } from '@/src/utils/imageUtils';
import { db, handleFirestoreError, OperationType } from '@/src/services/firebase';
import { saveOfflineSubmission } from '@/src/utils/indexedDB';
import { Camera, RefreshCw, MapPin, Sparkles, CheckCircle2, Trash2, Plus, Video, Film, Locate } from 'lucide-react';
import { getSeverityColor } from '@/src/utils/severityColors';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';

const issueIcon = L.divIcon({
  html: `<div style="font-size: 32px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.3));">📍</div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

function ChangeMapCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

function MapClickHandler({ onClick }: { onClick: (latlng: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng);
    },
  });
  return null;
}

function RecenterToCurrentLocation({ lat, lng, onRecenter }: { lat: number; lng: number; onRecenter: () => void }) {
  const map = useMap();
  const handleRecenter = () => {
    onRecenter();
    map.setView([lat, lng], 16, { animate: true });
  };
  return (
    <div className="absolute bottom-4 right-4 z-[999] flex items-center group pointer-events-none">
      <span className="mr-2 px-2 py-1 bg-slate-900/90 dark:bg-slate-800/90 text-white dark:text-slate-200 text-[10px] font-bold rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
        Use GPS Location
      </span>
      <button
        type="button"
        onClick={handleRecenter}
        className="bg-white dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 w-10 h-10 rounded-xl shadow-md border border-gray-100 dark:border-slate-800 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center pointer-events-auto"
        title="Recenter to GPS location"
      >
        <Locate className="w-5 h-5 animate-pulse" />
      </button>
    </div>
  );
}

export const ReportForm: React.FC = () => {
  const { user } = useAuth();
  const geo = useGeolocation();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();

  interface ImageItem {
    base64: string;
    previewUrl: string;
  }

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('Low');
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split('T')[0]);
  const [suggestedDept, setSuggestedDept] = useState('');
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [videoBase64, setVideoBase64] = useState<string>('');
  const [videoName, setVideoName] = useState<string>('');
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string>('');
  const [videoLoading, setVideoLoading] = useState<boolean>(false);

  // Manual override of coordinates
  const [manualLat, setManualLat] = useState<string>('');
  const [manualLng, setManualLng] = useState<string>('');
  const [mapStyle, setMapStyle] = useState<'street' | 'hybrid'>('street');

  // Statuses
  const [analyzing, setAnalyzing] = useState(false);
  const [textAnalyzing, setTextAnalyzing] = useState(false);
  const [lastAnalyzedDesc, setLastAnalyzedDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [offlineSuccess, setOfflineSuccess] = useState(false);

  const handleAutoCategorizeText = async (descToAnalyze = description) => {
    const trimmedDesc = descToAnalyze.trim();
    if (!trimmedDesc || trimmedDesc.length < 10) return;
    if (trimmedDesc === lastAnalyzedDesc) return;

    setErrorMsg(null);
    setTextAnalyzing(true);
    try {
      const response = await fetch('/api/gemini/categorize-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description: trimmedDesc }),
      });

      if (!response.ok) {
        throw new Error('AI categorization service failed or timed out.');
      }

      const data = await response.json();
      if (data.category) setCategory(data.category);
      if (data.severity) setSeverity(data.severity);
      if (data.suggested_department) setSuggestedDept(data.suggested_department);
      if (data.confidence) setAiConfidence(data.confidence);
      
      setLastAnalyzedDesc(trimmedDesc);
    } catch (err: any) {
      console.error(err);
    } finally {
      setTextAnalyzing(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrorMsg(null);
    setAnalyzing(true);

    try {
      const newImages: ImageItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const previewUrl = URL.createObjectURL(file);
        const compressedBase64 = await compressImage(file);
        newImages.push({
          base64: compressedBase64,
          previewUrl
        });
      }

      const updatedImages = [...images, ...newImages];
      setImages(updatedImages);

      // If this is the first batch, analyze the first image with Gemini for auto-classification
      if (images.length === 0 && newImages.length > 0) {
        const firstImgBase64 = newImages[0].base64;
        const response = await fetch('/api/gemini/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: firstImgBase64 }),
        });

        if (!response.ok) {
          throw new Error('AI analysis service failed or timed out.');
        }

        const data = await response.json();

        // Autofill details
        setTitle(data.title || '');
        setDescription(data.description || '');
        setCategory(data.category || 'Other');
        setSeverity(data.severity || 'Medium');
        setSuggestedDept(data.suggested_department || '');
        setAiConfidence(data.confidence || 0.85);
      }

    } catch (err: any) {
      console.error(err);
      setErrorMsg('Could not auto-analyze image. Please fill out details manually.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      URL.revokeObjectURL(prev[index].previewUrl);
      return filtered;
    });
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    
    // Check if file is too large (Firestore 1MB total doc size limit, so let's limit video to 750KB)
    if (file.size > 750 * 1024) {
      setErrorMsg('To ensure fast loading and fit Firestore limits, the video must be under 750 KB. Please record a short, 3-5 second clip or use a lower resolution.');
      return;
    }

    setVideoLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setVideoBase64(base64);
        setVideoName(file.name);
        setVideoPreviewUrl(URL.createObjectURL(file));
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to process video file.');
    } finally {
      setVideoLoading(false);
    }
  };

  const handleRemoveVideo = () => {
    setVideoBase64('');
    setVideoName('');
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
      setVideoPreviewUrl('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setErrorMsg('You must be signed in to submit a report.');
      return;
    }

    if (images.length === 0) {
      setErrorMsg('Please upload at least one photo of the issue.');
      return;
    }

    if (!title || !description || !category || !severity) {
      setErrorMsg('Please complete all required fields.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    // Resolve final coordinates
    const defaultLat = 20.5937;
    const defaultLng = 78.9629;
    const currentGeoLat = (geo && typeof geo.lat === 'number' && !isNaN(geo.lat)) ? geo.lat : defaultLat;
    const currentGeoLng = (geo && typeof geo.lng === 'number' && !isNaN(geo.lng)) ? geo.lng : defaultLng;

    const resolvedLatVal = parseFloat(manualLat) || currentGeoLat;
    const resolvedLngVal = parseFloat(manualLng) || currentGeoLng;
    const finalLat = isNaN(resolvedLatVal) ? defaultLat : resolvedLatVal;
    const finalLng = isNaN(resolvedLngVal) ? defaultLng : resolvedLngVal;

    const issuePayload = {
      title,
      description,
      category,
      severity,
      status: 'Reported',
      location: {
        lat: finalLat,
        lng: finalLng
      },
      imageBase64: images[0].base64,
      imagesBase64: images.map(img => img.base64),
      videoBase64: videoBase64 || null,
      videoName: videoName || null,
      reportedBy: user.uid,
      reportedByName: user.displayName,
      reportedByPhoto: user.photoURL,
      reportedAt: serverTimestamp(),
      incidentDate: incidentDate,
      upvotes: 0,
      upvotedBy: [],
      verifications: 0,
      verifiedBy: [],
      suggestedDepartment: suggestedDept || 'Unassigned',
      aiConfidence: aiConfidence || 0,
      resolvedAt: null,
    };

    const isOffline = !navigator.onLine;

    if (isOffline) {
      try {
        const tempId = `temp-${Date.now()}`;
        const offlinePayload = {
          ...issuePayload,
          tempId,
          reportedAt: new Date().toISOString(),
          isOfflinePending: true,
          id: tempId
        };
        await saveOfflineSubmission(offlinePayload);
        setOfflineSuccess(true);
        return;
      } catch (e) {
        console.error('[Offline Store] Failed:', e);
        setErrorMsg('Failed to save report offline. Please verify device storage.');
        return;
      } finally {
        setSubmitting(false);
      }
    }

    const path = 'issues';
    try {
      // 1. Save issue to Firestore
      const docRef = await addDoc(collection(db, path), issuePayload);

      // 2. Update user points (+10) and totalReports (+1)
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        totalReports: increment(1),
        points: increment(10)
      });

      // 3. Redirect to the detail page
      navigate(`/issues/${docRef.id}`);
    } catch (err: any) {
      console.warn('[Firestore] Failed to save online, attempting offline fallback:', err);
      try {
        const tempId = `temp-${Date.now()}`;
        const offlinePayload = {
          ...issuePayload,
          tempId,
          reportedAt: new Date().toISOString(),
          isOfflinePending: true,
          id: tempId
        };
        await saveOfflineSubmission(offlinePayload);
        setOfflineSuccess(true);
      } catch (e) {
        console.error('[Offline Store] Failed:', e);
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const defaultLat = 20.5937;
  const defaultLng = 78.9629;
  const currentGeoLat = (geo && typeof geo.lat === 'number' && !isNaN(geo.lat)) ? geo.lat : defaultLat;
  const currentGeoLng = (geo && typeof geo.lng === 'number' && !isNaN(geo.lng)) ? geo.lng : defaultLng;

  const finalLat = manualLat || currentGeoLat.toFixed(6);
  const finalLng = manualLng || currentGeoLng.toFixed(6);

  const parsedLat = parseFloat(finalLat);
  const parsedLng = parseFloat(finalLng);
  const safeLat = isNaN(parsedLat) ? defaultLat : parsedLat;
  const safeLng = isNaN(parsedLng) ? defaultLng : parsedLng;

  if (offlineSuccess) {
    return (
      <div id="report-offline-success" className="max-w-xl mx-auto bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 font-sans transition-colors duration-200 my-6 text-center space-y-6">
        <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto hover:scale-110 transition-transform duration-300">
          <Sparkles className="w-8 h-8 font-bold animate-pulse" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Saved Offline! 🗺️🛰️
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-2 leading-relaxed">
            Your connection is currently offline or weak. We've securely saved your community report locally using **IndexedDB**.
          </p>
          <div className="mt-4 p-4 bg-amber-500/10 rounded-xl text-xs text-amber-700 dark:text-amber-300 font-mono flex items-center justify-center gap-2">
            <span>●</span> PENDING BACKGROUND AUTO-SYNC
          </div>
        </div>
        <div className="text-sm text-gray-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl text-left border border-gray-100 dark:border-slate-800/80">
          <p className="font-semibold text-gray-800 dark:text-white mb-1">What happens next?</p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-gray-500 dark:text-slate-400">
            <li>Your report is stored safely on this browser.</li>
            <li>Once your internet connection is active, the report will automatically upload in the background.</li>
            <li>You will receive points and your report will appear on the main map.</li>
          </ul>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 px-4 rounded-xl shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer text-sm"
          >
            Go to Main Dashboard
          </button>
          <button
            type="button"
            onClick={() => {
              setOfflineSuccess(false);
              setTitle('');
              setDescription('');
              setCategory('');
              setImages([]);
              setVideoBase64('');
              setVideoName('');
              setVideoPreviewUrl('');
            }}
            className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 font-medium py-3 px-4 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer text-sm border border-gray-200 dark:border-slate-700"
          >
            Report Another Issue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="report-form-container" className="max-w-xl mx-auto bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 font-sans transition-colors duration-200 my-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {t('reportHeader')} <span className="text-emerald-600">🚨</span>
        </h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
          {t('reportSub')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Image Upload Box */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider font-mono">
            {t('photoRequired')}
          </label>
          <div className="relative border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl hover:border-emerald-500 transition-colors bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center min-h-[220px]">
            {images.length > 0 ? (
              <div className="space-y-3 w-full">
                {/* Grid of uploaded images */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
                  {images.map((img, index) => (
                    <div key={index} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 shadow-sm">
                      <img src={img.previewUrl} alt={`Issue preview ${index + 1}`} className="w-full h-full object-cover" />
                      
                      {/* Primary Badge */}
                      {index === 0 && (
                        <span className="absolute top-2 left-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                          Primary
                        </span>
                      )}

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full shadow-md hover:scale-105 transition-all cursor-pointer opacity-90 group-hover:opacity-100 flex items-center justify-center"
                        title="Remove Photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* Add More block */}
                  <label className="border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl hover:border-emerald-500 hover:bg-emerald-50/10 dark:hover:bg-slate-900/40 transition-all flex flex-col items-center justify-center aspect-square cursor-pointer text-center p-4">
                    <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg flex items-center justify-center text-emerald-600 mb-1.5">
                      <Plus className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-gray-700 dark:text-slate-300">Add More</span>
                    <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
                  </label>
                </div>
              </div>
            ) : (
              <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer py-8">
                <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl flex items-center justify-center text-emerald-600 mb-3">
                  <Camera className="w-6 h-6" />
                </div>
                <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">{t('uploadText')}</span>
                <span className="text-xs text-gray-400 dark:text-slate-500 mt-1">{t('uploadSub')}</span>
                <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
              </label>
            )}

            {analyzing && (
              <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center space-y-3 z-10 animate-fade-in">
                <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-800 dark:text-slate-200 flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                    🤖 {t('aiAnalyzing')}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{t('aiAnalyzingSub')}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Video Upload Box */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider font-mono">
            {t('videoOptional')}
          </label>
          <div className="relative border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl hover:border-emerald-500 transition-colors bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center min-h-[160px]">
            {videoBase64 ? (
              <div className="space-y-3 w-full max-w-sm mx-auto">
                {/* Video Preview */}
                <div className="relative rounded-xl overflow-hidden border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 shadow-sm aspect-video">
                  {videoPreviewUrl ? (
                    <video src={videoPreviewUrl} controls className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                      <Film className="w-8 h-8 animate-pulse mb-1" />
                      <span className="text-xs font-mono">{videoName || 'Processing video...'}</span>
                    </div>
                  )}
                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={handleRemoveVideo}
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full shadow-md hover:scale-105 transition-all cursor-pointer flex items-center justify-center z-10"
                    title={t('removeVideo')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-xs text-gray-400 dark:text-slate-500 font-mono truncate px-2">
                  🎥 {videoName}
                </div>
              </div>
            ) : (
              <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer py-6">
                <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl flex items-center justify-center text-emerald-600 mb-2">
                  <Video className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">
                  {t('videoOptional')}
                </span>
                <span className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
                  {t('videoUploadSub')}
                </span>
                <input type="file" accept="video/*" onChange={handleVideoChange} className="hidden" />
              </label>
            )}

            {videoLoading && (
              <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center space-y-2 z-10 animate-fade-in">
                <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
                <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
                  {t('videoUploading')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* AI Confidence Badge */}
        {aiConfidence !== null && (
          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 p-3.5 rounded-xl text-emerald-800 dark:text-emerald-400 text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <span className="font-bold">{t('aiComplete')}</span> {t('confidence')}:{' '}
              <span className="font-bold font-mono">{(aiConfidence * 100).toFixed(0)}%</span>. Feel free to review or edit details below.
            </div>
          </div>
        )}

        {/* Title */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider font-mono">
            {t('issueTitle')}
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Broken streetlight on Elm street"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm text-gray-800 dark:text-slate-100 transition-all"
          />
        </div>

        {/* Category, Severity & Incident Date Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider font-mono">
              {t('category')}
            </label>
            <select
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm text-gray-800 dark:text-slate-100 transition-all"
            >
              <option value="">{t('category')}</option>
              <option value="Pothole">{t('pothole')}</option>
              <option value="Broken Streetlight">{t('brokenLight')}</option>
              <option value="Water Leakage">{t('waterLeak')}</option>
              <option value="Waste/Garbage">{t('garbage')}</option>
              <option value="Damaged Road">Damaged Road</option>
              <option value="Sewage Issue">Sewage Issue</option>
              <option value="Public Property Damage">Public Property Damage</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider font-mono">
              {t('severity')}
            </label>
            <select
              required
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm text-gray-800 dark:text-slate-100 transition-all"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">{t('critical')}</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider font-mono">
              {t('incidentDate')}
            </label>
            <input
              type="date"
              required
              max={new Date().toISOString().split('T')[0]}
              value={incidentDate}
              onChange={(e) => setIncidentDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm text-gray-800 dark:text-slate-100 transition-all"
            />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider font-mono">
              {t('description')}
            </label>
            {description.trim().length >= 10 && (
              <button
                type="button"
                disabled={textAnalyzing}
                onClick={() => handleAutoCategorizeText()}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 py-0.5"
              >
                {textAnalyzing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>{t('aiSuggestBtn')}</span>
                  </>
                )}
              </button>
            )}
          </div>
          <textarea
            required
            rows={3}
            placeholder={t('descriptionPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => handleAutoCategorizeText()}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm text-gray-800 dark:text-slate-100 transition-all resize-none"
          />
          {textAnalyzing && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
              {t('aiSuggesting')}
            </p>
          )}
        </div>

        {/* Suggested Department */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider font-mono">
            {t('suggestedDept')}
          </label>
          <input
            type="text"
            placeholder="e.g. Municipal Board, Public Works, Water Board"
            value={suggestedDept}
            onChange={(e) => setSuggestedDept(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm text-gray-800 dark:text-slate-100 transition-all"
          />
        </div>

        {/* Map Location Picker */}
        <div className="space-y-2 p-5 bg-gray-50 dark:bg-slate-950 border border-gray-150 dark:border-slate-800 rounded-2xl transition-colors duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-gray-150/50 dark:border-slate-800/50">
            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-600 animate-pulse" />
              {t('pinpointLocation')}
            </label>
            
            <div className="flex items-center gap-3">
              {/* Map Style Switcher */}
              <div className="inline-flex rounded-lg bg-gray-200/60 dark:bg-slate-800 p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setMapStyle('street')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    mapStyle === 'street'
                      ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
                  }`}
                >
                  Street
                </button>
                <button
                  type="button"
                  onClick={() => setMapStyle('hybrid')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    mapStyle === 'hybrid'
                      ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
                  }`}
                >
                  Hybrid
                </button>
              </div>

              {(manualLat || manualLng) && (
                <button
                  type="button"
                  onClick={() => {
                    setManualLat('');
                    setManualLng('');
                  }}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {t('resetGps')}
                </button>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
            {t('mapClickTip')}
          </p>

          <div className="h-[240px] rounded-xl overflow-hidden border border-gray-200 dark:border-slate-800 relative z-10 shadow-inner">
            <MapContainer
              center={[safeLat, safeLng]}
              zoom={15}
              className="w-full h-full"
              style={{ height: '100%', width: '100%' }}
              zoomControl={true}
            >
              {mapStyle === 'hybrid' ? (
                <>
                  <TileLayer
                    key="hybrid-satellite"
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
                  />
                  <TileLayer
                    key="hybrid-overlay"
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
                    attribution="&copy; OpenStreetMap &copy; CARTO"
                    zIndex={10}
                  />
                </>
              ) : (
                <TileLayer
                  key={theme}
                  url={theme === 'dark'
                    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"}
                  attribution={theme === 'dark'
                    ? '&copy; OpenStreetMap &copy; CARTO'
                    : '&copy; OpenStreetMap &copy; CARTO'}
                />
              )}
              <ChangeMapCenter center={[safeLat, safeLng]} />
              <MapClickHandler onClick={(latlng) => {
                setManualLat(latlng.lat.toFixed(6));
                setManualLng(latlng.lng.toFixed(6));
              }} />
              <Marker
                position={[safeLat, safeLng]}
                icon={issueIcon}
                draggable={true}
                eventHandlers={{
                  dragend: (e) => {
                    const marker = e.target;
                    const position = marker.getLatLng();
                    setManualLat(position.lat.toFixed(6));
                    setManualLng(position.lng.toFixed(6));
                  }
                }}
              />
              <RecenterToCurrentLocation
                lat={currentGeoLat}
                lng={currentGeoLng}
                onRecenter={() => {
                  setManualLat('');
                  setManualLng('');
                }}
              />
            </MapContainer>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <span className="block text-[10px] text-gray-400 dark:text-slate-500 uppercase font-bold font-mono mb-1">{t('latitude')}</span>
              <input
                type="number"
                step="any"
                required
                placeholder={currentGeoLat.toFixed(6)}
                value={manualLat || currentGeoLat.toFixed(6)}
                onChange={(e) => setManualLat(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:border-emerald-500 text-xs text-gray-800 dark:text-slate-100 font-mono shadow-xs"
              />
            </div>
            <div>
              <span className="block text-[10px] text-gray-400 dark:text-slate-500 uppercase font-bold font-mono mb-1">{t('longitude')}</span>
              <input
                type="number"
                step="any"
                required
                placeholder={currentGeoLng.toFixed(6)}
                value={manualLng || currentGeoLng.toFixed(6)}
                onChange={(e) => setManualLng(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:border-emerald-500 text-xs text-gray-800 dark:text-slate-100 font-mono shadow-xs"
              />
            </div>
          </div>

          <div className="text-[11px] text-gray-400 dark:text-slate-500 font-mono flex items-center justify-between border-t border-gray-150/50 dark:border-slate-800/60 pt-2 mt-1">
            <span className="flex items-center gap-1">
              {geo.loading ? (
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" /> {t('gpsLoading')}</span>
              ) : geo.error ? (
                <span className="text-amber-600 dark:text-amber-500 flex items-center gap-2">
                  <span>⚠️ Location unavailable</span>
                  <button
                    type="button"
                    onClick={() => geo.retry()}
                    className="px-1.5 py-0.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400 rounded-lg text-[9px] font-bold transition-colors cursor-pointer border border-amber-200/50 dark:border-amber-900/20"
                    title="Retry GPS search"
                  >
                    🔄 Retry GPS
                  </button>
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">🟢 {t('gpsLive')} ({geo.accuracy ? `accuracy: ${geo.accuracy.toFixed(1)}m` : 'resolved'})</span>
              )}
            </span>
            <span>WGS84 Datum</span>
          </div>
        </div>

        {/* Error indicator */}
        {errorMsg && (
          <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 p-3.5 rounded-xl font-medium">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-3.5 px-4 rounded-xl shadow-sm text-sm transition-all duration-200 flex items-center justify-center gap-2"
        >
          {submitting ? t('submitting') : `${t('submitReport')} 🚀`}
        </button>
      </form>
    </div>
  );
};

