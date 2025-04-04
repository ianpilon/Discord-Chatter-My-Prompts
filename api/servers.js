import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req, res) {
  try {
    // Import storage only when the function is called to avoid initialization issues
    const { storage } = await import('../server/storage');
    const { syncServers } = await import('../server/discord');
    
    if (req.method === 'GET') {
      // Get all servers or sync servers if required
      let servers = await storage.getServers();
      
      // If refresh parameter is present, sync servers from Discord first
      if (req.query.refresh === 'true') {
        servers = await syncServers();
      }
      
      return res.status(200).json({ servers });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
