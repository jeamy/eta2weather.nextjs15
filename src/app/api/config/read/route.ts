import { NextResponse } from 'next/server';
import { getConfig } from '@/utils/cache';

export async function GET() {
  try {
    const configData = await getConfig();
    return NextResponse.json({ success: true, data: configData });
  } catch (error) {
    console.error('Error in config/read:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
