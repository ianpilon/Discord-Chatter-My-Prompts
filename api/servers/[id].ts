import { VercelRequest, VercelResponse } from '@vercel/node';
import { getServer, getChannels } from '../storage-minimal';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { id } = req.query;
    
    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: 'Invalid server ID' });
    }
    
    // Only respond to GET requests
    if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Method not allowed' });
    }
    
    // Only respond with hardcoded data for the demo server
    if (id === 'demo-server-1') {
      // Return server details in the exact format expected by frontend
      return res.status(200).json({
        id: 'demo-server-1',
        name: 'Demo Server',
        icon: null,
        // Include these as direct properties, not in stats object
        activeUsers: 10,
        totalMessages: 150,
        // Ensure channels is an array with expected properties
        channels: [
          {
            id: 'demo-channel-1',
            name: 'general',
            type: 'text',
            lastActive: new Date().toISOString()
          },
          {
            id: 'demo-channel-2',
            name: 'random',
            type: 'text',
            lastActive: new Date().toISOString()
          }
        ]
      });
    } else {
      return res.status(404).json({ message: 'Server not found' });
    }
  } catch (error: any) {
    console.error('Server details API error:', error);
    return res.status(500).json({ 
      message: error.message || 'Internal server error' 
    });
  }
}
