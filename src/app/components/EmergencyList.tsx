import { Clock, AlertTriangle, CheckCircle, Radio, Users } from 'lucide-react';
import { Emergency } from '../types';

interface EmergencyListProps {
  emergencies: Emergency[];
  selectedEmergency: string | null;
  onEmergencySelect: (id: string) => void;
  onDispatchClick: (id: string) => void;
  onResolve: (id: string) => void;
}

export default function EmergencyList({
  emergencies,
  selectedEmergency,
  onEmergencySelect,
  onDispatchClick,
  onResolve
}: EmergencyListProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-400';
      case 'high': return 'bg-orange-400';
      case 'medium': return 'bg-yellow-400';
      case 'low': return 'bg-blue-400';
      default: return 'bg-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'dispatched': return <Radio className="w-4 h-4" />;
      case 'resolved': return <CheckCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  return (
    <div className="flex flex-col h-full bg-[#F4F5F0]">
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-3 p-3">
          {emergencies.map((emergency) => {
            const totalVictims = 
              emergency.victims.normal + 
              emergency.victims.childrenElders + 
              emergency.victims.injured + 
              emergency.victims.immediateHelp;

            return (
              <div
                key={emergency.id}
                onClick={() => onEmergencySelect(emergency.id)}
                className={`border-2 border-black bg-white rounded-none p-3 cursor-pointer transition-all ${
                  selectedEmergency === emergency.id ? 'shadow-[4px_4px_0_0_#000000] translate-y-[-2px] translate-x-[-2px]' : 'shadow-[2px_2px_0_0_#000000] hover:translate-y-[-1px] hover:translate-x-[-1px] hover:shadow-[3px_3px_0_0_#000000]'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1 border-2 border-black ${getSeverityColor(emergency.severity)}`}>
                      <AlertTriangle className="w-4 h-4 text-black" />
                    </div>
                    <span className="font-bold text-sm line-clamp-1 uppercase">{emergency.type}</span>
                  </div>
                </div>

                <div className="text-xs font-bold mb-2 truncate uppercase">{emergency.address}</div>

                <div className="flex justify-between items-end mb-3">
                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex items-center gap-1.5 text-xs font-bold border-2 border-black px-2 py-1 bg-[#F4F5F0] w-fit">
                      <Users className="w-3 h-3" />
                      <span>{totalVictims} AFFECTED</span>
                    </div>
                    {selectedEmergency === emergency.id && (
                      <div className="grid grid-cols-2 gap-1 text-[10px] font-bold uppercase border-2 border-black bg-[#F4F5F0] p-2 mt-1">
                        <div>Normal: {emergency.victims.normal}</div>
                        <div>Child/Elder: {emergency.victims.childrenElders}</div>
                        <div>Injured: {emergency.victims.injured}</div>
                        <div>Immediate: {emergency.victims.immediateHelp}</div>
                      </div>
                    )}
                  </div>
                  <div className="text-right pl-2">
                    <div className="text-[10px] font-bold uppercase whitespace-nowrap">Urgency</div>
                    <div className="font-black text-xl">
                      {emergency.urgencyScore}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t-2 border-black mt-2">
                  <div className="flex items-center gap-1.5 font-bold uppercase text-xs">
                    {getStatusIcon(emergency.status)}
                    <span>{emergency.status}</span>
                  </div>

                  <div className="flex gap-1">
                    {emergency.status === 'pending' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDispatchClick(emergency.id);
                        }}
                        className="px-3 py-1 bg-black text-white text-xs font-bold uppercase border-2 border-transparent hover:bg-white hover:text-black hover:border-black transition-colors"
                      >
                        Dispatch
                      </button>
                    )}
                    {emergency.status === 'dispatched' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onResolve(emergency.id);
                        }}
                        className="px-3 py-1 bg-white text-black text-xs font-bold uppercase border-2 border-black shadow-[2px_2px_0_0_#000000] hover:translate-y-px hover:shadow-[1px_1px_0_0_#000000] transition-all"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
