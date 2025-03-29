import { apiRequest } from "./queryClient";

// Server-related API calls
export const fetchServers = async () => {
  const response = await fetch('/api/servers');
  if (!response.ok) throw new Error('Failed to fetch servers');
  return response.json();
};

export const syncServers = async () => {
  const response = await apiRequest('POST', '/api/servers/sync', {});
  return response.json();
};

export const fetchServerDetails = async (serverId: string) => {
  const response = await fetch(`/api/servers/${serverId}`);
  if (!response.ok) throw new Error(`Failed to fetch details for server ${serverId}`);
  return response.json();
};

export const syncChannels = async (serverId: string) => {
  const response = await apiRequest('POST', `/api/servers/${serverId}/channels/sync`, {});
  return response.json();
};

export const fetchChannels = async (serverId: string) => {
  const response = await fetch(`/api/servers/${serverId}/channels`);
  if (!response.ok) throw new Error(`Failed to fetch channels for server ${serverId}`);
  return response.json();
};

// Summary-related API calls
export const fetchChannelSummary = async (channelId: string) => {
  const response = await fetch(`/api/channels/${channelId}/summary`);
  if (!response.ok) {
    if (response.status === 404) {
      return null; // No summary exists yet
    }
    throw new Error(`Failed to fetch summary for channel ${channelId}`);
  }
  return response.json();
};

// Messages-related API calls
export const fetchChannelMessages = async (channelId: string, limit?: number) => {
  const url = limit 
    ? `/api/channels/${channelId}/messages?limit=${limit}` 
    : `/api/channels/${channelId}/messages`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        return { messages: [] }; // No messages found
      }
      throw new Error(`Failed to fetch messages for channel ${channelId}`);
    }
    
    const data = await response.json();
    console.log('API response for messages:', data);
    
    // Make sure we return in the expected format
    return { messages: Array.isArray(data) ? data : (data.messages || []) };
  } catch (error) {
    console.error('Error fetching messages:', error);
    return { messages: [] };
  }
};

// Analyze sentiment of messages
export const analyzeMessageSentiment = async (channelId: string, messages: any[]) => {
  try {
    const response = await fetch(`/api/channels/${channelId}/analyze-sentiment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
    });
    
    if (!response.ok) {
      // First check if the response is HTML (common error response from servers)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        const text = await response.text();
        console.error('Server returned HTML instead of JSON:', text.substring(0, 100));
        throw new Error('Server returned HTML instead of JSON. Check server logs for details.');
      }
      
      // Otherwise, try to get error details from the JSON response
      try {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to analyze messages: ${response.statusText}`);
      } catch (jsonError) {
        // If parsing JSON fails, use the status text
        throw new Error(`Failed to analyze messages: ${response.statusText}`);
      }
    }
    
    // Try to safely parse the successful response
    try {
      return await response.json();
    } catch (jsonError) {
      console.error('Failed to parse JSON response:', jsonError);
      throw new Error('Failed to parse analysis results. The response was not valid JSON.');
    }
  } catch (error) {
    console.error('Error analyzing message sentiment:', error);
    throw error;
  }
};

export const generateServerSummary = async (serverId: string) => {
  const response = await apiRequest('POST', `/api/servers/${serverId}/generate-summary`, {});
  return response.json();
};

// Settings-related API calls
export const fetchSettings = async () => {
  const response = await fetch('/api/settings');
  if (!response.ok) throw new Error('Failed to fetch settings');
  return response.json();
};

export const updateSettings = async (settings: {
  summaryFrequency?: string;
  detailLevel?: string;
  emailNotifications?: boolean;
  webNotifications?: boolean;
}) => {
  const response = await apiRequest('POST', '/api/settings', settings);
  return response.json();
};

// System status API call
export const fetchSystemStatus = async () => {
  const response = await fetch('/api/status');
  if (!response.ok) throw new Error('Failed to fetch system status');
  return response.json();
};

// Discord management API calls
export const refreshDiscordConnection = async () => {
  const response = await apiRequest('POST', '/api/discord/refresh', {});
  return response.json();
};

// Analyze messages for Jobs to be Done (JTBD)
// Modified to accept either raw messages or sentiment analysis results
export const analyzeMessageJTBD = async (channelId: string, messages: any[], sentimentAnalysisResult?: string) => {
  try {
    const response = await fetch(`/api/channels/${channelId}/analyze-jtbd`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        messages, 
        sentimentAnalysis: sentimentAnalysisResult 
      }),
    });
    
    if (!response.ok) {
      // First check if the response is HTML (common error response from servers)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        const text = await response.text();
        console.error('Server returned HTML instead of JSON:', text.substring(0, 100));
        throw new Error('Server returned HTML instead of JSON. Check server logs for details.');
      }
      
      // Otherwise, try to get error details from the JSON response
      try {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to analyze JTBD: ${response.statusText}`);
      } catch (jsonError) {
        // If parsing JSON fails, use the status text
        throw new Error(`Failed to analyze JTBD: ${response.statusText}`);
      }
    }
    
    // Try to safely parse the successful response
    try {
      return await response.json();
    } catch (jsonError) {
      console.error('Failed to parse JSON response:', jsonError);
      throw new Error('Failed to parse JTBD analysis results. The response was not valid JSON.');
    }
  } catch (error) {
    console.error('Error analyzing JTBD:', error);
    throw error;
  }
};
