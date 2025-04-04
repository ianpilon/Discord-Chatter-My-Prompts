import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only respond to GET requests
    if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Method not allowed' });
    }

    // Import modules only when the function is called to avoid initialization issues
    const { storage } = await import('../server/storage');
    const { syncServers } = await import('../server/discord');
    
    // Get all servers or sync servers if required
    let servers = await storage.getServers();
    
    // If refresh parameter is present, sync servers from Discord first
    if (req.query.refresh === 'true') {
      try {
        servers = await syncServers();
      } catch (syncError) {
        console.error('Error syncing servers:', syncError);
        // Continue with existing servers if sync fails
      }
    }
    
    return res.status(200).json({ servers });
  } catch (error: any) {
    console.error('Servers API error:', error);
    return res.status(500).json({ 
      message: error.message || 'Internal server error' 
    });
  }
}
