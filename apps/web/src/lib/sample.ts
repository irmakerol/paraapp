/**
 * Sample records carry "(Ö)" (Örnek) in their names and titles; English pages show "(S)" (Sample).
 * See supabase/seeds/sample_data.sql.
 */
export function sampleLabel(text: string, locale: string): string;
export function sampleLabel(
  text: string | null | undefined,
  locale: string,
): string | null | undefined;
export function sampleLabel(text: string | null | undefined, locale: string) {
  return locale === 'en' && text ? text.replace(/\(Ö\)/g, '(S)') : text;
}
