import { useMemo, useCallback } from "react";
import { Server, Check, Hash, ChevronDown, ChevronUp } from "lucide-react";
import ChannelSummary from "./channel-summary";

interface Channel {
  id: string;
  name: string;
  type: string;
  serverId: string;
}

interface ChannelSummary {
  id: number;
  channelId: string;
  summary: string;
  messageCount: number;
  keyTopics: string[];
  generatedAt: string;
}

interface ServerSummaryProps {
  server: {
    id: string;
    name: string;
  };
  channels: Channel[];
  summaries: Record<string, ChannelSummary>;
  messages?: Record<string, any>; // Add messages prop
  collapsed?: boolean;
  onViewDetails?: () => void;
  isLoading: boolean;
}

const ServerSummary = ({
  server,
  channels,
  summaries,
  messages = {},
  collapsed = false,
  onViewDetails,
  isLoading
}: ServerSummaryProps) => {
  // Function to check if a channel is a test channel
  const isTestChannel = useCallback((channel: Channel) => {
    return channel.name.toLowerCase() === 'chatbot-testing' || 
           channel.id === '1332443868473463006' ||
           channel.name.includes('test');
  }, []);

  const activeChannels = useMemo(() => {
    // First check if channels is defined
    if (!channels || channels.length === 0) {
      console.log(`No channels found for server ${server.name || server.id}`);
      return [];
    }
    
    console.log(`Processing ${channels.length} channels for server ${server.name || server.id}`);
    
    // Find any test channels first
    const testChannels = channels.filter(channel => isTestChannel(channel));
    if (testChannels.length > 0) {
      console.log(`Found ${testChannels.length} test channels`);
    }
    
    // IMPORTANT: Show ALL channels in the list, not just ones with summaries
    // This ensures users can see their channels even if there's no activity
    const filtered = channels.filter(channel => {
      // Include text channels and exclude voice channels
      if (channel.type !== "0" && channel.type !== "GUILD_TEXT") {
        return false;
      }
      
      // Show all channels - this is the main change
      return true;
    });
    
    // Sort channels to put test channels first
    filtered.sort((a, b) => {
      const aIsTest = isTestChannel(a);
      const bIsTest = isTestChannel(b);
      
      if (aIsTest && !bIsTest) return -1;
      if (!aIsTest && bIsTest) return 1;
      return 0;
    });
    
    console.log(`Filtered to ${filtered.length} active channels for display`);
    return filtered;
  }, [channels, summaries, server.id, server.name, isTestChannel]);
  
  const totalMessages = useMemo(() => {
    return activeChannels.reduce((total, channel) => {
      return total + (summaries[channel.id]?.messageCount || 0);
    }, 0);
  }, [activeChannels, summaries]);
  
  if (isLoading) {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-40 bg-[#36393f]/50 rounded animate-pulse"></div>
          <div className="h-4 w-24 bg-[#36393f]/50 rounded animate-pulse"></div>
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[#2f3136] rounded-lg overflow-hidden">
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <div className="h-4 w-32 bg-[#36393f]/50 rounded animate-pulse"></div>
                <div className="h-4 w-4 bg-[#36393f]/50 rounded animate-pulse"></div>
              </div>
              <div className="p-4 space-y-3">
                <div className="h-4 w-24 bg-[#36393f]/50 rounded animate-pulse"></div>
                <div className="h-16 bg-[#36393f]/50 rounded animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  if (collapsed) {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">{server.name}</h2>
          <div className="flex items-center text-sm">
            <span className="text-[#72767d] mr-2">Server Status:</span>
            <span className="flex items-center text-[#43b581]">
              <span className="w-2 h-2 bg-[#43b581] rounded-full mr-1"></span>
              Active
            </span>
          </div>
        </div>
        
        <div className="bg-[#2f3136] rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Server className="h-4 w-4 text-[#7289da] mr-2" />
              <span className="text-sm text-[#dcddde]">
                {activeChannels.length} active {activeChannels.length === 1 ? 'channel' : 'channels'} with {totalMessages} total {totalMessages === 1 ? 'message' : 'messages'}
              </span>
            </div>
            <button 
              className="bg-[#36393f] hover:bg-[#36393f]/70 text-sm px-3 py-1 rounded text-[#dcddde]"
              onClick={onViewDetails}
            >
              View Details
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">{server.name}</h2>
        <div className="flex items-center text-sm">
          <span className="text-[#72767d] mr-2">Server Status:</span>
          <span className="flex items-center text-[#43b581]">
            <span className="w-2 h-2 bg-[#43b581] rounded-full mr-1"></span>
            Active
          </span>
        </div>
      </div>
      
      <div className="space-y-4">
        {activeChannels.length > 0 ? (
          activeChannels.map(channel => (
            <ChannelSummary 
              key={channel.id}
              channel={channel}
              summary={summaries[channel.id]}
              messages={messages[channel.id]}
            />
          ))
        ) : (
          <>
            {/* This is a more helpful fallback for when we have no channels */}
            <div className="bg-[#2f3136] rounded-lg p-6 mb-4 border-2 border-[#7289da]/30">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="flex items-center justify-center w-16 h-16 bg-[#36393f] rounded-full">
                  <Server className="h-8 w-8 text-[#7289da]" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold text-white mb-2">No Visible Channels Yet</h3>
                  <p className="text-[#dcddde] mb-3">This server doesn't have any active channels in the last hour, or we're still loading channels.</p>
                  <div className="flex flex-col space-y-2 text-sm text-[#b9bbbe] max-w-md mx-auto mb-4">
                    <div className="flex items-start p-2 bg-black/20 rounded">
                      <span className="text-[#7289da] font-medium mr-2">•</span>
                      <p>Try clicking the Refresh button at the top to sync with Discord</p>
                    </div>
                    <div className="flex items-start p-2 bg-black/20 rounded">  
                      <span className="text-[#7289da] font-medium mr-2">•</span>
                      <p>Make sure your Discord bot has the necessary permissions (View Channels, Read Message History)</p>
                    </div>
                    <div className="flex items-start p-2 bg-black/20 rounded">
                      <span className="text-[#7289da] font-medium mr-2">•</span>
                      <p>Send some messages in Discord channels to generate activity summaries</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Show the chatbot-testing channel even if there's no activity */}
            <div className="bg-[#2f3136] rounded-lg overflow-hidden border-2 border-purple-500/30 shadow-lg">
              <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-purple-900/30">
                <div className="flex items-center">
                  <div className="mr-2 h-5 w-5 text-purple-300">#</div>
                  <h3 className="font-semibold text-[#ffffff]">chatbot-testing</h3>
                  <span className="ml-2 text-xs bg-purple-500/40 text-purple-100 px-2 py-0.5 rounded-full font-medium">
                    Test Channel
                  </span>
                </div>
                <button 
                  className="text-purple-300 hover:text-white p-1 bg-black/10 rounded-md"
                  onClick={() => {}}
                >
                  ▼
                </button>
              </div>
              
              <div className="p-4">
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
                      <li>Send a few messages in a <span className="text-purple-300">chatbot-testing</span> channel on Discord</li>
                      <li>Wait a moment for the Discord API to register your messages</li>
                      <li>Click the "Refresh" button at the top of this dashboard</li>
                      <li>The AI will generate a summary of your conversation</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ServerSummary;
