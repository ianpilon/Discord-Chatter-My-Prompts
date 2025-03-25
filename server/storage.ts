import { 
  users, type User, type InsertUser,
  discordServers, type DiscordServer, type InsertDiscordServer,
  discordChannels, type DiscordChannel, type InsertDiscordChannel,
  channelSummaries, type ChannelSummary, type InsertChannelSummary,
  serverStats, type ServerStats, type InsertServerStats,
  userSettings, type UserSettings, type InsertUserSettings
} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Discord server methods
  getServers(): Promise<DiscordServer[]>;
  getServer(id: string): Promise<DiscordServer | undefined>;
  createServer(server: InsertDiscordServer): Promise<DiscordServer>;
  updateServer(id: string, server: Partial<InsertDiscordServer>): Promise<DiscordServer | undefined>;
  
  // Discord channel methods
  getChannels(serverId: string): Promise<DiscordChannel[]>;
  getChannel(id: string): Promise<DiscordChannel | undefined>;
  createChannel(channel: InsertDiscordChannel): Promise<DiscordChannel>;
  
  // Channel summary methods
  getChannelSummaries(channelId: string, limit?: number): Promise<ChannelSummary[]>;
  getLatestChannelSummary(channelId: string): Promise<ChannelSummary | undefined>;
  createChannelSummary(summary: InsertChannelSummary): Promise<ChannelSummary>;
  
  // Server stats methods
  getLatestServerStats(serverId: string): Promise<ServerStats | undefined>;
  createServerStats(stats: InsertServerStats): Promise<ServerStats>;
  
  // User settings methods
  getUserSettings(userId: number): Promise<UserSettings | undefined>;
  createUserSettings(settings: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(id: number, settings: Partial<InsertUserSettings>): Promise<UserSettings | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private discordServers: Map<string, DiscordServer>;
  private discordChannels: Map<string, DiscordChannel>;
  private channelSummaries: Map<number, ChannelSummary>;
  private serverStats: Map<number, ServerStats>;
  private userSettings: Map<number, UserSettings>;
  
  private userCurrentId: number;
  private channelSummaryCurrentId: number;
  private serverStatsCurrentId: number;
  private userSettingsCurrentId: number;

  constructor() {
    this.users = new Map();
    this.discordServers = new Map();
    this.discordChannels = new Map();
    this.channelSummaries = new Map();
    this.serverStats = new Map();
    this.userSettings = new Map();
    
    this.userCurrentId = 1;
    this.channelSummaryCurrentId = 1;
    this.serverStatsCurrentId = 1;
    this.userSettingsCurrentId = 1;
    
    // Initialize with some default data
    this.initializeDefaultData();
  }

  // Initialize with default data for demo purposes
  private initializeDefaultData() {
    // Sample servers
    const servers: InsertDiscordServer[] = [
      { id: "server1", name: "Game Developers", icon: null, isActive: true, lastSynced: new Date() },
      { id: "server2", name: "JavaScript Community", icon: null, isActive: true, lastSynced: new Date() },
      { id: "server3", name: "Design Systems", icon: null, isActive: true, lastSynced: new Date() },
      { id: "server4", name: "AI Researchers", icon: null, isActive: true, lastSynced: new Date() },
      { id: "server5", name: "Python Developers", icon: null, isActive: true, lastSynced: new Date() }
    ];
    
    servers.forEach(server => this.createServer(server));
    
    // Sample channels for Game Developers server
    const channels: InsertDiscordChannel[] = [
      { id: "channel1", serverId: "server1", name: "general", type: "text", isActive: true },
      { id: "channel2", serverId: "server1", name: "unity-dev", type: "text", isActive: true },
      { id: "channel3", serverId: "server1", name: "game-design", type: "text", isActive: true },
      { id: "channel4", serverId: "server2", name: "react", type: "text", isActive: true },
      { id: "channel5", serverId: "server2", name: "node", type: "text", isActive: true }
    ];
    
    channels.forEach(channel => this.createChannel(channel));
    
    // Sample channel summaries (for demo purposes when Discord connection fails)
    const channelSummaries: InsertChannelSummary[] = [
      { 
        channelId: "channel1", 
        summary: "Discussions focused on upcoming game jams and sharing of developer resources. Several users shared their latest projects and received feedback from the community.",
        messageCount: 78,
        activeUsers: 12,
        keyTopics: ["Game Jams", "Project Sharing", "Game Engines"],
        generatedAt: new Date()
      },
      { 
        channelId: "channel2", 
        summary: "Technical questions about Unity physics system and rendering pipelines. A community member shared a custom shader tutorial that was well-received.",
        messageCount: 45,
        activeUsers: 8,
        keyTopics: ["Unity Physics", "Shader Programming", "Rendering Pipelines"],
        generatedAt: new Date()
      },
      { 
        channelId: "channel4", 
        summary: "React 18 features discussion and debugging help for context API issues. Several users discussed migration strategies from class components to hooks.",
        messageCount: 62,
        activeUsers: 15,
        keyTopics: ["React 18", "Context API", "Hooks Migration"],
        generatedAt: new Date()
      }
    ];
    
    channelSummaries.forEach(summary => this.createChannelSummary(summary));
    
    // Sample server statistics
    const serverStats: InsertServerStats[] = [
      {
        serverId: "server1",
        totalMessages: 123,
        activeUsers: 22,
        activeChannels: 3,
        percentChange: {
          messages: 15,
          users: 8,
          channels: 0
        },
        generatedAt: new Date()
      },
      {
        serverId: "server2",
        totalMessages: 85,
        activeUsers: 18,
        activeChannels: 2,
        percentChange: {
          messages: 5,
          users: -3,
          channels: 0
        },
        generatedAt: new Date()
      }
    ];
    
    serverStats.forEach(stats => this.createServerStats(stats));
    
    // Sample user settings
    const defaultUserSettings: InsertUserSettings = {
      userId: 1,
      summaryFrequency: "24h",
      detailLevel: "standard",
      emailNotifications: false,
      webNotifications: true
    };
    
    this.createUserSettings(defaultUserSettings);
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Discord server methods
  async getServers(): Promise<DiscordServer[]> {
    const servers = Array.from(this.discordServers.values());
    
    // Separate real Discord servers (with long IDs) from sample servers
    const realServers = servers.filter(server => server.id.length > 10);
    const sampleServers = servers.filter(server => server.id.length <= 10);
    
    // If we have real Discord servers, only return those
    // Otherwise, fall back to sample servers
    return realServers.length > 0 ? realServers : sampleServers;
  }

  async getServer(id: string): Promise<DiscordServer | undefined> {
    return this.discordServers.get(id);
  }

  async createServer(server: InsertDiscordServer): Promise<DiscordServer> {
    // Ensure all required fields have values to satisfy the type requirements
    const newServer: DiscordServer = {
      id: server.id,
      name: server.name,
      icon: server.icon !== undefined ? server.icon : null,
      isActive: server.isActive !== undefined ? server.isActive : true,
      lastSynced: server.lastSynced !== undefined ? server.lastSynced : new Date()
    };
    this.discordServers.set(server.id, newServer);
    return newServer;
  }

  async updateServer(id: string, serverUpdate: Partial<InsertDiscordServer>): Promise<DiscordServer | undefined> {
    const server = this.discordServers.get(id);
    if (!server) return undefined;
    
    const updatedServer = { ...server, ...serverUpdate };
    this.discordServers.set(id, updatedServer);
    return updatedServer;
  }

  // Discord channel methods
  async getChannels(serverId: string): Promise<DiscordChannel[]> {
    // Get all channels for this server
    const channels = Array.from(this.discordChannels.values()).filter(
      channel => channel.serverId === serverId
    );
    
    // If this is a real Discord server ID (longer than 10 chars), we only want real Discord channels
    if (serverId.length > 10) {
      // Real Discord channel IDs are also long
      return channels.filter(channel => channel.id.length > 10);
    }
    
    // For sample servers, return all channels
    return channels;
  }

  async getChannel(id: string): Promise<DiscordChannel | undefined> {
    return this.discordChannels.get(id);
  }

  async createChannel(channel: InsertDiscordChannel): Promise<DiscordChannel> {
    // Ensure all required fields have values
    const newChannel: DiscordChannel = {
      id: channel.id,
      serverId: channel.serverId,
      name: channel.name,
      type: channel.type,
      isActive: channel.isActive !== undefined ? channel.isActive : true
    };
    this.discordChannels.set(channel.id, newChannel);
    return newChannel;
  }

  // Channel summary methods
  async getChannelSummaries(channelId: string, limit: number = 5): Promise<ChannelSummary[]> {
    return Array.from(this.channelSummaries.values())
      .filter(summary => summary.channelId === channelId)
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
      .slice(0, limit);
  }

  async getLatestChannelSummary(channelId: string): Promise<ChannelSummary | undefined> {
    const summaries = await this.getChannelSummaries(channelId, 1);
    
    // If we have a summary, return it
    if (summaries.length > 0) {
      return summaries[0];
    }
    
    // If this is a real Discord channel (ID length > 10) and no summary exists,
    // create a placeholder summary
    if (channelId.length > 10) {
      const channel = await this.getChannel(channelId);
      
      if (channel) {
        // Create a placeholder summary
        const placeholderSummary: InsertChannelSummary = {
          channelId: channelId,
          summary: "No conversations have been analyzed yet. Check back later for an AI-generated summary of recent discussions.",
          messageCount: 0,
          activeUsers: 0,
          keyTopics: [],
          generatedAt: new Date()
        };
        
        return this.createChannelSummary(placeholderSummary);
      }
    }
    
    // No summary and not a real Discord channel
    return undefined;
  }

  async createChannelSummary(summary: InsertChannelSummary): Promise<ChannelSummary> {
    const id = this.channelSummaryCurrentId++;
    // Ensure all required fields have values
    const newSummary: ChannelSummary = {
      id,
      channelId: summary.channelId,
      summary: summary.summary,
      messageCount: summary.messageCount,
      activeUsers: summary.activeUsers !== undefined ? summary.activeUsers : 0,
      keyTopics: summary.keyTopics !== undefined ? summary.keyTopics : [],
      generatedAt: summary.generatedAt !== undefined ? summary.generatedAt : new Date()
    };
    this.channelSummaries.set(id, newSummary);
    return newSummary;
  }

  // Server stats methods
  async getLatestServerStats(serverId: string): Promise<ServerStats | undefined> {
    const stats = Array.from(this.serverStats.values())
      .filter(stats => stats.serverId === serverId)
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())[0];
    
    // If no stats exist and this is a real Discord server, create default stats
    if (!stats && serverId.length > 10) {
      // Create default stats for this real Discord server
      const serverChannels = await this.getChannels(serverId);
      const activeChannels = serverChannels.length;
      
      const defaultStats: InsertServerStats = {
        serverId: serverId,
        totalMessages: 0,
        activeUsers: 0,
        activeChannels: activeChannels,
        percentChange: {
          messages: 0,
          users: 0,
          channels: 0
        },
        generatedAt: new Date()
      };
      
      return this.createServerStats(defaultStats);
    }
    
    return stats;
  }

  async createServerStats(stats: InsertServerStats): Promise<ServerStats> {
    const id = this.serverStatsCurrentId++;
    // Ensure all required fields have values
    const newStats: ServerStats = {
      id,
      serverId: stats.serverId,
      totalMessages: stats.totalMessages,
      activeUsers: stats.activeUsers,
      activeChannels: stats.activeChannels,
      percentChange: stats.percentChange,
      generatedAt: stats.generatedAt !== undefined ? stats.generatedAt : new Date()
    };
    this.serverStats.set(id, newStats);
    return newStats;
  }

  // User settings methods
  async getUserSettings(userId: number): Promise<UserSettings | undefined> {
    return Array.from(this.userSettings.values()).find(
      settings => settings.userId === userId
    );
  }

  async createUserSettings(settings: InsertUserSettings): Promise<UserSettings> {
    const id = this.userSettingsCurrentId++;
    // Ensure all required fields have values
    const newSettings: UserSettings = {
      id,
      userId: settings.userId,
      summaryFrequency: settings.summaryFrequency !== undefined ? settings.summaryFrequency : "24h",
      detailLevel: settings.detailLevel !== undefined ? settings.detailLevel : "standard",
      emailNotifications: settings.emailNotifications !== undefined ? settings.emailNotifications : false,
      webNotifications: settings.webNotifications !== undefined ? settings.webNotifications : true
    };
    this.userSettings.set(id, newSettings);
    return newSettings;
  }

  async updateUserSettings(id: number, settingsUpdate: Partial<InsertUserSettings>): Promise<UserSettings | undefined> {
    const settings = this.userSettings.get(id);
    if (!settings) return undefined;
    
    const updatedSettings = { ...settings, ...settingsUpdate };
    this.userSettings.set(id, updatedSettings);
    return updatedSettings;
  }
}

export const storage = new MemStorage();
