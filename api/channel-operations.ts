import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { id, operation } = req.query;
  
  // Ensure we have a channel ID
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ message: 'Invalid channel ID' });
  }

  // Route based on the path segments and HTTP method
  switch (operation) {
    case 'messages':
      if (req.method === 'GET') {
        return getMessages(id, req, res);
      }
      break;

    case 'summary':
      if (req.method === 'GET') {
        return getSummary(id, req, res);
      }
      break;

    case 'sync-messages':
      if (req.method === 'POST') {
        return syncMessages(id, req, res);
      }
      break;

    case 'analyze-sentiment':
      if (req.method === 'POST') {
        return analyzeSentiment(id, req, res);
      }
      break;

    case 'analyze-jtbd':
      if (req.method === 'POST') {
        return analyzeJTBD(id, req, res);
      }
      break;
  }

  return res.status(405).json({ message: 'Method not allowed or invalid operation' });
}

// Channel messages handler
function getMessages(channelId: string, req: VercelRequest, res: VercelResponse) {
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

// Channel summary handler
function getSummary(channelId: string, req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    id: channelId,
    channelId: channelId,
    content: 'This channel has been active with general discussion about project updates and team coordination. Several users shared progress on their tasks and there were discussions about upcoming deadlines.',
    topics: [
      { name: 'Project Updates', count: 5 },
      { name: 'Team Coordination', count: 3 },
      { name: 'Deadlines', count: 2 }
    ],
    sentiment: 'positive',
    messageCount: 25,
    activeUsers: 5,
    lastUpdated: new Date().toISOString(),
    generationDate: new Date().toISOString()
  });
}

// Sync messages handler
function syncMessages(channelId: string, req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    success: true,
    message: 'Messages synced successfully',
    channelId: channelId,
    messageCount: 25,
    timestamp: new Date().toISOString()
  });
}

// Sentiment analysis handler
function analyzeSentiment(channelId: string, req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    channelId: channelId,
    sentiment: 'positive',
    confidence: 0.85,
    keywords: ['productive', 'helpful', 'exciting'],
    messageCount: 25,
    timestamp: new Date().toISOString()
  });
}

// JTBD analysis handler
function analyzeJTBD(channelId: string, req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    channelId: channelId,
    jobs: [
      { job: 'Stay informed about project status', confidence: 0.9 },
      { job: 'Coordinate team activities', confidence: 0.8 },
      { job: 'Get quick answers to questions', confidence: 0.7 }
    ],
    messageCount: 25,
    timestamp: new Date().toISOString()
  });
}
