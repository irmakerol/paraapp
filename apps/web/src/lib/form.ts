import { routing } from '@/i18n/routing';

/** The locale a form posted from, falling back to the default. */
export function localeFrom(formData: FormData): string {
  const value = String(formData.get('locale') ?? '');
  return (routing.locales as readonly string[]).includes(value) ? value : routing.defaultLocale;
}

/** A form field as a string ('' when missing). */
export function str(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

/** A checkbox: true when ticked. */
export function bool(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === 'on' || value === 'true' || value === '1';
}
