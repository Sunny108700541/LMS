const COOKIE_NAME = process.env.NEXT_PUBLIC_ACCESS_COOKIE ?? 'lms_access_token';

export function setSessionIndicator(): void {
  if (typeof document !== 'undefined') {
    const isHttps = window.location.protocol === 'https:';
    document.cookie = `${COOKIE_NAME}=1; path=/; max-age=604800; SameSite=Lax; ${isHttps ? 'Secure;' : ''}`;
  }
}

export function clearSessionIndicator(): void {
  if (typeof document !== 'undefined') {
    const isHttps = window.location.protocol === 'https:';
    document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; ${isHttps ? 'Secure;' : ''}`;
  }
}
