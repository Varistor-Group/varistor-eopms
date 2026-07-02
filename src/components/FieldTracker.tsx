// Requires: npm install leaflet react-leaflet @types/leaflet
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import {
  MapPin,
  Search,
  RefreshCw,
  Users,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  Clock,
  LogIn,
  LogOut,
  Route,
} from 'lucide-react';
import type { FieldEmployeeLocation } from '../types';
import { getFieldLocations, updateFieldLocation } from '../api/employees';

// Fix the default Leaflet marker icon issue (common in Vite/React)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// ─── Status colour system (shared by map pins + list dots) ───────────────────

type StatusFilterOption = 'All' | 'Active' | 'Idle' | 'Offline';

const STATUS_COLORS: Record<FieldEmployeeLocation['status'], string> = {
  Active: '#84cc16',  // varistor-lime
  Idle: '#f59e0b',    // amber
  Offline: '#9ca3af', // gray
};

const STATUS_BADGE_CLS: Record<FieldEmployeeLocation['status'], string> = {
  Active: 'bg-varistor-limeTint text-varistor-limeText',
  Idle: 'bg-amber-100 text-amber-700',
  Offline: 'bg-gray-100 text-gray-500',
};

// ─── Small helpers ────────────────────────────────────────────────────────────

const initials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

const minutesSince = (iso: string) =>
  Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));

const lastSeenLabel = (iso: string) => {
  const mins = minutesSince(iso);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
};

const timeLabel = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : '—';

const batteryBarColor = (level: number) =>
  level > 50 ? 'bg-varistor-lime' : level > 20 ? 'bg-amber-500' : 'bg-red-500';

const BatteryIcon: React.FC<{ level: number; size?: number }> = ({ level, size = 14 }) => {
  const cls = level > 50 ? 'text-varistor-limeText' : level > 20 ? 'text-amber-600' : 'text-red-500';
  const Icon = level > 50 ? BatteryFull : level > 20 ? BatteryMedium : BatteryLow;
  return <Icon size={size} className={cls} />;
};

// ─── Map imperative helpers (react-leaflet child components) ─────────────────

const FitBoundsOnLoad: React.FC<{ locations: FieldEmployeeLocation[] }> = ({ locations }) => {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || locations.length === 0) return;
    const bounds = L.latLngBounds(locations.map(l => [l.lat, l.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40] });
    fitted.current = true;
  }, [locations, map]);
  return null;
};

const MapRefBinder: React.FC<{ mapRef: React.MutableRefObject<L.Map | null> }> = ({ mapRef }) => {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
};

// ─── Stat card ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{ label: string; value: number; dotColor?: string; icon?: React.ReactNode }> = ({
  label,
  value,
  dotColor,
  icon,
}) => (
  <div className="bg-white rounded-varistor border border-varistor-border p-4 shadow-varistor flex items-center justify-between transition-varistor hover:shadow-md">
    <div>
      <p className="text-xs text-varistor-muted font-medium flex items-center gap-1.5">
        {dotColor && <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: dotColor }} />}
        {label}
      </p>
      <p className="text-2xl font-bold text-varistor-dark mt-1">{value}</p>
    </div>
    {icon && <div className="w-9 h-9 rounded-full bg-varistor-limeLight flex items-center justify-center">{icon}</div>}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

export const FieldTracker: React.FC = () => {
  const [locations, setLocations] = useState<FieldEmployeeLocation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('All');
  const [isLoading, setIsLoading] = useState(true);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFieldLocations().then(data => {
      if (!cancelled) {
        setLocations(data);
        setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(
    () =>
      locations.filter(l => {
        if (statusFilter !== 'All' && l.status !== statusFilter) return false;
        if (searchQuery && !l.employeeName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      }),
    [locations, statusFilter, searchQuery]
  );

  const counts = useMemo(
    () => ({
      total: locations.length,
      active: locations.filter(l => l.status === 'Active').length,
      idle: locations.filter(l => l.status === 'Idle').length,
      offline: locations.filter(l => l.status === 'Offline').length,
    }),
    [locations]
  );

  const selected = locations.find(l => l.employeeId === selectedId) ?? null;

  const handleSelect = (loc: FieldEmployeeLocation) => {
    setSelectedId(prev => (prev === loc.employeeId ? null : loc.employeeId));
    mapRef.current?.flyTo([loc.lat, loc.lng], 14, { duration: 0.8 });
  };

  // Randomly nudge 1–2 employees' positions to demo "live tracking"
  const handleSimulateUpdate = () => {
    const movable = locations.filter(l => l.status !== 'Offline');
    if (movable.length === 0) return;
    const count = Math.min(movable.length, 1 + Math.floor(Math.random() * 2));
    const shuffled = [...movable].sort(() => Math.random() - 0.5);
    const picked = new Set(shuffled.slice(0, count).map(l => l.employeeId));

    setLocations(prev =>
      prev.map(l => {
        if (!picked.has(l.employeeId)) return l;
        const patch = {
          lat: l.lat + (Math.random() - 0.5) * 0.004,
          lng: l.lng + (Math.random() - 0.5) * 0.004,
          lastUpdated: new Date().toISOString(),
        };
        updateFieldLocation(l.employeeId, patch);
        return { ...l, ...patch, routeHistory: [...l.routeHistory, [patch.lat, patch.lng] as [number, number]] };
      })
    );
  };

  const filterTabs: StatusFilterOption[] = ['All', 'Active', 'Idle', 'Offline'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-varistor-muted text-sm animate-[fadeInPage_250ms_ease-out]">
        <RefreshCw size={16} className="animate-spin mr-2" />
        Loading field locations…
      </div>
    );
  }

  return (
    <div className="animate-[fadeInPage_250ms_ease-out]">

      {/* ── Page header row ── */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MapPin size={20} strokeWidth={1.5} className="text-varistor-dark" />
            <h1 className="text-xl font-bold text-varistor-dark">Field Tracker</h1>
          </div>
          <p className="text-sm text-varistor-muted">Live locations and status of all field employees.</p>
        </div>
        <button
          onClick={handleSimulateUpdate}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-varistor bg-varistor-lime text-varistor-limeText hover:bg-[#92cc14] active:scale-[0.98] transition-all"
        >
          <RefreshCw size={15} strokeWidth={2} />
          Simulate Update
        </button>
      </div>

      {/* ── Summary stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard
          label="Total Field Employees"
          value={counts.total}
          icon={<Users size={18} className="text-varistor-limeText" />}
        />
        <StatCard label="Currently Active" value={counts.active} dotColor={STATUS_COLORS.Active} />
        <StatCard label="Currently Idle" value={counts.idle} dotColor={STATUS_COLORS.Idle} />
        <StatCard label="Offline" value={counts.offline} dotColor={STATUS_COLORS.Offline} />
      </div>

      {/* ── Split panel: list (left) + map (right); stacks on mobile ── */}
      <div className="flex flex-col-reverse lg:flex-row gap-4">

        {/* Employee list panel */}
        <div className="lg:w-[320px] w-full flex-shrink-0 bg-white rounded-varistor border border-varistor-border shadow-varistor flex flex-col lg:h-[calc(100vh-220px)] h-[420px]">

          {/* Search */}
          <div className="p-3 border-b border-varistor-border">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-varistor-muted" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name…"
                className="w-full pl-8 pr-3 py-2 border border-varistor-border rounded-varistor text-sm outline-none bg-white focus:ring-2 focus:ring-varistor-lime/40 focus:border-varistor-lime transition-all"
              />
            </div>

            {/* Status filter pill tabs */}
            <div className="flex gap-1.5 mt-2.5">
              {filterTabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-all ${
                    statusFilter === tab
                      ? 'bg-varistor-lime border-varistor-lime text-varistor-limeText'
                      : 'bg-varistor-limeLight border-varistor-border text-varistor-muted hover:border-varistor-lime'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Cards */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filtered.length === 0 && (
              <p className="text-sm text-varistor-muted text-center py-8">No field employees match.</p>
            )}
            {filtered.map(loc => {
              const isSelected = selectedId === loc.employeeId;
              return (
                <button
                  key={loc.employeeId}
                  onClick={() => handleSelect(loc)}
                  className={`w-full text-left p-3 rounded-varistor border transition-all bg-white hover:shadow-md ${
                    isSelected ? 'border-varistor-lime ring-1 ring-varistor-lime/40' : 'border-varistor-border'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Initials avatar with status dot */}
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-varistor-limeTint flex items-center justify-center text-xs font-bold text-varistor-limeText">
                        {initials(loc.employeeName)}
                      </div>
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                        style={{ backgroundColor: STATUS_COLORS[loc.status] }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-varistor-dark truncate">{loc.employeeName}</p>
                      <p className="text-[11px] text-varistor-muted truncate">{loc.department}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full flex-shrink-0 ${STATUS_BADGE_CLS[loc.status]}`}>
                      {loc.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-2.5 text-[11px] text-varistor-muted">
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      Last seen {lastSeenLabel(loc.lastUpdated)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Route size={11} />
                      {loc.distanceTravelledKm.toFixed(1)} km
                    </span>
                  </div>

                  {/* Battery bar */}
                  <div className="flex items-center gap-2 mt-2">
                    <BatteryIcon level={loc.batteryLevel} size={13} />
                    <div className="flex-1 h-1.5 bg-varistor-pageBg rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${batteryBarColor(loc.batteryLevel)}`}
                        style={{ width: `${loc.batteryLevel}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-varistor-muted w-7 text-right">{loc.batteryLevel}%</span>
                  </div>

                  {/* Inline expanded detail */}
                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-varistor-border grid grid-cols-2 gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5 text-varistor-muted">
                        <LogIn size={11} className="text-varistor-limeText" />
                        In: <span className="font-semibold text-varistor-dark">{timeLabel(loc.todayCheckIn)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-varistor-muted">
                        <LogOut size={11} className="text-red-400" />
                        Out: <span className="font-semibold text-varistor-dark">{timeLabel(loc.todayCheckOut)}</span>
                      </div>
                      <div className="col-span-2 text-varistor-muted">
                        Accuracy: <span className="font-semibold text-varistor-dark">±{loc.accuracy} m</span>
                        <span className="mx-1.5">·</span>
                        Route shown on map
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Map panel */}
        <div className="flex-1 bg-white rounded-varistor border border-varistor-border shadow-varistor overflow-hidden lg:h-[calc(100vh-220px)] h-[420px]">
          <MapContainer
            center={[12.9716, 77.5946]}
            zoom={11}
            className="w-full h-full"
            scrollWheelZoom
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            <MapRefBinder mapRef={mapRef} />
            <FitBoundsOnLoad locations={locations} />

            {/* Selected employee's route history (dashed) */}
            {selected && selected.routeHistory.length > 1 && (
              <Polyline
                positions={selected.routeHistory}
                pathOptions={{ color: STATUS_COLORS[selected.status], dashArray: '6 8', weight: 3, opacity: 0.8 }}
              />
            )}

            {filtered.map(loc => (
              <CircleMarker
                key={loc.employeeId}
                center={[loc.lat, loc.lng]}
                radius={selectedId === loc.employeeId ? 12 : 9}
                pathOptions={{
                  color: '#ffffff',
                  weight: 2,
                  fillColor: STATUS_COLORS[loc.status],
                  fillOpacity: 1,
                }}
                eventHandlers={{ click: () => setSelectedId(loc.employeeId) }}
              >
                <Popup>
                  <div className="text-sm min-w-[180px]">
                    <p className="font-bold text-varistor-dark">{loc.employeeName}</p>
                    <p className="text-xs text-varistor-muted mb-1.5">{loc.department}</p>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${STATUS_BADGE_CLS[loc.status]}`}>
                      {loc.status}
                    </span>
                    <div className="mt-2 space-y-1 text-xs text-varistor-muted">
                      <p>Updated {lastSeenLabel(loc.lastUpdated)}</p>
                      <p>Check-in: {timeLabel(loc.todayCheckIn)} · Check-out: {timeLabel(loc.todayCheckOut)}</p>
                      <p className="flex items-center gap-1">
                        <BatteryIcon level={loc.batteryLevel} size={12} />
                        {loc.batteryLevel}% battery
                      </p>
                      <p>{loc.distanceTravelledKm.toFixed(1)} km travelled today</p>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};
