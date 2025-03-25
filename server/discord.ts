import { Client, GatewayIntentBits, TextChannel, Collection, Message } from 'discord.js';
import { storage } from './storage';
import { log } from './vite';
import fetch from 'node-fetch';
import { 
  type InsertDiscordServer, 
  type InsertDiscordChannel,
  type DiscordServer,
  type DiscordChannel
} from '@shared/schema';

// Create Discord client with minimal intents until full permissions are granted
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    // These require privileged intents to be enabled in the Discord Developer Portal
    // Uncomment them after enabling the corresponding intents
    // GatewayIntentBits.GuildMessages,
    // GatewayIntentBits.MessageContent, // Requires MESSAGE CONTENT INTENT
    // GatewayIntentBits.GuildMembers,  // Requires SERVER MEMBERS INTENT
    // GatewayIntentBits.GuildPresences, // Requires PRESENCE INTENT
  ],
});

let isConnected = false;
let debugInfo = {
  tokenValid: false,
  inGuilds: false,
  intentsEnabled: false
};

// Direct REST API test to check token and guild membership
async function testDiscordToken(token: string): Promise<{ valid: boolean, inGuilds: boolean, botId?: string, botUsername?: string }> {
  try {
    // Test the token with a direct API call
    const response = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bot ${token}`
      }
    });
    
    if (!response.ok) {
      log(`Discord token test failed: ${response.status} ${response.statusText}`, 'discord');
      return { valid: false, inGuilds: false };
    }
    
    const botData = await response.json();
    log(`Discord token is valid for bot: ${botData.username}#${botData.discriminator}`, 'discord');
    debugInfo.tokenValid = true;
    
    // Check if the bot is in any guilds
    const guildsResponse = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: {
        Authorization: `Bot ${token}`
      }
    });
    
    if (!guildsResponse.ok) {
      log(`Guild check failed: ${guildsResponse.status} ${guildsResponse.statusText}`, 'discord');
      return { valid: true, inGuilds: false, botId: botData.id, botUsername: botData.username };
    }
    
    const guilds = await guildsResponse.json();
    
    if (Array.isArray(guilds) && guilds.length > 0) {
      log(`Bot is in ${guilds.length} servers: ${guilds.map(g => g.name).join(', ')}`, 'discord');
      debugInfo.inGuilds = true;
      return { valid: true, inGuilds: true, botId: botData.id, botUsername: botData.username };
    } else {
      log('Bot is not in any Discord servers. Please invite it to a server.', 'discord');
      return { valid: true, inGuilds: false, botId: botData.id, botUsername: botData.username };
    }
  } catch (error: any) {
    log(`Discord API test failed: ${error.message}`, 'discord');
    return { valid: false, inGuilds: false };
  }
}

export async function initializeDiscordClient(): Promise<void> {
  try {
    // Check if API token exists
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      log('Discord bot token not found. Discord client not initialized.', 'discord');
      return;
    }

    log('Attempting to connect to Discord...', 'discord');
    
    // First test the token with direct API calls
    const tokenTest = await testDiscordToken(token);
    
    if (!tokenTest.valid) {
      throw new Error('Discord token is invalid. Please check your token and try again.');
    }
    
    if (tokenTest.valid && !tokenTest.inGuilds) {
      log('WARNING: Your bot is not in any Discord servers!', 'discord');
      log('You need to invite your bot to at least one server for it to function properly.', 'discord');
      log('Use the following steps to invite your bot:', 'discord');
      log('1. Go to https://discord.com/developers/applications', 'discord');
      log('2. Select your application', 'discord');
      log('3. Go to OAuth2 -> URL Generator', 'discord');
      log('4. Check "bot" under scopes', 'discord');
      log('5. Select permissions: Read Messages/View Channels, Read Message History', 'discord');
      log('6. Copy the generated URL and open it in a browser', 'discord');
      log('7. Select a server to add your bot to', 'discord');
      log('', 'discord');
      log('The bot will continue in limited mode with sample data until invited to a server.', 'discord');
    }
    
    // Connect to Discord
    log('Attempting to login with Discord token...', 'discord');
    const loginResult = await client.login(token).catch(error => {
      throw new Error(`Discord login failed: ${error.message}`);
    });

    if (!loginResult) {
      throw new Error('Discord login failed: No response from Discord API');
    }
    
    log('Discord login successful, waiting for ready event...', 'discord');
    
    // Set up event handlers
    client.on('ready', () => {
      isConnected = true;
      log(`Logged in as ${client.user?.tag}!`, 'discord');
      log(`Connected to ${client.guilds.cache.size} servers`, 'discord');
      
      // List servers the bot is connected to
      client.guilds.cache.forEach(guild => {
        log(`- ${guild.name} (${guild.id})`, 'discord');
      });
    });

    client.on('error', (error) => {
      isConnected = false;
      log(`Discord client error: ${error.message}`, 'discord');
    });
    
    // Set a timeout to check if we ever get the ready event
    setTimeout(() => {
      if (!isConnected) {
        log('Discord client did not receive ready event after 5 seconds', 'discord');
        log('This may indicate one of these issues:', 'discord');
        log('1. The bot has not been invited to any Discord servers', 'discord');
        log('2. You need to enable intents in the Discord Developer Portal', 'discord');
        log('3. There might be network connectivity issues', 'discord');
        log('', 'discord');
        log('To invite your bot to a server:', 'discord');
        log('1. Go to https://discord.com/developers/applications', 'discord');
        log('2. Select your application', 'discord');
        log('3. Go to OAuth2 -> URL Generator', 'discord');
        log('4. Check "bot" under scopes', 'discord');
        log('5. Select permissions: Read Messages/View Channels, Read Message History', 'discord');
        log('6. Copy the generated URL and open it in a browser', 'discord');
        log('7. Select a server to add your bot to', 'discord');
      }
    }, 5000);

  } catch (error: any) {
    isConnected = false;
    log(`Failed to initialize Discord client: ${error?.message || 'Unknown error'}`, 'discord');
    
    // Provide more helpful error messages
    if (error?.message?.includes('invalid token')) {
      log('Please check that your Discord bot token is correct. It should be in the format "XXXXXXXXXXXXXXXXXXXXXXXX.XXXXXX.XXXXXXXXXXXXXXXXXXXXXXXXXXX"', 'discord');
    } else if (error?.message?.includes('disallowed intents')) {
      log('Your bot needs additional permissions. To get full functionality:', 'discord');
      log('1. Go to https://discord.com/developers/applications', 'discord');
      log('2. Select your application', 'discord');
      log('3. Go to "Bot" tab', 'discord');
      log('4. Under "Privileged Gateway Intents", enable:', 'discord');
      log('   - MESSAGE CONTENT INTENT', 'discord');
      log('   - SERVER MEMBERS INTENT', 'discord');
      log('   - PRESENCE INTENT', 'discord');
      log('5. Save changes and restart the application', 'discord');
      log('Until then, the application will run in limited mode with sample data.', 'discord');
    }
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
    let fetchedMessages: Collection<string, Message<boolean>>;

    do {
      const options: { limit: number; before?: string } = { limit: 100 };
      if (lastId) options.before = lastId;

      fetchedMessages = await channel.messages.fetch(options);
      
      if (fetchedMessages.size === 0) break;
      
      const recentMessages = fetchedMessages.filter(msg => msg.createdAt > oneDayAgo);
      allMessages = [...allMessages, ...Array.from(recentMessages.values())];
      
      // Update the last ID for pagination
      const lastMessage = fetchedMessages.last();
      lastId = lastMessage?.id;
      
      // If the oldest message in this batch is already older than 24 hours, we can stop
      if (lastMessage && lastMessage.createdAt <= oneDayAgo) break;
      
    } while (fetchedMessages.size === 100);

    return allMessages;
  } catch (error: any) {
    log(`Error fetching messages from channel ${channelId}: ${error?.message || 'Unknown error'}`, 'discord');
    return [];
  }
}

// Get unique active users count from a list of messages
export function getActiveUsers(messages: Message[]): number {
  const uniqueUsers = new Set(messages.map(msg => msg.author.id));
  return uniqueUsers.size;
}
