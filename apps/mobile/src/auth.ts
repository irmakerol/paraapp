import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { CONFIG } from './config';
import { supabase } from './supabase';

export type SignInResult = 'ok' | 'cancelled' | 'failed' | 'notConfigured' | 'wrongPassword';

/** Native Sign in with Apple; Supabase checks the ID token and the nonce. */
export async function signInWithApple(): Promise<SignInResult> {
  try {
    const rawNonce = Crypto.randomUUID();
    const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashed,
    });
    if (!credential.identityToken) return 'failed';
    // Apple only shares the name on the very first sign-in; pass it on for the profile.
    const name = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(' ');
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error) return 'failed';
    if (name) await supabase.auth.updateUser({ data: { name, full_name: name } });
    return 'ok';
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'ERR_REQUEST_CANCELED') {
      return 'cancelled';
    }
    return 'failed';
  }
}

let googleConfigured = false;

/** Native Google Sign-In; the ID token is exchanged for a Supabase session. */
export async function signInWithGoogle(): Promise<SignInResult> {
  if (!CONFIG.googleIosClientId || !CONFIG.googleWebClientId) return 'notConfigured';
  try {
    if (!googleConfigured) {
      GoogleSignin.configure({
        iosClientId: CONFIG.googleIosClientId,
        webClientId: CONFIG.googleWebClientId,
      });
      googleConfigured = true;
    }
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return 'cancelled';
    const token = response.data.idToken;
    if (!token) return 'failed';
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token });
    return error ? 'failed' : 'ok';
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.IN_PROGRESS) return 'cancelled';
    return 'failed';
  }
}

export async function signInWithEmail(email: string, password: string): Promise<SignInResult> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (!error) return 'ok';
  return error.status === 400 ? 'wrongPassword' : 'failed';
}

export async function signOut() {
  if (googleConfigured) await GoogleSignin.signOut().catch(() => undefined);
  await supabase.auth.signOut({ scope: 'local' });
}
