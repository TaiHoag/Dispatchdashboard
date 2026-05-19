import { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polyline,
  ZoomControl,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { MapPin } from 'lucide-react';
import { Emergency, FloodZone } from '../types';
import {
  buildCanoePath,
  DEPOT_LOCATION,
  fetchOsrmRoute,
  isCanoeOnly,
  MAP_CENTER,
  routeDistanceMeters,
} from '../utils/algorithms';

interface EmergencyMapProps {
  emergencies: Emergency[];
  selectedEmergency: string | null;
  onEmergencySelect: (id: string) => void;
  floodZones?: FloodZone[];
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#f87171', // red-400
  high: '#fb923c', // orange-400
  medium: '#facc15', // yellow-400
  low: '#60a5fa', // blue-400
};

function makeEmergencyIcon(emergency: Emergency, isSelected: boolean): L.DivIcon {
  const color =
    emergency.status === 'resolved' ? '#4ade80' : SEVERITY_COLOR[emergency.severity] || '#9ca3af';
  const pulse =
    emergency.severity === 'critical' && emergency.status !== 'resolved'
      ? `<span class="em-marker-pulse" style="background:${color};border:2px solid black;"></span>`
      : '';
  const html = `
    <div class="em-marker-root" style="border: 2px solid black; background: white; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; ${isSelected ? 'box-shadow: 4px 4px 0 0 black; transform: translate(-2px, -2px);' : 'box-shadow: 2px 2px 0 0 black;'}">
      ${pulse}
      <div class="em-marker-dot" style="background:${color}; width: 100%; height: 100%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-weight: 900; color: black;">!</div>
    </div>
  `;
  return L.divIcon({ html, className: '', iconSize: [32, 32], iconAnchor: [16, 16] });
}

const depotIcon = L.divIcon({
  html: `<div class="depot-marker-dot" style="border: 2px solid black; background: black; color: white; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; font-weight: 900; box-shadow: 2px 2px 0 0 white;">HQ</div>`,
  className: '',
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});

function FlyToSelected({ emergencies, selectedId }: { emergencies: Emergency[]; selectedId: string | null }) {
  const map = useMap();
  useEffect(() => {
    if (!selectedId) return;
    const e = emergencies.find((x) => x.id === selectedId);
    if (e) map.flyTo(e.location, Math.max(map.getZoom(), 15), { duration: 0.8 });
  }, [selectedId, emergencies, map]);
  return null;
}

interface RouteData {
  emergencyId: string;
  path: [number, number][];
  canoe: boolean;
  distanceKm: number;
}

export default function EmergencyMap({ emergencies, selectedEmergency, onEmergencySelect, floodZones = [] }: EmergencyMapProps) {
  const [routes, setRoutes] = useState<RouteData[]>([]);

  const dispatched = useMemo(
    () => emergencies.filter((e) => e.status === 'dispatched'),
    [emergencies]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        dispatched.map(async (e) => {
          const canoe = isCanoeOnly(e);
          const path = canoe
            ? buildCanoePath(DEPOT_LOCATION, e.location)
            : await fetchOsrmRoute(DEPOT_LOCATION, e.location);
          return {
            emergencyId: e.id,
            path,
            canoe,
            distanceKm: routeDistanceMeters(path) / 1000,
          };
        })
      );
      if (!cancelled) setRoutes(results);
    })();
    return () => { cancelled = true; };
  }, [dispatched]);

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={MAP_CENTER}
        zoom={13}
        zoomControl={false}
        className="w-full h-full z-0"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ZoomControl position="topright" />

        {floodZones.map((z) => (
          <Circle
            key={z.id}
            center={z.center}
            radius={z.radiusMeters}
            pathOptions={{
              color: '#dc2626',
              weight: 1,
              fillColor: '#dc2626',
              fillOpacity: 0.18 + z.intensity * 0.22,
            }}
          />
        ))}

        <Marker position={DEPOT_LOCATION} icon={depotIcon}>
          <Popup>HQ Depot — Hue Central</Popup>
        </Marker>

        {routes.map((r) => (
          <Polyline
            key={r.emergencyId}
            positions={r.path}
            pathOptions={{
              color: 'black',
              weight: 6,
              opacity: 1,
              dashArray: r.canoe ? '10 10' : undefined,
            }}
          />
        ))}

        {emergencies.map((emergency) => {
          const isSelected = selectedEmergency === emergency.id;
          const route = routes.find((r) => r.emergencyId === emergency.id);
          return (
            <Marker
              key={emergency.id}
              position={emergency.location}
              icon={makeEmergencyIcon(emergency, isSelected)}
              eventHandlers={{ click: () => onEmergencySelect(emergency.id) }}
            >
              <Popup className="neo-popup">
                <div className="w-64 p-1">
                  <div className="font-black text-sm mb-1 uppercase">{emergency.type}</div>
                  <div className="text-[10px] font-bold uppercase mb-2 border-b-2 border-black pb-2">{emergency.address}</div>
                  <div className="grid grid-cols-2 gap-1 text-[10px] bg-[#F4F5F0] p-2 border-2 border-black font-bold uppercase mb-2">
                    <div>Normal: <b className="text-black">{emergency.victims.normal}</b></div>
                    <div>Child/Elder: <b className="text-black">{emergency.victims.childrenElders}</b></div>
                    <div>Injured: <b className="text-black">{emergency.victims.injured}</b></div>
                    <div>Immediate: <b className="text-black">{emergency.victims.immediateHelp}</b></div>
                  </div>
                  <div className="text-xs flex justify-between font-black uppercase mb-2">
                    <span>Urgency: {emergency.urgencyScore}</span>
                    {isCanoeOnly(emergency) && <span className="bg-black text-white px-1">Canoe Only</span>}
                  </div>
                  {route && (
                    <div className="text-[10px] font-bold uppercase border-t-2 border-black pt-2">
                      Route: {route.distanceKm.toFixed(1)} km {route.canoe ? '(CANOE)' : '(ROAD)'}
                    </div>
                  )}
                  {emergency.assignedVehicleIds?.length ? (
                    <div className="text-[10px] font-bold uppercase mt-1">
                      Assigned units: {emergency.assignedVehicleIds.length}
                    </div>
                  ) : null}
                </div>
              </Popup>
            </Marker>
          );
        })}

        <FlyToSelected emergencies={emergencies} selectedId={selectedEmergency} />
      </MapContainer>

      <div className="absolute bottom-4 right-4 bg-white border-2 border-black p-3 shadow-[4px_4px_0_0_#000000] text-xs z-[400] max-w-[220px]">
        <div className="font-black uppercase mb-2">Map Legend</div>
        <div className="space-y-1.5 font-bold uppercase">
          <div className="flex items-center gap-2"><div className="w-3 h-3 border border-black bg-red-400" /><span>Critical</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 border border-black bg-orange-400" /><span>High</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 border border-black bg-yellow-400" /><span>Medium</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 border border-black bg-blue-400" /><span>Low</span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-1 bg-blue-600 border-y border-black" /><span>Road route</span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-0 border-t-2 border-dashed border-sky-500" /><span>Canoe route</span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 border border-red-500 bg-red-500/40" /><span>Flood hazard</span></div>
          <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-black" /><span>HQ Depot</span></div>
        </div>
      </div>
    </div>
  );
}
