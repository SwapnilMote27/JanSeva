import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useIssues } from '@/src/hooks/useIssues';
import { useGeolocation } from '@/src/hooks/useGeolocation';
import { useTheme } from '@/src/hooks/useTheme';
import { useLanguage } from '@/src/hooks/useLanguage';
import { getSeverityColor } from '@/src/utils/severityColors';
import { Plus, MapPin, Eye, ThumbsUp, Layers, CheckCircle, Compass, Globe, Sparkles, Locate, Lightbulb, ChevronRight, X, HelpCircle, RefreshCw } from 'lucide-react';
import { StreetViewViewer } from './StreetViewViewer';
import useSupercluster from 'use-supercluster';
import { useAuth } from '@/src/hooks/useAuth';
import { db, handleFirestoreError, OperationType } from '@/src/services/firebase';
import { doc, updateDoc, arrayUnion, increment } from 'firebase/firestore';

const CIVIC_TIPS = [
  {
    title: "Take Wide-Angle Photos 📸",
    text: "Photos showing clear surrounding landmarks help administrative teams locate and verify reported issues twice as fast.",
    impact: "+40% faster triage"
  },
  {
    title: "Rally Neighbor Upvotes 🗳️",
    text: "Issues with 5 or more upvotes automatically trigger high-priority alerts in administrative portals. Share your report!",
    impact: "Priority escalation"
  },
  {
    title: "Accurate Marker Coordinates 📍",
    text: "Zoom in fully before placing your pin. Accurate coordinate placement prevents inspectors from searching the wrong street.",
    impact: "Zero locator errors"
  },
  {
    title: "Be Highly Descriptive 📝",
    text: "Instead of 'broken lamp', write 'Streetlight pole #42 outside building 12B is flickering'. Specificity helps inspectors prepare tools.",
    impact: "First-visit resolution"
  },
  {
    title: "Search for Duplicates First 🔍",
    text: "Browse nearby map pins before reporting. Upvoting an existing active report aggregates community priority faster.",
    impact: "Saves community effort"
  },
  {
    title: "Select Correct Category 🏷️",
    text: "Tagging the issue correctly (e.g. 'Water Leakage' vs 'Pothole') routes it instantly to the right public service department.",
    impact: "Instant department routing"
  }
];

interface RecenterMapControlProps {
  map: L.Map | null;
  lat: number | null;
  lng: number | null;
}

const RecenterMapControl: React.FC<RecenterMapControlProps> = ({ map, lat, lng }) => {
  const handleRecenter = () => {
    if (map && lat !== null && lng !== null) {
      map.flyTo([lat, lng], 15, {
        animate: true,
        duration: 1.2
      });
    }
  };

  if (lat === null || lng === null) return null;

  return (
    <div className="absolute bottom-24 right-6 z-[999] flex items-center group pointer-events-none">
      <span className="mr-2 px-2.5 py-1.5 bg-slate-900/90 dark:bg-slate-800/90 text-white dark:text-slate-200 text-[11px] font-bold rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
        Go to current location
      </span>
      <button
        onClick={handleRecenter}
        className="bg-white dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 w-12 h-12 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center pointer-events-auto"
        title="Go to current location"
      >
        <Locate className="w-6 h-6 animate-pulse" />
      </button>
    </div>
  );
};

const MapInstanceSetter: React.FC<{ setMap: (map: L.Map) => void }> = ({ setMap }) => {
  const map = useMap();
  React.useEffect(() => {
    if (map) {
      setMap(map);
    }
  }, [map, setMap]);
  return null;
};

interface HeatmapLayerProps {
  points: [number, number, number][];
}

const HeatmapLayer: React.FC<HeatmapLayerProps> = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    let heatLayerInstance: any = null;
    let isActive = true;

    const initHeatmap = async () => {
      try {
        (window as any).L = L;
        await import('leaflet.heat');
        
        if (!isActive) return;

        const LAny = L as any;
        if (LAny.heatLayer) {
          heatLayerInstance = LAny.heatLayer(points, {
            radius: 35,
            blur: 20,
            maxZoom: 15,
            max: 1.0,
            gradient: {
              0.4: 'rgba(59, 130, 246, 0.75)',
              0.6: 'rgba(45, 212, 191, 0.8)',
              0.7: 'rgba(16, 185, 129, 0.85)',
              0.8: 'rgba(245, 158, 11, 0.9)',
              1.0: 'rgba(239, 68, 68, 1)'
            }
          });
          heatLayerInstance.addTo(map);
        }
      } catch (err) {
        console.error('Failed to initialize Leaflet heat layer:', err);
      }
    };

    initHeatmap();

    return () => {
      isActive = false;
      if (heatLayerInstance && map) {
        map.removeLayer(heatLayerInstance);
      }
    };
  }, [map, points]);

  return null;
};

export const MapDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { issues, loading } = useIssues();
  const geo = useGeolocation();
  const { theme } = useTheme();
  const { t } = useLanguage();

  const defaultLat = 20.5937;
  const defaultLng = 78.9629;
  const safeLat = (geo && typeof geo.lat === 'number' && !isNaN(geo.lat)) ? geo.lat : defaultLat;
  const safeLng = (geo && typeof geo.lng === 'number' && !isNaN(geo.lng)) ? geo.lng : defaultLng;

  const [upvotingIds, setUpvotingIds] = useState<string[]>([]);

  const handleUpvote = async (issueId: string) => {
    if (!user) return;
    if (upvotingIds.includes(issueId)) return;
    try {
      setUpvotingIds((prev) => [...prev, issueId]);
      const issueRef = doc(db, 'issues', issueId);
      
      // 1. Upvote the issue in firestore
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
      handleFirestoreError(error, OperationType.UPDATE, `issues/${issueId}`);
    } finally {
      setUpvotingIds((prev) => prev.filter((id) => id !== issueId));
    }
  };

  const focusState = location.state as { focusIssueId?: string; lat?: number; lng?: number } | null;

  // Keep track of marker elements
  const markerRefs = useRef<{ [key: string]: L.Marker | null }>({});

  // Filter conditions: 'All', 'Pothole', 'Water Leakage', 'Broken Streetlight', 'Waste/Garbage', 'Critical', 'Resolved'
  const [activeFilter, setActiveFilter] = useState('All');
  
  // Map geographical style state
  const [mapStyle, setMapStyle] = useState<'street' | 'satellite' | 'hybrid' | 'terrain'>('street');
  
  // Selected Street View coordinates
  const [selectedStreetView, setSelectedStreetView] = useState<{ lat: number; lng: number; title: string } | null>(null);

  // Heatmap layer visibility state
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Leaflet map instance state
  const [map, setMap] = useState<L.Map | null>(null);

  // Leaflet map bounds and zoom states for Supercluster
  const [bounds, setBounds] = useState<[number, number, number, number] | null>(null);
  const [zoom, setZoom] = useState<number>(13);

  // Civic Tip of the Day states
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [showTipCard, setShowTipCard] = useState(true);

  // Update bounds & zoom from map instance
  const updateMapBoundsAndZoom = React.useCallback(() => {
    if (!map) return;
    const b = map.getBounds();
    const z = map.getZoom();
    setBounds([
      b.getWest(),
      b.getSouth(),
      b.getEast(),
      b.getNorth()
    ]);
    setZoom(z);
  }, [map]);

  React.useEffect(() => {
    if (!map) return;
    
    // Set initial bounds and zoom
    updateMapBoundsAndZoom();

    // Attach map listeners
    map.on('moveend', updateMapBoundsAndZoom);
    map.on('zoomend', updateMapBoundsAndZoom);

    return () => {
      map.off('moveend', updateMapBoundsAndZoom);
      map.off('zoomend', updateMapBoundsAndZoom);
    };
  }, [map, updateMapBoundsAndZoom]);

  // Effect to automatically fly to a focused issue and open its popup
  React.useEffect(() => {
    if (map && focusState && focusState.lat !== undefined && focusState.lng !== undefined) {
      const targetLat = focusState.lat;
      const targetLng = focusState.lng;
      const issueId = focusState.focusIssueId;

      // Animate/fly to the location on the map
      map.flyTo([targetLat, targetLng], 16, {
        animate: true,
        duration: 1.5
      });

      // Clear the router state so we don't refly on page navigation or reload
      navigate('.', { replace: true, state: null });

      // After flying, open the popup
      const timer = setTimeout(() => {
        if (issueId) {
          const marker = markerRefs.current[issueId];
          if (marker) {
            marker.openPopup();
          }
        }
      }, 1600); // Wait 1.6s (slightly after duration finishes)

      return () => clearTimeout(timer);
    }
  }, [map, focusState, navigate]);

  // Flag to ensure we only auto-center on GPS once during initial map load
  const hasCenteredOnGPS = useRef(false);

  // Auto-center/fly to user's current GPS location on initial load
  React.useEffect(() => {
    if (!map) return;

    // If there is a focusState (requested specific issue), mark GPS as centered so we don't conflict
    if (focusState && focusState.lat !== undefined && focusState.lng !== undefined) {
      hasCenteredOnGPS.current = true;
      return;
    }

    if (!geo.loading && !geo.error && !hasCenteredOnGPS.current) {
      hasCenteredOnGPS.current = true;
      map.flyTo([safeLat, safeLng], 14, {
        animate: true,
        duration: 1.5
      });
    }
  }, [map, geo.loading, geo.error, safeLat, safeLng, focusState]);

  const handleSimulateGPS = (lat: number, lng: number) => {
    geo.simulate(lat, lng);
    if (map) {
      map.flyTo([lat, lng], 14, {
        animate: true,
        duration: 1.5
      });
    }
  };

  // Emoji marker helper
  const getMarkerIcon = (severity: string, status: string) => {
    let emoji = '🟢';
    if (status === 'Resolved') {
      emoji = '✅';
    } else if (severity === 'Critical') {
      emoji = '🔴';
    } else if (severity === 'High') {
      emoji = '🟠';
    } else if (severity === 'Medium') {
      emoji = '🟡';
    }
    return L.divIcon({
      html: `<div style="font-size: 30px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));">${emoji}</div>`,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  };

  // Blue dot current location icon helper
  const getBlueDotIcon = () => {
    return L.divIcon({
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px;">
          <div style="position: absolute; width: 24px; height: 24px; background-color: #3b82f6; border-radius: 9999px; opacity: 0.4; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: relative; width: 14px; height: 14px; background-color: #2563eb; border-radius: 9999px; border: 2px solid #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>
        </div>
      `,
      className: '',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  // Filter Logic
  const filteredIssues = issues.filter((issue) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Critical') return issue.severity === 'Critical' && issue.status !== 'Resolved';
    if (activeFilter === 'Resolved') return issue.status === 'Resolved';
    if (activeFilter === 'Others') {
      const mainCategories = ['Pothole', 'Water Leakage', 'Broken Streetlight', 'Waste/Garbage'];
      return !mainCategories.includes(issue.category);
    }
    return issue.category === activeFilter;
  });

  // Map filtered issues into GeoJSON Features for Supercluster
  const points = filteredIssues.map((issue) => ({
    type: 'Feature' as const,
    properties: {
      cluster: false,
      issueId: issue.id,
      category: issue.category,
      severity: issue.severity,
      status: issue.status,
      title: issue.title,
      description: issue.description,
      incidentDate: issue.incidentDate,
      reportedAt: issue.reportedAt,
      upvotes: issue.upvotes,
      issue: issue,
    },
    geometry: {
      type: 'Point' as const,
      coordinates: [issue.location.lng, issue.location.lat],
    },
  }));

  // Convert filtered issues to multi-dimensional weighted heatmap coordinates [lat, lng, intensity]
  const heatmapPoints = filteredIssues.map((issue) => {
    let intensity = 0.5;
    if (issue.severity === 'Critical') intensity = 1.0;
    else if (issue.severity === 'High') intensity = 0.8;
    else if (issue.severity === 'Medium') intensity = 0.5;
    else if (issue.severity === 'Low') intensity = 0.2;

    // Apply a subtle boost to intensity for highly upvoted issues to represent community traction/concern
    if (issue.upvotes > 0) {
      intensity = Math.min(1.0, intensity + (issue.upvotes * 0.05));
    }

    return [issue.location.lat, issue.location.lng, intensity] as [number, number, number];
  });

  // Get clusters
  const { clusters, supercluster } = useSupercluster({
    points,
    bounds: bounds || undefined,
    zoom,
    options: { radius: 60, maxZoom: 17 },
  });

  // Cluster click/expansion handler
  const handleClusterClick = (clusterId: number, lat: number, lng: number) => {
    if (!map || !supercluster) return;
    const expansionZoom = Math.min(
      supercluster.getClusterExpansionZoom(clusterId),
      18
    );
    map.setView([lat, lng], expansionZoom, {
      animate: true,
      duration: 1.0,
    });
  };

  // Custom styling for Cluster icons
  const createClusterIcon = (count: number) => {
    const size = count < 10 ? 36 : count < 50 ? 44 : 52;
    return L.divIcon({
      html: `
        <div class="relative flex items-center justify-center bg-gradient-to-tr from-emerald-600 to-teal-500 text-white rounded-full font-extrabold shadow-lg border-2 border-white dark:border-slate-800 transition-all cursor-pointer hover:scale-105" style="width: ${size}px; height: ${size}px; font-size: ${size * 0.35}px;">
          <span>${count}</span>
          <span class="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500"></span>
          </span>
        </div>
      `,
      className: '',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };

  // Calculate statistics
  const totalCount = issues.length;
  const openCount = issues.filter((i) => i.status !== 'Resolved').length;
  const resolvedCount = issues.filter((i) => i.status === 'Resolved').length;

  // Geographical style tile definitions
  const tileLayers = {
    street: {
      url: theme === 'dark' 
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      attribution: theme === 'dark'
        ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    },
    satellite: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    },
    hybrid: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      overlayUrl: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png",
      attribution: 'Tiles &copy; Esri, i-cubed, USDA, USGS &mdash; Labels &copy; OpenStreetMap, CARTO'
    },
    terrain: {
      url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="http://viewfinderpanoramas.org">SRTM</a> | Style: &copy; OpenTopoMap'
    }
  };

  return (
    <div id="map-dashboard-container" className="relative flex flex-col h-[calc(100vh-64px)] w-full font-sans transition-colors duration-200">
      
      {/* Top Controls / Filter Bar / Stats Bar */}
      <div className="absolute top-4 left-4 right-4 z-[999] flex flex-col lg:flex-row gap-3 pointer-events-none">
        
        {/* Filters Panel */}
        <div className="flex-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-800 flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-none pointer-events-auto transition-colors duration-200">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mr-2 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> {t('filter')}:
          </span>
          {[
            { id: 'All', label: t('allIssues') },
            { id: 'Pothole', label: `${t('pothole')} 🕳️` },
            { id: 'Water Leakage', label: `${t('waterLeak')} 💧` },
            { id: 'Broken Streetlight', label: `${t('brokenLight')} 💡` },
            { id: 'Waste/Garbage', label: `${t('garbage')} 🗑️` },
            { id: 'Others', label: `${t('others')} 🌐` },
            { id: 'Critical', label: `${t('critical')} 🔴` },
            { id: 'Resolved', label: `${t('resolved')} ✅` }
          ].map((filt) => (
            <button
              key={filt.id}
              onClick={() => setActiveFilter(filt.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                activeFilter === filt.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 border border-gray-100 dark:border-slate-700'
              }`}
            >
              {filt.label}
            </button>
          ))}
        </div>

        {/* Stats Panel */}
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-800 flex items-center justify-around gap-6 lg:min-w-[300px] pointer-events-auto transition-colors duration-200">
          <div className="text-center">
            <p className="text-[10px] uppercase font-mono font-bold tracking-wider text-gray-400 dark:text-slate-500">{t('totalReported')}</p>
            <p className="text-lg font-bold text-gray-800 dark:text-white">{totalCount}</p>
          </div>
          <div className="h-6 w-[1px] bg-gray-200 dark:bg-slate-800"></div>
          <div className="text-center">
            <p className="text-[10px] uppercase font-mono font-bold tracking-wider text-gray-400 dark:text-slate-500">{t('open')}</p>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-500">{openCount}</p>
          </div>
          <div className="h-6 w-[1px] bg-gray-200 dark:bg-slate-800"></div>
          <div className="text-center">
            <p className="text-[10px] uppercase font-mono font-bold tracking-wider text-gray-400 dark:text-slate-500">{t('resolved')}</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{resolvedCount}</p>
          </div>
        </div>

      </div>

      {/* Main Map Leaflet Container with optional Street View side-by-side */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 space-y-3 transition-colors duration-200">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">Loading citizen reports onto map...</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row w-full h-full relative overflow-hidden">
          
          {/* Left / Main Map Section */}
          <div className="flex-1 h-full relative z-10">
            <MapContainer
              center={[safeLat, safeLng]}
              zoom={13}
              className="w-full h-full"
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
            >
              {/* Dynamic Tile Layer based on active mapStyle & current theme */}
              {mapStyle === 'hybrid' ? (
                <>
                  <TileLayer
                    key="hybrid-satellite"
                    url={tileLayers.hybrid.url}
                    attribution={tileLayers.hybrid.attribution}
                  />
                  <TileLayer
                    key="hybrid-overlay"
                    url={tileLayers.hybrid.overlayUrl}
                    attribution=""
                    zIndex={10}
                  />
                </>
              ) : (
                <TileLayer
                  key={`${mapStyle}-${theme}`}
                  url={tileLayers[mapStyle].url}
                  attribution={tileLayers[mapStyle].attribution}
                />
              )}

              <MapInstanceSetter setMap={setMap} />

              {/* Render Heatmap Layer if enabled */}
              {showHeatmap && <HeatmapLayer points={heatmapPoints} />}

              {/* Current Location Blue Dot */}
              {!geo.loading && !geo.error && typeof geo.lat === 'number' && typeof geo.lng === 'number' && (
                <Marker
                  position={[geo.lat, geo.lng]}
                  icon={getBlueDotIcon()}
                >
                  <Popup>
                    <div className="p-1.5 font-sans text-center text-xs dark:text-slate-200">
                      <p className="font-extrabold text-blue-600 dark:text-blue-400">📍 You are here</p>
                      <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">Your detected current location</p>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Render markers / clusters only if Heatmap is not active */}
              {!showHeatmap && clusters.map((cluster) => {
                const [longitude, latitude] = cluster.geometry.coordinates;
                const { cluster: isCluster, point_count: pointCount } = cluster.properties;

                if (isCluster) {
                  return (
                    <Marker
                      key={`cluster-${cluster.id}`}
                      position={[latitude, longitude]}
                      icon={createClusterIcon(pointCount)}
                      eventHandlers={{
                        click: () => handleClusterClick(cluster.id!, latitude, longitude)
                      }}
                    />
                  );
                }

                const issue = cluster.properties.issue;
                return (
                  <Marker
                    key={`issue-${issue.id}`}
                    position={[issue.location.lat, issue.location.lng]}
                    icon={getMarkerIcon(issue.severity, issue.status)}
                    ref={(el) => {
                      markerRefs.current[issue.id] = el;
                    }}
                  >
                    <Popup className="custom-popup">
                      <div className="p-1 font-sans min-w-[210px] text-gray-800 dark:text-slate-200">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold font-mono uppercase bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 px-2 py-0.5 rounded">
                            {issue.category}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm border ${getSeverityColor(issue.severity).border} ${getSeverityColor(issue.severity).text}`}
                          >
                            {issue.severity}
                          </span>
                        </div>

                        <h4 className="font-bold text-sm text-gray-900 dark:text-white mb-1 line-clamp-1">{issue.title}</h4>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mb-1 line-clamp-2">{issue.description}</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 font-mono mb-3">
                          📅 Spotted: {issue.incidentDate ? new Date(issue.incidentDate).toLocaleDateString() : (issue.reportedAt?.toDate ? new Date(issue.reportedAt.toDate()).toLocaleDateString() : 'Recent')}
                        </p>

                        <div className="flex items-center justify-between text-xs border-t border-gray-100 dark:border-slate-800 pt-2 text-gray-500 dark:text-slate-400 mb-2">
                          <span className="flex items-center gap-1">
                            <ThumbsUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            {issue.upvotes} Upvotes
                          </span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {issue.status}
                          </span>
                        </div>

                        <button
                          disabled={!user || (issue.upvotedBy || []).includes(user.uid) || issue.status === 'Resolved'}
                          onClick={() => handleUpvote(issue.id)}
                          className={`w-full py-1.5 px-2 text-[10.5px] font-bold rounded-lg mb-2.5 flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm border ${
                            user && (issue.upvotedBy || []).includes(user.uid)
                              ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50'
                              : !user
                              ? 'bg-gray-100 dark:bg-slate-800/80 text-gray-400 dark:text-slate-500 border-transparent cursor-not-allowed'
                              : issue.status === 'Resolved'
                              ? 'bg-gray-50 dark:bg-slate-800/30 text-gray-400 dark:text-slate-600 border-transparent cursor-not-allowed'
                              : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 dark:hover:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50'
                          }`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span>
                            {user && (issue.upvotedBy || []).includes(user.uid) 
                              ? 'Upvoted! ✓' 
                              : !user 
                              ? 'Sign in to Upvote' 
                              : 'Me too! (+2 XP)'}
                          </span>
                        </button>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setSelectedStreetView({
                              lat: issue.location.lat,
                              lng: issue.location.lng,
                              title: issue.title
                            })}
                            className="bg-slate-900 dark:bg-slate-850 hover:bg-slate-800 dark:hover:bg-slate-750 text-white font-bold text-[11px] py-2 px-2.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-sm"
                          >
                            <Compass className="w-3 h-3 text-emerald-400" />
                            Street View
                          </button>
                          <button
                            onClick={() => navigate(`/issues/${issue.id}`)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] py-2 px-2.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-sm"
                          >
                            <Eye className="w-3 h-3" />
                            Details
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>

            {/* Heatmap Legend Overlay */}
            {showHeatmap && (
              <div className="absolute top-24 left-4 z-[999] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 max-w-xs transition-all animate-[slideIn_0.2s_ease-out]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></div>
                  <h5 className="text-[11px] font-extrabold text-gray-800 dark:text-white uppercase tracking-wider font-mono">
                    Hotspot Density Legend
                  </h5>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-slate-400 mb-2.5 leading-relaxed">
                  Visualizes civic report density weighted by priority/severity & community interest.
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-gray-500 dark:text-slate-400 font-medium">Extreme Density (Critical)</span>
                    <span className="w-16 h-2 rounded-full bg-gradient-to-r from-amber-500 to-red-600"></span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-gray-500 dark:text-slate-400 font-medium">Moderate Priority (Medium)</span>
                    <span className="w-16 h-2 rounded-full bg-gradient-to-r from-teal-400 to-emerald-500"></span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-gray-500 dark:text-slate-400 font-medium">Low Density / Resolved</span>
                    <span className="w-16 h-2 rounded-full bg-gradient-to-r from-blue-500 to-teal-400"></span>
                  </div>
                </div>
              </div>
            )}

            {/* GPS status and retry bar on the left */}
            <div className={`absolute left-4 z-[999] pointer-events-auto transition-all duration-300 ${showHeatmap ? 'top-[260px]' : 'top-24'}`}>
              <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800/80 max-w-[320px] flex flex-col gap-2">
                
                {/* Status Indicator Row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {geo.loading ? (
                      <div className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                      </div>
                    ) : geo.error ? (
                      <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    ) : (
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                    
                    <span className="text-[11px] font-bold tracking-tight uppercase font-mono text-gray-700 dark:text-slate-300">
                      {geo.loading ? 'Pinpointing GPS...' : geo.error ? 'GPS Restricted' : 'GPS Active'}
                    </span>
                  </div>

                  {!geo.loading && (
                    <button
                      onClick={() => geo.retry()}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                      title="Retry GPS detection"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Subtext description */}
                <p className="text-[10px] text-gray-500 dark:text-slate-400 leading-snug">
                  {geo.loading ? (
                    'Searching satellite signal to find your local municipal zone...'
                  ) : geo.error ? (
                    'Iframe permissions or device GPS disabled. Simulate a test location below to experience full platform features:'
                  ) : (
                    `Currently centered on coordinates with ${geo.accuracy ? `${geo.accuracy.toFixed(0)}m` : 'resolved'} accuracy.`
                  )}
                </p>

                {/* Simulation controls & Quick Preset buttons */}
                {(geo.loading || geo.error) ? (
                  <div className="pt-1.5 border-t border-gray-100 dark:border-slate-800/80 mt-1 flex flex-col gap-1.5">
                    <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-mono">
                      ✨ Select Simulated City:
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => handleSimulateGPS(19.0760, 72.8777)}
                        className="px-2 py-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-gray-100 dark:border-slate-700 rounded-lg text-[10px] font-bold text-left transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span>📍 Mumbai</span>
                      </button>
                      <button
                        onClick={() => handleSimulateGPS(28.7041, 77.1025)}
                        className="px-2 py-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-gray-100 dark:border-slate-700 rounded-lg text-[10px] font-bold text-left transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span>📍 Delhi</span>
                      </button>
                      <button
                        onClick={() => handleSimulateGPS(12.9716, 77.5946)}
                        className="px-2 py-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-gray-100 dark:border-slate-700 rounded-lg text-[10px] font-bold text-left transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span>📍 Bengaluru</span>
                      </button>
                      <button
                        onClick={() => handleSimulateGPS(18.5204, 73.8567)}
                        className="px-2 py-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-gray-100 dark:border-slate-700 rounded-lg text-[10px] font-bold text-left transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span>📍 Pune</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-1.5 border-t border-gray-100 dark:border-slate-800/80 mt-1 flex items-center justify-between gap-2">
                    <button
                      onClick={() => geo.retry()}
                      className="text-left text-[9px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      🔄 Refresh Real GPS
                    </button>
                    <span className="text-[8px] text-gray-400 dark:text-slate-500 font-mono">
                      Lat: {safeLat.toFixed(4)}, Lng: {safeLng.toFixed(4)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Civic Tip of the Day Overlay (Top Right) */}
            <div className="absolute top-24 right-4 z-[999] pointer-events-auto transition-all duration-300">
              {showTipCard ? (
                <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-3.5 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 max-w-[280px] animate-[slideIn_0.2s_ease-out] relative">
                  <button
                    onClick={() => setShowTipCard(false)}
                    className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 cursor-pointer p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                    title="Minimize"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl">
                      <Lightbulb className="w-4 h-4 text-amber-500 animate-pulse" />
                    </div>
                    <div>
                      <h5 className="text-[10px] font-extrabold text-gray-800 dark:text-white uppercase tracking-wider font-mono">
                        Civic Tip of the Day
                      </h5>
                      <p className="text-[9px] text-gray-400 dark:text-slate-500 font-mono">Maximize report impact ⚡</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 mt-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug">
                        {CIVIC_TIPS[currentTipIndex].title}
                      </span>
                    </div>
                    
                    <p className="text-[10.5px] text-gray-500 dark:text-slate-400 leading-relaxed font-sans">
                      {CIVIC_TIPS[currentTipIndex].text}
                    </p>

                    <div className="pt-0.5">
                      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/20 shrink-0 whitespace-nowrap">
                        🎯 Impact: {CIVIC_TIPS[currentTipIndex].impact}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-gray-100 dark:border-slate-800/80 mt-2.5 pt-2.5">
                    <span className="text-[9px] text-gray-400 dark:text-slate-500 font-mono">
                      Tip {currentTipIndex + 1} of {CIVIC_TIPS.length}
                    </span>
                    <button
                      onClick={() => setCurrentTipIndex((prev) => (prev + 1) % CIVIC_TIPS.length)}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold flex items-center gap-0.5 cursor-pointer transition-colors"
                    >
                      <span>Next Tip</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowTipCard(true)}
                  className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-2.5 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 flex items-center justify-center gap-2 group hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  title="Expand Civic Tip of the Day"
                >
                  <div className="relative">
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    <span className="absolute -top-1 -right-1 flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                  </div>
                  <span className="text-[10px] font-extrabold text-gray-700 dark:text-slate-300 font-mono uppercase tracking-wider max-w-0 overflow-hidden group-hover:max-w-[120px] transition-all duration-300 ease-out whitespace-nowrap">
                    Civic Tip
                  </span>
                </button>
              )}
            </div>

            {/* Floating Unified Map Controls (Bottom Left) */}
            <div className="absolute bottom-6 left-6 z-[999] flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pointer-events-auto">
              {/* Map Style Controller */}
              <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-1.5 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 flex items-center gap-1 transition-colors duration-200">
                {[
                  { id: 'street' as const, label: 'Street 🗺️', icon: Layers },
                  { id: 'hybrid' as const, label: 'Hybrid 🛰️🗺️', icon: Sparkles },
                  { id: 'satellite' as const, label: 'Satellite 🛰️', icon: Globe },
                  { id: 'terrain' as const, label: 'Terrain 🏔️', icon: Compass }
                ].map((style) => {
                  const IconComponent = style.icon;
                  const isSelected = mapStyle === style.id;
                  return (
                    <button
                      key={style.id}
                      onClick={() => setMapStyle(style.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm'
                          : 'bg-transparent text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <IconComponent className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-400 dark:text-emerald-600' : 'text-gray-400'}`} />
                      <span className="hidden sm:inline">{style.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Heatmap Toggle Button */}
              <button
                onClick={() => setShowHeatmap(!showHeatmap)}
                className={`px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-xl border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                  showHeatmap
                    ? 'bg-gradient-to-r from-red-500 to-amber-500 hover:from-red-600 hover:to-amber-600 text-white border-transparent'
                    : 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-gray-700 dark:text-slate-300 border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
              >
                <Sparkles className={`w-4 h-4 ${showHeatmap ? 'animate-pulse text-white' : 'text-amber-500'}`} />
                <span>{showHeatmap ? 'Heatmap Mode Active 🔥' : 'Show Heatmap hotspots 📈'}</span>
              </button>
            </div>

            {/* Empty state overlay on map if filtered count is 0 */}
            {filteredIssues.length === 0 && (
              <div className="absolute inset-0 bg-black/10 dark:bg-black/40 backdrop-blur-[1px] pointer-events-none z-20 flex items-center justify-center">
                <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-6 py-4 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 max-w-sm text-center pointer-events-auto transition-colors duration-200">
                  <span className="text-2xl">🏙️</span>
                  <p className="text-sm font-semibold text-gray-800 dark:text-slate-200 mt-2">No issues reported in this filter category yet.</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Be the first to create a civic report for your neighborhood!</p>
                </div>
              </div>
            )}

            {/* Floating Action Button (FAB) bottom right - only visible when street view is not taking screen */}
            {!selectedStreetView && (
              <>
                <RecenterMapControl map={map} lat={safeLat} lng={safeLng} />
                <div className="absolute bottom-6 right-6 z-[999] flex items-center group pointer-events-none">
                  <span className="mr-2 px-2.5 py-1.5 bg-slate-900/90 dark:bg-slate-800/90 text-white dark:text-slate-200 text-[11px] font-bold rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                    Report Civic Issue
                  </span>
                  <button
                    onClick={() => navigate('/report')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white w-12 h-12 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center pointer-events-auto"
                    title="Report Issue"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Right Side Immersive Street View Container */}
          {selectedStreetView && (
            <div className="w-full md:w-[460px] lg:w-[500px] h-[360px] md:h-full bg-slate-950 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col shrink-0 relative z-20 animate-[slideLeft_0.2s_ease-out]">
              <div className="flex-1 p-4 md:p-6 flex flex-col justify-center bg-slate-950 overflow-y-auto">
                <div className="mb-4 text-left">
                  <span className="text-[10px] bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-bold font-mono">
                    📍 COMMUNITY STREET VIEW
                  </span>
                  <h2 className="text-lg font-extrabold text-white mt-2 leading-snug truncate">
                    {selectedStreetView.title}
                  </h2>
                </div>

                <div className="flex-1">
                  <StreetViewViewer
                    lat={selectedStreetView.lat}
                    lng={selectedStreetView.lng}
                    title={selectedStreetView.title}
                    onClose={() => setSelectedStreetView(null)}
                  />
                </div>

                <div className="mt-4 p-3.5 bg-slate-900 border border-slate-800/80 rounded-xl text-left space-y-1">
                  <p className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" /> Virtual Site Inspection
                  </p>
                  <p className="text-[10.5px] text-slate-400 leading-relaxed">
                    Inspect the surrounding environment to verify details, search for landmarks, or validate reported civic blockages directly from your screen.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

