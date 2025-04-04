import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req, res) {
  try {
    // Import modules only when the function is called
    const { getDiscordStatus } = await import('../server/discord');
    
    // Get the Discord connection status
    const isConnected = getDiscordStatus();
    
    return res.status(200).json({
      status: 'ok',
      discord: {
        connected: isConnected
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ 
      status: 'error',
      error: error.message || 'Internal server error' 
    });
  }
}
