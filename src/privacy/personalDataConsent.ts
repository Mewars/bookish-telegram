export const PD_CONSENT_VERSION = 'PD-CONSENT-1.0';
export const PD_CONSENT_KEY = 'ryadom_pd_consent_v1';
export interface PersonalDataConsentReceipt {
  accepted: true;
  documentVersion: typeof PD_CONSENT_VERSION;
  acceptedAt: string;
  source: 'web-login';
}
export function hasCurrentPersonalDataConsent(): boolean {
  try {
    const raw = localStorage.getItem(PD_CONSENT_KEY);
    if (!raw) return false;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return false;
    const receipt = value as Partial<PersonalDataConsentReceipt>;
    return receipt.accepted === true && receipt.documentVersion === PD_CONSENT_VERSION
      && receipt.source === 'web-login' && typeof receipt.acceptedAt === 'string'
      && Number.isFinite(Date.parse(receipt.acceptedAt));
  } catch { return false; }
}
export function savePersonalDataConsent(): boolean {
  const receipt: PersonalDataConsentReceipt = {
    accepted: true, documentVersion: PD_CONSENT_VERSION,
    acceptedAt: new Date().toISOString(), source: 'web-login',
  };
  // После миграции пользовательской БД на российскую инфраструктуру
  // квитанция согласия должна дополнительно фиксироваться
  // на сервере и привязываться к user_id.
  try { localStorage.setItem(PD_CONSENT_KEY, JSON.stringify(receipt)); return true; }
  catch { return false; }
}
