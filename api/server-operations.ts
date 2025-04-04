import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const { id, operation } = req.query;
  
  // Handle server list operation if no ID is provided
  if (!id && !operation) {
    // Server list (main /api/server-operations endpoint)
    if (req.method === 'GET') {
      return getServers(req, res);
    }
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Ensure we have a valid server ID
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ message: 'Invalid server ID' });
  }

  // Handle individual server operations
  if (!operation) {
    // Server details endpoint (/api/server-operations?id=X)
    if (req.method === 'GET') {
      return getServerDetails(id, req, res);
    }
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Handle operations requiring both server ID and operation type
  if (operation === 'channels') {
    // For handling /api/server-operations?id=X&operation=channels
    if (req.method === 'GET') {
      return getChannels(id, req, res);
    } else if (req.method === 'POST') {
      return syncChannels(id, req, res);
    }
  } else if (operation === 'generate-summary') {
    // For handling /api/server-operations?id=X&operation=generate-summary
    if (req.method === 'POST') {
      return generateSummary(id, req, res);
    }
  }

  return res.status(405).json({ message: 'Method not allowed or invalid operation' });
}

// Get all servers
function getServers(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json([
    {
      id: 'demo-server-1',
      name: 'Demo Server',
      icon: null,
      activeUsers: 10,
      totalMessages: 150
    }
  ]);
}

// Get server details
function getServerDetails(serverId: string, req: VercelRequest, res: VercelResponse) {
  if (serverId === 'demo-server-1') {
    return res.status(200).json({
      id: 'demo-server-1',
      name: 'Demo Server',
      icon: null,
      activeUsers: 10,
      totalMessages: 150,
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
  return res.status(404).json({ message: 'Server not found' });
}

// Get server channels
function getChannels(serverId: string, req: VercelRequest, res: VercelResponse) {
  if (serverId === 'demo-server-1') {
    return res.status(200).json([
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
    ]);
  }
  return res.status(404).json({ message: 'Server not found' });
}

// Sync server channels
function syncChannels(serverId: string, req: VercelRequest, res: VercelResponse) {
  if (serverId === 'demo-server-1') {
    return res.status(200).json({
      success: true,
      message: 'Channels synced successfully',
      serverId: serverId,
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
  return res.status(404).json({ message: 'Server not found' });
}

// Generate summary for all channels in a server
function generateSummary(serverId: string, req: VercelRequest, res: VercelResponse) {
  if (serverId === 'demo-server-1') {
    return res.status(200).json({
      success: true,
      message: 'Summary generation initiated for all channels',
      serverId: serverId,
      timestamp: new Date().toISOString()
    });
  }
  return res.status(404).json({ message: 'Server not found' });
}
