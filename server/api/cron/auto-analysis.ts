import { VercelRequest, VercelResponse } from '@vercel/node';
import { checkChannelsForAutoAnalysis } from '../../auto-analysis';
import { log } from '../../vite';

/**
 * This API endpoint is designed to be called by Vercel's cron job scheduler
 * It replaces the node-schedule implementation used in development
 * and runs the auto-analysis process on a schedule
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Validate the request is from Vercel's cron system or authorized source
  // You might want to add additional auth checks here in the future
  const authHeader = req.headers.authorization;
  
  // Basic protection - in production you might want something more secure
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    log('Unauthorized cron job attempt', 'cron');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    log('Running scheduled auto-analysis via cron API endpoint', 'cron');
    
    // Run the auto-analysis process
    await checkChannelsForAutoAnalysis();
    
    return res.status(200).json({ success: true, message: 'Auto-analysis completed successfully' });
  } catch (error: any) {
    log(`Error in cron job: ${error.message}`, 'cron');
    return res.status(500).json({ error: 'Failed to run auto-analysis', details: error.message });
  }
}
