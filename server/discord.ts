import { Client, GatewayIntentBits, TextChannel, Collection, Message } from 'discord.js';
import { storage } from './storage';
import { log } from './vite';
import { 
  type InsertDiscordServer, 
  type InsertDiscordChannel,
  type DiscordServer,
  type DiscordChannel
} from '@shared/schema';

// Create a new Discord client with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let isConnected = false;

export async function initializeDiscordClient(): Promise<void> {
  try {
    // Check if API token exists
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      log('Discord bot token not found. Discord client not initialized.', 'discord');
      return;
    }

    // Connect to Discord
    await client.login(token);

    client.on('ready', () => {
      isConnected = true;
      log(`Logged in as ${client.user?.tag}!`, 'discord');
    });

    client.on('error', (error) => {
      isConnected = false;
      log(`Discord client error: ${error.message}`, 'discord');
    });

  } catch (error) {
    isConnected = false;
    log(`Failed to initialize Discord client: ${error.message}`, 'discord');
  }
}

export function getDiscordStatus(): boolean {
  return isConnected;
}

// Fetch and sync servers (guilds) from Discord
export async function syncServers(): Promise<DiscordServer[]> {
  if (!isConnected || !client.isReady()) {
    throw new Error('Discord client is not connected');
  }

  // Get all guilds the bot is a member of
  const guilds = client.guilds.cache.map(guild => ({
    id: guild.id,
    name: guild.name,
    icon: guild.iconURL({ extension: 'png' }) || null,
    isActive: true,
    lastSynced: new Date()
  }));

  // Save to storage
  const savedServers: DiscordServer[] = [];
  for (const guildData of guilds) {
    const existingServer = await storage.getServer(guildData.id);
    
    if (existingServer) {
      // Update existing server
      const updatedServer = await storage.updateServer(guildData.id, guildData);
      if (updatedServer) savedServers.push(updatedServer);
    } else {
      // Create new server
      const newServer = await storage.createServer(guildData as InsertDiscordServer);
      savedServers.push(newServer);
    }
  }

  return savedServers;
}

// Sync channels for a specific server
export async function syncChannels(serverId: string): Promise<DiscordChannel[]> {
  if (!isConnected || !client.isReady()) {
    throw new Error('Discord client is not connected');
  }

  const guild = client.guilds.cache.get(serverId);
  if (!guild) {
    throw new Error(`Guild with ID ${serverId} not found`);
  }

  // Fetch all text channels
  const channels = guild.channels.cache
    .filter(channel => channel.type === 0) // 0 is GUILD_TEXT
    .map(channel => ({
      id: channel.id,
      serverId,
      name: channel.name,
      type: 'text',
      isActive: true
    }));

  // Save to storage
  const savedChannels: DiscordChannel[] = [];
  for (const channelData of channels) {
    const existingChannel = await storage.getChannel(channelData.id);
    
    if (!existingChannel) {
      // Create new channel
      const newChannel = await storage.createChannel(channelData as InsertDiscordChannel);
      savedChannels.push(newChannel);
    } else {
      savedChannels.push(existingChannel);
    }
  }

  return savedChannels;
}

// Get messages from a channel within the last 24 hours
export async function getRecentMessages(channelId: string): Promise<Message[]> {
  if (!isConnected || !client.isReady()) {
    throw new Error('Discord client is not connected');
  }

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      throw new Error(`Channel with ID ${channelId} not found or is not a text channel`);
    }

    // Calculate the timestamp for 24 hours ago
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    // Fetch messages
    let allMessages: Message[] = [];
    let lastId: string | undefined;
    let fetchedMessages: Collection<string, Message>;

    do {
      const options: any = { limit: 100 };
      if (lastId) options.before = lastId;

      fetchedMessages = await channel.messages.fetch(options);
      
      if (fetchedMessages.size === 0) break;
      
      const recentMessages = fetchedMessages.filter(msg => msg.createdAt > oneDayAgo);
      allMessages = [...allMessages, ...Array.from(recentMessages.values())];
      
      // Update the last ID for pagination
      lastId = fetchedMessages.last()?.id;
      
      // If the oldest message in this batch is already older than 24 hours, we can stop
      if (fetchedMessages.last()?.createdAt <= oneDayAgo) break;
      
    } while (fetchedMessages.size === 100);

    return allMessages;
  } catch (error) {
    log(`Error fetching messages from channel ${channelId}: ${error.message}`, 'discord');
    return [];
  }
}

// Get unique active users count from a list of messages
export function getActiveUsers(messages: Message[]): number {
  const uniqueUsers = new Set(messages.map(msg => msg.author.id));
  return uniqueUsers.size;
}
