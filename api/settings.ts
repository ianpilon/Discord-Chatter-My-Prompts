import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Return hardcoded settings directly - no async/await, no imports, no validation
  if (req.method === 'GET') {
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

  // Extremely simplified POST handler with no validation
  if (req.method === 'POST') {
    const settings = {
      id: 1,
      userId: 1,
      ...req.body
    };
    
    return res.status(200).json({
      message: "Settings updated successfully",
      settings
    });
  }

  // Handle unsupported methods
  return res.status(405).json({ message: "Method not allowed" });
}
