import { NextResponse } from 'next/server';
import { getNames2Id } from '@/utils/cache';

export async function GET() {
  try {
    return NextResponse.json(await getNames2Id());
  } catch (error) {
    console.error('Error reading Names2Id data:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
