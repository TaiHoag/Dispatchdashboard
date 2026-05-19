import { Emergency, FloodZone, Vehicle } from '../types';

const SHEET_ID = '15CvYf51bcRhMI_K_YuQdBMJEHaVBceGb1jNfOSK33PU';

const TABS = {
  zoneNodes: 'tbl_Zone_Nodes',
  clusters: 'tbl_Request_Clusters',
  sosRequests: 'tbl_SOS_Requests',
  volunteers: 'tbl_Volunteers',
  dispatchLogs: 'tbl_Dispatch_Logs',
} as const;

function csvUrl(tab: string) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
}

// RFC4180-ish CSV parser (quoted fields, escaped quotes, embedded newlines).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (c === '"') { inQuotes = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim().length));
}

function toRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) =>
    Object.fromEntries(headers.map((h, idx) => [h, (r[idx] ?? '').trim()]))
  );
}

async function fetchTab(tab: string): Promise<Record<string, string>[]> {
  const res = await fetch(csvUrl(tab));
  if (!res.ok) throw new Error(`Failed to fetch sheet tab "${tab}" (${res.status}). Make sure the sheet is shared "Anyone with the link".`);
  return toRecords(await res.text());
}

// Vietnamese province/region coordinates seen in the sheet.
const NODE_COORDS: Record<string, [number, number]> = {
  'NODE-HCM': [10.7626, 106.6602],   // TP.HCM
  'NODE-BD': [11.1733, 106.6519],    // Bình Dương
  'NODE-DN': [16.0544, 108.2022],    // Đà Nẵng
  'NODE-ĐN': [10.9522, 106.8225],    // Đồng Nai
  'NODE-LD': [11.9404, 108.4583],    // Lâm Đồng
  'NODE-LĐ': [11.9404, 108.4583],    // Lâm Đồng
  'NODE-QB': [17.4833, 106.6000],    // Quảng Bình
  'NODE-QT': [16.7493, 107.1881],    // Quảng Trị
  'NODE-HUE': [16.4637, 107.5909],   // Huế
  'NODE-HT': [18.3333, 105.9000],    // Hà Tĩnh
  'NODE-QN': [15.5658, 108.4875],    // Quảng Nam
  'NODE-NA': [18.6667, 105.6667],    // Nghệ An
  'NODE-TH': [19.8000, 105.7667],    // Thanh Hoá
  'NODE-NĐ': [20.4333, 106.1667],    // Nam Định
  'NODE-BĐ': [13.7820, 109.2196],    // Bình Định
  'NODE-HN': [21.0285, 105.8542],    // Hà Nội
  'NODE-CT': [10.0452, 105.7469],    // Cần Thơ
  'NODE-NB': [20.2506, 105.9745]     // Ninh Bình
};

function hashCoord(seed: string): [number, number] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = ((h >>> 0) % 10000) / 10000;
  const b = (((h >>> 8) >>> 0) % 10000) / 10000;
  return [10 + a * 11, 105 + b * 5];
}

function locateNode(nodeId: string, node?: Record<string, string>): [number, number] {
  const fromRow = coordsFromRow(node);
  if (fromRow) return fromRow;
  return NODE_COORDS[nodeId] || hashCoord(nodeId || 'unknown');
}

// Try common lat/lng column shapes found in the sheet.
function coordsFromRow(row?: Record<string, string>): [number, number] | null {
  if (!row) return null;
  const latKeys = ['latitude', 'lat', 'node_lat', 'node_latitude', 'y'];
  const lngKeys = ['longitude', 'lng', 'lon', 'node_lng', 'node_longitude', 'x'];
  const pick = (keys: string[]) => {
    for (const k of keys) {
      const v = row[k] ?? row[k.toUpperCase()];
      if (v != null && v !== '') {
        const n = Number(String(v).replace(/[^\d.\-]/g, ''));
        if (Number.isFinite(n) && n !== 0) return n;
      }
    }
    return null;
  };
  const lat = pick(latKeys);
  const lng = pick(lngKeys);
  if (lat == null || lng == null) return null;
  return [lat, lng];
}

function num(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(String(v).replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function severityFromPriority(priority: string, immediate: number, injured: number): Emergency['severity'] {
  const p = (priority || '').toLowerCase();
  if (p.includes('critical') || immediate > 0) return 'critical';
  if (p.includes('high') || injured > 0) return 'high';
  if (p.includes('medium')) return 'medium';
  if (p.includes('low')) return 'low';
  return 'medium';
}

function mapStatus(opStatus: string, dispatchStatus: string | undefined): Emergency['status'] {
  const v = `${opStatus || ''} ${dispatchStatus || ''}`.toLowerCase();
  if (v.includes('resolv') || v.includes('complet') || v.includes('closed') || v.includes('done')) return 'resolved';
  if (v.includes('dispatch') || v.includes('assigned') || v.includes('en route') || v.includes('progress')) return 'dispatched';
  return 'pending';
}

// Map severity index to 1-4. "Boat" required means heavily flooded (3).
function dangerScoreFromRow(requiredVehicleType: string, severityIndex: number): number {
  const v = (requiredVehicleType || '').toLowerCase();
  const boatOnly = v.includes('boat') && !v.includes('truck');
  if (boatOnly) return 4;
  return Math.max(1, Math.min(4, severityIndex));
}

function parseTime(ts: string): Date {
  const t = Date.parse(ts);
  return Number.isFinite(t) ? new Date(t) : new Date();
}

function classifyVehicle(vehicleClass: string, capacityKg: number): Vehicle['type'] {
  const v = (vehicleClass || '').toLowerCase();
  if (v.includes('boat') || v.includes('canoe')) return 'canoe';
  if (capacityKg >= 1000) return 'big_truck';
  return 'small_truck';
}

export interface SheetSnapshot {
  emergencies: Emergency[];
  vehicles: Vehicle[];
  floodZones: FloodZone[];
}

function buildFloodZones(zoneNodes: Record<string, string>[]): FloodZone[] {
  return zoneNodes
    .map((n) => {
      const risk = num(n.severity_index) || 1;
      const coords = coordsFromRow(n) || NODE_COORDS[n.node_id];
      if (!coords) return null;
      const radius = num(n.radius_meters) || 4000 + risk * 2000;
      return {
        id: n.node_id || `zone-${Math.random().toString(36).slice(2, 8)}`,
        center: coords,
        radiusMeters: radius,
        intensity: Math.min(1, risk / 3),
      } as FloodZone;
    })
    .filter((z): z is FloodZone => z !== null);
}

export async function loadFromSheet(): Promise<SheetSnapshot> {
  const [zoneNodes, sosRequests, dispatchLogs, volunteers] = await Promise.all([
    fetchTab(TABS.zoneNodes),
    fetchTab(TABS.sosRequests),
    fetchTab(TABS.dispatchLogs).catch(() => [] as Record<string, string>[]),
    fetchTab(TABS.volunteers).catch(() => [] as Record<string, string>[]),
  ]);

  const nodeById = new Map<string, Record<string, string>>();
  for (const n of zoneNodes) nodeById.set(n.node_id, n);

  // Group dispatches by request_id; collect assigned volunteer ids.
  const dispatchesByRequest = new Map<string, Record<string, string>[]>();
  for (const d of dispatchLogs) {
    if (!d.request_id) continue;
    const arr = dispatchesByRequest.get(d.request_id) || [];
    arr.push(d);
    dispatchesByRequest.set(d.request_id, arr);
  }

  const emergencies: Emergency[] = sosRequests.map((r) => {
    const node = nodeById.get(r.node_id);
    const nodeName = r.zone_name_lookup || node?.node_name || r.node_id || 'Unknown';
    const location = locateNode(r.node_id, node);

    const victims = {
      normal: num(r.healthy_count),
      childrenElders: num(r.vulnerable_count),
      injured: num(r.medical_count),
      immediateHelp: num(r.emergency_count),
    };

    const severityIndex = num(r.severity_index) || num(node?.severity_index) || 1;
    const dangerScore = dangerScoreFromRow(r.required_vehicle_type, severityIndex);
    const severity = severityFromPriority(r.priority_level, victims.immediateHelp, victims.injured);
    const dispatches = dispatchesByRequest.get(r.request_id) || [];
    const dispatchStatus = dispatches[0]?.dispatch_status;
    const status = mapStatus(r.operational_status, dispatchStatus);
    const assignedVehicleIds = dispatches.map((d) => d.volunteer_id).filter(Boolean);

    const sheetUrgency = num(r.computed_urgency_score);
    const waitingDays = num(r.waiting_days_calc);

    return {
      id: r.request_id || `sos-${Math.random().toString(36).slice(2, 8)}`,
      location,
      severity,
      type: r.urgent_need_type
        ? `${r.urgent_need_type} request — ${nodeName}`
        : `SOS request — ${nodeName}`,
      address: `${nodeName}, Vietnam`,
      status,
      timestamp: parseTime(r.created_at),
      waitingDays,
      areaDangerScore: dangerScore,
      victims,
      urgencyScore: sheetUrgency || undefined,
      assignedVehicleIds: assignedVehicleIds.length ? assignedVehicleIds : undefined,
    };
  });

  const vehicles: Vehicle[] = volunteers.map((v) => {
    const capacity = num(v['vehicle_capacity_kg (assumed)'] || v.vehicle_capacity_kg);
    const type = classifyVehicle(v.vehicle_class, capacity);
    return {
      id: v.volunteer_id,
      name: v.volunteer_name || v.volunteer_id,
      type,
      capacity: capacity || (type === 'canoe' ? 100 : 150),
      available: (v.availability_status || '').toLowerCase().includes('available')
        && !(v.availability_status || '').toLowerCase().includes('not'),
      baseNodeId: v.current_node_id,
      role: v.volunteer_role,
      resources: v.associated_resources,
    };
  });

  const floodZones = buildFloodZones(zoneNodes);

  return { emergencies, vehicles, floodZones };
}
