// Mock data for Vercel deployment demo

import { type DiscordServer, type UserSettings } from '../shared/schema';

export const mockServers: DiscordServer[] = [
  {
    id: '1234567890',
    name: 'Demo Server',
    icon: 'https://cdn.discordapp.com/icons/1234567890/abcdef.png',
    isActive: true,
    lastSynced: new Date()
  },
  {
    id: '0987654321',
    name: 'Test Community',
    icon: 'https://cdn.discordapp.com/icons/0987654321/fedcba.png',
    isActive: true,
    lastSynced: new Date()
  }
];

export const mockSettings: UserSettings = {
  id: 1,
  userId: 1,
  summaryFrequency: '24h',
  detailLevel: 'standard',
  emailNotifications: false,
  webNotifications: true,
  autoAnalysisEnabled: false,
  defaultEmailRecipient: null,
  messageThreshold: 20,
  timeThreshold: 30
};
