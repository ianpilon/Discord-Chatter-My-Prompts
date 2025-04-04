import { VercelRequest, VercelResponse } from '@vercel/node';
import { getServers } from './storage-minimal';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only respond to GET requests
    if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Method not allowed' });
    }
    
    // Return a simplified response with demo data
    return res.status(200).json({ 
      servers: [
        {
          id: 'demo-server-1',
          name: 'Demo Server',
          stats: {
            activeUsers: 10,
            totalMessages: 150
          }
        }
      ] 
    });
  } catch (error: any) {
    console.error('Servers API error:', error);
    return res.status(500).json({ 
      message: error.message || 'Internal server error' 
    });
  }
}
