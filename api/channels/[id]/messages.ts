import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  
  // Only respond to GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Mocked messages data
  return res.status(200).json([
    {
      id: '123456789',
      content: 'Hello everyone!',
      author: {
        id: 'user1',
        username: 'User One',
        avatar: null
      },
      timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      reactions: []
    },
    {
      id: '123456790',
      content: 'Welcome to the channel!',
      author: {
        id: 'user2',
        username: 'User Two',
        avatar: null
      },
      timestamp: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
      reactions: []
    },
    {
      id: '123456791',
      content: 'How is everyone doing today?',
      author: {
        id: 'user3',
        username: 'User Three',
        avatar: null
      },
      timestamp: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
      reactions: []
    }
  ]);
}
