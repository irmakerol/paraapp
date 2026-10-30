import 'server-only';
import { createClient } from '@/lib/supabase/server';

export interface ClubMessageSummary {
  id: string;
  title: string;
  createdAt: string;
  unread: boolean;
}

/** The latest club messages this person received (RLS returns only their own). */
export async function listClubMessages(userId: string, limit = 10): Promise<ClubMessageSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('club_message_recipients')
    .select('read_at, club_messages(id, title, created_at)')
    .eq('user_id', userId)
    .order('message_id', { ascending: false })
    .limit(50);
  return (data ?? [])
    .flatMap((r) =>
      r.club_messages
        ? [
            {
              id: r.club_messages.id,
              title: r.club_messages.title,
              createdAt: r.club_messages.created_at,
              unread: r.read_at === null,
            },
          ]
        : [],
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
