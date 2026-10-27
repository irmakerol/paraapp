import 'server-only';
import { notFound } from 'next/navigation';
import type { Role } from '@paraapp/core';
import { requireActiveViewer, type Viewer } from '@/lib/session';

export type StaffArea =
  'news' | 'tips' | 'events' | 'trips' | 'reports' | 'safety' | 'sites' | 'users' | 'requests';

/** Which roles may use each admin area. RLS enforces the same rules in the database. */
export const AREA_ROLES: Record<StaffArea, readonly Role[]> = {
  news: ['admin'],
  tips: ['instructor', 'moderator', 'admin'],
  events: ['instructor', 'admin'],
  trips: ['instructor', 'trip_organiser', 'admin'],
  reports: ['moderator', 'admin'],
  // Health data: safety officers only, not admins.
  safety: ['safety_officer'],
  sites: ['moderator', 'admin'],
  users: ['admin'],
  requests: ['admin'],
};

export function canUse(viewer: Viewer, area: StaffArea): boolean {
  return viewer.roles.some((r) => AREA_ROLES[area].includes(r));
}

export function staffAreas(viewer: Viewer): StaffArea[] {
  return (Object.keys(AREA_ROLES) as StaffArea[]).filter((a) => canUse(viewer, a));
}

/** For admin pages: 404 for anyone without the right role (we don't advertise admin URLs). */
export async function requireStaff(locale: string, area?: StaffArea): Promise<Viewer> {
  const viewer = await requireActiveViewer(locale);
  const ok = area ? canUse(viewer, area) : staffAreas(viewer).length > 0;
  if (!ok) notFound();
  return viewer;
}
