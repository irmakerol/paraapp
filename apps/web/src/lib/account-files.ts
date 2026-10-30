import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

const PAGE = 1000;

async function listFolder(bucket: string, folder: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin.storage.from(bucket).list(folder, { limit: PAGE });
  const paths: string[] = [];
  for (const entry of data ?? []) {
    const path = `${folder}/${entry.name}`;
    // Folders come back without an id.
    if (entry.id) paths.push(path);
    else paths.push(...(await listFolder(bucket, path)));
  }
  return paths;
}

/**
 * Removes every file a user uploaded: avatar, ad and notice photos, flight files and the photos they
 * sent in chats. Storage objects are not covered by database cascades, so this runs when
 * the user asks to delete their account. Best effort: errors are swallowed so the deletion
 * request itself still goes through (the files are retried by staff if needed).
 */
export async function removeUserFiles(userId: string): Promise<void> {
  const admin = createAdminClient();
  try {
    const { data: images } = await admin
      .from('messages')
      .select('image_path')
      .eq('sender_id', userId)
      .not('image_path', 'is', null);
    const byBucket: [string, string[]][] = [
      ['avatars', await listFolder('avatars', userId)],
      ['ad-photos', await listFolder('ad-photos', userId)],
      ['notice-photos', await listFolder('notice-photos', userId)],
      ['flight-files', await listFolder('flight-files', userId)],
      ['chat-media', (images ?? []).map((m) => m.image_path!)],
    ];
    for (const [bucket, paths] of byBucket) {
      for (let i = 0; i < paths.length; i += PAGE) {
        await admin.storage.from(bucket).remove(paths.slice(i, i + PAGE));
      }
    }
  } catch {
    // See above.
  }
}
