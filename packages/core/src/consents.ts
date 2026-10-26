/**
 * Optional, granular consents (KVKK açık rıza / GDPR consent).
 * None are required to use the app and none are pre-ticked.
 * Must match the `consent_type` enum in SQL.
 */
export const CONSENT_TYPES = [
  'marketing_notifications',
  'analytics',
  'public_profile',
  'live_location',
  'incident_special_category',
] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

/** Consents offered at sign-up. The rest are asked when the feature is first used. */
export const SIGNUP_CONSENTS: readonly ConsentType[] = [
  'marketing_notifications',
  'analytics',
  'public_profile',
];

/** Legal documents a user must have seen/accepted. Must match `legal_document_kind` in SQL. */
export const LEGAL_DOCUMENT_KINDS = ['privacy_notice', 'terms', 'explicit_consent'] as const;
export type LegalDocumentKind = (typeof LEGAL_DOCUMENT_KINDS)[number];
