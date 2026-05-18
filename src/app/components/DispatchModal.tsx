import { useMemo, useState } from 'react';
import { X, Truck, Ship, Package as PackageIcon, CheckCircle, Radio, AlertTriangle } from 'lucide-react';
import { Emergency, Vehicle } from '../types';
import { getPackagesForEmergency, isCanoeOnly, optimizeKnapsack } from '../utils/algorithms';

interface DispatchModalProps {
  emergency: Emergency;
  onClose: () => void;
  onConfirmDispatch: (emergencyId: string, vehicleIds: string[]) => void;
}

const VEHICLES: Vehicle[] = [
  { id: 'c1', name: 'Canoe Alpha', type: 'canoe', capacity: 300 },
  { id: 'c2', name: 'Canoe Bravo', type: 'canoe', capacity: 300 },
  { id: 'c3', name: 'Canoe Charlie', type: 'canoe', capacity: 350 },
  { id: 't1', name: 'Small Truck 1', type: 'small_truck', capacity: 1000 },
  { id: 't2', name: 'Small Truck 2', type: 'small_truck', capacity: 1200 },
  { id: 'b1', name: 'Heavy Truck 1', type: 'big_truck', capacity: 5000 },
];

export default function DispatchModal({ emergency, onClose, onConfirmDispatch }: DispatchModalProps) {
  const canoeOnly = isCanoeOnly(emergency);
  const allowed = useMemo(
    () => (canoeOnly ? VEHICLES.filter((v) => v.type === 'canoe') : VEHICLES),
    [canoeOnly]
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([allowed[0]?.id].filter(Boolean) as string[]);

  const selectedVehicles = VEHICLES.filter((v) => selectedIds.includes(v.id));
  const combinedCapacity = selectedVehicles.reduce((s, v) => s + v.capacity, 0);

  const packages = useMemo(() => getPackagesForEmergency(emergency), [emergency]);
  const { selected, totalValue, totalWeight } = useMemo(
    () => optimizeKnapsack(combinedCapacity, packages),
    [combinedCapacity, packages]
  );

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const canConfirm = selectedIds.length > 0;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white border-4 border-black shadow-[8px_8px_0_0_#000000] w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="bg-black text-white p-4 flex justify-between items-center border-b-4 border-black">
          <div className="min-w-0">
            <h2 className="text-xl font-black uppercase truncate">Dispatch Units</h2>
            <p className="text-sm font-bold truncate">Incident: {emergency.type}</p>
          </div>
          <button onClick={onClose} className="p-2 border-2 border-white hover:bg-white hover:text-black transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {canoeOnly && (
          <div className="bg-[#F4F5F0] border-b-4 border-black px-4 py-3 flex items-start gap-2 text-black">
            <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
            <div className="text-sm font-bold uppercase">
              HEAVY FLOODING DETECTED (DANGER {emergency.areaDangerScore}/10). CANOES ONLY — TRUCKS DISABLED.
            </div>
          </div>
        )}

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          <section>
            <h3 className="text-base font-black uppercase mb-3">1. Select Vehicle(s)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {VEHICLES.map((v) => {
                const isAllowed = !canoeOnly || v.type === 'canoe';
                const isSelected = selectedIds.includes(v.id);
                return (
                  <button
                    key={v.id}
                    disabled={!isAllowed}
                    onClick={() => toggle(v.id)}
                    className={`p-3 border-2 transition-all text-center flex flex-col items-center gap-1.5 ${
                      !isAllowed
                        ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                        : isSelected
                        ? 'border-black bg-black text-white shadow-[4px_4px_0_0_#000000] translate-y-[-2px] translate-x-[-2px]'
                        : 'border-black bg-white text-black shadow-[2px_2px_0_0_#000000] hover:shadow-[4px_4px_0_0_#000000] hover:-translate-y-1 hover:-translate-x-1'
                    }`}
                  >
                    {v.type === 'canoe' ? (
                      <Ship className={`w-6 h-6 ${!isAllowed ? 'text-gray-400' : ''}`} />
                    ) : (
                      <Truck className={`w-6 h-6 ${!isAllowed ? 'text-gray-400' : ''}`} />
                    )}
                    <div className="text-sm font-black uppercase">{v.name}</div>
                    <div className="text-[11px] font-bold uppercase">{v.capacity} kg</div>
                    {isSelected && <CheckCircle className="w-4 h-4 text-white mt-1" />}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="text-base font-black uppercase mb-3">2. Optimal Load</h3>
            <div className="bg-[#F4F5F0] p-4 border-2 border-black shadow-[4px_4px_0_0_#000000]">
              <div className="flex flex-wrap gap-4 sm:gap-6 mb-4">
                <div>
                  <div className="text-[10px] font-black uppercase">Units</div>
                  <div className="text-xl font-black">{selectedVehicles.length}</div>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase">Weight</div>
                  <div className={`text-xl font-black ${totalWeight > combinedCapacity ? 'bg-black text-white px-1' : ''}`}>
                    {totalWeight.toFixed(1)} / {combinedCapacity} kg
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase">Value</div>
                  <div className="text-xl font-black">{totalValue.toFixed(1)}</div>
                </div>
                <div className="ml-auto bg-black text-white border-2 border-black px-2 py-1 flex items-center gap-1 self-start font-bold text-[10px] uppercase shadow-[2px_2px_0_0_#000000]">
                  <CheckCircle className="w-3 h-3" /> Auto-opt
                </div>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {packages.length === 0 ? (
                  <p className="text-sm font-bold uppercase">No packages needed.</p>
                ) : (
                  packages.map((pkg) => {
                    const isLoaded = selected.some((s) => s.id === pkg.id);
                    return (
                      <div
                        key={pkg.id}
                        className={`flex items-center justify-between p-2 text-xs sm:text-sm border-2 ${
                          isLoaded ? 'bg-white border-black shadow-[2px_2px_0_0_#000000]' : 'bg-transparent border-gray-300 text-gray-400'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold uppercase">
                          <PackageIcon className="w-4 h-4" />
                          <span>Level {pkg.level} Kit</span>
                        </div>
                        <div className="flex gap-3 font-bold uppercase">
                          <span>{pkg.weight} kg</span>
                          <span>val {pkg.value}</span>
                          <span className={isLoaded ? 'bg-black text-white px-1' : ''}>
                            {isLoaded ? 'Loaded' : 'Left'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="border-t-4 border-black p-4 bg-[#F4F5F0] flex justify-end gap-4">
          <button onClick={onClose} className="px-6 py-2 bg-white text-black border-2 border-black font-black uppercase shadow-[2px_2px_0_0_#000000] hover:translate-y-px hover:translate-x-px hover:shadow-[1px_1px_0_0_#000000] transition-all">
            Cancel
          </button>
          <button
            disabled={!canConfirm}
            onClick={() => onConfirmDispatch(emergency.id, selectedIds)}
            className="px-6 py-2 bg-black disabled:bg-gray-400 disabled:border-gray-400 text-white border-2 border-black font-black uppercase shadow-[4px_4px_0_0_#000000] disabled:shadow-none disabled:translate-y-0 disabled:translate-x-0 hover:translate-y-px hover:translate-x-px hover:shadow-[2px_2px_0_0_#000000] transition-all flex items-center gap-2"
          >
            <Radio className="w-4 h-4" />
            Dispatch {selectedIds.length || ''}
          </button>
        </div>
      </div>
    </div>
  );
}
