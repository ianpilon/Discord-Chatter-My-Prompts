import { scheduleJob } from 'node-schedule';
import { storage } from './storage';
import { getRecentMessages, getAllMessages } from './discord';
import { sendEmailDirect } from './api/email';
import { log } from './vite';
import OpenAI from 'openai';
import { Message } from 'discord.js';

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generate a summary of channel messages using our custom message format
 * This is similar to the generateChannelSummary function in openai.ts but works with our message format
 */
async function generateAutoAnalysisSummary(messages: DiscordMessageFromDB[], channelName: string): Promise<{
  summary: string;
  keyTopics: string[];
}> {
  try {
    // Format messages for the summary
    const messageText = messages
      .map(msg => `${msg.authorName}: ${msg.content}`)
      .join('\n');
    
    log(`Formatted message text length: ${messageText.length} characters`, 'auto-analysis');
    
    const prompt = `
      Please analyze and summarize the following Discord conversation from the "${channelName}" channel.
      Focus on the main discussion topics, key points, and notable interactions.
      Keep the summary concise but informative (150-200 words max).
      Also identify 3-5 key topics as short phrases (2-4 words each).
      
      Respond in JSON format with two fields:
      - "summary": a paragraph summarizing the conversation
      - "keyTopics": an array of 3-5 short topic phrases
      
      Here are the messages:
      ${messageText}
    `;

    // Check if we're using a mock API key
    const isMockMode = process.env.OPENAI_API_KEY === 'mock';
    let responseText: string;
    
    if (isMockMode) {
      log('Using mock OpenAI response for auto-analysis', 'auto-analysis');
      responseText = JSON.stringify({
        summary: `This channel contains ${messages.length} messages discussing ${channelName} topics. Users have been active recently.`,
        keyTopics: ['Discord Chat', 'Channel Activity', 'Community Discussion']
      });
    } else {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });
      responseText = response.choices[0].message.content || "{}"
    }

    log(`Received response for ${channelName}`, 'auto-analysis');
    log(`Raw response: ${responseText.substring(0, 100)}...`, 'auto-analysis');
    
    try {
      const result = JSON.parse(responseText);
      log(`Parsed JSON result successfully for ${channelName}`, 'auto-analysis');
      
      return {
        summary: result.summary || "Failed to generate summary.",
        keyTopics: result.keyTopics || []
      };
    } catch (parseError: any) {
      log(`Error parsing response for ${channelName}: ${parseError.message}`, 'auto-analysis');
      // If parsing fails, return a basic summary
      return {
        summary: `Generated summary for ${channelName} based on ${messages.length} messages.`,
        keyTopics: ['Discord messages', 'Channel activity']
      };
    }
  } catch (error: any) {
    log(`Error generating channel summary: ${error.message}`, 'auto-analysis');
    return {
      summary: `Error generating summary for ${channelName}: ${error.message}`,
      keyTopics: []
    };
  }
}

// Store the last analysis time for each channel
const lastAnalysisTime: Record<string, Date> = {};

// Store the message counts at last check for each channel
const lastMessageCounts: Record<string, number> = {};

// Track channels that are currently being analyzed to prevent duplicate processing
const channelsBeingAnalyzed = new Set<string>();

/**
 * Initialize the auto-analysis service
 * This sets up a recurring job that checks for new messages and triggers analysis
 * when thresholds are met
 */
export function initializeAutoAnalysisService() {
  // Check every minute for new messages that might trigger auto-analysis
  const job = scheduleJob('*/1 * * * *', async () => {
    try {
      await checkChannelsForAutoAnalysis();
    } catch (error: any) {
      log(`Error in auto-analysis check: ${error.message}`, 'auto-analysis');
    }
  });
  
  log('Auto-analysis service initialized', 'auto-analysis');
  return job;
}

/**
 * Check all channels for auto-analysis triggers
 */
export async function checkChannelsForAutoAnalysis() {
  // Get user settings to check if auto-analysis is enabled
  const userSettings = await storage.getUserSettings(1); // Using default user ID
  
  if (!userSettings || !userSettings.autoAnalysisEnabled) {
    // Auto-analysis is disabled, no need to check further
    return;
  }
  
  log('Auto-analysis is enabled, checking channels for new messages', 'auto-analysis');
  
  // Get all servers
  const servers = await storage.getServers();
  
  for (const server of servers) {
    // Skip inactive servers
    if (!server.isActive) continue;
    
    // Get all channels for this server
    const channels = await storage.getChannels(server.id);
    
    for (const channel of channels) {
      // Skip inactive channels
      if (!channel.isActive) continue;
      
      // Skip channels that are currently being analyzed
      if (channelsBeingAnalyzed.has(channel.id)) {
        log(`Channel ${channel.name} is already being analyzed, skipping`, 'auto-analysis');
        continue;
      }
      
      try {
        await checkChannelForAutoAnalysis(channel.id, channel.name, userSettings);
      } catch (error: any) {
        log(`Error checking channel ${channel.name} for auto-analysis: ${error.message}`, 'auto-analysis');
      }
    }
  }
}

/**
 * Check a specific channel for auto-analysis triggers
 */
async function checkChannelForAutoAnalysis(channelId: string, channelName: string, userSettings: any) {
  // Debug log user settings to see if they're being loaded correctly
  log(`User settings for auto-analysis: ${JSON.stringify(userSettings)}`, 'auto-analysis');
  
  // Get the time threshold from settings (in minutes)
  const timeThresholdMinutes = userSettings.timeThreshold || 30;
  const messageThreshold = userSettings.messageThreshold || 5; // Set to 5 by default
  
  // Check if we've analyzed this channel recently
  const lastAnalysis = lastAnalysisTime[channelId];
  const now = new Date();
  
  if (lastAnalysis) {
    const minutesSinceLastAnalysis = (now.getTime() - lastAnalysis.getTime()) / (1000 * 60);
    
    // If we haven't waited long enough since the last analysis, skip this channel
    if (minutesSinceLastAnalysis < timeThresholdMinutes) {
      log(`Channel ${channelName} was analyzed ${Math.round(minutesSinceLastAnalysis)} minutes ago, ` +
          `waiting until ${timeThresholdMinutes} minutes have passed`, 'auto-analysis');
      return;
    }
  }
  
  // Get recent messages for this channel
  const messages = await getRecentMessages(channelId);
  
  // Get the current message count
  const currentMessageCount = messages.length;
  
  // TEMPORARILY RESET message count to 0 for testing
  lastMessageCounts[channelId] = 0;
  
  // Get the previous message count (now always 0 for testing)
  const previousMessageCount = lastMessageCounts[channelId];
  
  // Calculate new messages since last check
  const newMessageCount = currentMessageCount - previousMessageCount;
  
  log(`Channel ${channelName} has ${newMessageCount} new messages since last check (FORCED FOR TESTING)`, 'auto-analysis');
  
  // Update the last message count
  lastMessageCounts[channelId] = currentMessageCount;
  
  // Check if we've reached the message threshold
  if (newMessageCount >= messageThreshold) {
    log(`Channel ${channelName} has reached the message threshold (${newMessageCount} >= ${messageThreshold}), ` +
        `triggering auto-analysis`, 'auto-analysis');
    
    // Mark this channel as being analyzed
    channelsBeingAnalyzed.add(channelId);
    
    try {
      // Trigger analysis for this channel
      await triggerAutoAnalysis(channelId, channelName, userSettings);
      
      // Update the last analysis time
      lastAnalysisTime[channelId] = now;
    } finally {
      // Always remove the channel from the being analyzed set
      channelsBeingAnalyzed.delete(channelId);
    }
  }
}

/**
 * Interface for our Discord message format from the database
 */
interface DiscordMessageFromDB {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: Date;
  processedAt: Date;
}

/**
 * Trigger auto-analysis for a channel
 */
async function triggerAutoAnalysis(channelId: string, channelName: string, userSettings: any) {
  log(`Starting auto-analysis for channel ${channelName}`, 'auto-analysis');
  
  // Get all messages for this channel
  const discordMessages: Message[] = await getAllMessages(channelId);
  
  if (discordMessages.length === 0) {
    log(`No messages found for channel ${channelName}, skipping analysis`, 'auto-analysis');
    return;
  }
  
  log(`Analyzing ${discordMessages.length} messages from channel ${channelName}`, 'auto-analysis');
  
  // Convert Discord.js Message objects to our DiscordMessageFromDB format
  const messages: DiscordMessageFromDB[] = discordMessages.map(msg => ({
    id: msg.id,
    channelId: channelId,
    authorId: msg.author.id,
    authorName: msg.author.username,
    content: msg.content,
    createdAt: msg.createdAt,
    processedAt: new Date()
  }));
  
  // Generate summary using our custom function
  const { summary, keyTopics } = await generateAutoAnalysisSummary(messages, channelName);
  
  // Calculate active users for this channel
  const uniqueUsers = new Set<string>();
  // Use the authorId property from our message format
  messages.forEach(msg => uniqueUsers.add(msg.authorId));
  const activeUsers = uniqueUsers.size;
  
  // Save the channel summary
  const channelSummary = {
    channelId,
    summary,
    messageCount: messages.length,
    activeUsers,
    keyTopics,
    generatedAt: new Date()
  };
  
  await storage.createChannelSummary(channelSummary);
  log(`Saved auto-analysis summary for channel ${channelName}`, 'auto-analysis');

  // Step 1: Generate sentiment analysis
  log(`Generating sentiment analysis for channel ${channelName}`, 'auto-analysis');
  let sentimentAnalysis = null;
  try {
    // Format messages for the AI analysis with enhanced metadata
    const messageTextForAnalysis = messages.map(msg => {
      const timestamp = msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt);
      const formattedDate = timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const formattedTime = timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      return `${msg.authorName}: ${msg.content} Posted by @${msg.authorName} ${formattedDate} • ${formattedTime}`;
    }).join('\n\n');

    // Use OpenAI directly for sentiment analysis
    log('Sending request to OpenAI API for sentiment analysis', 'auto-analysis');
    const analysis = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an AI specialized in analyzing user posts to determine overall sentiment and identify recurring themes. Your analysis will be passed to another analyst for a Jobs to be Done (JTBD) analysis, ultimately supporting Product Managers in making higher-confidence product decisions."
        },
        {
          role: "user",
          content: `Analyze this collection of Discord messages: \n\n${messageTextForAnalysis}\n\n
            Objective:\n\nAnalyze these user posts to determine the overall sentiment and identify recurring themes or topics. This analysis will be passed to another analyst for a Jobs to be Done (JTBD) analysis, ultimately supporting Product Managers in making higher-confidence product decisions.\n\n
            Task:\n\n- Determine the overall sentiment of the posts (e.g., positive, negative, neutral, mixed).\n- Identify key themes or topics that recur across the posts, considering the context of threaded conversations or specific topics if applicable.\n- For each theme:\n  - Provide a brief description.\n  - Indicate the sentiment associated with that theme.\n  - Include representative quotes or examples from the posts.\n- Note any notable patterns or trends across the posts (e.g., increasing frustration over time, growing interest in a feature).\n\n
            Output Format:\n\n# Overall Sentiment\n[Provide a summary of the general sentiment across all posts]\n\n# Key Themes\n## Theme 1: [Brief description of the theme]\n- Sentiment: [Associated sentiment, e.g., positive, negative, mixed]\n- Examples: [Include 2-3 representative quotes or examples from the posts]\n\n## Theme 2: [Brief description of the theme]\n- Sentiment: [Associated sentiment]\n- Examples: [Include 2-3 representative quotes or examples]\n\n[Continue for additional themes]\n\n# Notable Patterns/Trends\n[Describe any observed patterns or trends across the posts, e.g., recurring issues or growing interest in certain topics]\n`
        }
      ],
      temperature: 0.5,
      max_tokens: 1000
    });
    
    const analysisResult = analysis.choices[0].message.content;
    
    // Store the analysis data
    sentimentAnalysis = {
      channelId,
      analysis: analysisResult,
      messagesAnalyzed: messages.length,
      generatedAt: new Date().toISOString()
    };
    
    log(`Sentiment analysis completed for channel ${channelName}`, 'auto-analysis');
  } catch (error: any) {
    log(`Error generating sentiment analysis: ${error.message}`, 'auto-analysis');
  }

  // Step 2: Generate JTBD analysis using the sentiment analysis results
  log(`Generating JTBD analysis for channel ${channelName}`, 'auto-analysis');
  let jtbdAnalysis = null;
  try {
    // Format messages for the AI analysis with enhanced metadata
    const messageTextForAnalysis = messages.map(msg => {
      const timestamp = msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt);
      const formattedDate = timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const formattedTime = timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      return `${msg.authorName}: ${msg.content} Posted by @${msg.authorName} ${formattedDate} • ${formattedTime}`;
    }).join('\n\n');

    // Prepare content for analysis based on whether we have sentiment analysis results
    let analysisContent = '';
    let contentType = 'raw messages';
    
    // Use the sentimentAnalysis from previous step if available
    if (sentimentAnalysis && sentimentAnalysis.analysis) {
      // If we have sentiment analysis, use it as the primary input
      analysisContent = sentimentAnalysis.analysis;
      contentType = 'sentiment analysis output';
    } else {
      // If no sentiment analysis was provided, use the raw messages
      analysisContent = messageTextForAnalysis;
    }
    
    log(`Using ${contentType} as input for JTBD analysis`, 'auto-analysis');
    
    // Use OpenAI directly for JTBD analysis
    log('Sending request to OpenAI API for JTBD analysis', 'auto-analysis');
    const analysis = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert qualitative data research analyst specializing in the Jobs to be Done (JTBD) framework. Your task is to perform a deep, nuanced analysis to uncover the explicit and implicit 'jobs' users are trying to accomplish, explore the underlying motivations, frustrations, and tensions driving these jobs, and present rich, evidence-based insights. This analysis stops at findings—do not suggest solutions or product improvements. Your role is to equip Product Managers with a detailed understanding of user needs and struggles, enabling them to draw their own conclusions and make strategic product decisions."
        },
        {
          role: "user",
          content: `Analyze ${contentType === 'sentiment analysis output' ? 'this Broad Sentiment and Theme Analysis output' : 'these Discord messages'} using the Jobs to be Done (JTBD) framework: \n\n${analysisContent}\n\nYou are an expert qualitative data research analyst specializing in the Jobs to be Done (JTBD) framework. Your task is to perform a deep, nuanced analysis of the provided ${contentType === 'sentiment analysis output' ? '"Broad Sentiment and Theme Analysis" output' : 'Discord messages'}, derived from user posts in a Discord channel. Your goal is to uncover the explicit and implicit "jobs" users are trying to accomplish, explore the underlying motivations, frustrations, and tensions driving these jobs, and present rich, evidence-based insights. This analysis stops at findings—do not suggest solutions or product improvements. Your role is to equip Product Managers with a detailed understanding of user needs and struggles, enabling them to draw their own conclusions and make strategic product decisions.`
        }
      ],
      temperature: 0.2,
      max_tokens: 1500
    });
    
    const analysisResult = analysis.choices[0].message.content;
    
    // Store the analysis data
    jtbdAnalysis = {
      channelId,
      analysis: analysisResult,
      messagesAnalyzed: messages.length,
      generatedAt: new Date().toISOString()
    };
    
    log(`JTBD analysis completed for channel ${channelName}`, 'auto-analysis');
  } catch (error: any) {
    log(`Error generating JTBD analysis: ${error.message}`, 'auto-analysis');
  }
  
  // Send email if email notifications are enabled and we have a recipient
  if (userSettings.emailNotifications && userSettings.defaultEmailRecipient) {
    log(`Sending email to ${userSettings.defaultEmailRecipient}`, 'auto-analysis');
    await sendAutoAnalysisEmail(
      channelName, 
      channelSummary, 
      sentimentAnalysis, 
      jtbdAnalysis, 
      userSettings.defaultEmailRecipient
    );
  } else {
    log(`Email not sent - notifications enabled: ${userSettings.emailNotifications}, recipient: ${userSettings.defaultEmailRecipient}`, 'auto-analysis');
  }
}

/**
 * Send an email with the auto-analysis results, including sentiment and JTBD analyses
 */
async function sendAutoAnalysisEmail(
  channelName: string, 
  summary: any, 
  sentimentAnalysis: any, 
  jtbdAnalysis: any, 
  recipient: string
) {
  try {
    log(`Sending comprehensive auto-analysis email for channel ${channelName} to ${recipient}`, 'auto-analysis');
    
    const subject = `Discord Auto-Analysis: ${channelName}`;
    
    // Format the key topics as a comma-separated list
    const topicsString = summary.keyTopics.join(', ');
    
    // Format the timestamp
    const timestamp = new Date(summary.generatedAt).toLocaleString();
    
    // Start building the email content with the basic summary
    let emailContent = `
      <h1>Discord Channel Auto-Analysis</h1>
      <p><strong>Channel:</strong> ${channelName}</p>
      <p><strong>Generated:</strong> ${timestamp}</p>
      <p><strong>Messages Analyzed:</strong> ${summary.messageCount}</p>
      <p><strong>Active Users:</strong> ${summary.activeUsers}</p>
      
      <h2>Recent Activity Summary</h2>
      <p>${summary.summary}</p>
      
      <h2>Key Topics</h2>
      <p>${topicsString}</p>
    `;
    
    // Add sentiment analysis results if available
    if (sentimentAnalysis && sentimentAnalysis.analysis) {
      emailContent += `
        <h2>Sentiment Analysis</h2>
        <div style="white-space: pre-line;">
          ${sentimentAnalysis.analysis}
        </div>
      `;
    }
    
    // Add JTBD analysis results if available
    if (jtbdAnalysis && jtbdAnalysis.analysis) {
      emailContent += `
        <h2>Jobs To Be Done (JTBD) Analysis</h2>
        <div style="white-space: pre-line;">
          ${jtbdAnalysis.analysis}
        </div>
      `;
    }
    
    // Add footer to the email
    emailContent += `
      <hr>
      <p><em>This is an automated message from Discord Digest.</em></p>
    `;
    
    // Send the email with the comprehensive analysis
    await sendEmailDirect(recipient, subject, emailContent);
    
    log(`Comprehensive auto-analysis email sent successfully to ${recipient}`, 'auto-analysis');
  } catch (error: any) {
    log(`Error sending auto-analysis email: ${error.message}`, 'auto-analysis');
  }
}
