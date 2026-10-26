import { adSchema } from '@paraapp/core';
import { str } from '@/lib/form';

const AD_FIELDS = [
  'title',
  'category',
  'brand',
  'model',
  'size',
  'weight_min',
  'weight_max',
  'year',
  'hours',
  'flights',
  'certification',
  'last_check_date',
  'reserve_repack_date',
  'condition',
  'price',
  'currency',
  'city',
  'location_text',
  'description',
] as const;

export function readAd(formData: FormData) {
  return adSchema.safeParse(Object.fromEntries(AD_FIELDS.map((f) => [f, str(formData, f)])));
}

export const AD_LIST_COLUMNS =
  'id, title, category, brand, model, size, certification, condition, price, currency, city, status, is_club, created_at, expires_at, ad_photos(path, position)';

/** First photo by position. */
export function coverPhoto(photos: { path: string; position: number }[] | null | undefined) {
  return [...(photos ?? [])].sort((a, b) => a.position - b.position)[0]?.path ?? null;
}
