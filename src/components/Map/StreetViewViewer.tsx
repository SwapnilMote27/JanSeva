import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Globe, Loader2, HelpCircle, Key, ExternalLink } from 'lucide-react';

declare global {
  interface Window {
    google?: any;
  }
}

interface StreetViewViewerProps {
  lat: number;
  lng: number;
  title?: string;
  onClose?: () => void;
}

export const StreetViewViewer: React.FC<StreetViewViewerProps> = ({ lat, lng, title, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [panoAvailable, setPanoAvailable] = useState<boolean | null>(null);

  const API_KEY =
    process.env.GOOGLE_MAPS_PLATFORM_KEY ||
    (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
    (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
    '';

  const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY' && API_KEY.trim() !== '';

  useEffect(() => {
    if (!hasValidKey || !lat || !lng || !containerRef.current) {
      return;
    }

    setLoadState('loading');
    setPanoAvailable(null);

    // Helper to initialize the panorama
    const initPanorama = () => {
      try {
        if (!window.google || !window.google.maps) {
          setLoadState('error');
          return;
        }

        // Verify if Street View is available for this location first
        const svService = new window.google.maps.StreetViewService();
        svService.getPanorama(
          { location: { lat, lng }, radius: 100 },
          (data, status) => {
            if (status === window.google.maps.StreetViewStatus.OK && data && data.location) {
              setPanoAvailable(true);
              
              // Render the interactive panorama
              if (containerRef.current) {
                new window.google.maps.StreetViewPanorama(containerRef.current, {
                  position: { lat, lng },
                  pov: { heading: 165, pitch: 0 },
                  zoom: 1,
                  visible: true,
                  addressControl: true,
                  linksControl: true,
                  panControl: true,
                  enableCloseButton: false,
                  motionTracking: false,
                  motionTrackingControl: false,
                });
                setLoadState('success');
              }
            } else {
              console.warn('No Street View panorama found within 100 meters of this location.');
              setPanoAvailable(false);
              setLoadState('success'); // Still success, but we will display a fallback notice
            }
          }
        );
      } catch (err) {
        console.error('Error initializing Street View:', err);
        setLoadState('error');
      }
    };

    // Check if script is already loaded
    if (window.google && window.google.maps) {
      initPanorama();
      return;
    }

    // Load Google Maps Script
    const scriptId = 'google-maps-streetview-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=streetView`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const handleScriptLoad = () => {
      initPanorama();
    };

    script.addEventListener('load', handleScriptLoad);

    return () => {
      script.removeEventListener('load', handleScriptLoad);
    };
  }, [hasValidKey, lat, lng]);

  const externalStreetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;

  return (
    <div className="flex flex-col bg-slate-900 text-white rounded-2xl overflow-hidden shadow-2xl border border-slate-800 w-full h-[380px] min-h-[300px]">
      {/* Top Header */}
      <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-300">
            {title ? `Street View: ${title}` : 'Neighborhood Street View'}
          </h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg hover:bg-slate-800 transition-colors font-semibold"
          >
            Close
          </button>
        )}
      </div>

      {/* Main Container View */}
      <div className="flex-1 relative bg-slate-950 flex flex-col items-center justify-center">
        {hasValidKey ? (
          <>
            {loadState === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-10 space-y-3">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                <p className="text-xs font-mono text-slate-400">Loading live street-level panorama...</p>
              </div>
            )}

            {loadState === 'error' && (
              <div className="p-6 text-center space-y-4 max-w-sm">
                <div className="text-3xl">⚠️</div>
                <h4 className="font-bold text-sm text-red-400">Failed to load Google Maps</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The Google Maps API script failed to initialize. Please check your API key and restriction settings.
                </p>
                <a
                  href={externalStreetViewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-xs px-3.5 py-2 rounded-xl transition-all font-semibold border border-slate-700"
                >
                  <Globe className="w-3.5 h-3.5" /> View on Google Web Maps <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Actual Google Maps Element */}
            <div
              ref={containerRef}
              className={`w-full h-full transition-opacity duration-300 ${
                loadState === 'success' && panoAvailable !== false ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
              }`}
            />

            {/* Pano Not Available Fallback */}
            {loadState === 'success' && panoAvailable === false && (
              <div className="p-6 text-center space-y-4 max-w-sm">
                <div className="text-4xl">🚗💨</div>
                <h4 className="font-bold text-sm text-amber-400">Limited Coverage Area</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  No close-up Google Street View panorama exists at these exact coordinates yet.
                </p>
                <div className="space-y-2">
                  <a
                    href={externalStreetViewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs px-4 py-2.5 rounded-xl transition-all font-bold"
                  >
                    <Globe className="w-4 h-4" /> Open Search on Google Maps <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <p className="text-[10px] text-slate-500">
                    Location: {lat.toFixed(5)}, {lng.toFixed(5)}
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Simulated Preview Card & Activation Guide (no key entered) */
          <div className="p-6 text-center w-full max-w-md flex flex-col items-center justify-center space-y-4">
            
            {/* Mock Viewport */}
            <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-left relative overflow-hidden group">
              {/* Decorative grid */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
              
              <div className="flex items-center justify-between mb-3 relative z-10">
                <div className="flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-sm border border-slate-800 px-2 py-1 rounded text-[10px] font-mono text-emerald-400">
                  <MapPin className="w-3 h-3 text-emerald-500" /> Lat: {lat.toFixed(5)}, Lng: {lng.toFixed(5)}
                </div>
                <span className="text-[10px] uppercase font-bold tracking-widest font-mono text-slate-500">MOCKUP VIEW</span>
              </div>

              <p className="text-xs text-slate-300 font-medium leading-relaxed mb-3">
                Interactive 3D Street View visualizes issue reports right at street-level to assist municipal inspectors.
              </p>

              {/* Action Fallbacks */}
              <div className="flex flex-col sm:flex-row gap-2 relative z-10">
                <a
                  href={externalStreetViewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md"
                >
                  <Globe className="w-3.5 h-3.5" /> Open Street View <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Instruction Panel */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-left w-full space-y-2.5">
              <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Key className="w-4 h-4 text-amber-500 shrink-0" /> Unlock Direct 3D Panoramas inside App:
              </p>
              <ol className="text-[10.5px] text-slate-400 space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>
                  Get a key:{' '}
                  <a
                    href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:underline inline-flex items-center gap-0.5"
                  >
                    Google Cloud Console <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </li>
                <li>
                  Open <strong>Settings</strong> (⚙️ top-right) → <strong>Secrets</strong>
                </li>
                <li>
                  Add secret named <code className="bg-slate-900 border border-slate-800 text-amber-400 px-1 py-0.5 rounded font-mono">GOOGLE_MAPS_PLATFORM_KEY</code>
                </li>
              </ol>
            </div>

          </div>
        )}
      </div>

      {/* Footer Info Bar */}
      <div className="bg-slate-950 px-4 py-2 border-t border-slate-850 flex items-center justify-between text-[10px] text-slate-500 font-mono">
        <span>Google Maps Street View API</span>
        <span>WGS84 Coordinates</span>
      </div>
    </div>
  );
};
