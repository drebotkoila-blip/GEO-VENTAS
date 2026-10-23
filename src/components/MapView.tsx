import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { SalesRep, Client, Visit, Coordinates } from '../types';
import { calculateDistanceMeters, formatDistance, safeCoords, isValidCoordinate } from '../utils/geoUtils';
import { sound } from '../utils/audioFeedback';

interface MapViewProps {
  salesReps: SalesRep[];
  clients: Client[];
  visits: Visit[];
  selectedRepId: string;
  selectedClientId: string | null;
  onSelectClient: (clientId: string) => void;
  onSelectRep: (repId: string) => void;
  onInitiateCheckIn?: (visit: Visit) => void;
  onMapClickCoordinate?: (coords: Coordinates) => void;
  showAllReps?: boolean;
  userCoords?: Coordinates | null;
}

type MapLayerType = 'streets' | 'satellite' | 'topo';

export const MapView: React.FC<MapViewProps> = ({
  salesReps,
  clients,
  visits,
  selectedRepId,
  selectedClientId,
  onSelectClient,
  onSelectRep,
  onInitiateCheckIn,
  onMapClickCoordinate,
  showAllReps = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const geofenceLayerRef = useRef<L.LayerGroup | null>(null);
  const tempPinLayerRef = useRef<L.LayerGroup | null>(null);

  const [activeLayer, setActiveLayer] = useState<MapLayerType>('streets');
  const [filterVisitStatus, setFilterVisitStatus] = useState<string>('all');
  const [isPickingLocation, setIsPickingLocation] = useState<boolean>(false);

  // Find active rep
  const activeRep = salesReps.find((r) => r.id === selectedRepId) || salesReps[0];

  // Google Maps daily route URL for selected rep
  const googleMapsRepRouteUrl = React.useMemo(() => {
    if (!activeRep) return null;
    const repVisits = visits.filter((v) => v.repId === activeRep.id);
    const sorted = [...repVisits].sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
    const stops: { lat: number; lng: number }[] = [];
    for (const v of sorted) {
      const c = clients.find((client) => client.id === v.clientId);
      if (c && c.coords && isValidCoordinate(c.coords)) {
        stops.push({ lat: c.coords.lat, lng: c.coords.lng });
      }
    }
    if (stops.length === 0) return null;
    const origin = `${activeRep.currentCoords.lat},${activeRep.currentCoords.lng}`;
    if (stops.length === 1) {
      return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${stops[0].lat},${stops[0].lng}&travelmode=driving`;
    }
    const dest = stops[stops.length - 1];
    const waypoints = stops.slice(0, stops.length - 1).map((s) => `${s.lat},${s.lng}`).join('|');
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest.lat},${dest.lng}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`;
  }, [activeRep, visits, clients]);

  // Tile layer configurations (100% free, no API key required)
  const tileConfigs: Record<MapLayerType, { url: string; maxZoom: number; attribution: string }> = {
    streets: {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      maxZoom: 19,
      attribution: '&copy; Esri &mdash; Maxar, Earthstar Geographics',
    },
    topo: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      maxZoom: 19,
      attribution: '&copy; Esri &mdash; Topographic Basemap',
    },
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initCoords = safeCoords(activeRep?.currentCoords, { lat: 40.4350, lng: -3.6900 });

      const map = L.map(mapContainerRef.current, {
        center: [initCoords.lat, initCoords.lng],
        zoom: 13,
        zoomControl: false,
      });

      const config = tileConfigs[activeLayer];
      const tileLayer = L.tileLayer(config.url, {
        attribution: config.attribution,
        maxZoom: config.maxZoom,
      }).addTo(map);

      tileLayerRef.current = tileLayer;

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      routeLayerRef.current = L.layerGroup().addTo(map);
      geofenceLayerRef.current = L.layerGroup().addTo(map);
      tempPinLayerRef.current = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update base tile layer when activeLayer changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const config = tileConfigs[activeLayer];
    const newTile = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
    }).addTo(map);

    tileLayerRef.current = newTile;
  }, [activeLayer]);

  // Click on map to pick coordinate
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (isPickingLocation && onMapClickCoordinate) {
        sound.playClick();
        if (tempPinLayerRef.current) {
          tempPinLayerRef.current.clearLayers();
          const tempIcon = L.divIcon({
            className: 'temp-pin',
            html: `
              <div style="background: #2563EB; color: #fff; width: 32px; height: 32px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(37,99,235,0.4); border: 2px solid white; transform: translate(-50%, -100%);">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              </div>
            `,
          });
          L.marker([e.latlng.lat, e.latlng.lng], { icon: tempIcon }).addTo(tempPinLayerRef.current);
        }
        onMapClickCoordinate({ lat: e.latlng.lat, lng: e.latlng.lng });
        setIsPickingLocation(false);
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [isPickingLocation, onMapClickCoordinate]);

  // Update map contents when state changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !markersLayerRef.current || !routeLayerRef.current || !geofenceLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    routeLayerRef.current.clearLayers();
    geofenceLayerRef.current.clearLayers();

    const bounds = L.latLngBounds([]);

    // 1. Draw Sales Rep(s)
    const repsToDisplay = showAllReps ? salesReps : activeRep ? [activeRep] : [];

    repsToDisplay.forEach((rep) => {
      const isSelected = rep.id === selectedRepId;
      const repCoords = safeCoords(rep.currentCoords, { lat: 40.4530, lng: -3.6883 });

      if (isValidCoordinate(repCoords)) {
        bounds.extend([repCoords.lat, repCoords.lng]);
      }

      const statusColors: Record<string, { bg: string; text: string; label: string }> = {
        on_route: { bg: '#2563EB', text: '#FFFFFF', label: 'En Ruta' },
        in_meeting: { bg: '#0D9488', text: '#FFFFFF', label: 'En Visita' },
        available: { bg: '#16A34A', text: '#FFFFFF', label: 'Disponible' },
        offline: { bg: '#64748B', text: '#FFFFFF', label: 'Desconectado' },
      };

      const sc = statusColors[rep.status] || statusColors.available;

      // Custom animated Sales Rep marker
      const repIcon = L.divIcon({
        className: 'custom-rep-icon',
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; user-select: none;">
            <!-- Pulse wave -->
            <div style="position: absolute; top: 0; left: 50%; transform: translate(-50%, -50%); width: 48px; height: 48px; background: rgba(37, 99, 235, 0.28); border-radius: 9999px; animation: gps-pulse 2s infinite;"></div>
            
            <!-- Avatar / Initials badge -->
            <div style="position: relative; z-index: 2; width: 40px; height: 40px; border-radius: 9999px; background: ${sc.bg}; border: 3px solid #FFFFFF; box-shadow: 0 4px 14px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; overflow: hidden; transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'}; transition: transform 0.2s;">
              <span style="color: #ffffff; font-weight: 700; font-size: 13px; font-family: 'Plus Jakarta Sans', sans-serif;">
                ${(rep.name || 'V').split(' ').map((n) => n[0]).join('').substring(0, 2)}
              </span>
            </div>

            <!-- Direction arrow if moving -->
            ${rep.speedKmH > 5 && rep.heading ? `
              <div style="position: absolute; top: -6px; right: -2px; width: 18px; height: 18px; background: #0f172a; border: 1.5px solid #fff; border-radius: 9999px; display: flex; align-items: center; justify-content: center; transform: rotate(${rep.heading}deg);">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="#ffffff"><polygon points="12 2 19 21 12 17 5 21 12 2"/></svg>
              </div>
            ` : ''}

            <!-- Rep name tag -->
            <div style="margin-top: 4px; padding: 2px 8px; border-radius: 6px; background: #0f172a; color: #ffffff; font-size: 11px; font-weight: 600; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.25);">
              ${rep.name}
            </div>
          </div>
        `,
        iconSize: [48, 64],
        iconAnchor: [24, 40],
      });

      const repMarker = L.marker([repCoords.lat, repCoords.lng], { icon: repIcon })
        .addTo(markersLayerRef.current!);

      repMarker.on('click', () => {
        sound.playClick();
        onSelectRep(rep.id);
      });

      // Rep popup
      const repPopupHtml = `
        <div style="min-width: 220px; padding: 4px; font-family: 'Plus Jakarta Sans', sans-serif;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-weight: 700; font-size: 14px; color: #0f172a;">${rep.name}</span>
            <span style="font-size: 11px; padding: 2px 7px; border-radius: 4px; background: ${sc.bg}; color: #ffffff; font-weight: 600;">${sc.label}</span>
          </div>
          <p style="font-size: 12px; color: #64748b; margin: 0 0 6px 0;">${rep.territory}</p>
          <div style="font-size: 11px; color: #334155; line-height: 1.7; border-top: 1px solid #e2e8f0; padding-top: 6px;">
            <div style="display: flex; justify-content: space-between;"><span>Velocidad:</span> <strong>${rep.speedKmH} km/h</strong></div>
            <div style="display: flex; justify-content: space-between;"><span>Batería:</span> <strong>${rep.batteryLevel}%</strong></div>
            <div style="display: flex; justify-content: space-between;"><span>Distancia Hoy:</span> <strong>${rep.totalDistanceKmToday} km</strong></div>
            <div style="display: flex; justify-content: space-between;"><span>Último reporte:</span> <span>Hace ${Math.max(1, Math.round((Date.now() - new Date(rep.lastPing).getTime()) / 1000))}s</span></div>
          </div>
        </div>
      `;
      repMarker.bindPopup(repPopupHtml);

      // Draw GPS Breadcrumbs / Route History
      if (isSelected && Array.isArray(rep.routeHistory) && rep.routeHistory.length > 0) {
        const polyCoords: [number, number][] = rep.routeHistory
          .filter((p) => isValidCoordinate(p))
          .map((p) => [Number(p.lat), Number(p.lng)]);
        polyCoords.push([repCoords.lat, repCoords.lng]);

        if (polyCoords.length > 1) {
          L.polyline(polyCoords, {
            color: '#3B82F6',
            weight: 4,
            opacity: 0.8,
            dashArray: '4, 8',
            lineCap: 'round',
          }).addTo(routeLayerRef.current!);
        }
      }
    });

    // 2. Filter visits
    const repVisits = visits.filter((v) => (!showAllReps ? v.repId === selectedRepId : true));

    clients.forEach((client) => {
      const clientVisit = repVisits.find((v) => v.clientId === client.id);

      // Filter check
      if (filterVisitStatus !== 'all') {
        if (!clientVisit && filterVisitStatus !== 'none') return;
        if (clientVisit && clientVisit.status !== filterVisitStatus) return;
      }

      const isSelected = client.id === selectedClientId;
      const clientCoords = safeCoords(client.coords, { lat: 40.4200, lng: -3.7000 });

      if (isValidCoordinate(clientCoords)) {
        bounds.extend([clientCoords.lat, clientCoords.lng]);
      }

      // Calculate distance from active sales rep
      const repToClientDistance = activeRep
        ? calculateDistanceMeters(safeCoords(activeRep.currentCoords), clientCoords)
        : 9999;
      const radius = typeof client.geofenceRadiusMeters === 'number' && Number.isFinite(client.geofenceRadiusMeters)
        ? client.geofenceRadiusMeters
        : 120;
      const isInsideGeofence = repToClientDistance <= radius;

      let statusColor = '#64748B';
      let statusLabel = 'Sin visita hoy';

      if (clientVisit) {
        if (clientVisit.status === 'completed') {
          statusColor = '#16A34A';
          statusLabel = 'Visita Completada';
        } else if (clientVisit.status === 'in_progress') {
          statusColor = '#2563EB';
          statusLabel = 'En Curso Ahora';
        } else if (clientVisit.status === 'scheduled') {
          statusColor = '#D97706';
          statusLabel = `Prog. ${clientVisit.scheduledTime}`;
        } else if (clientVisit.status === 'cancelled') {
          statusColor = '#DC2626';
          statusLabel = 'Cancelada';
        }
      }

      // Draw Geofence radius circle
      const geofenceCircle = L.circle([clientCoords.lat, clientCoords.lng], {
        radius,
        color: isInsideGeofence ? '#16A34A' : isSelected ? '#2563EB' : statusColor,
        weight: isInsideGeofence ? 2.5 : isSelected ? 2 : 1,
        fillColor: isInsideGeofence ? '#22C55E' : statusColor,
        fillOpacity: isInsideGeofence ? 0.25 : isSelected ? 0.18 : 0.08,
      }).addTo(geofenceLayerRef.current!);

      geofenceCircle.bindTooltip(`Geocerca: ${radius}m radio`, {
        permanent: false,
        direction: 'top',
      });

      // Custom Client Pin
      const clientIcon = L.divIcon({
        className: 'custom-client-icon',
        html: `
          <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer; user-select: none;">
            <div style="width: ${isSelected ? '38px' : '32px'}; height: ${isSelected ? '38px' : '32px'}; background: ${statusColor}; border-radius: 10px; border: 2.5px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'}; transition: transform 0.2s;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <div style="margin-top: 3px; padding: 2px 6px; border-radius: 4px; background: rgba(15, 23, 42, 0.9); color: #ffffff; font-size: 10px; font-weight: 600; white-space: nowrap; max-width: 140px; overflow: hidden; text-overflow: ellipsis; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
              ${client.code ? `[${client.code}] ` : ''}${client.name}
            </div>
          </div>
        `,
        iconSize: [38, 52],
        iconAnchor: [19, 26],
      });

      const clientMarker = L.marker([clientCoords.lat, clientCoords.lng], { icon: clientIcon })
        .addTo(markersLayerRef.current!);

      clientMarker.on('click', () => {
        sound.playClick();
        onSelectClient(client.id);
      });

      // Popup with rich information
      const popupDiv = document.createElement('div');
      popupDiv.style.minWidth = '250px';
      popupDiv.style.fontFamily = "'Plus Jakarta Sans', sans-serif";
      popupDiv.innerHTML = `
        <div style="padding: 2px;">
          <div style="font-weight: 700; font-size: 14px; color: #0f172a; margin-bottom: 2px;">
            ${client.code ? `<span style="font-family: monospace; font-size: 11px; background: #e2e8f0; padding: 1px 5px; border-radius: 4px; margin-right: 4px;">${client.code}</span>` : ''}
            ${client.name}
          </div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">
            ${client.company} · ${client.category} · ${client.pais || 'España'}
          </div>
          <div style="font-size: 11px; color: #334155; margin-bottom: 6px;">
            <strong>Ubicación:</strong> ${client.address}, ${client.city}
          </div>
          <div style="font-size: 11px; color: #334155; margin-bottom: 8px;">
            <strong>Contacto:</strong> ${client.contactName} (${client.phone})
          </div>
          
          <div style="background: ${isInsideGeofence ? '#f0fdf4' : '#fffbeb'}; border: 1px solid ${isInsideGeofence ? '#bbf7d0' : '#fef08a'}; border-radius: 6px; padding: 6px 8px; margin-bottom: 10px;">
            <div style="font-size: 11px; font-weight: 600; color: ${isInsideGeofence ? '#15803d' : '#b45309'}; display: flex; align-items: center; gap: 4px;">
              <span>${isInsideGeofence ? '✓ Dentro de la geocerca' : '⚠ Fuera de geocerca'}</span>
            </div>
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
              Distancia actual del vendedor: <strong>${formatDistance(repToClientDistance)}</strong> (Radio permitido: ${radius}m)
            </div>
          </div>
          ${clientVisit ? `
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: #334155; margin-bottom: 8px; padding-top: 4px; border-top: 1px solid #e2e8f0;">
              <span>Estado: <strong style="color: ${statusColor}">${statusLabel}</strong></span>
              <span>Hora: ${clientVisit.scheduledTime}</span>
            </div>
          ` : ''}
        </div>
      `;

      if (clientVisit && (clientVisit.status === 'scheduled' || clientVisit.status === 'in_progress') && onInitiateCheckIn) {
        const btn = document.createElement('button');
        btn.innerText = clientVisit.status === 'scheduled' ? '📍 Registrar Check-in' : '✓ Finalizar Visita';
        btn.style.width = '100%';
        btn.style.padding = '8px 12px';
        btn.style.borderRadius = '6px';
        btn.style.backgroundColor = clientVisit.status === 'scheduled' ? '#2563EB' : '#16A34A';
        btn.style.color = '#ffffff';
        btn.style.fontWeight = '600';
        btn.style.fontSize = '12px';
        btn.style.cursor = 'pointer';
        btn.style.border = 'none';
        btn.style.marginTop = '4px';

        btn.onclick = () => {
          sound.playClick();
          onInitiateCheckIn(clientVisit);
        };
        popupDiv.appendChild(btn);
      }

      clientMarker.bindPopup(popupDiv);
    });

    // 3. Connect visits with planned route polyline
    if (repVisits.length > 0 && activeRep) {
      const activeCoords = safeCoords(activeRep.currentCoords);
      const scheduledCoords: [number, number][] = [
        [activeCoords.lat, activeCoords.lng],
      ];

      repVisits
        .sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''))
        .forEach((v) => {
          const cl = clients.find((c) => c.id === v.clientId);
          if (cl) {
            const clCoords = safeCoords(cl.coords);
            if (isValidCoordinate(clCoords)) {
              scheduledCoords.push([clCoords.lat, clCoords.lng]);
            }
          }
        });

      if (scheduledCoords.length > 1) {
        L.polyline(scheduledCoords, {
          color: '#6366F1',
          weight: 3.5,
          opacity: 0.75,
          lineJoin: 'round',
        }).addTo(routeLayerRef.current!);
      }
    }

    // Auto-fit if bounds are valid
    if (bounds.isValid()) {
      try {
        const center = bounds.getCenter();
        if (isValidCoordinate({ lat: center.lat, lng: center.lng })) {
          if (!map.getBounds().contains(center)) {
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
          }
        }
      } catch (err) {
        console.warn('fitBounds error handled:', err);
      }
    }
  }, [salesReps, clients, visits, selectedRepId, selectedClientId, showAllReps, filterVisitStatus, activeLayer]);

  // Center on active rep
  const centerOnRep = () => {
    sound.playClick();
    if (!mapInstanceRef.current || !activeRep) return;
    const coords = safeCoords(activeRep.currentCoords);
    mapInstanceRef.current.flyTo([coords.lat, coords.lng], 15, {
      duration: 1.0,
    });
  };

  // Center on selected client
  useEffect(() => {
    if (!selectedClientId || !mapInstanceRef.current) return;
    const client = clients.find((c) => c.id === selectedClientId);
    if (client) {
      const coords = safeCoords(client.coords);
      mapInstanceRef.current.flyTo([coords.lat, coords.lng], 16, {
        duration: 0.9,
      });
    }
  }, [selectedClientId, clients]);

  return (
    <div className="relative w-full h-full min-h-[460px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 flex flex-col">
      {/* Top Map Action Bar */}
      <div className="absolute top-3 left-3 right-3 z-[500] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left tools */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Active Rep pill */}
          <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-xl px-3 py-1.5 shadow-sm text-xs flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block animate-pulse"></span>
            <span className="text-slate-800 font-semibold">{activeRep?.name || 'Vendedor'}</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500 font-mono tabular-nums">
              {activeRep?.currentCoords.lat.toFixed(4)}, {activeRep?.currentCoords.lng.toFixed(4)}
            </span>
          </div>

          <button
            onClick={centerOnRep}
            className="bg-white/95 hover:bg-white text-slate-700 border border-slate-200/90 font-medium text-xs px-3 py-1.5 rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
            title="Centrar en el vendedor"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="22" y1="12" x2="18" y2="12"/>
              <line x1="6" y1="12" x2="2" y2="12"/>
              <line x1="12" y1="6" x2="12" y2="2"/>
              <line x1="12" y1="22" x2="12" y2="18"/>
            </svg>
            <span>Centrar GPS</span>
          </button>
        </div>

        {/* Right tools: Layer Switcher & Pin-picker */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Location Picker toggle */}
          {onMapClickCoordinate && (
            <button
              onClick={() => {
                sound.playClick();
                setIsPickingLocation(!isPickingLocation);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 ${
                isPickingLocation
                  ? 'bg-amber-600 text-white animate-pulse'
                  : 'bg-white/95 hover:bg-white text-slate-700 border border-slate-200'
              }`}
              title="Haz clic en cualquier punto del mapa para seleccionar coordenadas"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{isPickingLocation ? 'Haz clic en el mapa...' : 'Fijar Punto'}</span>
            </button>
          )}

          {/* Open Route in Google Maps button */}
          {googleMapsRepRouteUrl && (
            <a
              href={googleMapsRepRouteUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              title={`Abrir ruta diaria de ${activeRep?.name || 'vendedor'} en Google Maps con paradas consecutivas`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11"/>
              </svg>
              <span>Google Maps</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
              </svg>
            </a>
          )}

          {/* Map Layer Selector */}
          <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-xl p-1 shadow-sm flex items-center gap-1 text-xs">
            <button
              onClick={() => {
                sound.playClick();
                setActiveLayer('streets');
              }}
              className={`px-2 py-1 rounded-lg font-medium transition-colors ${
                activeLayer === 'streets' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mapa
            </button>
            <button
              onClick={() => {
                sound.playClick();
                setActiveLayer('satellite');
              }}
              className={`px-2 py-1 rounded-lg font-medium transition-colors ${
                activeLayer === 'satellite' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Satélite
            </button>
            <button
              onClick={() => {
                sound.playClick();
                setActiveLayer('topo');
              }}
              className={`px-2 py-1 rounded-lg font-medium transition-colors ${
                activeLayer === 'topo' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Relieve
            </button>
          </div>
        </div>
      </div>

      {/* Main Leaflet Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full flex-1" style={{ minHeight: '440px' }} />

      {/* Bottom Filter & Status Strip */}
      <div className="absolute bottom-3 left-3 z-[500] flex flex-wrap items-center gap-2">
        <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl p-1.5 shadow-sm text-xs flex items-center gap-1.5">
          <span className="font-semibold text-slate-700 px-1.5">Filtrar:</span>
          {[
            { id: 'all', label: 'Todas' },
            { id: 'scheduled', label: 'Pendientes' },
            { id: 'in_progress', label: 'En Curso' },
            { id: 'completed', label: 'Completadas' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                sound.playClick();
                setFilterVisitStatus(item.id);
              }}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                filterVisitStatus === item.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Picker Guidance Banner */}
      {isPickingLocation && (
        <div className="absolute top-14 left-1/2 transform -translate-x-1/2 z-[600] bg-amber-500 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
          <span>📍 Haz clic en la ubicación deseada en el mapa para capturar sus coordenadas GPS</span>
        </div>
      )}
    </div>
  );
};
