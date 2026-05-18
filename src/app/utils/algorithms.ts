import { Emergency, FloodZone, Package } from '../types';

export const MAP_BOUNDS = {
  minLng: 107.50,
  maxLng: 107.65,
  minLat: 16.40,
  maxLat: 16.52,
};

export const MAP_CENTER: [number, number] = [16.4637, 107.5909];
export const DEPOT_LOCATION: [number, number] = [16.4637, 107.5909];

// Flood hazard zones over the Hue region. areaDangerScore >= 8 ⇒ canoe-only.
export const FLOOD_ZONES: FloodZone[] = [
  { id: 'fz-1', center: [16.470, 107.560], radiusMeters: 900, intensity: 0.85 },
  { id: 'fz-2', center: [16.455, 107.605], radiusMeters: 1100, intensity: 0.7 },
  { id: 'fz-3', center: [16.442, 107.555], radiusMeters: 800, intensity: 0.9 },
  { id: 'fz-4', center: [16.478, 107.620], radiusMeters: 700, intensity: 0.55 },
];

// Urgency uses the specified victim weights: 1 / 5 / 20 / 100.
export function calculateUrgency(emergency: Emergency): number {
  const severityWeight: Record<string, number> = { low: 10, medium: 20, high: 30, critical: 40 };
  const base = severityWeight[emergency.severity] || 10;
  const waitingScore = emergency.waitingDays * 5;
  const dangerScore = emergency.areaDangerScore * 2;
  const victimScore =
    emergency.victims.normal * 1 +
    emergency.victims.childrenElders * 5 +
    emergency.victims.injured * 20 +
    emergency.victims.immediateHelp * 100;

  return base + waitingScore + dangerScore + victimScore;
}

export function isCanoeOnly(emergency: Emergency): boolean {
  return emergency.areaDangerScore >= 8;
}

export function getPackagesForEmergency(emergency: Emergency): Package[] {
  const packages: Package[] = [];
  let pkgIdx = 0;
  for (let i = 0; i < emergency.victims.normal; i++) {
    packages.push({ id: `${emergency.id}-L1-${pkgIdx++}`, emergencyId: emergency.id, level: 1, weight: 30.0, value: 90.0 });
  }
  for (let i = 0; i < emergency.victims.childrenElders; i++) {
    packages.push({ id: `${emergency.id}-L2-${pkgIdx++}`, emergencyId: emergency.id, level: 2, weight: 37.5, value: 112.5 });
  }
  for (let i = 0; i < emergency.victims.injured; i++) {
    packages.push({ id: `${emergency.id}-L3-${pkgIdx++}`, emergencyId: emergency.id, level: 3, weight: 50.0, value: 235.0 });
  }
  for (let i = 0; i < emergency.victims.immediateHelp; i++) {
    packages.push({ id: `${emergency.id}-L4-${pkgIdx++}`, emergencyId: emergency.id, level: 4, weight: 70.0, value: 380.0 });
  }
  return packages;
}

// Greedy multi-vehicle knapsack: load highest-value-per-weight items first into combined capacity.
export function optimizeKnapsack(
  capacity: number,
  packages: Package[]
): { selected: Package[]; totalValue: number; totalWeight: number } {
  const W = Math.floor(capacity * 10);
  const items = packages.map((p) => ({ ...p, weightInt: Math.floor(p.weight * 10) }));
  const dp = new Array(W + 1).fill(0);
  const chosen = Array.from({ length: items.length }, () => new Array(W + 1).fill(false));

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    for (let w = W; w >= item.weightInt; w--) {
      if (dp[w - item.weightInt] + item.value > dp[w]) {
        dp[w] = dp[w - item.weightInt] + item.value;
        chosen[i][w] = true;
      }
    }
  }

  const selected: Package[] = [];
  let currW = W;
  for (let i = items.length - 1; i >= 0; i--) {
    if (chosen[i][currW]) {
      selected.push(packages[i]);
      currW -= items[i].weightInt;
    }
  }

  return {
    selected,
    totalValue: selected.reduce((s, p) => s + p.value, 0),
    totalWeight: selected.reduce((s, p) => s + p.weight, 0),
  };
}

// Haversine distance in meters
function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Real road routing via the public OSRM demo server. Falls back to a straight line on error.
export async function fetchOsrmRoute(
  start: [number, number],
  end: [number, number]
): Promise<[number, number][]> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('routing failed');
    const data = await res.json();
    const coords = data?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
    if (!coords?.length) throw new Error('empty route');
    return coords.map(([lng, lat]) => [lat, lng] as [number, number]);
  } catch {
    return [start, end];
  }
}

// Build a canoe path that gently bends along the river toward the destination.
export function buildCanoePath(
  start: [number, number],
  end: [number, number]
): [number, number][] {
  const steps = 24;
  const path: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = start[0] + (end[0] - start[0]) * t;
    const lng = start[1] + (end[1] - start[1]) * t;
    // small lateral wiggle to suggest a waterway path
    const offset = Math.sin(t * Math.PI) * 0.002;
    path.push([lat + offset * 0.4, lng + offset]);
  }
  return path;
}

export function routeDistanceMeters(path: [number, number][]): number {
  let d = 0;
  for (let i = 1; i < path.length; i++) d += haversine(path[i - 1], path[i]);
  return d;
}

// Cluster nearby emergencies (k-means) for batched dispatch.
export function clusterEmergencies(emergencies: Emergency[], k: number): Emergency[][] {
  if (emergencies.length <= k) return emergencies.map((e) => [e]);
  let centroids = emergencies.slice(0, k).map((e) => ({ lat: e.location[0], lng: e.location[1] }));
  let clusters: Emergency[][] = [];
  for (let iter = 0; iter < 10; iter++) {
    clusters = Array.from({ length: k }, () => []);
    for (const e of emergencies) {
      let minDist = Infinity;
      let minIdx = 0;
      for (let i = 0; i < k; i++) {
        const d = Math.hypot(e.location[0] - centroids[i].lat, e.location[1] - centroids[i].lng);
        if (d < minDist) { minDist = d; minIdx = i; }
      }
      clusters[minIdx].push(e);
    }
    for (let i = 0; i < k; i++) {
      if (clusters[i].length === 0) continue;
      const avgLat = clusters[i].reduce((s, e) => s + e.location[0], 0) / clusters[i].length;
      const avgLng = clusters[i].reduce((s, e) => s + e.location[1], 0) / clusters[i].length;
      centroids[i] = { lat: avgLat, lng: avgLng };
    }
  }
  return clusters.filter((c) => c.length > 0);
}
