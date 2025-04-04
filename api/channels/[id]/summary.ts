import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  
  // Only respond to GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Mock summary data
  return res.status(200).json({
    id: id as string,
    channelId: id as string,
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
