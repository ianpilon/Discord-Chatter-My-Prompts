import { Client, GatewayIntentBits, TextChannel, Collection, Message } from 'discord.js';
import { storage } from './storage';
import { log } from './vite';
import fetch from 'node-fetch';
import { 
  type InsertDiscordServer, 
  type InsertDiscordChannel,
  type DiscordServer,
  type DiscordChannel,
  type InsertDiscordMessage,
  type DiscordMessage
} from '@shared/schema';

// Create Discord client with the required intents for message content analysis
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Now enabled in Discord Developer Portal
    // Additional intents if you've enabled them
    // GatewayIntentBits.GuildMembers,  // Optional: SERVER MEMBERS INTENT
    // GatewayIntentBits.GuildPresences, // Optional: PRESENCE INTENT
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

  // Fetch all text channels - Discord.js v14 uses different channel type constants
  // 0: GUILD_TEXT, 5: GUILD_ANNOUNCEMENT, 15: GUILD_FORUM
  const textChannelTypes = [0, 5, 15];
  
  // Log all channels for debugging
  guild.channels.cache.forEach(channel => {
    log(`Channel in guild: ${channel.name} (${channel.id}) - Type: ${channel.type}`, 'discord');
  });

  const channels = guild.channels.cache
    .filter(channel => {
      // Filter for text-based channels
      const isTextChannel = textChannelTypes.includes(channel.type);
      
      // Special exception for "chatbot-testing" channel
      const isChatbotTesting = channel.name.toLowerCase() === 'chatbot-testing';
      
      // Special exception for a specific testing channel by ID
      const specificTestChannelId = '1332443868473463006'; // ID for a test channel
      const isSpecificTestChannel = channel.id === specificTestChannelId;
      
      // Exclude other bot/command channels (except chatbot-testing and specific test channel)
      const isExcluded = !isChatbotTesting && !isSpecificTestChannel &&
                       (channel.name.toLowerCase().includes('bot') || 
                        channel.name.toLowerCase().includes('command'));
        
      // Include the channel if it's a text channel and not excluded or if it's our specific test channel
      const shouldInclude = (isTextChannel && !isExcluded) || isSpecificTestChannel;
      
      // Debug log
      log(`Channel filter: ${channel.name} - isTextChannel: ${isTextChannel}, isChatbotTesting: ${isChatbotTesting}, isExcluded: ${isExcluded}, shouldInclude: ${shouldInclude}`, 'discord');
      
      return shouldInclude;
    })
    .map(channel => {
      // Determine channel type for display
      let type = 'text';
      if (channel.type === 5) type = 'announcement';
      if (channel.type === 15) type = 'forum';
      
      return {
        id: channel.id,
        serverId,
        name: channel.name,
        type: type,
        isActive: true
      };
    });

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

// Get messages from a channel within the last hour
export async function getRecentMessages(channelId: string): Promise<Message[]> {
  if (!isConnected || !client.isReady()) {
    throw new Error('Discord client is not connected');
  }

  try {
    log(`Fetching messages from channel ${channelId}`, 'discord');
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      throw new Error(`Channel with ID ${channelId} not found`);
    }
    
    const channelName = 'name' in channel ? channel.name : 'unknown';
    log(`Channel ${channelId} (${channelName}) found: ${channel.constructor.name} - Type: ${channel.type}`, 'discord');
    
    // Special handling for general channel
    if (channelName === 'first-landing-room' || channelName === 'general' || channelName === 'chat-room') {
      log(`This is a main channel (${channelName}), fetching with extra attention`, 'discord');
    }
    
    // Check if the channel has message fetching capabilities
    // TextChannel, NewsChannel, ThreadChannel have fetchMessages
    if (!('messages' in channel)) {
      log(`Channel ${channelId} (${channelName}) does not support message fetching`, 'discord');
      return [];
    }
    
    // Cast to a channel type that has messages
    const textChannel = channel as TextChannel;
    
    // We'll fetch messages from the last 1 hour to ensure we have the most recent activity
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    
    // Set seconds and milliseconds to zero to avoid millisecond comparison issues
    oneHourAgo.setSeconds(0);
    oneHourAgo.setMilliseconds(0);
    
    log(`Fetching messages since: ${oneHourAgo.toISOString()} for channel ${channelName} (${channelId})`, 'discord');
    log(`Current channel info - Name: ${channelName}, ID: ${channelId}, Type: ${textChannel.type}`, 'discord');

    // Fetch messages
    let allMessages: Message[] = [];
    let lastId: string | undefined;
    let fetchedMessages: Collection<string, Message<boolean>>;
    
    try {
      log(`Starting message fetch loop for channel ${channelName} (${channelId})`, 'discord');
      
      // First attempt - get the most recent messages
      try {
        // Increase the limit to make sure we get recent messages
        const initialFetch = await textChannel.messages.fetch({ limit: 30 });
        log(`Initial fetch returned ${initialFetch.size} messages from ${channelName}`, 'discord');
        log(`Current time: ${new Date().toISOString()}`, 'discord');
        
        if (initialFetch.size > 0) {
          // Log all messages for debugging
          initialFetch.forEach(msg => {
            log(`Message in ${channelName}: From ${msg.author.username} at ${msg.createdAt.toISOString()}: ${msg.content.substring(0, 30)}${msg.content.length > 30 ? '...' : ''}`, 'discord');
          });
          
          // Filter initial messages to only include those from the last hour
          const initialRecentMessages = Array.from(initialFetch.values()).filter(msg => {
            // Log each message's creation date for debugging
            const msgDate = msg.createdAt;
            const isRecent = msgDate > oneHourAgo;
            log(`Message date check: ${msgDate.toISOString()} > ${oneHourAgo.toISOString()} = ${isRecent}`, 'discord');
            return isRecent;
          });
          
          log(`Found ${initialRecentMessages.length} messages from the last hour in initial fetch`, 'discord');
          
          // Add these filtered messages to our collection
          allMessages = [...allMessages, ...initialRecentMessages];
        }
      } catch (initErr: any) {
        log(`Error in initial message fetch for ${channelName}: ${initErr.message}`, 'discord');
      }
      
      // Continue with pagination if needed
      if (allMessages.length < 50) {
        do {
          const options: { limit: number; before?: string } = { limit: 30 }; // Reduced to 30 to avoid rate limits
          if (lastId) options.before = lastId;
  
          try {
            fetchedMessages = await textChannel.messages.fetch(options);
            log(`Fetched ${fetchedMessages.size} additional messages from ${channelName}`, 'discord');
            
            if (fetchedMessages.size === 0) {
              log(`No more messages found in channel ${channelName}`, 'discord');
              break;
            }
            
            // Filter messages to only include those from the last hour
            const recentMessages = Array.from(fetchedMessages.values()).filter(msg => {
              // Log each message's creation date for debugging
              const msgDate = msg.createdAt;
              const isRecent = msgDate > oneHourAgo;
              log(`Message date check: ${msgDate.toISOString()} > ${oneHourAgo.toISOString()} = ${isRecent}`, 'discord');
              return isRecent;
            });
            
            log(`Found ${recentMessages.length} messages from the last hour in this batch`, 'discord');
            allMessages = [...allMessages, ...recentMessages];
            
            // Update the last ID for pagination
            const lastMessage = fetchedMessages.last();
            lastId = lastMessage?.id;
            
            // Just get a reasonable number of messages for testing
            if (allMessages.length >= 50) {
              log(`Reached 50 messages for ${channelName}, stopping fetch to avoid overload`, 'discord');
              break;
            }
          } catch (fetchErr: any) {
            log(`Error fetching batch from ${channelName}: ${fetchErr.message}`, 'discord');
            break;
          }
          
        } while (fetchedMessages && fetchedMessages.size === 30);
      }
      
      log(`Completed message fetch loop for ${channelName}. Total messages: ${allMessages.length}`, 'discord');
      
      // Log all messages for this channel and store them in the database
      for (const msg of allMessages) {
        log(`Message ${allMessages.indexOf(msg) + 1} in ${channelName}: From ${msg.author.username} at ${msg.createdAt.toISOString()}: ${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}`, 'discord');
        
        // Store message in database
        try {
          const messageData: InsertDiscordMessage = {
            id: msg.id,
            channelId: channelId,
            authorId: msg.author.id,
            authorName: msg.author.username,
            content: msg.content,
            createdAt: msg.createdAt,
            processedAt: new Date()
          };
          
          await storage.createMessage(messageData);
          log(`Stored message ${msg.id} in database`, 'discord');
        } catch (error: any) {
          log(`Error storing message ${msg.id} in database: ${error.message}`, 'discord');
        }
      }
      
    } catch (err: any) {
      // If there's an error fetching messages (e.g., permission issues)
      log(`Error in message fetching loop for channel ${channelName}: ${err.message}`, 'discord');
      // Return whatever messages we did manage to get
    }

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
