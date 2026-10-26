import type { AgeGroup } from './age';

export const VISIBILITIES = ['public', 'members', 'private'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

/** Profile fields whose visibility the user controls. Must match `profiles.field_privacy` in SQL. */
export const PRIVATE_PROFILE_FIELDS = [
  'full_name',
  'photo',
  'location',
  'home_site',
  'pilot_level',
  'years_flying',
  'wings',
  'bio',
] as const;
export type PrivacyField = (typeof PRIVATE_PROFILE_FIELDS)[number];
export type FieldPrivacy = Record<PrivacyField, Visibility>;

export function defaultFieldPrivacy(group: Exclude<AgeGroup, 'too_young'>): FieldPrivacy {
  const fallback: Visibility = group === 'minor' ? 'private' : 'members';
  return {
    full_name: fallback,
    photo: group === 'minor' ? 'private' : 'public',
    location: fallback,
    home_site: group === 'minor' ? 'private' : 'public',
    pilot_level: group === 'minor' ? 'private' : 'public',
    years_flying: group === 'minor' ? 'private' : 'public',
    wings: group === 'minor' ? 'private' : 'public',
    bio: group === 'minor' ? 'private' : 'public',
  };
}

export interface Viewer {
  isOwner: boolean;
  /** Verified club member or staff. */
  isMember: boolean;
}

/** Mirrors `public.can_view_field()` in SQL so the UI can explain what others see. */
export function canView(visibility: Visibility, viewer: Viewer): boolean {
  if (viewer.isOwner) return true;
  if (visibility === 'public') return true;
  if (visibility === 'members') return viewer.isMember;
  return false;
}

export const FLIGHT_VISIBILITIES = ['public', 'friends', 'private'] as const;
export type FlightVisibility = (typeof FLIGHT_VISIBILITIES)[number];

export function defaultFlightVisibility(group: Exclude<AgeGroup, 'too_young'>): FlightVisibility {
  return group === 'minor' ? 'private' : 'public';
}
