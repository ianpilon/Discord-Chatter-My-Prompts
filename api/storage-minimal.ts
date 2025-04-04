// A minimal version of storage functionality for serverless functions
import { VercelRequest, VercelResponse } from '@vercel/node';

// Basic storage interfaces
interface UserSettings {
  id: number;
  userId: number;
  summaryFrequency: string;
  detailLevel: string;
  emailNotifications: boolean;
  webNotifications: boolean;
  autoAnalysisEnabled: boolean;
  defaultEmailRecipient: string | null;
  messageThreshold: number;
  timeThreshold: number;
}

// In-memory storage as fallback when database isn't available
const defaultSettings: UserSettings = {
  id: 1,
  userId: 1,
  summaryFrequency: "24h",
  detailLevel: "standard",
  emailNotifications: false,
  webNotifications: true,
  autoAnalysisEnabled: process.env.AUTO_ANALYSIS_ENABLED === 'true',
  defaultEmailRecipient: process.env.DEFAULT_EMAIL_RECIPIENT || null,
  messageThreshold: 20,
  timeThreshold: 30
};

// Simple server representation
export interface Server {
  id: string;
  name: string;
  icon?: string;
  stats?: {
    activeUsers: number;
    totalMessages: number;
  };
}

export const getDefaultSettings = (): UserSettings => {
  return { ...defaultSettings };
};

// Get settings for the demo user
export const getUserSettings = async (): Promise<UserSettings> => {
  try {
    return { ...defaultSettings };
  } catch (error) {
    console.error('Error getting user settings:', error);
    throw error;
  }
};

// Return mock servers for demo
export const getServers = async (): Promise<Server[]> => {
  try {
    return [
      {
        id: 'demo-server-1',
        name: 'Demo Server',
        stats: {
          activeUsers: 10,
          totalMessages: 150
        }
      }
    ];
  } catch (error) {
    console.error('Error getting servers:', error);
    throw error;
  }
};

// Get a specific server
export const getServer = async (id: string): Promise<Server | null> => {
  if (id === 'demo-server-1') {
    return {
      id: 'demo-server-1',
      name: 'Demo Server',
      stats: {
        activeUsers: 10,
        totalMessages: 150
      }
    };
  }
  return null;
};

// Get channels for a server
export const getChannels = async (serverId: string) => {
  if (serverId === 'demo-server-1') {
    return [
      {
        id: 'demo-channel-1',
        name: 'general',
        type: 'text'
      },
      {
        id: 'demo-channel-2',
        name: 'random',
        type: 'text'
      }
    ];
  }
  return [];
};
