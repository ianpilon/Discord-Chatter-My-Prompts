import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { initializeDiscordClient, syncServers, syncChannels, getDiscordStatus, getRecentMessages, getAllMessages } from "./discord";
import { checkOpenAIStatus } from "./openai";
import { scheduleDiscordSummaryJob, generateServerSummary } from "./scheduler";
import { initializeAutoAnalysisService } from "./auto-analysis";
import { log } from "./vite";
import { z } from "zod";
import { type DiscordMessage } from "@shared/schema";
import { sendEmail } from "./api/email";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize Discord client
  await initializeDiscordClient();
  
  // Schedule the summary job
  scheduleDiscordSummaryJob();
  
  // Initialize the auto-analysis service
  initializeAutoAnalysisService();
  
  // API Routes
  // Update Discord bot token
  app.post("/api/discord/token", async (req: Request, res: Response) => {
    try {
      // Validate the token from the request body
      const tokenSchema = z.object({
        token: z.string().min(10)  // Just ensure it's non-empty and reasonably long
      });
      
      const parseResult = tokenSchema.safeParse(req.body);
      if (!parseResult.success) {
        log(`Token validation failed: ${JSON.stringify(parseResult.error)}`, 'express');
        return res.status(400).json({ 
          valid: false, 
          message: "Invalid token format" 
        });
      }
      
      log(`Token validation passed: Length = ${req.body.token?.length || 0}`, 'express');
      
      const { token } = parseResult.data;
      log(`Updating Discord bot token`, 'express');
      
      // Store the token in process.env - this is not persisted between restarts
      process.env.DISCORD_BOT_TOKEN = token;
      
      // Test if the token is valid
      try {
        log(`About to initialize Discord client with token of length: ${token.length}`, 'express');
        await initializeDiscordClient();
        
        // Add a delay to allow the Discord client to fully connect
        // This fixes the race condition where the API returns before the client is ready
        log('Waiting for Discord client to fully connect...', 'express');
        
        // Check connection status multiple times with delays
        let isConnected = false;
        for (let i = 0; i < 5; i++) {
          // Wait 1 second between checks
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          isConnected = getDiscordStatus();
          log(`Discord client connection check ${i+1}: connected=${isConnected}`, 'express');
          
          if (isConnected) {
            break;
          }
        }
        
        if (isConnected) {
          return res.json({ 
            valid: true, 
            message: "Token is valid and Discord client is connected" 
          });
        } else {
          return res.status(400).json({ 
            valid: false, 
            message: "Token was accepted but Discord client needs more time to connect. Please try refreshing." 
          });
        }
      } catch (error: any) {
        log(`Error testing Discord token: ${error.message}`, 'express');
        return res.status(400).json({ 
          valid: false, 
          message: `Invalid Discord token: ${error.message}` 
        });
      }
    } catch (error: any) {
      log(`Error updating Discord token: ${error.message}`, 'express');
      return res.status(500).json({ 
        valid: false, 
        message: `Failed to update Discord token: ${error.message}` 
      });
    }
  });
  
  // Refresh Discord connection
  app.post("/api/discord/refresh", async (_req: Request, res: Response) => {
    try {
      await initializeDiscordClient();
      const discordStatus = getDiscordStatus();
      
      res.json({
        discord: discordStatus ? "connected" : "disconnected",
        message: "Discord connection refreshed",
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({ message: `Failed to refresh Discord connection: ${error.message}` });
    }
  });
  
  // Get system status
  app.get("/api/status", async (_req: Request, res: Response) => {
    const discordStatus = getDiscordStatus();
    const openaiStatus = await checkOpenAIStatus();
    
    res.json({
      discord: discordStatus ? "connected" : "disconnected",
      openai: openaiStatus ? "operational" : "error",
      lastUpdated: new Date().toISOString()
    });
  });
  
  // Get all servers
  app.get("/api/servers", async (_req: Request, res: Response) => {
    try {
      // Check if Discord is connected
      const isDiscordConnected = getDiscordStatus();
      
      if (isDiscordConnected) {
        // Try to sync the latest servers from Discord
        try {
          await syncServers();
        } catch (syncError: any) {
          console.error(`Warning: Could not sync servers from Discord: ${syncError.message}`);
          // Continue with stored servers if sync fails
        }
      }
      
      // Get servers from storage (which now should include any newly synced servers)
      const servers = await storage.getServers();
      res.json(servers);
    } catch (error: any) {
      res.status(500).json({ message: `Failed to fetch servers: ${error.message}` });
    }
  });
  
  // Sync servers from Discord
  app.post("/api/servers/sync", async (_req: Request, res: Response) => {
    try {
      const servers = await syncServers();
      res.json({ message: `Successfully synced ${servers.length} servers`, servers });
    } catch (error: any) {
      res.status(500).json({ message: `Failed to sync servers: ${error.message}` });
    }
  });
  
  // Get server details including stats
  app.get("/api/servers/:serverId", async (req: Request, res: Response) => {
    try {
      const serverId = req.params.serverId;
      const server = await storage.getServer(serverId);
      
      if (!server) {
        return res.status(404).json({ message: "Server not found" });
      }
      
      // Check if this is a real Discord server ID (not a sample server)
      const isDiscordConnected = getDiscordStatus();
      const isRealServer = serverId.length > 10; // Real Discord IDs are longer than sample IDs
      
      if (isDiscordConnected && isRealServer) {
        // Try to sync channels for this server to ensure we have the latest data
        try {
          await syncChannels(serverId);
        } catch (syncError: any) {
          console.error(`Warning: Could not sync channels for server ${serverId}: ${syncError.message}`);
          // Continue with stored data if sync fails
        }
      }
      
      const stats = await storage.getLatestServerStats(serverId);
      
      // Also get channels for this server to include in the response
      const channels = await storage.getChannels(serverId);
      log(`Server ${serverId} has ${channels.length} channels in storage`, 'express');
      
      // Log channel types to help debug filtering issues
      const channelTypes = new Set(channels.map(c => c.type));
      log(`Channel types in server ${serverId}: ${Array.from(channelTypes).join(', ')}`, 'express');
      
      // Include channels in the response for easier client access - be more permissive with filtering
      // The previous filter might have been too strict
      const filteredChannels = channels.filter(channel => {
        // Handle numeric types, string types, and both standard and legacy Discord type formats
        const isTextChannel = 
          channel.type === "0" || // New Discord API format
          String(channel.type) === "0" || // Handle potential numeric values
          channel.type === "GUILD_TEXT" || // Legacy format
          String(channel.type).toLowerCase() === "text"; // Another common format
          
        return isTextChannel;
      });
      
      log(`Filtered to ${filteredChannels.length} text channels for server ${serverId}`, 'express');
      
      res.json({ 
        server, 
        stats,
        channels: filteredChannels 
      });
    } catch (error: any) {
      res.status(500).json({ message: `Failed to fetch server details: ${error.message}` });
    }
  });
  
  // Get channels for a server
  app.get("/api/servers/:serverId/channels", async (req: Request, res: Response) => {
    try {
      const serverId = req.params.serverId;
      
      // Check if Discord is connected
      const isDiscordConnected = getDiscordStatus();
      
      if (isDiscordConnected) {
        // Try to sync the latest channels from Discord
        try {
          await syncChannels(serverId);
        } catch (syncError: any) {
          console.error(`Warning: Could not sync channels from Discord: ${syncError.message}`);
          // Continue with stored channels if sync fails
        }
      }
      
      // Get channels from storage
      const channels = await storage.getChannels(serverId);
      
      // Apply the same filtering logic as in the server details endpoint
      const filteredChannels = channels.filter(channel => {
        // Handle numeric types, string types, and both standard and legacy Discord type formats
        const isTextChannel = 
          channel.type === "0" || // New Discord API format
          String(channel.type) === "0" || // Handle potential numeric values
          channel.type === "GUILD_TEXT" || // Legacy format
          String(channel.type).toLowerCase() === "text"; // Another common format
          
        return isTextChannel;
      });
      
      log(`Filtered to ${filteredChannels.length} text channels of ${channels.length} total channels`, 'express');
      
      res.json(filteredChannels);
    } catch (error: any) {
      res.status(500).json({ message: `Failed to fetch channels: ${error.message}` });
    }
  });
  
  // Sync channels for a server
  app.post("/api/servers/:serverId/channels/sync", async (req: Request, res: Response) => {
    try {
      const serverId = req.params.serverId;
      log(`Syncing channels for server ${serverId}...`, 'express');
      
      // First check if we can get actual channels from Discord
      try {
        const channels = await syncChannels(serverId);
        log(`Successfully synced ${channels.length} real channels for server ${serverId}`, 'express');
        
        // If we have channels, return them
        if (channels.length > 0) {
          return res.json({ message: `Successfully synced ${channels.length} channels`, channels });
        }
      } catch (error: any) {
        log(`Error syncing real channels: ${error.message}`, 'express');
        // Continue to fallback logic below
      }
      
      // If we couldn't get any channels or there was an error, create a test channel
      log(`No real channels found, creating test channel for server ${serverId}`, 'express');
      
      // Create a test channel and store it
      const testChannel = {
        id: 'test-channel-1',
        serverId: serverId,
        name: 'chatbot-testing', // This will match the special handling in the client
        type: '0', // Text channel
        position: 0,
        isActive: true,
        isPrivate: false,
        lastSynced: new Date().toISOString()
      };
      
      await storage.createOrUpdateChannel(testChannel);
      
      return res.json({ 
        message: 'Added test channel for troubleshooting', 
        channels: [testChannel] 
      });
    } catch (error: any) {
      log(`Failed to sync channels: ${error.message}`, 'express');
      res.status(500).json({ message: `Failed to sync channels: ${error.message}` });
    }
  });
  
  // Get latest channel summary
  app.get("/api/channels/:channelId/summary", async (req: Request, res: Response) => {
    try {
      const channelId = req.params.channelId;
      
      // Special handling for our test channel ID
      const specificTestChannelId = '1332443868473463006';
      const isChatbotTestingChannel = (channelId === specificTestChannelId); 
      
      // Get the channel to check its name for additional test channel identification
      const channel = await storage.getChannel(channelId);
      const isNamedTestChannel = channel && channel.name.toLowerCase() === 'chatbot-testing';
      
      // Get the latest actual summary
      const summary = await storage.getLatestChannelSummary(channelId);
      
      // If no summary but this is a test channel, create a placeholder summary for UI testing
      if (!summary && (isChatbotTestingChannel || isNamedTestChannel)) {
        log(`Creating placeholder summary for test channel ${channelId}`, "routes");
        
        // Create a placeholder summary for the UI to display
        const testSummary = {
          id: 0,
          channelId: channelId,
          summary: "This is a test channel for demonstrating the Discord summarization capabilities. Send messages here to see how they're processed.",
          messageCount: 0,
          activeUsers: 0,
          keyTopics: ["testing", "demonstration"],
          generatedAt: new Date().toISOString()
        };
        
        return res.json(testSummary);
      }
      
      if (!summary) {
        return res.status(404).json({ message: "No summary found for this channel" });
      }
      
      res.json(summary);
    } catch (error: any) {
      console.error("Error fetching channel summary:", error);
      res.status(500).json({ message: `Failed to fetch channel summary: ${error.message}` });
    }
  });
  
  // Get recent messages for a channel
  app.get("/api/channels/:channelId/messages", async (req: Request, res: Response) => {
    try {
      const channelIdOrName = req.params.channelId;
      const fetchAll = req.query.all === 'true';
      // If fetchAll is true, set limit to 0 (meaning no limit)
      const limit = fetchAll ? 0 : (req.query.limit ? parseInt(req.query.limit as string) : 30);
      
      log(`[DEBUG] Received request for messages with channelId/name: ${channelIdOrName}, fetchAll: ${fetchAll}, limit: ${limit}`, 'express');
      
      // Check if the identifier is a name or ID
      let channelId = channelIdOrName;
      
      // If it's not a numeric ID (Discord IDs are large numbers), it might be a channel name
      if (!/^\d{17,20}$/.test(channelIdOrName)) {
        log(`Received request with channel name: ${channelIdOrName}, attempting to find matching channel ID`, 'express');
        
        // Get all channels across all servers
        const allServers = await storage.getServers();
        log(`[DEBUG] Found ${allServers.length} servers to search for channel ${channelIdOrName}`, 'express');
        
        for (const server of allServers) {
          const channels = await storage.getChannels(server.id);
          log(`[DEBUG] Server ${server.name} has ${channels.length} channels`, 'express');
          
          const matchingChannel = channels.find(c => c.name === channelIdOrName);
          
          if (matchingChannel) {
            channelId = matchingChannel.id;
            log(`Found channel ID ${channelId} for channel name ${channelIdOrName}`, 'express');
            break;
          }
        }
      }
      
      // Log all messages in the storage for debugging
      const allMessages = await storage.getAllMessages();
      log(`[DEBUG] Total messages in storage: ${allMessages.length}`, 'express');
      
      // For debugging - print up to 5 messages to check their channelId values
      const sampleMessages = allMessages.slice(0, 5);
      sampleMessages.forEach((msg: DiscordMessage, i: number) => {
        log(`[DEBUG] Sample message #${i+1}: channelId=${msg.channelId}, id=${msg.id}, content=${msg.content}`, 'express');
      });
      
      // Count how many messages are stored with this channelId
      const messagesWithChannelId = allMessages.filter(msg => msg.channelId === channelId).length;
      log(`[DEBUG] Messages in storage with channelId=${channelId}: ${messagesWithChannelId}`, 'express');
      
      // Get messages from storage using the resolved channel ID
      let messages = await storage.getChannelMessages(channelId, limit);
      log(`Retrieved ${messages.length} messages for channel ${channelIdOrName} (ID: ${channelId})`, 'express');
      
      // If fetchAll is true and we're not seeing enough messages, trigger a sync
      if (fetchAll && messages.length < 10 && getDiscordStatus()) {
        log(`fetchAll=true requested but only ${messages.length} messages in storage. Triggering full sync...`, 'express');
        
        try {
          // Get ALL messages directly from Discord API
          const discordMessages = await getAllMessages(channelId);
          log(`Synced ${discordMessages.length} messages from Discord for channel ${channelIdOrName}`, 'express');
          
          // Get the updated messages from storage
          messages = await storage.getChannelMessages(channelId, limit);
          log(`After sync: Retrieved ${messages.length} messages for channel ${channelIdOrName}`, 'express');
        } catch (syncError: any) {
          log(`Error syncing messages for full fetch: ${syncError.message}`, 'express');
          // Continue with whatever messages we have
        }
      }
      
      // If no messages in storage and we're using a sample channel ID or Discord isn't connected,
      // create mock messages directly here to ensure they appear in the UI
      if (messages.length === 0) {
        log(`No messages found in storage, creating mock messages for UI display`, 'express');
        const isDiscordConnected = getDiscordStatus();
        const isSampleChannel = !channelId.match(/^\d{17,20}$/);
        
        if (!isDiscordConnected || isSampleChannel) {
          // Create mock messages on-the-fly for the UI
          const now = new Date();
          messages = [
            {
              id: '1000000000000000001',
              channelId: channelId,
              authorId: 'system',
              authorName: 'System',
              content: `This is a mock message for channel "${channelIdOrName}". The Discord client is ${isDiscordConnected ? 'connected' : 'not connected'}.`,
              createdAt: now,
              processedAt: now,
            },
            {
              id: '1000000000000000002',
              channelId: channelId,
              authorId: 'system',
              authorName: 'System',
              content: `Please ensure you have set up your Discord bot token in settings and that the channel ID is valid.`,
              createdAt: new Date(now.getTime() - 60000), // 1 minute ago
              processedAt: new Date(now.getTime() - 60000),
            }
          ];
          log(`Created ${messages.length} mock messages for UI display`, 'express');
        }
      }
      
      // Send messages wrapped in an object for consistency
      res.json({ messages });
      
      // Count messages for this channel ID for debugging
      const matchingMessages = allMessages.filter((m: DiscordMessage) => m.channelId === channelId);
      log(`[DEBUG] Messages in storage with channelId=${channelId}: ${matchingMessages.length}`, 'express');
      
    } catch (error: any) {
      console.error("Error fetching channel messages:", error);
      res.status(500).json({ message: `Failed to fetch channel messages: ${error.message}` });
    }
  });
  
  // Get original messages (first messages from the last 24 hours) for a channel
  app.get("/api/channels/:channelId/original-messages", async (req: Request, res: Response) => {
    try {
      const channelIdOrName = req.params.channelId;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      
      // Check if the identifier is a name or ID
      let channelId = channelIdOrName;
      
      // If it's not a numeric ID (Discord IDs are large numbers), it might be a channel name
      if (!/^\d{17,20}$/.test(channelIdOrName)) {
        log(`Received request with channel name: ${channelIdOrName}, attempting to find matching channel ID`, 'express');
        
        // Get all channels across all servers
        const allServers = await storage.getServers();
        for (const server of allServers) {
          const channels = await storage.getChannels(server.id);
          const matchingChannel = channels.find(c => c.name === channelIdOrName);
          
          if (matchingChannel) {
            channelId = matchingChannel.id;
            log(`Found channel ID ${channelId} for channel name ${channelIdOrName}`, 'express');
            break;
          }
        }
      }
      
      // Get original messages from storage using the resolved channel ID
      const messages = await storage.getChannelOriginalMessages(channelId, limit);
      log(`Retrieved ${messages.length} original messages for channel ${channelIdOrName} (ID: ${channelId})`, 'express');
      
      // Send messages wrapped in an object for consistency
      res.json({ messages });
    } catch (error: any) {
      console.error("Error fetching channel original messages:", error);
      res.status(500).json({ message: `Failed to fetch channel original messages: ${error.message}` });
    }
  });
  
  // Manually trigger summary generation for a server
  
  // Get ALL messages from a channel (for auto-analysis)
  app.get("/api/channels/:channelId/all-messages", async (req: Request, res: Response) => {
    try {
      const channelIdOrName = req.params.channelId;
      
      log(`Retrieving ALL messages for channel ${channelIdOrName} for auto-analysis`, 'express');
      
      // Check if the identifier is a name or ID
      let channelId = channelIdOrName;
      
      // If it's not a numeric ID (Discord IDs are large numbers), it might be a channel name
      if (!/^\d{17,20}$/.test(channelIdOrName)) {
        log(`Received request with channel name: ${channelIdOrName}, attempting to find matching channel ID`, 'express');
        
        // Get all channels across all servers
        const allServers = await storage.getServers();
        for (const server of allServers) {
          const channels = await storage.getChannels(server.id);
          const matchingChannel = channels.find(c => c.name === channelIdOrName);
          
          if (matchingChannel) {
            channelId = matchingChannel.id;
            log(`Found channel ID ${channelId} for channel name ${channelIdOrName}`, 'express');
            break;
          }
        }
      }
      
      // Get ALL messages directly from Discord API
      log(`Fetching all messages for channel ${channelId} directly from Discord...`, 'express');
      const messages = await getAllMessages(channelId);
      log(`Retrieved ${messages.length} total messages for channel ${channelIdOrName}`, 'express');
      
      // Send messages wrapped in an object for consistency
      res.json({ messages });
    } catch (error: any) {
      console.error("Error fetching all channel messages:", error);
      res.status(500).json({ message: `Failed to fetch all channel messages: ${error.message}` });
    }
  });
  
  // Sync messages for a channel directly from Discord
  app.post("/api/channels/:channelId/sync-messages", async (req: Request, res: Response) => {
    try {
      const { channelId } = req.params;
      
      // Check if Discord client is initialized
      if (!getDiscordStatus()) {
        return res.status(400).json({ 
          message: "Discord client is not initialized. Please connect your Discord bot first." 
        });
      }
      
      log(`Syncing messages for channel ${channelId} directly from Discord...`, 'express');
      
      // Get ALL messages directly from Discord API
      const messages = await getAllMessages(channelId);
      
      // Store them in our local storage
      let savedCount = 0;
      for (const message of messages) {
        try {
          // The storage API expects Date objects for timestamps based on the schema
          // Make sure we have proper Date objects for createdAt and processedAt
          const createdAt = message.createdAt instanceof Date 
            ? message.createdAt 
            : typeof message.createdAt === 'string' 
              ? new Date(message.createdAt) 
              : new Date();
              
          await storage.createMessage({
            id: message.id,
            channelId: message.channelId,
            authorId: message.author.id,
            authorName: message.author.username,
            content: message.content,
            createdAt: createdAt, // Pass the Date object directly
            processedAt: new Date() // Pass the Date object directly
          });
          savedCount++;
        } catch (error) {
          console.error(`Error saving message ${message.id}:`, error);
          // Continue with other messages even if one fails
        }
      }
      
      log(`Synced ${savedCount} of ${messages.length} messages for channel ${channelId}`, 'express');
      res.json({ 
        count: messages.length, 
        saved: savedCount,
        channelId,
        synced: true
      });
    } catch (error: any) {
      console.error("Error syncing messages:", error);
      res.status(500).json({ message: `Failed to sync messages: ${error.message}` });
    }
  });
  
  // Analyze messages for sentiment
// Analyze messages for Jobs to be Done (JTBD)
app.post("/api/channels/:channelId/analyze-jtbd", async (req: Request, res: Response) => {
  try {
    const channelId = req.params.channelId;
    const { messages, sentimentAnalysis } = req.body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "No messages provided for analysis" });
    }
    
    // Log whether we received sentiment analysis input
    if (sentimentAnalysis) {
      log(`JTBD analysis received sentiment analysis input of ${sentimentAnalysis.length} characters`, 'express');
    }
    
    // Log the start of analysis for debugging
    const startTime = Date.now();
    log(`Starting JTBD analysis for channel ${channelId} with ${messages.length} messages`, 'express');
    
    // Format messages for the AI analysis with enhanced metadata
    const messageText = messages.map(msg => {
      const timestamp = msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt);
      const formattedDate = timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const formattedTime = timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      return `${msg.authorName}: ${msg.content} Posted by @${msg.authorName} ${formattedDate} • ${formattedTime}`;
    }).join("\n\n");
    
    // Prepare content for analysis based on whether we have sentiment analysis results
    let analysisContent = '';
    let contentType = 'raw messages';
    
    // Use the sentimentAnalysis from request body if available
    if (typeof sentimentAnalysis === 'string' && sentimentAnalysis.length > 0) {
      // If we have sentiment analysis, use it as the primary input
      analysisContent = sentimentAnalysis;
      contentType = 'sentiment analysis output';
    } else {
      // If no sentiment analysis was provided, use the raw messages
      analysisContent = messageText;
    }
    
    log(`Using ${contentType} as input for JTBD analysis`, 'express');
    
    // Check if we have a valid OpenAI API key
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_HERE') {
      // Provide a clear error message if API key is missing or not set
      log('OpenAI API key not configured. Provide a valid API key in .env file', 'express');
      return res.status(400).json({ 
        message: "OpenAI API key not configured. Please add your API key to the .env file.",
        apiKeyMissing: true
      });
    }
    
    // Use OpenAI to analyze the Jobs to be Done (JTBD)
    // Create a mock response when in mock mode or for testing
    if (process.env.OPENAI_API_KEY === 'mock' || process.env.NODE_ENV === 'test') {
      log('Using mock JTBD analysis response', 'express');
      const mockAnalysis = {
        channelId,
        analysis: `# Jobs to be Done (JTBD) Analysis

## 1. Primary User Needs
Users are trying to:
- Organize and track project tasks efficiently
- Understand technical information quickly
- Coordinate team efforts seamlessly

## 2. Functional Jobs
- Information sharing and collaboration
- Problem identification and resolution
- Progress tracking and updates

## 3. Emotional Jobs
- Seeking reassurance about project direction
- Looking for validation of ideas
- Wanting to feel connected to team members

## 4. Social Jobs
- Building credibility with peers
- Demonstrating expertise
- Maintaining professional relationships`,
        messagesAnalyzed: messages.length,
        generatedAt: new Date().toISOString()
      };
      
      return res.json(mockAnalysis);
    }
    
    // Import OpenAI dynamically
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    log('Sending JTBD analysis request to OpenAI API', 'express');
    const analysis = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert qualitative data research analyst specializing in the Jobs to be Done (JTBD) framework. Your task is to perform a deep, nuanced analysis to uncover the explicit and implicit 'jobs' users are trying to accomplish, explore the underlying motivations, frustrations, and tensions driving these jobs, and present rich, evidence-based insights. This analysis stops at findings—do not suggest solutions or product improvements. Your role is to equip Product Managers with a detailed understanding of user needs and struggles, enabling them to draw their own conclusions and make strategic product decisions."
        },
        {
          role: "user",
          content: `Analyze ${contentType === 'sentiment analysis output' ? 'this Broad Sentiment and Theme Analysis output' : 'these Discord messages'} using the Jobs to be Done (JTBD) framework: 

${analysisContent}

Objective:

You are an expert qualitative data research analyst specializing in the Jobs to be Done (JTBD) framework. Your task is to perform a deep, nuanced analysis of the provided ${contentType === 'sentiment analysis output' ? '"Broad Sentiment and Theme Analysis" output' : 'Discord messages'}, derived from user posts in a Discord channel. Your goal is to uncover the explicit and implicit "jobs" users are trying to accomplish, explore the underlying motivations, frustrations, and tensions driving these jobs, and present rich, evidence-based insights. This analysis stops at findings—do not suggest solutions or product improvements. Your role is to equip Product Managers with a detailed understanding of user needs and struggles, enabling them to draw their own conclusions and make strategic product decisions.

Responsibilities:

Uncover Explicit and Implicit Jobs:
- Identify explicit goals directly stated in the quotes (e.g., "I want X to work") and implicit goals inferred from context, tone, or subtext (e.g., a complaint about slowness hinting at a need for control).
- Differentiate between broad, overarching jobs (e.g., "manage my crypto confidently") and specific, immediate jobs (e.g., "see my transaction status").

Categorize Jobs:
- Classify each job as functional (task-related), emotional (feeling-related), or social (relationship-related), providing reasoning for the classification.

Explore Underlying Dynamics:
- Dig into the motivations behind each job—why it matters to users emotionally, practically, or socially.
- Analyze the frustrations or tensions users experience, including what's at stake if the job isn't fulfilled.
- Examine the contextual triggers or situations that make these jobs salient (e.g., specific tasks, moments of failure).

Highlight Supporting Evidence:
- Anchor every insight in the input data, using specific quotes WITH THEIR METADATA (username, date, and time information) that appears directly after each quote.
- When including quotes as evidence, always format them with double quotes and include the author metadata.
- Always format evidence like this: "Direct quote from the user" Posted by @Username Date • Time
- Note where multiple examples reinforce a job or reveal conflicting user experiences.

Surface User Coping Mechanisms:
- Describe how users are currently attempting to fulfill these jobs (e.g., workarounds, avoidance), revealing their resourcefulness or disengagement.

Identify Barriers and Trade-Offs:
- Detail the obstacles preventing job completion (e.g., technical issues, unclear feedback) and any trade-offs users face (e.g., speed vs. reliability).

Synthesize Across Themes:
- Connect related jobs across themes to reveal broader user needs or tensions, using patterns/trends to highlight their significance.
- Note where sentiment shifts (e.g., mixed feelings) might indicate complex or competing priorities.

Maintain Depth and Objectivity:
- Provide layered insights that go beyond surface-level observations, exploring the "why" behind user behavior and feelings.
- Avoid assumptions not supported by the data; flag ambiguity as an area for further exploration if evidence is thin.

Output Format:

# Overview of Key User Jobs 
[A concise summary of the most prominent or recurring jobs identified, with their categories—functional, emotional, social]

# In-Depth JTBD Analysis

## Theme: [Name from input]

### Job: [e.g., "Track transactions in real time" (functional)]
- Evidence: [Specific quote(s) WITH THEIR METADATA, e.g., "i sent ADA an hour ago and it's still not showing"
[Posted by CryptoUser on 3/28/2025 at 2:15 PM]]
- Motivation: [Why this matters, e.g., "Users need assurance their funds are safe and moving as expected"]
- Frustration/Tension: [What's at stake, e.g., "Uncertainty breeds distrust in the wallet's reliability"]
- Contextual Trigger: [When this job arises, e.g., "During high-value transfers"]
- Coping Mechanism: [How users adapt, e.g., "Manually checking elsewhere or waiting anxiously"]
- Barriers: [What's in the way, e.g., "Lack of visibility into transaction status"]
- Supporting Insight: [Deeper inference, e.g., "Delays amplify emotional stakes tied to financial security"]

[Additional jobs under this theme]

[Repeat for each theme]

# Cross-Theme Insights
- [Synthesize recurring jobs, tensions, or needs across themes, e.g., "A consistent thread of needing predictability ties transaction tracking to interface reliability"]
- [Highlight patterns/trends that amplify certain jobs' importance, e.g., "Escalating frustration with updates suggests a growing emotional disconnect"]

Additional Guidelines:
- Use quotes as the backbone of your analysis, weaving in theme descriptions and patterns for context.
- Push beyond obvious findings—e.g., instead of "users want a better interface," explore why it feels like "spinning a roulette wheel" emotionally or practically.
- If sentiment is mixed, unpack the duality (e.g., love for features but hate for instability) to reveal competing jobs.
- Avoid any prescriptive language (e.g., "improve this," "fix that")—focus solely on illuminating the user's perspective.
- Flag where data is sparse or ambiguous, e.g., "This job is hinted at but lacks multiple examples for confirmation."`
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    const analysisResult = analysis.choices[0].message.content;
    const analysisTime = Date.now() - startTime;
    log(`JTBD analysis completed in ${analysisTime}ms`, 'express');
    
    // Store the analysis in the database
    const analysisData = {
      channelId,
      analysis: analysisResult,
      messagesAnalyzed: messages.length,
      generatedAt: new Date().toISOString()
    };
    
    // Return the analysis to the client
    return res.json(analysisData);
  } catch (error: any) {
    console.error("Error analyzing JTBD:", error);
    res.status(500).json({ message: `Failed to analyze JTBD: ${error.message}` });
  }
});

// Analyze messages for sentiment
app.post("/api/channels/:channelId/analyze-sentiment", async (req: Request, res: Response) => {
  try {
    const channelId = req.params.channelId;
    const { messages, sentimentAnalysis } = req.body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "No messages provided for analysis" });
    }
    
    // Log the start of analysis for debugging
    const startTime = Date.now();
    log(`Starting sentiment analysis for channel ${channelId} with ${messages.length} messages`, 'express');
    
    // Format messages for the AI analysis with enhanced metadata
    const messageText = messages.map(msg => {
      const timestamp = msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt);
      const formattedDate = timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const formattedTime = timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      return `${msg.authorName}: ${msg.content} Posted by @${msg.authorName} ${formattedDate} • ${formattedTime}`;
    }).join("\n\n");
    
    // Prepare content for analysis based on whether we have sentiment analysis results
    let analysisContent = '';
    let contentType = 'raw messages';
    
    // Use the sentimentAnalysis from request body if available
    if (typeof sentimentAnalysis === 'string' && sentimentAnalysis.length > 0) {
      // If we have sentiment analysis, use it as the primary input
      analysisContent = sentimentAnalysis;
      contentType = 'sentiment analysis output';
    } else {
      // If no sentiment analysis was provided, use the raw messages
      analysisContent = messageText;
    }
    
    log(`Using ${contentType} as input for JTBD analysis`, 'express');
    
    // Check if we have a valid OpenAI API key
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_HERE') {
      // Provide a clear error message if API key is missing or not set
      log('OpenAI API key not configured. Provide a valid API key in .env file', 'express');
      return res.status(400).json({ 
        message: "OpenAI API key not configured. Please add your API key to the .env file.",
        apiKeyMissing: true
      });
    }
    
    // Use OpenAI to analyze the sentiment
    // Create a mock response when in mock mode or for testing
    if (process.env.OPENAI_API_KEY === 'mock' || process.env.NODE_ENV === 'test') {
      log('Using mock analysis response', 'express');
      const mockAnalysis = {
        channelId,
        analysis: `# Discord Chat Analysis

## 1. Overall Sentiment
The overall sentiment is positive and collaborative.

## 2. Key Topics
- Project updates and progress
- Technical questions and solutions
- Team coordination

## 3. Social Dynamics
The conversation shows a balanced dynamic with multiple contributors engaged in constructive discussion.

## 4. Notable Communication Patterns
- Problem-solving focus
- Supportive responses to questions
- Regular updates on progress`,
        messagesAnalyzed: messages.length,
        generatedAt: new Date().toISOString()
      };
      
      return res.json(mockAnalysis);
    }
    
    // Import OpenAI dynamically
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    log('Sending request to OpenAI API', 'express');
    const analysis = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an AI specialized in analyzing user posts to determine overall sentiment and identify recurring themes. Your analysis will be passed to another analyst for a Jobs to be Done (JTBD) analysis, ultimately supporting Product Managers in making higher-confidence product decisions."
        },
        {
          role: "user",
          content: `Analyze this collection of Discord messages: \n\n${messageText}\n\n
Objective:\n\nAnalyze these user posts to determine the overall sentiment and identify recurring themes or topics. This analysis will be passed to another analyst for a Jobs to be Done (JTBD) analysis, ultimately supporting Product Managers in making higher-confidence product decisions.\n\n
Task:\n\n- Determine the overall sentiment of the posts (e.g., positive, negative, neutral, mixed).\n- Identify key themes or topics that recur across the posts, considering the context of threaded conversations or specific topics if applicable.\n- For each theme:\n  - Provide a brief description.\n  - Indicate the sentiment associated with that theme.\n  - Include representative quotes or examples from the posts. Always include the full metadata (username, date, time) with each quote in the format: "Direct quote" Posted by @Username Date • Time\n- Note any notable patterns or trends across the posts (e.g., increasing frustration over time, growing interest in a feature).\n\n
Guidelines:\n\n- Focus on user expressions related to product experiences, features, pain points, and desires.\n- Prioritize themes that are most relevant to product development and user experience.\n- Consider both the frequency and intensity of mentions when identifying themes.\n- Be aware that posts may use casual or informal language; interpret sentiment and meaning accordingly.\n- Look for patterns across multiple posts rather than over-interpreting individual comments.\n- If posts are part of threads or specific topics, use that context to inform your analysis of sentiment and themes.\n- Avoid personal biases and ensure the analysis remains objective.\n\n
Output Format:\n\n# Overall Sentiment\n[Provide a summary of the general sentiment across all posts]\n\n# Key Themes\n## Theme 1: [Brief description of the theme]\n- Sentiment: [Associated sentiment, e.g., positive, negative, mixed]\n- Examples: [Include 2-3 representative quotes or examples from the posts]\n\n## Theme 2: [Brief description of the theme]\n- Sentiment: [Associated sentiment]\n- Examples: [Include 2-3 representative quotes or examples]\n\n[Continue for additional themes]\n\n# Notable Patterns/Trends\n[Describe any observed patterns or trends across the posts, e.g., recurring issues or growing interest in certain topics]\n`
        }
      ],
      temperature: 0.5,
      max_tokens: 1000
    });
    
    const analysisResult = analysis.choices[0].message.content;
    const analysisTime = Date.now() - startTime;
    log(`Sentiment analysis completed in ${analysisTime}ms`, 'express');
    
    // Store the analysis in the database
    const analysisData = {
      channelId,
      analysis: analysisResult,
      messagesAnalyzed: messages.length,
      generatedAt: new Date().toISOString()
    };
    
    // Return the analysis to the client
    return res.json(analysisData);
  } catch (error: any) {
    console.error("Error analyzing messages:", error);
    res.status(500).json({ message: `Failed to analyze messages: ${error.message}` });
  }
});

app.post("/api/servers/:serverId/generate-summary", async (req: Request, res: Response) => {
    const serverId = req.params.serverId;
    
    try {
      // Check if server exists
      const server = await storage.getServer(serverId);
      if (!server) {
        return res.status(404).json({ message: "Server not found" });
      }
      
      // Set a timeout for responding to the client
      // This will make the API respond faster while processing continues in the background
      const responseTimeout = 10000; // 10 seconds
      
      // Create a promise that resolves after the timeout
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, responseTimeout);
      });
      
      // Start the summary generation process
      const summaryPromise = generateServerSummary(serverId).catch(error => {
        log(`Error in background summary generation: ${error.message}`, 'express');
        return null;
      });
      
      // Define response types for type safety
      type CompletedResponse = {
        completed: true;
        stats: ReturnType<typeof generateServerSummary> | null;
      };
      
      type PendingResponse = {
        completed: false;
        message: string;
      };
      
      type ResponseResult = CompletedResponse | PendingResponse;
      
      // Race between the timeout and the summary completion
      const result = await Promise.race<ResponseResult>([
        // If summary finishes before timeout, use that result
        summaryPromise.then(stats => ({ 
          completed: true, 
          stats 
        }) as CompletedResponse),
        
        // If timeout happens first, return early response but keep processing
        timeoutPromise.then(() => ({ 
          completed: false,
          message: "Summary generation started. This may take a minute to complete." 
        }) as PendingResponse)
      ]);
      
      if (result.completed) {
        // Summary finished before timeout
        res.json({
          message: "Summary generation completed",
          stats: result.stats
        });
      } else {
        // Timeout happened, but we'll continue processing in the background
        res.json(result);
        
        // Ensure the summary generation continues in the background
        summaryPromise.then(stats => {
          if (stats) {
            console.log(`Background summary generation completed for server ${serverId}`);
          }
        });
      }
    } catch (error: any) {
      res.status(500).json({ message: `Failed to generate summary: ${error.message}` });
    }
  });
  
  // User settings routes
  const userSettingsSchema = z.object({
    summaryFrequency: z.enum(["24h", "12h", "6h"]).optional(),
    detailLevel: z.enum(["standard", "detailed", "concise"]).optional(),
    emailNotifications: z.boolean().optional(),
    webNotifications: z.boolean().optional(),
    // Auto-analysis settings
    autoAnalysisEnabled: z.boolean().optional(),
    defaultEmailRecipient: z.preprocess(
      // Preprocess to handle empty string case differently
      (val) => val === '' ? null : val,
      z.union([
        z.string().email(),
        z.null()
      ])
    ).optional().nullable(),
    messageThreshold: z.number().int().min(5).max(100).optional(),
    timeThreshold: z.number().int().min(5).max(1440).optional() // minutes (max 24 hours)
  });
  
  // Get user settings
  app.get("/api/settings", async (_req: Request, res: Response) => {
    try {
      // For demo, we'll use user ID 1
      const userId = 1;
      let settings = await storage.getUserSettings(userId);
      
      if (!settings) {
        // Create default settings if none exist
        settings = await storage.createUserSettings({
          userId,
          summaryFrequency: "24h",
          detailLevel: "standard",
          emailNotifications: false,
          webNotifications: true,
          // Default auto-analysis settings
          autoAnalysisEnabled: false,
          defaultEmailRecipient: null,
          messageThreshold: 20,
          timeThreshold: 30
        });
      }
      
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: `Failed to fetch settings: ${error.message}` });
    }
  });
  
  // Update user settings
  app.post("/api/settings", async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validationResult = userSettingsSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ message: "Invalid settings data", errors: validationResult.error.format() });
      }
      
      // For demo, we'll use user ID 1
      const userId = 1;
      let settings = await storage.getUserSettings(userId);
      
      if (!settings) {
        // Create settings if they don't exist
        settings = await storage.createUserSettings({
          userId,
          ...validationResult.data
        });
      } else {
        // Update existing settings
        settings = await storage.updateUserSettings(settings.id, validationResult.data);
      }
      
      res.json({ message: "Settings updated successfully", settings });
    } catch (error: any) {
      res.status(500).json({ message: `Failed to update settings: ${error.message}` });
    }
  });

  // Email report routes
  
  // Email a report using Mailjet API
  app.post("/api/email/send", async (req: Request, res: Response) => {
    // The implementation is in the email.ts file
    await sendEmail(req, res);
  });

  const httpServer = createServer(app);

  return httpServer;
}
