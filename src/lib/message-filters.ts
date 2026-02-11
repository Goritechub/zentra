// Client-side content filtering for messages
const CONTACT_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i,
  phone: /(?:\+?234|0)?[789][01]\d{8}|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\d{10,11}\b/,
  bankAccount: /\b\d{10}\b|\b\d{3}[-\s]?\d{3}[-\s]?\d{4}\b|(?:account\s*(?:number|no|#|num))\s*:?\s*\d+/i,
  whatsapp: /whatsapp|whats\s*app|wa\.me|chat\s*me\s*on/i,
  scam: /\b(?:send money|wire transfer|western union|moneygram|bitcoin wallet|crypto wallet|sort code|routing number)\b/i,
};

export interface FilterResult {
  blocked: boolean;
  reason: string | null;
}

export function filterMessageContent(content: string): FilterResult {
  if (CONTACT_PATTERNS.email.test(content)) {
    return { blocked: true, reason: "Sharing email addresses is not allowed. Keep all communication on the platform." };
  }
  if (CONTACT_PATTERNS.phone.test(content)) {
    return { blocked: true, reason: "Sharing phone numbers is not allowed. Keep all communication on the platform." };
  }
  if (CONTACT_PATTERNS.bankAccount.test(content)) {
    return { blocked: true, reason: "Sharing bank account details is not allowed for your safety." };
  }
  if (CONTACT_PATTERNS.whatsapp.test(content)) {
    return { blocked: true, reason: "WhatsApp and off-platform contact sharing is not allowed." };
  }
  if (CONTACT_PATTERNS.scam.test(content)) {
    return { blocked: true, reason: "This message contains prohibited financial content." };
  }
  return { blocked: false, reason: null };
}
