// This file configures the shared environment for all Vercel serverless functions
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Pre-initialize modules that need global initialization
export const initializeEnvironment = async () => {
  try {
    // Import the storage module to ensure it's initialized
    const { storage } = await import('../server/storage');
    
    // Log successful initialization
    console.log('API environment initialized successfully');
    
    return { success: true };
  } catch (error) {
    console.error('Failed to initialize API environment:', error);
    return { success: false, error };
  }
};

// Call this function when importing this module
initializeEnvironment().catch(err => {
  console.error('Error in environment initialization:', err);
});
