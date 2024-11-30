import { NextRequest, NextResponse } from 'next/server';
import { getConfig, updateConfig } from '@/utils/cache';

export async function GET() {
  try {
    const config = await getConfig();
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('Error reading config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to read config' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { key, value } = await request.json();
    
    // Get existing config
    const existingConfig = await getConfig();
    
    // Update the specific key in the config
    const updatedConfig = {
      ...existingConfig,
      [key]: value
    };
    
    // Update the config using cache utility
    await updateConfig(updatedConfig);
    
    return NextResponse.json({ 
      success: true, 
      config: updatedConfig 
    });
  } catch (error) {
    console.error('Error updating config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update config' },
      { status: 500 }
    );
  }
}
