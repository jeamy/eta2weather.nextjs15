import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

function tokensMatch(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

function isSameOriginBrowserRequest(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      const allowedOrigins = new Set([request.nextUrl.origin]);
      const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
      const forwardedProto = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '');
      if (forwardedHost) allowedOrigins.add(`${forwardedProto}://${forwardedHost}`);
      if (allowedOrigins.has(new URL(origin).origin)) return true;
    } catch {
      return false;
    }
  }
  return request.headers.get('sec-fetch-site') === 'same-origin';
}

export function requireWriteAccess(request: NextRequest): NextResponse | null {
  const expectedToken = process.env.API_WRITE_TOKEN;
  const providedToken = request.headers.get('x-api-token') || request.headers.get('x-eta2weather-token');

  // The bundled UI remains usable without exposing a server secret. External
  // automation must authenticate, unless the legacy escape hatch is explicit.
  if (
    tokensMatch(providedToken, expectedToken) ||
    isSameOriginBrowserRequest(request) ||
    process.env.ALLOW_UNAUTHENTICATED_WRITES === 'true'
  ) {
    return null;
  }

  return NextResponse.json(
    {
      success: false,
      error: expectedToken
        ? 'Unauthorized'
        : 'Cross-origin writes require API_WRITE_TOKEN',
    },
    { status: expectedToken ? 401 : 403 }
  );
}
