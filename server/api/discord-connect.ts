import { VercelRequest, VercelResponse } from '@vercel/node';
import { Client, GatewayIntentBits } from 'discord.js';
import { log } from '../vite';

// Initialize Discord client for each API request
// This is less efficient than the persistent connection in development,
// but necessary for Vercel's serverless environment
let discordClient: Client | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Get the Discord token from environment variables
    const token = process.env.DISCORD_BOT_TOKEN;
    
    if (!token) {
      return res.status(400).json({ error: 'Discord token not configured' });
    }
    
    // Initialize the Discord client if not already done
    if (!discordClient) {
      discordClient = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent
        ]
      });
      
      await discordClient.login(token);
      log('Discord client connected via API', 'discord');
    }
    
    // Return connection status
    return res.status(200).json({
      status: 'connected',
      guilds: discordClient.guilds.cache.size,
      guildNames: discordClient.guilds.cache.map(guild => guild.name)
    });
  } catch (error: any) {
    log(`Error connecting to Discord: ${error.message}`, 'discord');
    return res.status(500).json({ error: 'Failed to connect to Discord', details: error.message });
  }
}
