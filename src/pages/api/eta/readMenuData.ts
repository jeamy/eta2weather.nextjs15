import { NextApiRequest, NextApiResponse } from 'next';
import { EtaApi } from '@/reader/functions/EtaApi';
import { parseXML } from '@/reader/functions/EtaData';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { method } = req;

  // Handle preflight requests
  if (method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  const { uri } = req.query;

  if (!uri || typeof uri !== 'string') {
    return res.status(400).json({ 
      success: false, 
      error: 'URI parameter is required' 
    });
  }

  console.log(`Fetching menu data for URI: ${uri}`);

  try {
    const api = new EtaApi();
    const response = await api.getUserVar(uri);

    if (response.error) {
      console.error('Error fetching menu data:', response.error);
      return res.status(500).json({ 
        success: false, 
        error: response.error 
      });
    }

    if (!response.result) {
      return res.status(404).json({ 
        success: false, 
        error: 'No data found' 
      });
    }

    // Parse the XML response
    const parsedData = parseXML(response.result, uri, null);
    
    return res.status(200).json({ 
      success: true, 
      data: parsedData 
    });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
