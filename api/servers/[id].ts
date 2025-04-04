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
    
    // Get the server details
    const server = await getServer(id);
    
    if (!server) {
      return res.status(404).json({ message: 'Server not found' });
    }
    
    // Get channels for this server
    const channels = await getChannels(id);
    
    return res.status(200).json({
      ...server,
      channels
    });
  } catch (error: any) {
    console.error('Server details API error:', error);
    return res.status(500).json({ 
      message: error.message || 'Internal server error' 
    });
  }
}
