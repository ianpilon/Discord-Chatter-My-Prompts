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
