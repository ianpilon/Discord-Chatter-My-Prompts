import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  
  // Only respond to POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Return mock sentiment analysis
  return res.status(200).json({
    channelId: id as string,
    sentiment: 'positive',
    confidence: 0.85,
    keywords: ['productive', 'helpful', 'exciting'],
    messageCount: 25,
    timestamp: new Date().toISOString()
  });
}
