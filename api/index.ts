import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import { mockServers, mockSettings } from './mock-data';

// Create Express app
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add CORS headers for development
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// API Health check
app.get('/api/status', (req: Request, res: Response) => {
  res.json({ status: 'ok', environment: process.env.NODE_ENV });
});

// Get servers
app.get('/api/servers', (req: Request, res: Response) => {
  try {
    // Return mock servers for the demo
    res.json(mockServers);
  } catch (error) {
    console.error('Error fetching servers:', error);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

// Get user settings
app.get('/api/settings', (req: Request, res: Response) => {
  try {
    // Return mock settings for the demo
    res.json(mockSettings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Export the Express API
export default app;
