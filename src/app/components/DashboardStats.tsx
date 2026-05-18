import { AlertTriangle, Radio, CheckCircle, Users } from 'lucide-react';

interface DashboardStatsProps {
  totalEmergencies: number;
  pending: number;
  dispatched: number;
  resolved: number;
}

export default function DashboardStats({ totalEmergencies, pending, dispatched, resolved }: DashboardStatsProps) {
  const stats = [
    {
      label: 'Total Emergencies',
      value: totalEmergencies,
      icon: AlertTriangle,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      label: 'Pending',
      value: pending,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
    },
    {
      label: 'Dispatched',
      value: dispatched,
      icon: Radio,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      label: 'Resolved',
      value: resolved,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-[2px] bg-black">
      {stats.map((stat, i) => (
        <div key={stat.label} className="flex items-center gap-2 p-3 bg-white">
          <div className={`p-2 border-2 border-black shadow-[2px_2px_0_0_#000000] ${stat.bgColor}`}>
            <stat.icon className={`w-5 h-5 text-black`} />
          </div>
          <div>
            <div className="text-xl font-bold leading-none mb-1">{stat.value}</div>
            <div className="text-[10px] font-bold uppercase">{stat.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
