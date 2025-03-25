import { useMemo } from "react";
import { Server, Check } from "lucide-react";
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
  collapsed?: boolean;
  onViewDetails?: () => void;
  isLoading: boolean;
}

const ServerSummary = ({
  server,
  channels,
  summaries,
  collapsed = false,
  onViewDetails,
  isLoading
}: ServerSummaryProps) => {
  const activeChannels = useMemo(() => {
    // First check if channels is defined
    if (!channels || channels.length === 0) {
      return [];
    }
    
    console.log(`Processing ${channels.length} channels for server ${server.name || server.id}`);
    
    // Less strict filtering - show channels even if they don't have summaries yet
    const filtered = channels.filter(channel => {
      // Special case: Always include chatbot-testing channel for visibility during testing
      if (channel.name.toLowerCase() === 'chatbot-testing') {
        console.log(`Including test channel by name: ${channel.name}`);
        return true;
      }
      
      // Special case: Include our specific test channel by ID
      const specificTestChannelId = '1332443868473463006';
      if (channel.id === specificTestChannelId) {
        console.log(`Including test channel by ID: ${channel.id}`);
        return true;
      }
      
      // If channel has a summary, include it (even if messageCount is 0)
      if (summaries && Object.keys(summaries).includes(channel.id)) {
        console.log(`Including channel with summary: ${channel.name}`);
        return true;
      }
      
      return false;
    });
    
    console.log(`Filtered to ${filtered.length} active channels for display`);
    return filtered;
  }, [channels, summaries, server.id, server.name]);
  
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
            />
          ))
        ) : (
          <div className="bg-[#2f3136] rounded-lg p-6 text-center">
            <div className="flex flex-col items-center justify-center space-y-2">
              <Server className="h-8 w-8 text-[#72767d]" />
              <p className="text-[#dcddde]">No active channels in the last hour</p>
              <p className="text-sm text-[#72767d]">New summaries will appear here when there's recent activity</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServerSummary;
