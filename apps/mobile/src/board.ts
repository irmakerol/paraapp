import * as Crypto from 'expo-crypto';
import type { PreparedImage } from './images';
import { supabase } from './supabase';

export interface Notice {
  id: string;
  userId: string;
  kind: 'offer' | 'request';
  category: string;
  title: string;
  body: string | null;
  site: string | null;
  place: string | null;
  date: string | null;
  seats: number | null;
  price: number | null;
  currency: string | null;
  photoUrl: string | null;
  createdAt: string;
  author: string | null;
}

export interface Ad {
  id: string;
  ownerId: string;
  title: string;
  category: string;
  brand: string | null;
  model: string | null;
  size: string | null;
  condition: string;
  price: number;
  currency: string;
  city: string | null;
  status: string;
  isClub: boolean;
  description: string;
  photos: string[];
  createdAt: string;
}

async function names(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  // Other people's names only through the privacy-masked view.
  const { data } = await supabase.from('profile_cards').select('id, display_name').in('id', unique);
  return new Map(
    ((data ?? []) as { id: string; display_name: string }[]).map((r) => [r.id, r.display_name]),
  );
}

interface NoticeRow {
  id: string;
  user_id: string;
  kind: Notice['kind'];
  category: string;
  title: string;
  body: string | null;
  place_text: string | null;
  notice_date: string | null;
  seats: number | null;
  price: number | null;
  currency: string | null;
  photo_path: string | null;
  created_at: string;
  sites: { name: string } | null;
}

/** Open notices (adults only: the database returns nothing to minors and guests). */
export async function listNotices(): Promise<Notice[]> {
  const { data, error } = await supabase
    .from('notices')
    .select('*, sites:site_id(name)')
    .eq('closed', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  const rows = (data ?? []) as NoticeRow[];
  const who = await names(rows.map((r) => r.user_id));
  const paths = rows.map((r) => r.photo_path).filter((p): p is string => Boolean(p));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await supabase.storage
      .from('notice-photos')
      .createSignedUrls(paths, 3600);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    kind: r.kind,
    category: r.category,
    title: r.title,
    body: r.body,
    site: r.sites?.name ?? null,
    place: r.place_text,
    date: r.notice_date,
    seats: r.seats,
    price: r.price,
    currency: r.currency,
    photoUrl: r.photo_path ? (signed.get(r.photo_path) ?? null) : null,
    createdAt: r.created_at,
    author: who.get(r.user_id) ?? null,
  }));
}

interface AdRow {
  id: string;
  owner_id: string;
  title: string;
  category: string;
  brand: string | null;
  model: string | null;
  size: string | null;
  condition: string;
  price: number;
  currency: string;
  city: string | null;
  status: string;
  is_club: boolean;
  description: string;
  created_at: string;
  ad_photos: { path: string; position: number }[];
}

/** Gear market ads that are for sale or reserved (photos are public). */
export async function listAds(): Promise<Ad[]> {
  const { data, error } = await supabase
    .from('ads')
    .select(
      'id, owner_id, title, category, brand, model, size, condition, price, currency, city, status, is_club, description, created_at, ad_photos(path, position)',
    )
    .in('status', ['active', 'reserved'])
    .is('removed_at', null)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return ((data ?? []) as AdRow[]).map((r) => ({
    id: r.id,
    ownerId: r.owner_id,
    title: r.title,
    category: r.category,
    brand: r.brand,
    model: r.model,
    size: r.size,
    condition: r.condition,
    price: r.price,
    currency: r.currency,
    city: r.city,
    status: r.status,
    isClub: r.is_club,
    description: r.description,
    createdAt: r.created_at,
    photos: [...r.ad_photos]
      .sort((a, b) => a.position - b.position)
      .map((p) => supabase.storage.from('ad-photos').getPublicUrl(p.path).data.publicUrl),
  }));
}

export function money(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

/** Must match NOTICE_KINDS / NOTICE_CATEGORIES in packages/core/src/notices.ts. */
export const NOTICE_KINDS = ['offer', 'request'] as const;
export const NOTICE_CATEGORIES = [
  'transport',
  'gear',
  'buddy',
  'training',
  'lost_found',
  'other',
] as const;

export interface NoticeInput {
  kind: (typeof NOTICE_KINDS)[number];
  category: (typeof NOTICE_CATEGORIES)[number];
  title: string;
  body: string;
  siteId: string | null;
  place: string;
  date: string;
  seats: number;
  price: string;
}

/** Posts a notice as the signed-in adult (RLS checks age and owner; same rules as noticeSchema). */
export async function postNotice(
  userId: string,
  n: NoticeInput,
  photo: PreparedImage | null = null,
): Promise<void> {
  const blank = (v: string) => (v.trim() === '' ? null : v.trim());
  const price = blank(n.price.replace(',', '.'));
  const priceValue = price == null ? null : Number(price);
  if (priceValue != null && (!Number.isFinite(priceValue) || priceValue < 0))
    throw new Error('validation');
  // Own folder only (storage policy); the photo was re-encoded on the phone (no EXIF/GPS).
  let photoPath: string | null = null;
  if (photo) {
    photoPath = `${userId}/${Crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('notice-photos')
      .upload(photoPath, photo.bytes, { contentType: photo.contentType });
    if (uploadError) throw new Error('photo');
  }
  const { error } = await supabase.from('notices').insert({
    user_id: userId,
    photo_path: photoPath,
    kind: n.kind,
    category: n.category,
    title: n.title.trim(),
    body: blank(n.body),
    site_id: n.siteId,
    place_text: blank(n.place),
    notice_date: blank(n.date),
    seats: n.category === 'transport' ? n.seats : null,
    price: priceValue,
    currency: priceValue == null ? null : 'TRY',
  });
  if (error) {
    if (photoPath) await supabase.storage.from('notice-photos').remove([photoPath]);
    throw error;
  }
}

export async function closeNotice(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('notices')
    .update({ closed: true })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function deleteNotice(userId: string, id: string): Promise<void> {
  const { data, error } = await supabase
    .from('notices')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('photo_path')
    .maybeSingle();
  if (error) throw error;
  const path = (data as { photo_path: string | null } | null)?.photo_path;
  if (path) await supabase.storage.from('notice-photos').remove([path]);
}
