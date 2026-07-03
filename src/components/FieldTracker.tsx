import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { MapPin, Clock, RefreshCw, Users } from 'lucide-react';
import type { LatestLocation, LocationEntry } from '../types';
import type { Employee } from '../api/employees';
import { getLatestLocations, getLocationHistory, getEmployees } from '../api/employees';
// Fix the default Leaflet marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const timeAgo = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
};

const FitBoundsOnLoad: React.FC<{ locations: { lat: number, lng: number }[] }> = ({ locations }) => {
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

const LiveMapTab: React.FC = () => {
  const [locations, setLocations] = useState<LatestLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLocations = async () => {
    try {
      const data = await getLatestLocations();
      setLocations(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
    const interval = setInterval(fetchLocations, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="bg-white rounded-varistor border border-varistor-border shadow-sm h-[600px] flex items-center justify-center">
        <RefreshCw className="animate-spin text-varistor-lime" size={32} />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-varistor border border-varistor-border shadow-sm overflow-hidden h-[600px] relative">
      <div className="absolute top-4 right-4 z-[1000] bg-white rounded-full p-2 shadow-md flex items-center gap-2 px-4 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-varistor-lime animate-pulse" />
        <span className="text-xs font-bold text-varistor-dark">Live Updating</span>
      </div>

      <MapContainer
        center={[20.5937, 78.9629]}
        zoom={5}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBoundsOnLoad locations={locations.map(l => ({ lat: l.latitude, lng: l.longitude }))} />
        {locations.map(loc => (
          <Marker key={loc.id} position={[loc.latitude, loc.longitude]}>
            <Popup>
              <div className="text-sm">
                <p className="font-bold text-varistor-dark">{loc.employeeName}</p>
                <p className="text-xs text-varistor-muted">{loc.employeeId} · {loc.department}</p>
                <div className="mt-2 text-xs flex items-center gap-1 text-varistor-muted">
                  <Clock size={12} /> Last seen: {timeAgo(loc.timestamp)}
                </div>
                <div className="mt-1 text-xs flex items-center gap-1 text-varistor-muted">
                  <MapPin size={12} /> Accuracy: {Math.round(loc.accuracy)}m
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {locations.length === 0 && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/70 backdrop-blur-sm pointer-events-none">
          <div className="bg-white px-6 py-4 rounded-lg shadow-sm border border-varistor-border text-center">
            <Users className="mx-auto text-varistor-muted mb-2" size={24} />
            <p className="text-sm font-semibold text-varistor-dark">No field employees are currently active.</p>
          </div>
        </div>
      )}
    </div>
  );
};

const HistoryTab: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.toISOString().split('T')[0];
  });
  const [history, setHistory] = useState<LocationEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    getEmployees().then(data => {
      setEmployees(data.filter(e => e.is_field_employee));
    });
  }, []);

  const handleLoadHistory = async () => {
    if (!selectedId) return;
    setIsLoading(true);
    try {
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      const data = await getLocationHistory(selectedId, from, to);
      setHistory(data);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedEmployee = employees.find(e => e.id === selectedId || e.employeeId === selectedId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Left Panel: Employee List */}
      <div className="bg-white rounded-varistor border border-varistor-border shadow-sm overflow-hidden flex flex-col h-[700px]">
        <div className="p-4 border-b border-varistor-border bg-varistor-pageBg">
          <h2 className="font-bold text-sm text-varistor-dark flex items-center gap-2">
            <Users size={16} className="text-varistor-lime" />
            Field Employees
          </h2>
        </div>
        <div className="overflow-y-auto flex-1">
          {employees.map(emp => (
            <button
              key={emp.id}
              onClick={() => setSelectedId(emp.employeeId)}
              className={`w-full text-left p-4 border-b border-gray-100 transition-colors hover:bg-varistor-pageBg ${selectedId === emp.employeeId ? 'bg-varistor-limeLight/30 border-l-4 border-l-varistor-lime' : 'border-l-4 border-l-transparent'}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-sm text-varistor-dark">{emp.fullName}</p>
                  <p className="text-xs text-varistor-muted">{emp.employeeId}</p>
                </div>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-varistor-lime/20 bg-varistor-limeTint text-[10px] font-bold text-varistor-limeText uppercase tracking-wider">
                  Field
                </span>
              </div>
              <p className="text-[11px] font-medium text-gray-500 mt-1">{emp.department}</p>
            </button>
          ))}
          {employees.length === 0 && (
            <div className="p-6 text-center text-sm text-varistor-muted">No field employees configured.</div>
          )}
        </div>
      </div>

      {/* Right Panel: Map & Table */}
      <div className="lg:col-span-3 bg-white rounded-varistor border border-varistor-border shadow-sm p-4 flex flex-col h-[700px]">
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div>
            <label className="block text-[11px] font-bold text-varistor-muted uppercase tracking-wider mb-1">From Date</label>
            <input
              type="date"
              className="px-3 py-2 border border-varistor-border rounded-md text-sm focus:outline-none focus:border-varistor-lime"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-varistor-muted uppercase tracking-wider mb-1">To Date</label>
            <input
              type="date"
              className="px-3 py-2 border border-varistor-border rounded-md text-sm focus:outline-none focus:border-varistor-lime"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
            />
          </div>
          <button
            onClick={handleLoadHistory}
            disabled={!selectedId || isLoading}
            className="px-4 py-2 bg-varistor-lime text-white rounded-md text-sm font-bold shadow-md shadow-varistor-limeTint hover:bg-[#74b313] transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Load History'}
          </button>
        </div>

        {!selectedEmployee ? (
          <div className="flex-1 border border-dashed border-gray-300 rounded-lg flex items-center justify-center text-varistor-muted text-sm">
            Select a field employee to view their location history.
          </div>
        ) : (
          <>
            <div className="flex-1 rounded-lg overflow-hidden border border-varistor-border relative mb-4">
              <MapContainer
                center={[20.5937, 78.9629]}
                zoom={5}
                style={{ height: '100%', width: '100%', zIndex: 0 }}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {history.length > 0 && (
                  <>
                    <FitBoundsOnLoad locations={history.map(l => ({ lat: l.latitude, lng: l.longitude }))} />
                    <Polyline
                      positions={history.map(l => [l.latitude, l.longitude])}
                      color="#84cc16"
                      weight={4}
                      opacity={0.8}
                    />
                    {/* Start Marker */}
                    <Marker position={[history[0].latitude, history[0].longitude]}>
                      <Popup>Start: {new Date(history[0].timestamp).toLocaleTimeString()}</Popup>
                    </Marker>
                    {/* End Marker */}
                    {history.length > 1 && (
                      <Marker position={[history[history.length - 1].latitude, history[history.length - 1].longitude]}>
                        <Popup>End: {new Date(history[history.length - 1].timestamp).toLocaleTimeString()}</Popup>
                      </Marker>
                    )}
                  </>
                )}
              </MapContainer>
              {history.length === 0 && !isLoading && (
                <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/70 backdrop-blur-sm pointer-events-none">
                  <span className="text-sm font-semibold text-varistor-muted">No location data for this period.</span>
                </div>
              )}
            </div>

            <div className="h-48 overflow-y-auto border border-varistor-border rounded-lg">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-varistor-pageBg sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2 border-b border-varistor-border text-xs font-bold text-varistor-muted uppercase">Timestamp</th>
                    <th className="px-4 py-2 border-b border-varistor-border text-xs font-bold text-varistor-muted uppercase">Coordinates</th>
                    <th className="px-4 py-2 border-b border-varistor-border text-xs font-bold text-varistor-muted uppercase">Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(entry => (
                    <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2 text-varistor-dark">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-varistor-muted font-mono text-xs">
                        {entry.latitude.toFixed(5)}, {entry.longitude.toFixed(5)}
                      </td>
                      <td className="px-4 py-2 text-varistor-muted">
                        ±{Math.round(entry.accuracy)}m
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-varistor-muted">No entries</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const FieldTracker: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'live' | 'history'>('live');

  return (
    <div className="space-y-6 animate-[fadeInPage_250ms_ease-out]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-varistor-dark flex items-center gap-2">
            <MapPin className="text-varistor-lime" size={24} />
            Field Tracking
          </h1>
          <p className="text-sm text-varistor-muted mt-1">Monitor live locations and view tracking history for field employees.</p>
        </div>
        <div className="flex bg-white border border-varistor-border rounded-varistor overflow-hidden p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('live')}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${activeTab === 'live' ? 'bg-varistor-lime text-varistor-limeText shadow' : 'text-varistor-muted hover:text-varistor-dark hover:bg-varistor-pageBg'}`}
          >
            Live Map
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${activeTab === 'history' ? 'bg-varistor-lime text-varistor-limeText shadow' : 'text-varistor-muted hover:text-varistor-dark hover:bg-varistor-pageBg'}`}
          >
            Location History
          </button>
        </div>
      </div>

      {activeTab === 'live' ? <LiveMapTab /> : <HistoryTab />}
    </div>
  );
};
