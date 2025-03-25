import { useState } from "react";
import { Hash, ChevronDown, ChevronUp } from "lucide-react";

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
}

const ChannelSummary = ({ channel, summary }: ChannelSummaryProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };
  
  // Handle the case where summary doesn't exist yet
  const hasSummary = summary && typeof summary === 'object';
  const messageCount = hasSummary ? summary.messageCount : 0;
  
  return (
    <div className="bg-[#2f3136] rounded-lg overflow-hidden">
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center">
          <Hash className="text-[#72767d] mr-2 h-4 w-4" />
          <h3 className="font-medium text-[#dcddde]">{channel.name}</h3>
          {hasSummary ? (
            <span className="ml-2 text-xs bg-[#7289da]/10 text-[#7289da] px-2 py-0.5 rounded-full">
              {messageCount} {messageCount === 1 ? 'message' : 'messages'}
            </span>
          ) : (
            <span className="ml-2 text-xs bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded-full">
              Processing
            </span>
          )}
        </div>
        <button 
          className="text-[#72767d] hover:text-[#dcddde]"
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
            </>
          ) : (
            <div className="py-2">
              <p className="text-[#dcddde] mb-2">Generating summary for this channel...</p>
              <p className="text-xs text-[#72767d]">
                This channel is being monitored, but no summary has been generated yet.
                {(channel.name.toLowerCase() === 'chatbot-testing' || channel.id === '1332443868473463006') && 
                  " This is a test channel - you can send messages here to see how they're processed."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChannelSummary;
