import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req, res) {
  try {
    // Import storage only when the function is called to avoid initialization issues
    const { storage } = await import('../server/storage');
    
    if (req.method === 'GET') {
      // Get the default user settings
      const settings = await storage.getUserSettings(1); // Default user ID
      
      return res.status(200).json(settings);
    } else if (req.method === 'POST' || req.method === 'PUT') {
      // Update settings
      const updatedSettings = await storage.updateUserSettings(1, req.body);
      
      return res.status(200).json(updatedSettings);
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
