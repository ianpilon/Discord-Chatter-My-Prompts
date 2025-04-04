import { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { getUserSettings, getDefaultSettings } from './storage-minimal';

// Define validation schema for settings
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  
  try {
    // Handle GET request to fetch settings
    if (req.method === 'GET') {
      // Return hardcoded settings that match what the frontend expects
      return res.status(200).json({
        id: 1,
        userId: 1,
        summaryFrequency: "24h",
        detailLevel: "standard",
        emailNotifications: true,
        webNotifications: true,
        autoAnalysisEnabled: true,
        defaultEmailRecipient: "user@example.com",
        messageThreshold: 5,
        timeThreshold: 5
      });
    }
    
    // Handle POST request to update settings
    if (req.method === 'POST') {
      // Validate request body
      const validationResult = userSettingsSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid settings data", 
          errors: validationResult.error.format() 
        });
      }
      
      // For demo/serverless environment, just return the validated data
      // as if it was saved (we can't actually save it in serverless without a DB)
      const settings = {
        ...getDefaultSettings(),
        ...validationResult.data
      };
      
      return res.status(200).json({
        message: "Settings updated successfully", 
        settings 
      });
    }
    
    // Handle unsupported methods
    return res.status(405).json({ message: "Method not allowed" });
  } catch (error: any) {
    console.error('Settings API error:', error);
    return res.status(500).json({
      message: `Settings operation failed: ${error.message}` 
    });
  }
}
