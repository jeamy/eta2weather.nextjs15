import { NextResponse } from 'next/server';
import { getConfig, updateConfig } from '@/utils/cache';

export async function GET() {
  try {
    const config = await getConfig();
    const response = NextResponse.json(config.channelNames || {});
    response.headers.set('Content-Type', 'application/json; charset=utf-8');
    return response;
  } catch (error) {
    console.error('Error reading channel names:', error);
    const errorResponse = NextResponse.json(
      { error: 'Failed to read channel names' },
      { status: 500 }
    );
    errorResponse.headers.set('Content-Type', 'application/json; charset=utf-8');
    return errorResponse;
  }
}

export async function POST(request: Request) {
  try {
    const newChannelNames = await request.json();
    
    // Get existing config using cache utility
    const config = await getConfig();
    
    // Update channel names in config
    const updatedConfig = {
      ...config,
      channelNames: {
        ...(config.channelNames || {}),
        ...newChannelNames
      }
    };
    
    // Update config using cache utility
    await updateConfig(updatedConfig);
    
    const response = NextResponse.json({ success: true });
    response.headers.set('Content-Type', 'application/json; charset=utf-8');
    return response;
  } catch (error) {
    console.error('Error updating channel names:', error);
    const errorResponse = NextResponse.json(
      { error: 'Failed to update channel names' },
      { status: 500 }
    );
    errorResponse.headers.set('Content-Type', 'application/json; charset=utf-8');
    return errorResponse;
  }
}
