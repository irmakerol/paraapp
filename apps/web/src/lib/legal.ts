import 'server-only';
import type { LegalDocumentKind } from '@paraapp/core';
import { createClient } from '@/lib/supabase/server';
import type { Tables } from '@/lib/supabase/database.types';

/** Latest published version of a legal document, in the requested locale if available. */
export async function getLatestLegalDocument(
  kind: LegalDocumentKind,
  locale: string,
): Promise<Tables<'legal_documents'> | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('legal_documents')
      .select('*')
      .eq('kind', kind)
      .order('version', { ascending: false })
      .limit(4);
    if (!data?.length) return null;
    const latest = data[0]!.version;
    const candidates = data.filter((d) => d.version === latest);
    return candidates.find((d) => d.locale === locale) ?? candidates[0] ?? null;
  } catch {
    return null;
  }
}
