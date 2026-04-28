import { NextRequest, NextResponse } from 'next/server';
import { getConfig, updateConfig } from '@/utils/cache';
import { validateConfigPatch } from '@/utils/configValidation';
import { requireWriteAccess } from '@/utils/apiAuth';

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
    const authError = requireWriteAccess(request);
    if (authError) return authError;

    const { key, value } = await request.json();
    const validation = validateConfigPatch(key, value);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error, message: validation.error },
        { status: 400 }
      );
    }
    
    // Get existing config
    const existingConfig = await getConfig();
    
    // Update the specific key in the config
    const updatedConfig = {
      ...existingConfig,
      [validation.key]: validation.value
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
