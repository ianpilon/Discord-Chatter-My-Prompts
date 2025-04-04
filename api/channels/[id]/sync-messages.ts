import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  
  // Only respond to POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Return mock sync response
  return res.status(200).json({
    success: true,
    message: 'Messages synced successfully',
    channelId: id as string,
    messageCount: 25,
    timestamp: new Date().toISOString()
  });
}
