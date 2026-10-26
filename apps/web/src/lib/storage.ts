import { publicEnv } from '@/lib/env';

export type PublicBucket = 'content' | 'ad-photos';

/** URL of an object in a public bucket (news covers, ad photos). */
export function publicUrl(bucket: PublicBucket, path: string | null | undefined): string | null {
  if (!path) return null;
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${encoded}`;
}
