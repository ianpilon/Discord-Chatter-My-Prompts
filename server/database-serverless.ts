import { drizzle } from 'drizzle-orm/neon-http';
import { neon, neonConfig } from '@neondatabase/serverless';
import { log } from './vite';

// Configure Neon to work with Vercel's serverless environment
neonConfig.fetchConnectionCache = true;

// Initialize a serverless connection to the database
// This is optimized for Vercel's serverless environment

let dbConnection: any = null;

export function getServerlessDatabaseClient() {
  if (!dbConnection) {
    try {
      // Get the database URL from environment variables
      const databaseUrl = process.env.DATABASE_URL;
      
      if (!databaseUrl) {
        log('DATABASE_URL environment variable not set', 'database');
        throw new Error('Database URL not configured');
      }
      
      // Create a serverless SQL client
      const sql = neon(databaseUrl);
      
      // Initialize Drizzle with the HTTP client for serverless
      dbConnection = drizzle(sql);
      
      log('Serverless database connection initialized', 'database');
    } catch (error: any) {
      log(`Error connecting to database: ${error.message}`, 'database');
      throw error;
    }
  }
  
  return dbConnection;
}
