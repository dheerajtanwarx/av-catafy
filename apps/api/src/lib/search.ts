/** Escape user input for use inside a RegExp (search boxes). */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** "98765 43210", "+91-98765…" and "9876" all match the stored 10-digit phone. */
export function phoneSearchDigits(q: string): string | null {
  const digits = q.replace(/[\s+-]/g, "");
  if (!/^\d{3,12}$/.test(digits)) return null;
  return digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
}
