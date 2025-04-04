import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only respond to GET requests
    if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Method not allowed' });
    }

    // Import modules only when the function is called to avoid initialization issues
    const { getDiscordStatus } = await import('../server/discord');
    const { checkOpenAIStatus } = await import('../server/openai');
    
    // Get the Discord connection status
    const isDiscordConnected = getDiscordStatus();
    
    // Get OpenAI API status
    let isOpenAIConnected = false;
    try {
      isOpenAIConnected = await checkOpenAIStatus();
    } catch (error) {
      console.error('Error checking OpenAI status:', error);
      // Continue even if OpenAI check fails
    }
    
    // Return the combined status
    return res.status(200).json({
      status: 'ok',
      discord: {
        connected: isDiscordConnected
      },
      openai: {
        connected: isOpenAIConnected
      },
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
