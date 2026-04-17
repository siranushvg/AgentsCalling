/**
 * Masks a phone number, showing only the last 5 digits.
 * Examples:
 *   +917973298220 → *******98220
 *   918827371014  → *******71014
 * If the number is too short (< 6 digits), masks all but last 2.
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '•••••••••';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length < 6) return '•••••••••';

  const last5 = digits.slice(-5);
  const starCount = Math.max(digits.length - 5, 4);
  return '*'.repeat(starCount) + last5;
}
