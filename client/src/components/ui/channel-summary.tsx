import { useState } from "react";
import { Hash, ChevronDown, ChevronUp, MessageCircle } from "lucide-react";
import MessageList from "./message-list";

interface Channel {
  id: string;
  name: string;
  type: string;
  serverId: string;
}

interface ChannelSummaryData {
  id: number;
  channelId: string;
  summary: string;
  messageCount: number;
  keyTopics: string[];
  generatedAt: string;
}

interface ChannelSummaryProps {
  channel: Channel;
  summary?: ChannelSummaryData | null;
  messages?: any[];
}

const ChannelSummary = ({ channel, summary, messages }: ChannelSummaryProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };
  
  // Log to help debugging
  console.log(`Rendering ChannelSummary for ${channel.name} (${channel.id}), summary:`, summary);
  
  // Identify test channels
  const isTestChannel = channel.name.toLowerCase() === 'chatbot-testing' || channel.id === '1332443868473463006';
  
  // Handle the case where summary doesn't exist yet
  const hasSummary = summary && typeof summary === 'object';
  const messageCount = hasSummary ? summary.messageCount : 0;
  
  return (
    <div className="bg-[#2f3136] rounded-lg overflow-hidden border-2 border-[#36393f] shadow-lg">
      <div className={`p-4 border-b border-gray-700 flex items-center justify-between ${isTestChannel ? 'bg-purple-900/30' : 'bg-[#7289da]/10'}`}>
        <div className="flex items-center">
          <Hash className={`mr-2 h-5 w-5 ${isTestChannel ? 'text-purple-300' : 'text-[#7289da]'}`} />
          <h3 className="font-semibold text-[#ffffff]">{channel.name}</h3>
          {isTestChannel && (
            <span className="ml-2 text-xs bg-purple-500/40 text-purple-100 px-2 py-0.5 rounded-full font-medium">
              Test Channel
            </span>
          )}
          {hasSummary ? (
            <span className="ml-2 text-xs bg-[#7289da]/20 text-[#a3b5ff] px-2 py-0.5 rounded-full font-medium">
              {messageCount} {messageCount === 1 ? 'message' : 'messages'}
            </span>
          ) : (
            <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full font-medium">
              {isTestChannel ? 'Ready for Testing' : 'Processing'}
            </span>
          )}
        </div>
        <button 
          className={`${isTestChannel ? 'text-purple-300' : 'text-[#7289da]'} hover:text-white p-1 bg-black/10 rounded-md`}
          onClick={toggleExpand}
        >
          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
      </div>
      
      {isExpanded && (
        <div className="p-4">
          {hasSummary ? (
            <>
              <h4 className="text-sm font-medium text-[#7289da] mb-2">Summary</h4>
              <p className="text-[#dcddde] mb-4">{summary.summary}</p>
              
              {summary.keyTopics && summary.keyTopics.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-[#7289da] mb-2">Key Topics</h4>
                  <div className="flex flex-wrap gap-2">
                    {summary.keyTopics.map((topic, index) => (
                      <span key={index} className="bg-[#36393f] px-2 py-1 rounded-full text-xs text-[#dcddde]">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Add the MessageList component for channels with summaries */}
              <div className="mt-6">
                <h4 className="text-sm font-medium text-[#7289da] mb-2 flex items-center">
                  <MessageCircle className="mr-1 h-4 w-4" /> Original Messages
                </h4>
                {messages && messages.length > 0 ? (
                  <MessageList channelId={channel.id} limit={20} messageData={messages} />
                ) : (
                  <MessageList channelId={channel.id} limit={20} />
                )}
              </div>
            </>
          ) : isTestChannel ? (
            <div className="py-2">
              <p className="text-purple-300 mb-2 font-semibold">Test Channel for Discord Summarizer</p>
              <p className="text-[#dcddde] mb-2">
                This is a special channel for testing the Discord AI summarization system.
              </p>
              <div className="mt-4 p-3 border border-dashed border-purple-500 rounded bg-purple-900/10">
                <p className="text-sm text-[#dcddde] mb-2">
                  <strong className="text-purple-300">To test this system:</strong>
                </p>
                <ol className="list-decimal list-inside text-sm text-[#dcddde] space-y-1">
                  <li>Send a few messages in the <span className="text-purple-300">{channel.name}</span> channel on Discord</li>
                  <li>Wait a moment for the Discord API to register your messages</li>
                  <li>Click the "Refresh" button at the top of this dashboard</li>
                  <li>The AI will generate a summary of your conversation</li>
                </ol>
              </div>
              <p className="text-xs text-[#72767d] mt-3">
                Channel ID: {channel.id}
              </p>
              
              {/* Add the MessageList component for test channels */}
              <div className="mt-6">
                <h4 className="text-sm font-medium text-purple-300 mb-2 flex items-center">
                  <MessageCircle className="mr-1 h-4 w-4" /> Discord Messages
                </h4>
                {messages && messages.length > 0 ? (
                  <MessageList channelId={channel.id} limit={10} isTestChannel={true} messageData={messages} />
                ) : (
                  <MessageList channelId={channel.id} limit={10} isTestChannel={true} />
                )}
              </div>
            </div>
          ) : (
            <div className="py-2">
              <p className="text-[#dcddde] mb-2">Generating summary for this channel...</p>
              <p className="text-xs text-[#72767d]">
                This channel is being monitored, but no summary has been generated yet.
                This could be because there are no recent messages in the last hour.
              </p>
              
              {/* Add the MessageList component for channels without summaries */}
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center">
                  <MessageCircle className="mr-1 h-4 w-4" /> Recent Messages
                </h4>
                {messages && messages.length > 0 ? (
                  <MessageList channelId={channel.id} limit={5} messageData={messages} />
                ) : (
                  <MessageList channelId={channel.id} limit={5} />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChannelSummary;
