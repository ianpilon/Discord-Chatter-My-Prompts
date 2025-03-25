import OpenAI from "openai";
import { log } from "./vite";
import { type Message } from "discord.js";

// Initialize OpenAI client
// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Check if OpenAI API is available
export async function checkOpenAIStatus(): Promise<boolean> {
  try {
    await openai.models.list();
    return true;
  } catch (error: any) {
    log(`OpenAI API error: ${error.message}`, 'openai');
    return false;
  }
}

// Format Discord messages for summarization
function formatMessagesForSummary(messages: Message[]): string {
  return messages
    .map(msg => `${msg.author.username}: ${msg.content}`)
    .join('\n');
}

// Generate a summary of channel messages
export async function generateChannelSummary(messages: Message[], channelName: string): Promise<{
  summary: string;
  keyTopics: string[];
}> {
  // Check if this is a test channel
  const isChatbotTestingChannel = channelName.toLowerCase() === 'chatbot-testing';
  
  // Special handling by channel ID
  const specificTestChannelId = '1332443868473463006';
  const isSpecificTestChannel = messages.length > 0 && 
    messages[0].channel.id === specificTestChannelId;
    
  const isTestChannel = isChatbotTestingChannel || isSpecificTestChannel;
  
  // Log detailed information about the messages
  log(`Generating summary for ${channelName} (${isTestChannel ? 'test channel' : 'regular channel'}) with ${messages.length} messages`, 'openai');
  
  if (messages.length === 0) {
    log(`No messages to summarize for ${channelName}`, 'openai');
    
    // For test channels, provide a special placeholder summary
    if (isTestChannel) {
      return {
        summary: `This is a test channel for the Discord summarization system. No recent messages were found, but you can send messages here to see how they're processed and summarized by the AI.`,
        keyTopics: ['Testing', 'Discord Bot', 'AI Summarization', 'Channel Activity']
      };
    }
    
    return {
      summary: `No messages in the ${channelName} channel in the last hour.`,
      keyTopics: []
    };
  }

  try {
    // Log the messages being summarized
    messages.forEach((msg, i) => {
      log(`Message ${i+1} being summarized: ${msg.author.username}: ${msg.content.substring(0, 30)}...`, 'openai');
    });
    
    const messageText = formatMessagesForSummary(messages);
    log(`Formatted message text length: ${messageText.length} characters`, 'openai');
    
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

    log(`Sending request to OpenAI for channel ${channelName}`, 'openai');
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    log(`Received response from OpenAI for ${channelName}`, 'openai');
    const resultText = response.choices[0].message.content || "{}";
    log(`Raw response: ${resultText.substring(0, 100)}...`, 'openai');
    
    try {
      const result = JSON.parse(resultText);
      log(`Parsed JSON result successfully for ${channelName}`, 'openai');
      
      return {
        summary: result.summary || "Failed to generate summary.",
        keyTopics: result.keyTopics || []
      };
    } catch (parseError: any) {
      log(`Error parsing OpenAI response for ${channelName}: ${parseError.message}`, 'openai');
      // If parsing fails, return a basic summary
      return {
        summary: `Generated summary for ${channelName} based on ${messages.length} messages.`,
        keyTopics: ['Discord messages', 'Channel activity']
      };
    }
  } catch (error: any) {
    log(`Error generating channel summary: ${error.message}`, 'openai');
    return {
      summary: `Error generating summary for ${channelName}: ${error.message}`,
      keyTopics: []
    };
  }
}
