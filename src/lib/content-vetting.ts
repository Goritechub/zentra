/**
 * Shared private-information vetting utility.
 * Used in messaging, attachments, profile fields, and any user-submitted text
 * to prevent sharing of contact details or off-platform communication channels.
 */

const PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i,
  emailProvider: /\b(?:gmail|yahoo|outlook|hotmail|protonmail|ymail|aol|icloud|zoho|mail\.com)\b/i,
  phone: /(?:\+?234|0)?[789][01]\d{8}|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\d{10,11}\b/,
  suspiciousDigits: /\b\d{7,}\b/,
  bankAccount: /\b\d{10}\b|\b\d{3}[-\s]?\d{3}[-\s]?\d{4}\b|(?:account\s*(?:number|no|#|num))\s*:?\s*\d+/i,
  whatsapp: /whatsapp|whats\s*app|wa\.me|chat\s*me\s*on/i,
  socialMedia: /\b(?:instagram|facebook|twitter|tiktok|snapchat|telegram|linkedin|signal)\b/i,
  url: /https?:\/\/[^\s]+|www\.[^\s]+/i,
  scam: /\b(?:send money|wire transfer|western union|moneygram|bitcoin wallet|crypto wallet|sort code|routing number)\b/i,
  profanity: /\b(?:fuck|shit|bitch|ass(?:hole)?|damn|bastard|dick|cunt|idiot|stupid|dumb(?:ass)?|hell|crap)\b/i,
};

export interface VetResult {
  blocked: boolean;
  reason: string | null;
}

/**
 * Vet any user-supplied text (messages, attachment names, profile fields, etc.)
 * Returns { blocked: true, reason } if the content violates rules.
 */
export function vetContent(content: string): VetResult {
  if (PATTERNS.email.test(content)) {
    return { blocked: true, reason: "Sharing email addresses is not allowed. Keep all communication on the platform." };
  }
  if (PATTERNS.emailProvider.test(content)) {
    return { blocked: true, reason: "References to email services (Gmail, Yahoo, etc.) are not allowed." };
  }
  if (PATTERNS.phone.test(content)) {
    return { blocked: true, reason: "Sharing phone numbers is not allowed. Keep all communication on the platform." };
  }
  if (PATTERNS.suspiciousDigits.test(content)) {
    return { blocked: true, reason: "Sharing long number sequences that may be phone numbers or account numbers is not allowed." };
  }
  if (PATTERNS.bankAccount.test(content)) {
    return { blocked: true, reason: "Sharing bank account details is not allowed for your safety." };
  }
  if (PATTERNS.whatsapp.test(content)) {
    return { blocked: true, reason: "WhatsApp and off-platform contact sharing is not allowed." };
  }
  if (PATTERNS.socialMedia.test(content)) {
    return { blocked: true, reason: "Sharing social media handles is not allowed. Keep all communication on the platform." };
  }
  if (PATTERNS.scam.test(content)) {
    return { blocked: true, reason: "This content contains prohibited financial content." };
  }
  if (PATTERNS.profanity.test(content)) {
    return { blocked: true, reason: "Profanity is not allowed. Please keep communication professional." };
  }
  return { blocked: false, reason: null };
}

/**
 * Vet a file/attachment name for private info leakage.
 */
export function vetAttachmentName(fileName: string): VetResult {
  return vetContent(fileName);
}

/**
 * Convenience: check if a profile field value contains private info.
 */
export function vetProfileField(value: string): VetResult {
  return vetContent(value);
}
