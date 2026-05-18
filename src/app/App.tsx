import { useMemo, useState } from 'react';
import EmergencyMap from './components/EmergencyMap';
import EmergencyList from './components/EmergencyList';
import DashboardStats from './components/DashboardStats';
import DispatchModal from './components/DispatchModal';
import { Filter, Bell, Settings, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Emergency } from './types';
import { calculateUrgency } from './utils/algorithms';

const generateInitialEmergencies = (): Emergency[] => {
  const data: Emergency[] = [
    {
      id: 'em-1',
      location: [16.465, 107.58],
      severity: 'critical',
      type: 'Severe Flooding - Imperial City',
      address: 'Phu Hau, Hue, Thua Thien Hue, Vietnam',
      status: 'pending',
      timestamp: new Date(Date.now() - 5 * 60000),
      waitingDays: 2,
      areaDangerScore: 8, // canoe only
      victims: { normal: 10, childrenElders: 5, injured: 2, immediateHelp: 1 },
    },
    {
      id: 'em-2',
      location: [16.45, 107.60],
      severity: 'high',
      type: 'River Overflow - Perfume River',
      address: 'Vy Da, Hue, Thua Thien Hue, Vietnam',
      status: 'dispatched',
      timestamp: new Date(Date.now() - 120 * 60000),
      waitingDays: 1,
      areaDangerScore: 7,
      victims: { normal: 20, childrenElders: 8, injured: 1, immediateHelp: 0 },
      assignedVehicleIds: ['t1'],
    },
    {
      id: 'em-3',
      location: [16.48, 107.56],
      severity: 'medium',
      type: 'Isolated Village - Road Access Cut',
      address: 'Huong Long, Hue, Vietnam',
      status: 'pending',
      timestamp: new Date(Date.now() - 300 * 60000),
      waitingDays: 4,
      areaDangerScore: 5,
      victims: { normal: 50, childrenElders: 15, injured: 0, immediateHelp: 0 },
    },
    {
      id: 'em-4',
      location: [16.44, 107.55],
      severity: 'critical',
      type: 'Flash Flood - Evacuation Needed',
      address: 'Thuy Bieu, Hue, Vietnam',
      status: 'pending',
      timestamp: new Date(Date.now() - 15 * 60000),
      waitingDays: 1,
      areaDangerScore: 9, // canoe only
      victims: { normal: 5, childrenElders: 4, injured: 3, immediateHelp: 2 },
    },
    {
      id: 'em-5',
      location: [16.47, 107.62],
      severity: 'low',
      type: 'Minor Water Accumulation',
      address: 'Phu Thuong, Hue, Vietnam',
      status: 'resolved',
      timestamp: new Date(Date.now() - 2800 * 60000),
      waitingDays: 0,
      areaDangerScore: 2,
      victims: { normal: 2, childrenElders: 0, injured: 0, immediateHelp: 0 },
    },
  ];
  return data.map((e) => ({ ...e, urgencyScore: calculateUrgency(e) }));
};

export default function App() {
  const [emergencies, setEmergencies] = useState<Emergency[]>(generateInitialEmergencies());
  const [selectedEmergencyId, setSelectedEmergencyId] = useState<string | null>(null);
  const [dispatchModalEmergencyId, setDispatchModalEmergencyId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
          onClose={() => setDispatchModalEmergencyId(null)}
          onConfirmDispatch={handleConfirmDispatch}
        />
      )}
    </div>
  );
}
