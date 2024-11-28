import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { Names2Id } from '@/reader/functions/types-constants/Names2IDconstants';

export async function GET() {
  const configFilePath = path.join(process.cwd(), 'src', 'config', 'f_names2id.json');

  try {
    const data = await fs.readFile(configFilePath, 'utf-8');
    const names2IdData: Names2Id = JSON.parse(data);
    return NextResponse.json(names2IdData);
  } catch (error) {
    console.error('Error reading Names2Id data:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
