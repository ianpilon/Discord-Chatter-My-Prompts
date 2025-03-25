import { useState, useEffect } from "react";
import { MessageCircle, AlertCircle, RefreshCw } from "lucide-react";
import { fetchChannelMessages } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistance } from "date-fns";

interface DiscordMessage {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  processedAt: string;
}

interface MessageListProps {
  channelId: string;
  limit?: number;
  isTestChannel?: boolean;
  messageData?: DiscordMessage[];
}

const MessageList = ({ channelId, limit = 10, isTestChannel = false, messageData }: MessageListProps) => {
  const [expanded, setExpanded] = useState(false);
  
  const {
    data: messagesData,
    isLoading,
    isError,
    refetch
  } = useQuery({
    queryKey: ['/api/channels/messages', channelId],
    queryFn: async () => {
      const response = await fetchChannelMessages(channelId, limit);
      console.log("Messages response for channel", channelId, ":", response);
      return response;
    },
    // Skip API call if messageData is provided
    enabled: !!channelId && !messageData,
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Use provided messageData if available, otherwise use data from the API
  const messages = messageData || messagesData?.messages || [];
  const hasMessages = Array.isArray(messages) && messages.length > 0;
  
  // If messageData is provided, we're never in a loading state
  const actualIsLoading = messageData ? false : isLoading;
  
  // Skip API call if messageData is provided
  useEffect(() => {
    if (messageData && messageData.length > 0) {
      console.log("Using provided messageData for channel", channelId, ":", messageData);
    }
  }, [messageData, channelId]);
  
  return (
    <div className="mt-4 border-t border-gray-700 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-[#7289da] flex items-center">
          <MessageCircle className="h-4 w-4 mr-1" /> Recent Messages
          {hasMessages && (
            <span className="ml-2 text-xs bg-[#7289da]/10 text-[#7289da] px-2 py-0.5 rounded-full">
              {messages.length}
            </span>
          )}
        </h4>
        <div className="flex items-center gap-2">
          {!messageData && (
            <button
              onClick={() => refetch()}
              className="text-xs text-[#72767d] hover:text-[#dcddde] flex items-center"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-[#72767d] hover:text-[#dcddde]"
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>
      
      {actualIsLoading ? (
        <div className="flex items-center justify-center py-10 bg-[#36393f] rounded-md">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#7289da]"></div>
        </div>
      ) : isError && !messageData ? (
        <div className="text-red-400 py-3 px-4 bg-red-900/20 rounded-md flex items-center">
          <AlertCircle className="h-4 w-4 mr-2" />
          Failed to load messages
        </div>
      ) : !hasMessages ? (
        <div className="text-[#72767d] py-3 px-4 bg-[#36393f] rounded-md">
          {isTestChannel ? (
            <p>No messages yet in this test channel. Send some messages on Discord to see them appear here.</p>
          ) : (
            <p>No recent messages in this channel in the last hour.</p>
          )}
        </div>
      ) : (
        <div className={`space-y-3 overflow-y-auto transition-all duration-300 ${expanded ? "max-h-96" : "max-h-36"}`}>
          {messages.map((message: DiscordMessage) => (
            <div key={message.id} className="bg-[#36393f] p-3 rounded-md">
              <div className="flex items-center mb-1">
                <div className="w-8 h-8 rounded-full bg-[#7289da] flex items-center justify-center text-white mr-2">
                  {message.authorName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-[#dcddde]">{message.authorName}</div>
                  <div className="text-xs text-[#72767d]">
                    {format(new Date(message.createdAt), 'MMM d, yyyy • h:mm a')}
                  </div>
                </div>
              </div>
              <div className="pl-10 text-[#dcddde]">{message.content}</div>
            </div>
          ))}
        </div>
      )}
      
      {hasMessages && expanded && (
        <div className="text-center mt-2">
          <button
            onClick={() => setExpanded(false)}
            className="text-xs text-[#72767d] hover:text-[#dcddde]"
          >
            Collapse
          </button>
        </div>
      )}
    </div>
  );
};

export default MessageList;