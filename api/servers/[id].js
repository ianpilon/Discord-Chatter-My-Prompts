import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req, res) {
  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: 'Server ID is required' });
    }
    
    // Import modules only when the function is called
    const { storage } = await import('../../server/storage');
    const { syncChannels } = await import('../../server/discord');
    
    if (req.method === 'GET') {
      // Get the server details with channels
      let server = await storage.getServer(id);
      
      if (!server) {
        return res.status(404).json({ error: 'Server not found' });
      }
      
      // If refresh parameter is present, sync channels from Discord first
      if (req.query.refresh === 'true') {
        const channels = await syncChannels(id);
        server = await storage.getServer(id); // Refresh server data after sync
      }
      
      // Get channels for this server
      const channels = await storage.getChannels(id);
      
      return res.status(200).json({
        ...server,
        channels
      });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
