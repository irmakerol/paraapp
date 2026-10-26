/** Shape returned by every form server action. Messages are i18n keys. */
export interface ActionState {
  ok?: boolean;
  /** Key under `auth.errors` (or a full key when it contains a dot). */
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Optional values for success messages, e.g. an email address. */
  values?: Record<string, string>;
}

export const initialState: ActionState = {};

/** Maps Supabase auth error codes to our message keys. */
export function authErrorKey(code: string | undefined): string {
  switch (code) {
    case 'invalid_credentials':
      return 'invalidCredentials';
    case 'email_not_confirmed':
      return 'emailNotConfirmed';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'rateLimited';
    case 'weak_password':
      return 'weakPassword';
    case 'user_already_exists':
    case 'email_exists':
      return 'userExists';
    case 'otp_expired':
    case 'flow_state_expired':
    case 'bad_code_verifier':
      return 'linkInvalid';
    default:
      return 'generic';
  }
}
