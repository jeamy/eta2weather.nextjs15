import { NextRequest, NextResponse } from 'next/server';
import { getConfig, updateConfig } from '@/utils/cache';
import { validateConfigPatch } from '@/utils/configValidation';
import { requireWriteAccess } from '@/utils/apiAuth';
import { BackgroundService } from '@/lib/backgroundService';

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
    
    const existingConfig = await getConfig();
    
    const configPatch = {
      [validation.key]: validation.value
    };
    
    // Update the config using cache utility
    await updateConfig(configPatch);

    // Immediately recompute diff/slider so the response contains up-to-date values
    const service = BackgroundService.getInstance();
    await service.triggerImmediateRecompute(existingConfig);

    // Return the config that is now in the store (may have updated slider/diff)
    const computedConfig = await getConfig();

    return NextResponse.json({ 
      success: true, 
      config: computedConfig
    });
  } catch (error) {
    console.error('Error updating config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update config' },
      { status: 500 }
    );
  }
}
