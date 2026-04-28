import { NextRequest, NextResponse } from 'next/server';

export function requireWriteAccess(request: NextRequest): NextResponse | null {
  const expectedToken = process.env.API_WRITE_TOKEN;
  if (!expectedToken) {
    return null;
  }

  const providedToken = request.headers.get('x-api-token') || request.headers.get('x-eta2weather-token');
  if (providedToken === expectedToken) {
    return null;
  }

  return NextResponse.json(
    { success: false, error: 'Unauthorized' },
    { status: 401 }
  );
}
