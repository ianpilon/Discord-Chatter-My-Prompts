import { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';

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
  // Use dynamic imports to avoid initialization issues with ESM/CJS compatibility
  const { storage } = await import('../server/storage');
  
  try {
    // Handle GET request to fetch settings
    if (req.method === 'GET') {
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
      
      return res.status(200).json(settings);
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
