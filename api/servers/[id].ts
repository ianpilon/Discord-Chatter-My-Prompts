import { VercelRequest, VercelResponse } from '@vercel/node';

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

    // Import modules only when the function is called to avoid initialization issues
    const { storage } = await import('../../server/storage');
    const { syncChannels } = await import('../../server/discord');
    
    // Get the server details
    let server = await storage.getServer(id);
    
    if (!server) {
      return res.status(404).json({ message: 'Server not found' });
    }
    
    // If refresh parameter is present, sync channels from Discord first
    if (req.query.refresh === 'true') {
      try {
        const channels = await syncChannels(id);
        server = await storage.getServer(id); // Refresh server data after sync
      } catch (syncError) {
        console.error(`Error syncing channels for server ${id}:`, syncError);
        // Continue with existing data if sync fails
      }
    }
    
    // Get channels for this server
    const channels = await storage.getChannels(id);
    
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
