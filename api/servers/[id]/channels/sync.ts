import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  
  // Only respond to POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // For demo purposes, only the demo-server-1 is valid
  if (id !== 'demo-server-1' && id !== 'demo-server-1') {
    return res.status(404).json({ message: 'Server not found' });
  }

  // Return mocked channel sync response
  return res.status(200).json({
    success: true,
    message: 'Channels synced successfully',
    channels: [
      {
        id: 'demo-channel-1',
        name: 'general',
        type: 'text',
        lastActive: new Date().toISOString()
      },
      {
        id: 'demo-channel-2',
        name: 'random',
        type: 'text',
        lastActive: new Date().toISOString()
      }
    ]
  });
}
