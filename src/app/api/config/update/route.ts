import { NextResponse } from 'next/server';

// DEPRECATED: Use /api/config (POST) instead.
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'This endpoint is deprecated. Use /api/config (POST) to update configuration.'
    },
    { status: 410 }
  );
}
