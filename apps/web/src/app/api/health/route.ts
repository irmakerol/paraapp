import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Liveness check for the container and uptime monitors. Says nothing about the database. */
export function GET() {
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
