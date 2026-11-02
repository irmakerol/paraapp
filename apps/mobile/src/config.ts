// Inlined at build time from EXPO_PUBLIC_* (see .env.example). None of these are secrets.
export const CONFIG = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  webUrl: (process.env.EXPO_PUBLIC_WEB_URL ?? '').replace(/\/$/, ''),
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
};
