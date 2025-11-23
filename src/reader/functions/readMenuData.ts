import { EtaApi } from './EtaApi';
import { parseXML } from './EtaData';
import { getConfig } from '@/utils/cache';

export async function readMenuData(uri: string) {
  const config = await getConfig();
  const etaApi = new EtaApi(config.s_eta);

  try {
    // Get menu data
    const menuResponse = await etaApi.getUserVar(uri);

    if (menuResponse.error) {
      // Instead of throwing, return null to indicate failure
      console.error(`Error reading menu data for URI ${uri}:`, menuResponse.error);
      return null;
    }

    if (!menuResponse.result) {
      console.error(`No data received for URI ${uri}`);
      return null;
    }

    // Parse XML data
    return parseXML(menuResponse.result, uri, null);
  } finally {
    // Always cleanup
    etaApi.dispose();
  }
}
