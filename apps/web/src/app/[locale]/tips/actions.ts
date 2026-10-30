'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/session';

const uuid = z.string().uuid();

export async function toggleBookmark(tipId: string, saved: boolean): Promise<void> {
  const user = await getUser();
  if (!user || !uuid.safeParse(tipId).success) return;
  const supabase = await createClient();
  if (saved) {
    await supabase
      .from('tip_bookmarks')
      .upsert({ tip_id: tipId, user_id: user.id }, { ignoreDuplicates: true });
  } else {
    await supabase.from('tip_bookmarks').delete().eq('tip_id', tipId).eq('user_id', user.id);
  }
  revalidatePath('/[locale]/tips/saved', 'page');
}
