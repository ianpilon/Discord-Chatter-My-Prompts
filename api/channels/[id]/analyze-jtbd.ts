import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  
  // Only respond to POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Return mock JTBD analysis
  return res.status(200).json({
    channelId: id as string,
    jobs: [
      { job: 'Stay informed about project status', confidence: 0.9 },
      { job: 'Coordinate team activities', confidence: 0.8 },
      { job: 'Get quick answers to questions', confidence: 0.7 }
    ],
    messageCount: 25,
    timestamp: new Date().toISOString()
  });
}
