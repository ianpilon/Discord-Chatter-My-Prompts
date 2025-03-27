import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { initializeDiscordClient, syncServers, syncChannels, getDiscordStatus, getRecentMessages } from "./discord";
import { checkOpenAIStatus } from "./openai";
import { scheduleDiscordSummaryJob, generateServerSummary } from "./scheduler";
import { log } from "./vite";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize Discord client
  await initializeDiscordClient();
  
  // Schedule the summary job
  scheduleDiscordSummaryJob();
  
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
      const channelId = req.params.channelId;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;
      
      // Get messages from storage
      const messages = await storage.getChannelMessages(channelId, limit);
      log(`Retrieved ${messages.length} messages for channel ${channelId}`, 'express');
      
      // Send messages wrapped in an object for consistency
      res.json({ messages });
    } catch (error: any) {
      console.error("Error fetching channel messages:", error);
      res.status(500).json({ message: `Failed to fetch channel messages: ${error.message}` });
    }
  });
  
  // Get original messages (first messages from the last 24 hours) for a channel
  app.get("/api/channels/:channelId/original-messages", async (req: Request, res: Response) => {
    try {
      const channelId = req.params.channelId;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      
      // Get original messages from storage
      const messages = await storage.getChannelOriginalMessages(channelId, limit);
      log(`Retrieved ${messages.length} original messages for channel ${channelId}`, 'express');
      
      // Send messages wrapped in an object for consistency
      res.json({ messages });
    } catch (error: any) {
      console.error("Error fetching channel original messages:", error);
      res.status(500).json({ message: `Failed to fetch channel original messages: ${error.message}` });
    }
  });
  
  // Manually trigger summary generation for a server
  
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
      
      // Get messages directly from Discord API
      const messages = await getRecentMessages(channelId);
      
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
app.post("/api/channels/:channelId/analyze-sentiment", async (req: Request, res: Response) => {
  try {
    const channelId = req.params.channelId;
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "No messages provided for analysis" });
    }
    
    // Log the start of analysis for debugging
    const startTime = Date.now();
    log(`Starting sentiment analysis for channel ${channelId} with ${messages.length} messages`, 'express');
    
    // Format messages for the AI analysis
    const messageText = messages.map(msg => `${msg.authorName}: ${msg.content}`).join("\n");
    
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
          content: "You are an AI specialized in analyzing Discord chat sentiment and dynamics. Provide insights about the tone, sentiment, key topics, and social dynamics in these messages. Format your response in Markdown with clear headings and bullet points."
        },
        {
          role: "user",
          content: `Analyze the sentiment, tone, and social dynamics of these Discord messages: \n\n${messageText}\n\nProvide a concise analysis with these sections:\n1. Overall Sentiment (positive, negative, neutral)\n2. Key Topics\n3. Social Dynamics\n4. Notable Communication Patterns`
        }
      ],
      temperature: 0.7,
      max_tokens: 500
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
    webNotifications: z.boolean().optional()
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
          webNotifications: true
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

  const httpServer = createServer(app);

  return httpServer;
}
