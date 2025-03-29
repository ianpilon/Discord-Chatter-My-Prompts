import { useState, useEffect } from "react";
import { MessageCircle, AlertCircle, RefreshCw, BarChart2, Loader2 } from "lucide-react";
import { fetchChannelMessages, analyzeMessageSentiment } from "@/lib/api";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, formatDistance } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

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
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analysisButtonState, setAnalysisButtonState] = useState<'idle' | 'clicked'>('idle');
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
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
    // Always enable for test channels, otherwise skip if messageData is provided
    enabled: !!channelId && (isTestChannel || !messageData),
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Use provided messageData if available, otherwise use data from the API
  const messages = messageData || messagesData?.messages || [];
  const hasMessages = Array.isArray(messages) && messages.length > 0;
  
  // Add more logging for debugging
  console.log(`MessageList for channel ${channelId}:`, {
    messageData,
    messagesFromAPI: messagesData?.messages,
    finalMessages: messages,
    hasMessages,
    isTestChannel
  });
  
  // If messageData is provided, we're never in a loading state
  const actualIsLoading = messageData ? false : isLoading;
  
  // Sync messages mutation
  const syncMessagesMutation = useMutation({
    mutationFn: () => {
      return fetch(`/api/channels/${channelId}/sync-messages`, { 
        method: 'POST'
      }).then(res => {
        if (!res.ok) {
          throw new Error('Failed to sync messages from Discord');
        }
        return res.json();
      });
    },
    onSuccess: (data) => {
      refetch(); // Refetch messages after syncing
      toast({
        title: 'Messages synced',
        description: `${data.saved} messages retrieved from Discord`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Sync failed',
        description: error.message || 'Could not sync messages from Discord',
        variant: 'destructive',
      });
    }
  });
  
  // Sentiment analysis mutation
  const sentimentAnalysis = useMutation({
    mutationFn: () => {
      const messagesToAnalyze = messages;
      if (!messagesToAnalyze || messagesToAnalyze.length === 0) {
        throw new Error('No messages to analyze');
      }
      return analyzeMessageSentiment(channelId, messagesToAnalyze);
    },
    onSuccess: (data) => {
      setAnalysisResult(data.analysis);
      
      // Store analysis result and channel information in localStorage
      localStorage.setItem('sentimentAnalysisResult', data.analysis);
      localStorage.setItem('analysisChannelName', channelId);
      
      toast({
        title: 'Analysis complete',
        description: 'Discord chat sentiment analysis is ready!',
        variant: 'default',
      });
      
      // Navigate to analysis page
      navigate('/analysis');
    },
    onError: (error: any) => {
      toast({
        title: 'Analysis failed',
        description: error.message || 'Could not analyze messages',
        variant: 'destructive',
      });
    }
  });
  
  // Special handling for test channels - always fetch messages even if messageData is provided
  useEffect(() => {
    if (messageData && messageData.length > 0) {
      console.log("Using provided messageData for channel", channelId, ":", messageData);
    } else if (isTestChannel) {
      console.log("This is a test channel - forcing refresh of messages");
      refetch();
    }
  }, [messageData, channelId, isTestChannel, refetch]);
  
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
          <div className="flex gap-2">
            {/* Sync Messages button - always visible regardless of message status */}
            <button
              onClick={() => syncMessagesMutation.mutate()}
              disabled={syncMessagesMutation.isPending}
              className={`text-xs px-2 py-1 rounded flex items-center transition-all duration-200 ${
                syncMessagesMutation.isPending 
                  ? 'bg-blue-500/40 text-white shadow-inner' 
                  : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
              }`}
            >
              {syncMessagesMutation.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              {syncMessagesMutation.isPending ? 'Syncing...' : 'Sync Messages'}
            </button>
            
            {hasMessages && (
              <button
                onClick={() => {
                  // Track start time when the button is clicked for response timing
                  const startTime = Date.now();
                  
                  // Update component state to track initial click without full loading state
                  setAnalysisButtonState('clicked');
                  
                  // Trigger the mutation
                  sentimentAnalysis.mutate(undefined, {
                    onSuccess: (data) => {
                      // Calculate response time
                      const responseTime = Date.now() - startTime;
                      console.log(`Sentiment analysis completed in ${responseTime}ms`);
                      
                      // Reset button state
                      setAnalysisButtonState('idle');
                      
                      // Continue with normal success handling
                      setAnalysisResult(data.analysis);
                      
                      // Store analysis result and channel information in localStorage
                      localStorage.setItem('sentimentAnalysisResult', data.analysis);
                      localStorage.setItem('analysisChannelName', channelId);
                      
                      toast({
                        title: 'Analysis complete',
                        description: 'Discord chat sentiment analysis is ready!',
                        variant: 'default',
                      });
                      
                      // Navigate to analysis page
                      navigate('/analysis');
                    },
                    onError: (error: any) => {
                      // Reset button state
                      setAnalysisButtonState('idle');
                      
                      // Continue with normal error handling
                      toast({
                        title: 'Analysis failed',
                        description: error.message || 'Could not analyze messages',
                        variant: 'destructive',
                      });
                    }
                  });
                }}
                disabled={sentimentAnalysis.isPending || analysisButtonState !== 'idle'}
                className={`text-xs px-2 py-1 rounded flex items-center transition-all duration-200 ${
                  analysisButtonState === 'clicked' 
                    ? 'bg-[#7289da]/30 text-[#7289da] scale-[0.98]' // Subtle feedback for initial click
                    : sentimentAnalysis.isPending 
                      ? 'bg-[#7289da]/40 text-[#7289da] shadow-inner' // More visible for longer loading
                      : 'bg-[#7289da]/20 text-[#7289da] hover:bg-[#7289da]/30' // Default state
                }`}
              >
                {sentimentAnalysis.isPending ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : analysisButtonState === 'clicked' ? (
                  <BarChart2 className="h-3 w-3 mr-1 animate-pulse" />
                ) : (
                  <BarChart2 className="h-3 w-3 mr-1" />
                )}
                {sentimentAnalysis.isPending 
                  ? 'Analyzing...' 
                  : analysisButtonState === 'clicked' 
                    ? 'Working...' 
                    : 'Analyze this chatter'}
              </button>
            )}
            
            {/* View Analysis button if we have analysis results */}
            {analysisResult && (
              <button
                onClick={() => {
                  // Store analysis result and channel information in localStorage
                  localStorage.setItem('sentimentAnalysisResult', analysisResult);
                  localStorage.setItem('analysisChannelName', channelId);
                  navigate('/analysis');
                }}
                className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded flex items-center gap-1 transition-colors"
              >
                <BarChart2 className="h-3 w-3 mr-1" />
                View Analysis
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
        <div className={`${isTestChannel ? 'border-2 border-purple-500/30 bg-[#36393f]' : 'bg-[#36393f]'} rounded-md overflow-hidden`}>
          {isTestChannel ? (
            <div className="p-4">
              <div className="flex items-center mb-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-sm mr-2 shadow-sm">
                  AI
                </div>
                <div>
                  <div className="font-medium text-white">Discord Chatter</div>
                  <div className="text-xs text-purple-300">{format(new Date(), 'MMM d, yyyy • h:mm a')}</div>
                </div>
              </div>
              <div className="pl-11 text-[#dcddde] whitespace-pre-wrap space-y-3">
                <p className="bg-purple-800/10 p-2 rounded border border-purple-500/20">
                  This is a test channel for the Discord AI summarization system. Send some messages in a <span className="text-purple-400 font-medium">chatbot-testing</span> channel on Discord to see them appear here.
                </p>
                <div className="flex items-center text-sm text-[#72767d] mt-2">
                  <AlertCircle className="h-4 w-4 mr-2 text-purple-400" />
                  <p>No messages found in the last hour. Try sending some test messages!</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-3 px-4 text-[#72767d]">
              <p>No recent messages in this channel in the last hour.</p>
            </div>
          )}
        </div>
      ) : (
        <div className={`space-y-3 overflow-y-auto transition-all duration-300 ${expanded ? "max-h-96" : "max-h-36"}`}>
          {messages.map((message: DiscordMessage) => (
            <div key={message.id} className="bg-[#36393f] p-3 rounded-md border border-[#40444b] hover:border-[#7289da]/30">
              <div className="flex items-center mb-2">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7289da] to-[#5865f2] flex items-center justify-center text-white mr-2 shadow-sm">
                  {message.authorName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-white">{message.authorName}</div>
                  <div className="text-xs text-[#a3b1cf]">
                    {format(new Date(message.createdAt), 'MMM d, yyyy • h:mm a')}
                  </div>
                </div>
              </div>
              <div className="pl-11 text-[#dcddde] whitespace-pre-wrap">{message.content}</div>
            </div>
          ))}
        </div>
      )}
      
      {/* Sentiment analysis is now shown in a full page view */}
      
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