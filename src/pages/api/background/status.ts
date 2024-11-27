import { NextApiRequest, NextApiResponse } from 'next';
import { getServerStore } from '@/lib/backgroundService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const store = getServerStore();
    const state = store.getState();

    res.status(200).json({
      success: true,
      data: {
        config: state.config.data,
        eta: state.eta.data,
        wifiAf83: state.wifiAf83.data,
        names2Id: state.names2Id.data
      }
    });
  } catch (error) {
    console.error('Error getting background service status:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
