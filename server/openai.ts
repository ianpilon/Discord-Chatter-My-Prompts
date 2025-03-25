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
  } catch (error) {
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
  if (messages.length === 0) {
    return {
      summary: `No messages in the ${channelName} channel in the last 24 hours.`,
      keyTopics: []
    };
  }

  try {
    const messageText = formatMessagesForSummary(messages);
    
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

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      summary: result.summary || "Failed to generate summary.",
      keyTopics: result.keyTopics || []
    };
  } catch (error) {
    log(`Error generating channel summary: ${error.message}`, 'openai');
    return {
      summary: `Error generating summary for ${channelName}: ${error.message}`,
      keyTopics: []
    };
  }
}
