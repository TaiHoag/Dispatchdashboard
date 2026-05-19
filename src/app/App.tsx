import { useEffect, useMemo, useState } from 'react';
import EmergencyMap from './components/EmergencyMap';
import EmergencyList from './components/EmergencyList';
import DashboardStats from './components/DashboardStats';
import DispatchModal from './components/DispatchModal';
import { Filter, Bell, Settings, PanelLeftClose, PanelLeftOpen, RefreshCw, AlertTriangle } from 'lucide-react';
import { Emergency, FloodZone, Vehicle } from './types';
import { loadFromSheet } from './services/sheetData';

export default function App() {
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [floodZones, setFloodZones] = useState<FloodZone[]>([]);
  const [selectedEmergencyId, setSelectedEmergencyId] = useState<string | null>(null);
  const [dispatchModalEmergencyId, setDispatchModalEmergencyId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dataStatus, setDataStatus] = useState<'loading' | 'live' | 'error'>('loading');
  const [dataError, setDataError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refreshFromSheet = async () => {
    setRefreshing(true);
    try {
      const { emergencies: ems, vehicles: vs, floodZones: fz } = await loadFromSheet();
      if (!ems.length) throw new Error('Sheet returned no SOS requests.');
      setEmergencies(ems);
      setVehicles(vs);
      setFloodZones(fz);
      setDataStatus('live');
      setDataError(null);
    } catch (err) {
      setDataStatus('error');
      setDataError(err instanceof Error ? err.message : 'Unable to load sheet.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    refreshFromSheet();
  }, []);

  const handleConfirmDispatch = (emergencyId: string, vehicleIds: string[]) => {
    setEmergencies((prev) =>
      prev.map((e) =>
        e.id === emergencyId
          ? { ...e, status: 'dispatched' as const, assignedVehicleIds: vehicleIds }
          : e
      )
    );
    setDispatchModalEmergencyId(null);
  };

  const handleResolve = (id: string) => {
    setEmergencies((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: 'resolved' as const } : e))
    );
  };

  const sortedEmergencies = useMemo(() => {
    return [...emergencies].sort((a, b) => {
      const statusWeight = { pending: 3, dispatched: 2, resolved: 1 };
      if (statusWeight[a.status] !== statusWeight[b.status]) {
        return statusWeight[b.status] - statusWeight[a.status];
      }
      if (a.status === 'pending' && a.urgencyScore && b.urgencyScore) {
        return b.urgencyScore - a.urgencyScore;
      }
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }, [emergencies]);

  const filteredEmergencies =
    filterStatus === 'all' ? sortedEmergencies : sortedEmergencies.filter((e) => e.status === filterStatus);

  const stats = {
    total: emergencies.length,
    pending: emergencies.filter((e) => e.status === 'pending').length,
    dispatched: emergencies.filter((e) => e.status === 'dispatched').length,
    resolved: emergencies.filter((e) => e.status === 'resolved').length,
  };

  const dispatchEmergency = emergencies.find((e) => e.id === dispatchModalEmergencyId);

  return (
    <div className="w-screen h-screen flex relative bg-[#F4F5F0] font-sans text-black overflow-hidden">
      {/* Map as the absolute background */}
      <main className="absolute inset-0 z-0">
        <EmergencyMap
          emergencies={emergencies}
          selectedEmergency={selectedEmergencyId}
          onEmergencySelect={setSelectedEmergencyId}
          floodZones={floodZones}
        />
      </main>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="absolute inset-0 bg-black/30 z-[35] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Floating UI on top of the Map */}
      <aside
        className={`
          absolute top-4 bottom-4 z-[40] pointer-events-none flex flex-col
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'left-4 w-[calc(100%-2rem)] sm:w-[400px]' : '-left-[420px] w-[calc(100%-2rem)] sm:w-[400px]'}
        `}
      >
        <div className="pointer-events-auto bg-[#F4F5F0] border-2 border-black shadow-[8px_8px_0_0_#000000] flex flex-col h-full overflow-hidden">
          {/* Header */}
          <header className="bg-white border-b-2 border-black p-4 flex flex-col gap-3 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-black text-white p-2 border border-black shadow-[2px_2px_0_0_#000000]">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight uppercase">FloodRescue</h1>
                  <p className="text-xs font-semibold uppercase">Hue Region</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={refreshFromSheet}
                  disabled={refreshing}
                  title="Refresh from Google Sheet"
                  className="p-2 border-2 border-black hover:bg-gray-100 shadow-[2px_2px_0_0_#000000] transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
                <button className="p-2 border-2 border-black hover:bg-gray-100 shadow-[2px_2px_0_0_#000000] transition-colors hidden sm:block">
                  <Settings className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 border-2 border-black hover:bg-gray-100 shadow-[2px_2px_0_0_#000000] transition-colors lg:hidden"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div
              className={`flex items-start gap-2 px-2 py-1 border-2 border-black text-[10px] font-bold uppercase ${
                dataStatus === 'live'
                  ? 'bg-[#C8F7C5]'
                  : dataStatus === 'error'
                  ? 'bg-[#FFE066]'
                  : 'bg-white'
              }`}
            >
              {dataStatus === 'error' && <AlertTriangle className="w-3 h-3 mt-px shrink-0" />}
              <span className="leading-tight">
                {dataStatus === 'loading' && 'Loading from Google Sheet…'}
                {dataStatus === 'live' && `Live — ${emergencies.length} SOS · ${vehicles.length} volunteers`}
                {dataStatus === 'error' && (dataError || 'Sheet unavailable')}
              </span>
            </div>
          </header>

          {/* Stats */}
          <div className="shrink-0 border-b-2 border-black">
            <DashboardStats
              totalEmergencies={stats.total}
              pending={stats.pending}
              dispatched={stats.dispatched}
              resolved={stats.resolved}
            />
          </div>

          {/* List section */}
          <div className="flex-1 flex flex-col min-h-0 bg-white">
            <div className="p-3 border-b-2 border-black bg-[#F4F5F0] shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <Filter className="w-4 h-4" />
                <span className="text-sm font-bold uppercase">Filter Incidents</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {['all', 'pending', 'dispatched', 'resolved'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-3 py-1 text-xs font-bold uppercase border-2 border-black transition-all ${
                      filterStatus === status
                        ? 'bg-black text-white shadow-[2px_2px_0_0_#000000]'
                        : 'bg-white text-black shadow-[2px_2px_0_0_#000000] hover:translate-y-px hover:shadow-[1px_1px_0_0_#000000]'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <EmergencyList
              emergencies={filteredEmergencies}
              selectedEmergency={selectedEmergencyId}
              onEmergencySelect={(id) => {
                setSelectedEmergencyId(id);
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
              onDispatchClick={(id) => setDispatchModalEmergencyId(id)}
              onResolve={handleResolve}
            />
          </div>
        </div>
      </aside>

      {/* Toggle (if closed) */}
      {!sidebarOpen && (
         <button
         onClick={() => setSidebarOpen(true)}
         className="absolute top-4 left-4 z-[40] pointer-events-auto p-3 bg-white border-2 border-black shadow-[4px_4px_0_0_#000000] hover:bg-gray-50"
       >
         <PanelLeftOpen className="w-6 h-6" />
       </button>
      )}

      {dispatchEmergency && (
        <DispatchModal
          emergency={dispatchEmergency}
          vehicles={vehicles}
          onClose={() => setDispatchModalEmergencyId(null)}
          onConfirmDispatch={handleConfirmDispatch}
        />
      )}
    </div>
  );
}
