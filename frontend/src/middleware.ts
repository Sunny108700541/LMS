import { NextResponse, type NextRequest } from 'next/server';

const COOKIE_NAME = process.env.NEXT_PUBLIC_ACCESS_COOKIE ?? 'lms_access_token';

const PROTECTED_PREFIXES = ['/dashboard', '/apply', '/loans'];
const AUTH_PAGES = ['/login', '/register'];

/**
 * First-pass routing only: it checks that a session cookie exists so signed-out
 * visitors do not land on an empty protected page. It is not the access
 * control — roles and ownership are enforced by the API on every request.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(COOKIE_NAME)?.value);

  if (!hasSession && PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (hasSession && AUTH_PAGES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/apply/:path*', '/loans/:path*', '/login', '/register'],
};
