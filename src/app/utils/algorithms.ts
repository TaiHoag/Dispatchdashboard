import { Emergency, Package } from "../types";

export const MAP_BOUNDS = {
  minLng: 105.0,
  maxLng: 110.0,
  minLat: 10.0,
  maxLat: 17.0,
};

export const MAP_CENTER: [number, number] = [11, 108];
export const DEPOT_LOCATION: [number, number] = [11, 108];

export const URGENCY_MAX = Number.POSITIVE_INFINITY;

export function isUrgencyMax(score: number): boolean {
  return !Number.isFinite(score);
}

export function isCanoeOnly(emergency: Emergency): boolean {
  return emergency.areaDangerScore >= 3;
}

export function getPackagesForEmergency(
  emergency: Emergency,
): Package[] {
  const packages: Package[] = [];
  let pkgIdx = 0;
  for (let i = 0; i < emergency.victims.normal; i++) {
    packages.push({
      id: `${emergency.id}-L1-${pkgIdx++}`,
      emergencyId: emergency.id,
      level: 1,
      weight: 30.0,
      value: 90.0,
    });
  }
  for (let i = 0; i < emergency.victims.childrenElders; i++) {
    packages.push({
      id: `${emergency.id}-L2-${pkgIdx++}`,
      emergencyId: emergency.id,
      level: 2,
      weight: 37.5,
      value: 112.5,
    });
  }
  for (let i = 0; i < emergency.victims.injured; i++) {
    packages.push({
      id: `${emergency.id}-L3-${pkgIdx++}`,
      emergencyId: emergency.id,
      level: 3,
      weight: 50.0,
      value: 235.0,
    });
  }
  for (let i = 0; i < emergency.victims.immediateHelp; i++) {
    packages.push({
      id: `${emergency.id}-L4-${pkgIdx++}`,
      emergencyId: emergency.id,
      level: 4,
      weight: 70.0,
      value: 380.0,
    });
  }
  return packages;
}

// Greedy multi-vehicle knapsack: load highest-value-per-weight items first into combined capacity.
export function optimizeKnapsack(
  capacity: number,
  packages: Package[],
): {
  selected: Package[];
  totalValue: number;
  totalWeight: number;
} {
  const W = Math.floor(capacity * 10);
  const items = packages.map((p) => ({
    ...p,
    weightInt: Math.floor(p.weight * 10),
  }));
  const dp = new Array(W + 1).fill(0);
  const chosen = Array.from({ length: items.length }, () =>
    new Array(W + 1).fill(false),
  );

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
function haversine(
  a: [number, number],
  b: [number, number],
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Real road routing via the public OSRM demo server. Falls back to a straight line on error.
export async function fetchOsrmRoute(
  start: [number, number],
  end: [number, number],
): Promise<[number, number][]> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("routing failed");
    const data = await res.json();
    const coords = data?.routes?.[0]?.geometry?.coordinates as
      | [number, number][]
      | undefined;
    if (!coords?.length) throw new Error("empty route");
    return coords.map(
      ([lng, lat]) => [lat, lng] as [number, number],
    );
  } catch {
    return [start, end];
  }
}

// Build a canoe path that gently bends along the river toward the destination.
export function buildCanoePath(
  start: [number, number],
  end: [number, number],
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

export function routeDistanceMeters(
  path: [number, number][],
): number {
  let d = 0;
  for (let i = 1; i < path.length; i++)
    d += haversine(path[i - 1], path[i]);
  return d;
}
