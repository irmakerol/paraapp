import { NextResponse } from 'next/server';
import { bearerViewer } from '@/lib/supabase/bearer';
import { messageSchema, sendChatMessage } from '@/lib/send-message';

/** Chat messages from the phone app: through the server so the other members get a push. */
export async function POST(request: Request) {
  const auth = await bearerViewer(request);
  if (!auth || auth.onboardingStep) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const parsed = messageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ ok: false, error: 'validation' }, { status: 400 });
  const message = await sendChatMessage(
    auth.supabase,
    { id: auth.viewer.user.id, name: auth.viewer.profile.display_name },
    parsed.data,
  );
  if (!message) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  return NextResponse.json({ ok: true, message });
}
