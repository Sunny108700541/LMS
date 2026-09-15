/** ABCDE1234F -> ABCXXXXX4F. Applied wherever a PAN leaves the server. */
export function maskPan(pan: string): string {
  if (pan.length !== 10) return 'XXXXXXXXXX';
  return `${pan.slice(0, 3)}XXXXX${pan.slice(8)}`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return 'hidden';
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
}
