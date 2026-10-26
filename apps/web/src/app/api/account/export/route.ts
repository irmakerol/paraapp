import { NextResponse } from 'next/server';
import { APP_CONFIG } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptField } from '@/lib/crypto';
import { serverEnv } from '@/lib/env';

/** "Download my data" (KVKK Art. 11 / GDPR Arts. 15 and 20). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

  const [profile, priv, roles, consents, acceptances, requests, guardians] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('profile_private').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('user_roles').select('role, granted_at').eq('user_id', user.id),
    supabase
      .from('consents')
      .select('consent_type, granted, method, created_at, document_id')
      .eq('user_id', user.id)
      .order('created_at'),
    supabase
      .from('legal_acceptances')
      .select('document_id, accepted_at, legal_documents(kind, locale, version)')
      .eq('user_id', user.id),
    supabase
      .from('data_requests')
      .select('request_type, channel, status, received_at, due_at, completed_at, details')
      .eq('user_id', user.id),
    supabase
      .from('guardian_consents')
      .select('guardian_name, guardian_email, created_at, expires_at, confirmed_at')
      .eq('user_id', user.id),
  ]);

  // Community and flying data. The service role is used so rows the user cannot read back
  // themselves (e.g. reports they filed) are included too; every query is filtered by user id.
  const admin = createAdminClient();
  const uid = user.id;
  const [
    comments,
    likes,
    tips,
    bookmarks,
    ads,
    chatsJoined,
    sentMessages,
    reports,
    blocks,
    pushSubs,
    notifications,
    flights,
    tracks,
    equipment,
    following,
    followers,
  ] = await Promise.all([
    admin.from('news_comments').select('news_id, body, hidden_at, created_at').eq('author_id', uid),
    admin.from('news_likes').select('news_id, created_at').eq('user_id', uid),
    admin
      .from('tips')
      .select('id, title, status, locale, summary, body_md, created_at')
      .eq('author_id', uid),
    admin.from('tip_bookmarks').select('tip_id, created_at').eq('user_id', uid),
    admin.from('ads').select('*, ad_photos(path, position)').eq('owner_id', uid),
    admin.from('chat_members').select('chat_id, joined_at, last_read_at, muted').eq('user_id', uid),
    admin
      .from('messages')
      .select('chat_id, body, image_path, lat, lng, deleted_at, created_at')
      .eq('sender_id', uid),
    admin
      .from('reports')
      .select('target_type, target_id, reason, details, status, created_at')
      .eq('reporter_id', uid),
    admin.from('blocks').select('blocked_id, created_at').eq('blocker_id', uid),
    admin.from('push_subscriptions').select('endpoint, user_agent, created_at').eq('user_id', uid),
    admin.from('notifications').select('kind, payload, read_at, created_at').eq('user_id', uid),
    admin.from('flights').select('*').eq('user_id', uid).order('started_at'),
    admin.from('flight_tracks').select('*').eq('user_id', uid),
    admin.from('equipment').select('*').eq('user_id', uid),
    admin.from('follows').select('followee_id, created_at').eq('follower_id', uid),
    admin.from('follows').select('follower_id, created_at').eq('followee_id', uid),
  ]);

  let licence: string | null = null;
  if (priv.data?.licence_number_enc) {
    try {
      licence = decryptField(priv.data.licence_number_enc, serverEnv().LICENCE_ENCRYPTION_KEY);
    } catch {
      licence = null;
    }
  }

  const body = {
    exported_at: new Date().toISOString(),
    controller: APP_CONFIG.club,
    account: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      providers: user.app_metadata.providers ?? [],
    },
    profile: profile.data,
    private: { birth_date: priv.data?.birth_date ?? null, licence_number: licence },
    roles: roles.data ?? [],
    consents: consents.data ?? [],
    legal_acceptances: acceptances.data ?? [],
    data_requests: requests.data ?? [],
    guardian_consents: guardians.data ?? [],
    news_comments: comments.data ?? [],
    news_likes: likes.data ?? [],
    tips_written: tips.data ?? [],
    tip_bookmarks: bookmarks.data ?? [],
    ads: ads.data ?? [],
    chats: chatsJoined.data ?? [],
    messages_sent: sentMessages.data ?? [],
    reports_filed: reports.data ?? [],
    blocked_users: blocks.data ?? [],
    push_subscriptions: pushSubs.data ?? [],
    notifications: notifications.data ?? [],
    // Full tracks (including the first and last 500 m) are in flight_tracks. Original IGC/GPX
    // files can be downloaded from each flight page.
    flights: flights.data ?? [],
    flight_tracks: tracks.data ?? [],
    equipment: equipment.data ?? [],
    following: following.data ?? [],
    followers: followers.data ?? [],
  };

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${APP_CONFIG.name.toLowerCase()}-my-data-${date}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
