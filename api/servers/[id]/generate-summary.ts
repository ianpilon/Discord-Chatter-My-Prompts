import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  
  // Only respond to POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // For demo purposes, only handle demo server
  if (id !== 'demo-server-1') {
    return res.status(404).json({ message: 'Server not found' });
  }

  // Return a mock success response
  return res.status(200).json({
    success: true,
    message: 'Summary generation initiated for all channels',
    serverId: id,
    timestamp: new Date().toISOString()
  });
}
