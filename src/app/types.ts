export interface EmergencyVictims {
  normal: number;
  childrenElders: number;
  injured: number;
  immediateHelp: number;
}

export interface Emergency {
  id: string;
  location: [number, number]; // [lat, lng]
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  address: string;
  status: 'pending' | 'dispatched' | 'resolved';
  timestamp: Date;
  waitingDays: number;
  areaDangerScore: number; // 0-10. >= 8 means heavily flooded (canoe only)
  victims: EmergencyVictims;
  urgencyScore?: number;
  assignedVehicleIds?: string[];
}

export interface Package {
  id: string;
  emergencyId: string;
  level: number;
  weight: number;
  value: number;
}

export interface Vehicle {
  id: string;
  name: string;
  type: 'small_truck' | 'big_truck' | 'canoe';
  capacity: number; // kg
}

export interface FloodZone {
  id: string;
  center: [number, number];
  radiusMeters: number;
  intensity: number; // 0..1
}
