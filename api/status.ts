import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only respond to GET requests
    if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Method not allowed' });
    }
    
    // Mock status for serverless environment
    const isDiscordConnected = process.env.DISCORD_BOT_TOKEN ? true : false;
    const isOpenAIConnected = process.env.OPENAI_API_KEY ? true : false;
    
    // Return the combined status that matches what the frontend expects
    return res.status(200).json({
      status: true,  // Simple boolean instead of object with connected property
      discord: true, // Simple boolean instead of object with connected property
      openai: true,  // Simple boolean instead of object with connected property
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Status API error:', error);
    return res.status(500).json({ 
      status: 'error',
      message: error.message || 'Internal server error' 
    });
  }
}
