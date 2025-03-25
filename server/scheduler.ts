import { scheduleJob } from 'node-schedule';
import { storage } from './storage';
import { getRecentMessages, getActiveUsers } from './discord';
import { generateChannelSummary } from './openai';
import { log } from './vite';
import { type InsertChannelSummary, type InsertServerStats } from '@shared/schema';

// Schedule the job to run once per day (at midnight)
export function scheduleDiscordSummaryJob() {
  // Run at midnight every day
  const job = scheduleJob('0 0 * * *', async () => {
    try {
      log('Starting scheduled Discord summary generation', 'scheduler');
      await generateAllServerSummaries();
      log('Completed scheduled Discord summary generation', 'scheduler');
    } catch (error) {
      log(`Error in scheduled job: ${error.message}`, 'scheduler');
    }
  });
  
  log('Discord summary job scheduled successfully', 'scheduler');
  return job;
}

// Generate summaries for all servers and channels
export async function generateAllServerSummaries() {
  try {
    // Get all active servers
    const servers = await storage.getServers();
    
    for (const server of servers) {
      if (!server.isActive) continue;
      
      // Get all channels for this server
      const channels = await storage.getChannels(server.id);
      let totalMessages = 0;
      let activeChannelsCount = 0;
      const activeUsersSet = new Set<string>();
      
      for (const channel of channels) {
        if (!channel.isActive) continue;
        
        // Get messages from the last 24 hours
        const messages = await getRecentMessages(channel.id);
        if (messages.length === 0) continue;
        
        // Count this as an active channel
        activeChannelsCount++;
        
        // Track total messages
        totalMessages += messages.length;
        
        // Track unique users
        messages.forEach(msg => activeUsersSet.add(msg.author.id));
        
        // Generate summary using OpenAI
        const { summary, keyTopics } = await generateChannelSummary(messages, channel.name);
        
        // Calculate active users for this channel
        const channelActiveUsers = getActiveUsers(messages);
        
        // Save the channel summary
        const channelSummary: InsertChannelSummary = {
          channelId: channel.id,
          summary,
          messageCount: messages.length,
          activeUsers: channelActiveUsers,
          keyTopics,
          generatedAt: new Date()
        };
        
        await storage.createChannelSummary(channelSummary);
        log(`Generated summary for channel ${channel.name} in server ${server.name}`, 'scheduler');
      }
      
      // Get previous server stats for comparison
      const previousStats = await storage.getLatestServerStats(server.id);
      
      // Calculate percentage changes
      const percentChange = {
        messages: previousStats ? calculatePercentChange(totalMessages, previousStats.totalMessages) : 0,
        users: previousStats ? calculatePercentChange(activeUsersSet.size, previousStats.activeUsers) : 0,
        channels: previousStats ? calculatePercentChange(activeChannelsCount, previousStats.activeChannels) : 0
      };
      
      // Save server stats
      const serverStats: InsertServerStats = {
        serverId: server.id,
        totalMessages,
        activeUsers: activeUsersSet.size,
        activeChannels: activeChannelsCount,
        percentChange,
        generatedAt: new Date()
      };
      
      await storage.createServerStats(serverStats);
      log(`Generated stats for server ${server.name}`, 'scheduler');
      
      // Update the server's lastSynced timestamp
      await storage.updateServer(server.id, { lastSynced: new Date() });
    }
    
    return true;
  } catch (error) {
    log(`Error generating server summaries: ${error.message}`, 'scheduler');
    return false;
  }
}

// Helper function to calculate percentage change
function calculatePercentChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

// Function to manually trigger summary generation for a specific server
export async function generateServerSummary(serverId: string) {
  try {
    // Get the server
    const server = await storage.getServer(serverId);
    if (!server || !server.isActive) {
      throw new Error(`Server ${serverId} not found or inactive`);
    }
    
    // Get all channels for this server
    const channels = await storage.getChannels(serverId);
    let totalMessages = 0;
    let activeChannelsCount = 0;
    const activeUsersSet = new Set<string>();
    
    for (const channel of channels) {
      if (!channel.isActive) continue;
      
      // Get messages from the last 24 hours
      const messages = await getRecentMessages(channel.id);
      if (messages.length === 0) continue;
      
      // Count this as an active channel
      activeChannelsCount++;
      
      // Track total messages
      totalMessages += messages.length;
      
      // Track unique users
      messages.forEach(msg => activeUsersSet.add(msg.author.id));
      
      // Generate summary using OpenAI
      const { summary, keyTopics } = await generateChannelSummary(messages, channel.name);
      
      // Calculate active users for this channel
      const channelActiveUsers = getActiveUsers(messages);
      
      // Save the channel summary
      const channelSummary: InsertChannelSummary = {
        channelId: channel.id,
        summary,
        messageCount: messages.length,
        activeUsers: channelActiveUsers,
        keyTopics,
        generatedAt: new Date()
      };
      
      await storage.createChannelSummary(channelSummary);
    }
    
    // Get previous server stats for comparison
    const previousStats = await storage.getLatestServerStats(serverId);
    
    // Calculate percentage changes
    const percentChange = {
      messages: previousStats ? calculatePercentChange(totalMessages, previousStats.totalMessages) : 0,
      users: previousStats ? calculatePercentChange(activeUsersSet.size, previousStats.activeUsers) : 0,
      channels: previousStats ? calculatePercentChange(activeChannelsCount, previousStats.activeChannels) : 0
    };
    
    // Save server stats
    const serverStats: InsertServerStats = {
      serverId,
      totalMessages,
      activeUsers: activeUsersSet.size,
      activeChannels: activeChannelsCount,
      percentChange,
      generatedAt: new Date()
    };
    
    await storage.createServerStats(serverStats);
    
    // Update the server's lastSynced timestamp
    await storage.updateServer(serverId, { lastSynced: new Date() });
    
    return serverStats;
  } catch (error) {
    log(`Error generating server summary: ${error.message}`, 'scheduler');
    throw error;
  }
}
