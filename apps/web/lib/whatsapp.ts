/** wa.me needs the full international number without "+"; Indian 10-digit numbers get 91. */
export function whatsappNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return digits;
  return digits.length >= 10 ? digits : null;
}

export function whatsappLink(raw: string, text?: string): string | null {
  const number = whatsappNumber(raw);
  if (!number) return null;
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
