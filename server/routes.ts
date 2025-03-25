import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { initializeDiscordClient, syncServers, syncChannels, getDiscordStatus } from "./discord";
import { checkOpenAIStatus } from "./openai";
import { scheduleDiscordSummaryJob, generateServerSummary } from "./scheduler";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize Discord client
  await initializeDiscordClient();
  
  // Schedule the summary job
  scheduleDiscordSummaryJob();
  
  // API Routes
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
      
      res.json({ server, stats });
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
      res.json(channels);
    } catch (error: any) {
      res.status(500).json({ message: `Failed to fetch channels: ${error.message}` });
    }
  });
  
  // Sync channels for a server
  app.post("/api/servers/:serverId/channels/sync", async (req: Request, res: Response) => {
    try {
      const serverId = req.params.serverId;
      const channels = await syncChannels(serverId);
      
      res.json({ message: `Successfully synced ${channels.length} channels`, channels });
    } catch (error: any) {
      res.status(500).json({ message: `Failed to sync channels: ${error.message}` });
    }
  });
  
  // Get latest channel summary
  app.get("/api/channels/:channelId/summary", async (req: Request, res: Response) => {
    try {
      const channelId = req.params.channelId;
      const summary = await storage.getLatestChannelSummary(channelId);
      
      if (!summary) {
        return res.status(404).json({ message: "No summary found for this channel" });
      }
      
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: `Failed to fetch channel summary: ${error.message}` });
    }
  });
  
  // Manually trigger summary generation for a server
  app.post("/api/servers/:serverId/generate-summary", async (req: Request, res: Response) => {
    try {
      const serverId = req.params.serverId;
      
      // Check if server exists
      const server = await storage.getServer(serverId);
      if (!server) {
        return res.status(404).json({ message: "Server not found" });
      }
      
      // Generate summaries
      const stats = await generateServerSummary(serverId);
      
      res.json({
        message: "Summary generation completed",
        stats
      });
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
