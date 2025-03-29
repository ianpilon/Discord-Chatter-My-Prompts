import React, { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { fetchServerDetails, analyzeMessageJTBD, analyzeMessageSentiment } from "@/lib/api";
import { Hash, MessageCircle, RefreshCw, Loader2, BarChart2, Info } from "lucide-react";
import MessageList from "@/components/ui/message-list";
import Sidebar from "@/components/ui/sidebar";
import ActivityHeader from "@/components/ui/activity-header";
import StatsOverview from "@/components/ui/stats-overview";
import StatusFooter from "@/components/ui/status-footer";
import ConnectServerDialog from "@/components/ui/connect-server-dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import AnalysisDrawer from "@/components/ui/analysis-drawer";
import { FixedSizeList as List } from 'react-window';
import { Dialog, DialogTrigger, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Server {
  id: string;
  name: string;
  icon: string | null;
  isActive: boolean;
  lastSynced: string;
}

interface Channel {
  id: string;
  serverId: string;
  name: string;
  type: string;
  isActive: boolean;
}

interface DiscordMessage {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  processedAt: string;
  // Add author object for avatar support
  author?: {
    id: string;
    username: string;
    avatarURL?: string;
    discriminator?: string;
  };
}

interface ChannelSummary {
  id: number;
  channelId: string;
  summary: string;
  messageCount: number;
  activeUsers: number;
  keyTopics: string[];
  generatedAt: string;
}

interface ServerStats {
  id: number;
  serverId: string;
  totalMessages: number;
  activeUsers: number;
  activeChannels: number;
  percentChange: {
    messages: number;
    users: number;
    channels: number;
  };
  generatedAt: string;
}

const Dashboard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
  const [isRecentMessagesExpanded, setIsRecentMessagesExpanded] = useState(true);
  // Analysis drawer state
  const [showAnalysisDrawer, setShowAnalysisDrawer] = useState(false);
  const [globalAnalysisResult, setGlobalAnalysisResult] = useState<string | null>(null);
  
  // Fetch servers
  const {
    data: servers = [],
    isLoading: isLoadingServers
  } = useQuery<Server[]>({
    queryKey: ['/api/servers'],
  });
  
  // Load saved navigation state from localStorage if available
  useEffect(() => {
    const savedServerId = localStorage.getItem('selectedServerId');
    const savedChannelId = localStorage.getItem('selectedChannelId');
    
    if (servers.length > 0) {
      // If we have saved state, restore it
      if (savedServerId && servers.some(server => server.id === savedServerId)) {
        setSelectedServerId(savedServerId);
        if (savedChannelId) {
          setSelectedChannelId(savedChannelId);
          // Also expand the server in the sidebar
          setExpandedServers(prev => new Set([...Array.from(prev), savedServerId]));
          
          // Ensure the server expansion state is updated in localStorage for sidebar too
          try {
            const expandedServers = localStorage.getItem('expandedServers');
            const expandedState = expandedServers ? JSON.parse(expandedServers) : {};
            expandedState[savedServerId] = true;
            localStorage.setItem('expandedServers', JSON.stringify(expandedState));
          } catch (err) {
            console.error('Error updating expanded servers state:', err);
          }
        }
      } else {
        // Otherwise set the first server as default
        setSelectedServerId(servers[0].id);
      }
    }
  }, [servers]);
  
  // Save navigation state whenever it changes
  useEffect(() => {
    if (selectedServerId) {
      localStorage.setItem('selectedServerId', selectedServerId);
    }
    if (selectedChannelId) {
      localStorage.setItem('selectedChannelId', selectedChannelId);
    }
  }, [selectedServerId, selectedChannelId]);
  
  
  // Fetch server details (which now includes channels) for the selected server
  const {
    data: serverDetails,
    isLoading: isLoadingServerDetails,
    refetch: refetchServerDetails,
    error: serverDetailsError
  } = useQuery<{ server: Server, stats: ServerStats, channels: Channel[] }>({
    queryKey: ['/api/servers', selectedServerId],
    enabled: !!selectedServerId,
    queryFn: () => selectedServerId ? fetchServerDetails(selectedServerId) : Promise.resolve(null),
    staleTime: 5000, // 5 seconds - keep data fresh
    retry: 2, // Retry twice if it fails
    refetchOnWindowFocus: true, // Refetch when user returns to the page
    refetchOnReconnect: true, // Refetch when network reconnects
  });
  
  // Debug: Log the entire server details response
  useEffect(() => {
    if (serverDetails) {
      console.log("Full server details response:", serverDetails);
    }
  }, [serverDetails]);
  
  // Handle API errors and show toast with reconnect option
  useEffect(() => {
    if (serverDetailsError) {
      // Check if it's a 404 error which likely means token is invalid or expired
      const is404 = (serverDetailsError as any)?.response?.status === 404;
      
      toast({
        title: is404 ? "Discord connection error" : "Error loading server data",
        description: is404 
          ? "Your Discord bot token may be invalid or expired. Click below to reconnect."
          : "There was a problem loading your server data. Try reconnecting your Discord bot.",
        variant: "destructive",
        action: (
          <Button 
            variant="outline" 
            onClick={() => setConnectDialogOpen(true)}
          >
            Reconnect Discord
          </Button>
        )
      });
    }
  }, [serverDetailsError, toast]);
  
  // Get channels for selected server from serverDetails
  const channels = serverDetails?.channels || [];
  
  // Auto-sync messages when a channel is selected
  useEffect(() => {
    // Only sync when we have a selected channel and server details are loaded
    // This means the Discord connection is working correctly
    if (selectedChannelId && serverDetails?.server) {
      console.log(`Auto-syncing messages for channel ${selectedChannelId}...`);
      // Sync messages directly from Discord when a channel is selected
      fetch(`/api/channels/${selectedChannelId}/sync-messages`, { 
        method: 'POST' 
      })
        .then(res => {
          if (!res.ok) throw new Error('Failed to sync messages');
          return res.json();
        })
        .then(data => {
          console.log(`Auto-synced ${data.saved} messages for channel ${selectedChannelId}`);
          // Invalidate queries to refetch messages using the correct syntax
          queryClient.invalidateQueries({ queryKey: [`/api/channels/${selectedChannelId}/messages`] });
        })
        .catch(error => {
          console.error('Auto-sync failed:', error);
        });
    }
  }, [selectedChannelId, serverDetails, queryClient]);
  
  // If we have no channels, let's trigger a sync operation to get them
  useEffect(() => {
    if (selectedServerId && channels.length === 0 && !isLoadingServerDetails) {
      console.log("No channels found, triggering channel sync...");
      fetch(`/api/servers/${selectedServerId}/channels/sync`, {
        method: 'POST'
      }).then(response => {
        console.log("Channel sync response:", response.status);
        if (response.ok) {
          // Wait a moment and then refetch server details
          setTimeout(() => {
            refetchServerDetails();
          }, 1000);
        }
      }).catch(error => {
        console.error("Error syncing channels:", error);
      });
    }
  }, [selectedServerId, channels.length, isLoadingServerDetails, refetchServerDetails]);
  
  console.log("Current channels for selected server:", channels);
  
  // Fetch summaries for each channel
  const {
    data: summariesMap = {},
    isLoading: isLoadingSummaries
  } = useQuery<Record<string, ChannelSummary>>({
    queryKey: ['/api/summaries', selectedServerId],
    enabled: !!selectedServerId && channels.length > 0,
    queryFn: async () => {
      const summaries: Record<string, ChannelSummary> = {};
      
      for (const channel of channels) {
        try {
          const response = await fetch(`/api/channels/${channel.id}/summary`);
          if (response.ok) {
            const data = await response.json();
            summaries[channel.id] = data;
          }
        } catch (error) {
          console.error(`Failed to fetch summary for channel ${channel.id}:`, error);
        }
      }
      
      return summaries;
    }
  });
  
  // Fetch messages for all channels in the server
  const {
    data: messagesMap = {},
    isLoading: isLoadingMessages,
    refetch: refetchAllMessages
  } = useQuery<Record<string, any>>({
    queryKey: ['/api/channel-messages', selectedServerId],
    enabled: !!selectedServerId && channels.length > 0,
    queryFn: async () => {
      const messages: Record<string, any> = {};
      
      for (const channel of channels) {
        try {
          const response = await fetch(`/api/channels/${channel.id}/messages?limit=10`);
          if (response.ok) {
            const data = await response.json();
            // Store messages both by ID and by name to handle inconsistencies
            messages[channel.id] = data.messages;
            messages[channel.name] = data.messages;
            console.log(`Fetched messages for channel ${channel.id} (${channel.name}):`, data.messages);
          }
        } catch (error) {
          console.error(`Failed to fetch messages for channel ${channel.id} (${channel.name}):`, error);
        }
      }
      
      return messages;
    }
  });
  
  // Original messages feature has been removed
  
  // Polling mechanism to automatically refresh data
  useEffect(() => {
    // Don't poll if we don't have a selected server or channel
    if (!selectedServerId) return;
    
    console.log('Setting up polling for dashboard data...');
    
    // Set up polling interval (30 seconds)
    const pollingInterval = setInterval(() => {
      console.log('Polling: Refreshing dashboard data...');
      
      // Show a toast notification for the refresh
      toast({
        title: 'Refreshing data',
        description: 'Checking for new messages and updates...',
        duration: 2000 // Short duration so it doesn't stay too long
      });
      
      // Refresh all relevant data
      queryClient.invalidateQueries({ queryKey: ['/api/servers', selectedServerId] });
      queryClient.invalidateQueries({ queryKey: ['/api/channel-messages', selectedServerId] });
      queryClient.invalidateQueries({ queryKey: ['/api/summaries', selectedServerId] });
      
      // If a specific channel is selected, also refresh its messages
      if (selectedChannelId) {
        queryClient.invalidateQueries({ queryKey: [`/api/channels/${selectedChannelId}/messages`] });
      }
    }, 30000); // 30 seconds polling interval
    
    // Clean up interval on component unmount or when selectedServerId changes
    return () => {
      console.log('Cleaning up polling interval');
      clearInterval(pollingInterval);
    };
  }, [selectedServerId, selectedChannelId, queryClient]);
  
  // All data loading status
  const isLoading = isLoadingServers || isLoadingServerDetails || isLoadingSummaries || isLoadingMessages;
  
  // Stats for the stats overview component
  const statsData = {
    totalMessages: serverDetails?.stats?.totalMessages || 0,
    activeUsers: serverDetails?.stats?.activeUsers || 0,
    activeChannels: serverDetails?.stats?.activeChannels || 0,
    connectedServers: servers.length,
    percentChange: serverDetails?.stats?.percentChange || { messages: 0, users: 0, channels: 0 }
  };
  
  // Refresh mutation - generates new summaries
  const refreshMutation = useMutation({
    mutationFn: async () => {
      if (!selectedServerId) throw new Error("No server selected");
      
      // Add a timeout to the request - 2 minutes (120000ms)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);
      
      try {
        const response = await apiRequest(
          'POST', 
          `/api/servers/${selectedServerId}/generate-summary`, 
          {}, 
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);
        return response.json();
      } catch (error: any) {
        clearTimeout(timeoutId);
        // Handle abort error specifically
        if (error.name === 'AbortError') {
          throw new Error('The request took too long. The process is still running in the background.');
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      // If processing was completed, show the full stats in the toast
      if (data.completed && data.stats) {
        toast({
          title: "Refreshed",
          description: `Activity summaries refreshed. Found ${data.stats.totalMessages} messages from the last hour, from ${data.stats.activeUsers} users across ${data.stats.activeChannels} channels. Click the reload button to see latest data.`,
        });
      } else {
        // For background processing, show a different message
        toast({
          title: "Refreshed",
          description: "Activity summaries from the last hour are refreshing. When complete, click the reload button to see latest data.",
        });
      }
      
      console.log("Refresh mutation succeeded with data:", data);
      
      // Immediately force refetch all relevant queries to get fresh data
      queryClient.invalidateQueries({ queryKey: ['/api/summaries', selectedServerId] });
      queryClient.invalidateQueries({ queryKey: ['/api/servers', selectedServerId] });
      
      // If the background processing is still ongoing, set up a delayed refetch
      if (!data.completed) {
        // Set a timeout to refetch the data after 10 seconds
        setTimeout(() => {
          console.log("Performing delayed refetch after background processing");
          queryClient.invalidateQueries({ queryKey: ['/api/summaries', selectedServerId] });
          queryClient.invalidateQueries({ queryKey: ['/api/servers', selectedServerId] });
          
          // For the selected server, manually fetch the latest data
          if (selectedServerId) {
            fetchServerDetails(selectedServerId).then(data => {
              if (data) {
                // Update the query cache with the fresh data
                queryClient.setQueryData(['/api/servers', selectedServerId], data);
              }
            }).catch(err => {
              console.error("Error in delayed data fetch:", err);
            });
          }
        }, 10000);
      }
    },
    onError: (error: any) => {
      // For timeout errors, give a more helpful message but still invalidate queries
      if (error.message?.includes('still running in the background')) {
        toast({
          title: "Processing in background",
          description: "The summaries for the last hour are being generated in the background. When complete, click the reload button to see latest data.",
        });
        
        // Still invalidate queries so the user can see updated data
        queryClient.invalidateQueries({ queryKey: ['/api/summaries', selectedServerId] });
        queryClient.invalidateQueries({ queryKey: ['/api/servers', selectedServerId] });
        
        // Set up a delayed refetch to capture the results of background processing
        setTimeout(() => {
          console.log("Performing delayed refetch after timeout error");
          queryClient.invalidateQueries({ queryKey: ['/api/summaries', selectedServerId] });
          queryClient.invalidateQueries({ queryKey: ['/api/servers', selectedServerId] });
        }, 10000);
      } else {
        toast({
          title: "Error",
          description: `Failed to refresh summaries: ${error.message}`,
          variant: "destructive",
        });
      }
    }
  });
  
  // Handle server selection
  const handleServerSelect = (serverId: string) => {
    setSelectedServerId(serverId);
  };
  
  // Toggle server expansion
  const toggleServerExpansion = useCallback((serverId: string) => {
    setExpandedServers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(serverId)) {
        newSet.delete(serverId);
      } else {
        newSet.add(serverId);
      }
      return newSet;
    });
  }, []);
  
  // Handle refresh button click
  const handleRefresh = useCallback(() => {
    refreshMutation.mutate();
    
    // Set up multiple delayed refetches to ensure we catch the updated data
    // even if the background processing takes longer than expected
    const refetchTimes = [5000, 15000, 30000]; // 5s, 15s, 30s
    
    refetchTimes.forEach(delay => {
      setTimeout(() => {
        if (!refreshMutation.isPending) {
          console.log(`Performing scheduled refetch after ${delay/1000}s`);
          refetchServerDetails();
          queryClient.invalidateQueries({ queryKey: ['/api/summaries', selectedServerId] });
          queryClient.invalidateQueries({ queryKey: ['/api/servers', selectedServerId] });
        }
      }, delay);
    });
  }, [selectedServerId, refreshMutation.isPending, refetchServerDetails, queryClient]);
  
  // Create a ref at component level, outside of the useEffect
  const autoTriggerRef = React.useRef(false);
  const initialLoadDoneRef = React.useRef(false);
  
  // Auto-trigger summary generation for test channels or when summaries are missing
  // This should only happen once on initial load
  useEffect(() => {
    if (!selectedServerId || isLoadingServerDetails || refreshMutation.isPending) return;
    
    // Only run this auto-trigger once on initial load
    if (initialLoadDoneRef.current) return;
    
    // Check if we've already triggered a summary generation in this session
    if (autoTriggerRef.current) return;
    
    // Check if we have any summaries already
    const hasSummaries = Object.keys(summariesMap).length > 0;
    
    // When we have summaries, mark the initial load as complete
    if (hasSummaries) {
      initialLoadDoneRef.current = true;
      return;
    }
    
    // Check for channels with the name 'chatbot-testing' or with our specific test channel ID
    const specificTestChannelId = '1332443868473463006';
    const hasChatbotTestingChannel = channels.some(
      (channel: Channel) => channel.name.toLowerCase() === 'chatbot-testing' || channel.id === specificTestChannelId
    );
    
    // If we have a test channel or no summaries, and summaries have loaded (or failed to load)
    // then trigger a summary generation
    if ((hasChatbotTestingChannel || !hasSummaries) && !isLoadingSummaries) {
      console.log("Auto-triggering summary generation for test channel or missing summaries");
      
      // Add a slight delay to avoid immediate re-triggering
      const timeoutId = setTimeout(() => {
        autoTriggerRef.current = true;  // Set flag to prevent repeated triggering
        initialLoadDoneRef.current = true; // Mark initial load as done
        refreshMutation.mutate();
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [
    selectedServerId, 
    channels, 
    isLoadingServerDetails,
    summariesMap,
    isLoadingSummaries,
    refreshMutation
  ]);
  
  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#36393f] text-[#dcddde]">
      <Sidebar 
        onServerSelect={handleServerSelect} 
        onChannelSelect={setSelectedChannelId}
        selectedServerId={selectedServerId}
        selectedChannelId={selectedChannelId}
      />
      
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <ActivityHeader 
          onRefresh={handleRefresh}
          lastUpdated={serverDetails?.stats?.generatedAt}
          isRefreshing={refreshMutation.isPending}
        />
        
        <div className="flex-1 overflow-auto p-4">
          {/* Stats Overview Section */}
          <StatsOverview 
            data={statsData}
            isLoading={isLoading}
          />
          
          {/* Channel Content Area */}
          {selectedServerId && (
            <div className="p-4">
              {selectedChannelId ? (
                // Show selected channel content
                <div className="bg-[#2f3136] rounded-lg p-6">
                  {channels.find(channel => channel.id === selectedChannelId) ? (
                    <div>
                      <div className="flex items-center mb-4">
                        <h2 className="text-xl font-bold text-white flex items-center">
                          <Hash className="h-5 w-5 mr-2 text-[#7289da]" />
                          {channels.find(channel => channel.id === selectedChannelId)?.name || "Channel"}
                        </h2>
                      </div>
                      
                      {/* Channel Summary - only shown when there's content */}
                      {summariesMap[selectedChannelId] && summariesMap[selectedChannelId].summary && (
                        <div className="mb-6">
                          <h3 className="text-lg font-semibold mb-2 text-[#dcddde]">Recent Activity Summary</h3>
                          <div className="bg-[#36393f] p-4 rounded">
                            <p className="text-[#dcddde] mb-4">{summariesMap[selectedChannelId].summary}</p>
                            {summariesMap[selectedChannelId].keyTopics?.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium mb-2 text-[#dcddde]">Key Topics</h4>
                                <div className="flex flex-wrap gap-2">
                                  {summariesMap[selectedChannelId].keyTopics.map((topic, index) => (
                                    <span key={index} className="bg-[#4f545c] text-xs px-2 py-1 rounded text-white">
                                      {topic}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Only Recent Messages section remains */}
                      
                      {/* Recent Messages Accordion */}
                      <div className="mb-4 overflow-hidden flex flex-col">
                        {/* Add a direct query for the selected channel to ensure we get messages */}
                        <DirectMessageFetcher
                          channelId={selectedChannelId}
                          channelName={channels.find(c => c.id === selectedChannelId)?.name}
                          messagesMap={messagesMap}
                          setShowAnalysisDrawer={setShowAnalysisDrawer}
                          setGlobalAnalysisResult={setGlobalAnalysisResult}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-8">
                      <p className="text-[#72767d]">Selected channel not found. Try selecting another channel.</p>
                    </div>
                  )}
                </div>
              ) : (
                // No channel selected, show welcome screen
                <div className="bg-[#2f3136] rounded-lg p-8 text-center">
                  <div className="w-16 h-16 bg-[#5865f2] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Hash className="h-8 w-8 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Welcome to {serverDetails?.server?.name || "Discord Digest"}</h2>
                  <p className="text-[#dcddde] mb-4">Select a channel from the sidebar to view its messages and activity summary.</p>
                </div>
              )}
            </div>
          )}
        </div>
        
        <StatusFooter />
        
        {/* Connect Server Dialog */}
        <ConnectServerDialog 
          open={connectDialogOpen} 
          onOpenChange={setConnectDialogOpen} 
        />
        
        {/* Analysis Drawer - slides in from the right */}
        <AnalysisDrawer
          isOpen={showAnalysisDrawer}
          onClose={() => setShowAnalysisDrawer(false)}
          channelName={channels.find(c => c.id === selectedChannelId)?.name}
        />
      </main>
    </div>
  );
};

// DirectMessageFetcher component - ensures we have messages for the selected channel
const DirectMessageFetcher = ({
  channelId,
  channelName,
  messagesMap,
  setShowAnalysisDrawer,
  setGlobalAnalysisResult
}: {
  channelId: string | null;
  channelName: string | undefined;
  messagesMap: Record<string, any>;
  setShowAnalysisDrawer: (show: boolean) => void;
  setGlobalAnalysisResult: (result: string | null) => void;
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const channelIdentifier = channelId || channelName || '';
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [analysisButtonState, setAnalysisButtonState] = useState<'idle' | 'clicked'>('idle');
  const [sentimentAnalysisState, setSentimentAnalysisState] = useState<'idle' | 'loading' | 'complete'>('idle');
  const [jtbdAnalysisState, setJtbdAnalysisState] = useState<'idle' | 'loading' | 'complete'>('idle');
  const { toast } = useToast();
  
  // Simple query for messages from this specific channel - now with option to fetch all messages
  const { data, isLoading, refetch } = useQuery({
    queryKey: [`/api/channels/${channelIdentifier}/messages`],
    queryFn: async () => {
      if (!channelIdentifier) return { messages: [] };
      
      try {
        console.log(`Fetching messages for ${channelIdentifier}`);
        // Request all messages by setting all=true parameter
        const response = await fetch(`/api/channels/${channelIdentifier}/messages?all=true`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        console.log(`Fetched ${result.messages?.length || 0} messages for ${channelIdentifier}`);
        return result;
      } catch (error) {
        console.error(`Error fetching messages for ${channelIdentifier}:`, error);
        return { messages: [] };
      }
    },
    enabled: !!channelIdentifier,
    staleTime: 60000, // 1 minute
  });
  
  // Handle refreshing messages
  const handleRefresh = () => {
    setIsRefreshing(true);
    refetch().finally(() => {
      setIsRefreshing(false);
    });
  };
  
  // Use any available messages, prioritizing direct fetch results
  const directMessages = data?.messages || [];
  const fallbackMessages = messagesMap[channelIdentifier] || [];
  const messages = directMessages.length > 0 ? directMessages : fallbackMessages;
  
  // API functions are imported at the top of the file
  
  // Get all messages for analysis
  const messagesToAnalyze = messages.map((message: any) => ({
    id: message.id,
    authorId: message.authorId,
    authorName: message.authorName,
    content: message.content,
    createdAt: message.createdAt,
  }));
  
  // Set up sentiment analysis mutation
  const sentimentAnalysis = useMutation({
    mutationFn: () => {
      if (!messagesToAnalyze || messagesToAnalyze.length === 0) {
        throw new Error('No messages to analyze');
      }
      return analyzeMessageSentiment(channelIdentifier, messagesToAnalyze);
    },
    onSuccess: (data: any) => {
      setGlobalAnalysisResult(data.analysis);
      setSentimentAnalysisState('complete');
      
      // Store analysis result for the drawer to use and for persistence across navigation
      // First, get any existing channel analysis map or create a new one
      let channelAnalysisMap: Record<string, any> = {};
      try {
        const existingMap = localStorage.getItem('channelAnalysisMap');
        if (existingMap) {
          channelAnalysisMap = JSON.parse(existingMap);
        }
      } catch (e) {
        console.error('Error parsing channel analysis map', e);
      }
      
      // Add this channel's analysis to the map
      channelAnalysisMap[channelIdentifier] = {
        analysis: data.analysis,
        channelName: channelName || 'Unknown Channel',
        timestamp: new Date().toISOString()
      };
      
      // Save the updated map back to localStorage
      localStorage.setItem('channelAnalysisMap', JSON.stringify(channelAnalysisMap));
      
      // Also set the current analysis in the regular keys for backward compatibility
      localStorage.setItem('sentimentAnalysisResult', data.analysis);
      localStorage.setItem('analysisChannelId', channelIdentifier);
      localStorage.setItem('analysisChannelName', channelName || 'Unknown Channel');
      
      toast({
        title: 'Sentiment analysis complete',
        description: 'Discord chat sentiment analysis is ready!',
        variant: 'default',
      });
      
      // Now that sentiment analysis is complete, trigger JTBD analysis
      if (jtbdAnalysisState === 'loading') {
        // Pass the sentiment analysis result to the JTBD analysis
        jtbdAnalysis.mutate(data.analysis);
      }
    },
    onError: (error: any) => {
      setSentimentAnalysisState('idle');
      toast({
        title: 'Sentiment analysis failed',
        description: error.message || 'Could not analyze messages',
        variant: 'destructive',
      });
    }
  });
  
  // Set up JTBD analysis mutation
  const jtbdAnalysis = useMutation({
    mutationFn: (sentimentAnalysisResult?: string) => {
      if (!messagesToAnalyze || messagesToAnalyze.length === 0) {
        throw new Error('No messages to analyze');
      }
      return analyzeMessageJTBD(channelIdentifier, messagesToAnalyze, sentimentAnalysisResult);
    },
    onSuccess: (data: any) => {
      // Store JTBD analysis result
      // First, get any existing channel analysis map or create a new one
      let jtbdAnalysisMap: Record<string, any> = {};
      try {
        const existingMap = localStorage.getItem('jtbdAnalysisMap');
        if (existingMap) {
          jtbdAnalysisMap = JSON.parse(existingMap);
        }
      } catch (e) {
        console.error('Error parsing JTBD analysis map', e);
      }
      
      // Add this channel's JTBD analysis to the map
      jtbdAnalysisMap[channelIdentifier] = {
        analysis: data.analysis,
        channelName: channelName || 'Unknown Channel',
        timestamp: new Date().toISOString()
      };
      
      // Save the updated map back to localStorage
      localStorage.setItem('jtbdAnalysisMap', JSON.stringify(jtbdAnalysisMap));
      
      // Update state
      setJtbdAnalysisState('complete');
      
      toast({
        title: 'JTBD analysis complete',
        description: 'Jobs to be Done analysis is ready!',
        variant: 'default',
      });
    },
    onError: (error: any) => {
      setJtbdAnalysisState('idle');
      toast({
        title: 'JTBD analysis failed',
        description: error.message || 'Could not analyze Jobs to be Done',
        variant: 'destructive',
      });
    }
  });
  
  // Log message count for debugging
  useEffect(() => {
    if (messages.length > 0) {
      console.log(`Rendering ${messages.length} messages for channel ${channelIdentifier}`);
    }
  }, [messages.length, channelIdentifier]);
  
  // Reset analysis states on page reload - using a more reliable global approach
  useEffect(() => {
    // This function generates a unique session ID
    const generateSessionId = () => {
      return Math.random().toString(36).substring(2, 15);
    };
    
    // Check if the page has been reloaded
    const isPageReload = () => {
      const currentSessionId = sessionStorage.getItem('appSessionId');
      if (!currentSessionId) {
        // First load - set initial session ID
        const newId = generateSessionId();
        sessionStorage.setItem('appSessionId', newId);
        return true;
      }
      return false;
    };
    
    // If this is a page reload or initial load...
    if (isPageReload()) {
      console.log('Page loaded/reloaded - resetting ALL analysis data');
      
      // Reset React component states
      setSentimentAnalysisState('idle');
      setJtbdAnalysisState('idle');
      setGlobalAnalysisResult(null);
      
      // The critical part: set a 'lastResetTime' timestamp in localStorage
      // This will be used by ALL instances of channel components to know
      // they should ignore previously stored analysis data
      localStorage.setItem('lastAnalysisReset', Date.now().toString());
      
      // We no longer need to clear specific channel data because
      // we'll use the timestamp to determine if data should be used
    }
  }, []);
  
  // Check if we already have analysis results for this channel when channel changes
  useEffect(() => {
    // Only run this effect if we have a valid channel identifier
    if (channelIdentifier) {
      // Get the last time analysis data was reset
      const lastResetTime = localStorage.getItem('lastAnalysisReset');
      
      // Check if we have analysis data for this channel
      let channelAnalysisTimestamp = 0;
      let jtbdAnalysisTimestamp = 0;
      
      try {
        // Check sentiment analysis timestamp
        const channelMap = localStorage.getItem('channelAnalysisMap');
        if (channelMap) {
          const parsedMap = JSON.parse(channelMap);
          if (parsedMap[channelIdentifier] && parsedMap[channelIdentifier].timestamp) {
            // Convert ISO timestamp to milliseconds for comparison
            channelAnalysisTimestamp = new Date(parsedMap[channelIdentifier].timestamp).getTime();
          }
        }
        
        // Check JTBD analysis timestamp
        const jtbdMap = localStorage.getItem('jtbdAnalysisMap');
        if (jtbdMap) {
          const parsedMap = JSON.parse(jtbdMap);
          if (parsedMap[channelIdentifier] && parsedMap[channelIdentifier].timestamp) {
            jtbdAnalysisTimestamp = new Date(parsedMap[channelIdentifier].timestamp).getTime();
          }
        }
      } catch (e) {
        console.error('Error checking analysis timestamps', e);
      }
      
      // If lastResetTime exists and is more recent than our analyses,
      // we should ignore the stored analyses (page was reloaded after they were created)
      if (lastResetTime && Number(lastResetTime) > channelAnalysisTimestamp && Number(lastResetTime) > jtbdAnalysisTimestamp) {
        console.log('Ignoring analysis data - created before last page reset');
        // Keep states reset
        setSentimentAnalysisState('idle');
        setJtbdAnalysisState('idle');
        setGlobalAnalysisResult(null);
      } else {
        // Normal channel change after initial load - restore any previous analyses
        // Check for sentiment analysis results
        let sentimentData = null;
        try {
          const channelAnalysisMap = localStorage.getItem('channelAnalysisMap');
          if (channelAnalysisMap) {
            const parsedMap = JSON.parse(channelAnalysisMap) as Record<string, any>;
            if (parsedMap[channelIdentifier]) {
              sentimentData = parsedMap[channelIdentifier];
            }
          }
        } catch (e) {
          console.error('Error retrieving sentiment analysis', e);
        }
        
        // Check for JTBD analysis results
        let jtbdData = null;
        try {
          const jtbdAnalysisMap = localStorage.getItem('jtbdAnalysisMap');
          if (jtbdAnalysisMap) {
            const parsedMap = JSON.parse(jtbdAnalysisMap) as Record<string, any>;
            if (parsedMap[channelIdentifier]) {
              jtbdData = parsedMap[channelIdentifier];
            }
          }
        } catch (e) {
          console.error('Error retrieving JTBD analysis', e);
        }
        
        // If we found sentiment analysis for this channel
        if (sentimentData) {
          // Set the global analysis result from the map
          setGlobalAnalysisResult(sentimentData.analysis);
          setSentimentAnalysisState('complete');
          
          // Also update the standard localStorage items for compatibility
          localStorage.setItem('sentimentAnalysisResult', sentimentData.analysis);
          localStorage.setItem('analysisChannelId', channelIdentifier);
          localStorage.setItem('analysisChannelName', sentimentData.channelName);
        } else {
          // Reset sentiment analysis state
          setSentimentAnalysisState('idle');
          setGlobalAnalysisResult(null);
        }
        
        // If we found JTBD analysis for this channel
        if (jtbdData) {
          setJtbdAnalysisState('complete');
        } else {
          // Reset JTBD analysis state
          setJtbdAnalysisState('idle');
        }
      }
      
      // Reset button state
      setAnalysisButtonState('idle');
    }
  }, [channelIdentifier, setGlobalAnalysisResult]);
  
  // Log only the final message count to avoid reference errors
  console.log(`Message count for ${channelIdentifier}:`, messages.length);

  // Return the messages in a scrollable container with fixed header
  return (
    <div className="flex flex-col h-full">
      {/* Fixed header with channel info and message count */}
      <div className="flex items-center justify-between mb-3 sticky top-0 bg-[#2f3136] z-10 py-2">
        <h3 className="text-lg font-semibold text-[#dcddde] flex items-center">
          <MessageCircle className="h-5 w-5 mr-2 text-[#7289da]" />
          Recent Messages
          {messages.length > 0 && (
            <span className="ml-2 bg-[#4f545c] text-white text-xs px-2 py-0.5 rounded">
              {messages.length}
            </span>
          )}
        </h3>
        
        <div className="flex items-center gap-2">
          
          {/* Sentiment Analysis Buttons - Using a fixed horizontal layout */}
          {messages.length > 0 && (
            <div className="flex items-center gap-2">
              {/* Only show the blue analyze button when both analyses are in idle state */}
              {sentimentAnalysisState === 'idle' && jtbdAnalysisState === 'idle' ? (
                <button
                  onClick={() => {
                    const startTime = Date.now();
                    setAnalysisButtonState('clicked');
                    setSentimentAnalysisState('loading');
                    setJtbdAnalysisState('loading');
                    sentimentAnalysis.mutate(undefined);
                    setAnalysisButtonState('idle');
                  }}
                  disabled={sentimentAnalysis.isPending || jtbdAnalysis.isPending || analysisButtonState !== 'idle'}
                  className="text-xs px-4 py-2 rounded min-w-[180px] flex items-center justify-center transition-all duration-200 
                    bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                >
                  <BarChart2 className="h-3 w-3 mr-1" />
                  Analyze this chatter
                </button>
              ) : (
                <>
                  {/* Container for Sentiment Analysis button - maintains fixed position */}
                  <div className="h-[36px] min-w-[180px]">
                    {/* Show loading spinner when sentiment analysis is loading */}
                    {sentimentAnalysisState === 'loading' ? (
                      <button
                        disabled
                        className="text-xs bg-green-600 text-white px-4 py-2 rounded flex items-center justify-center gap-1 transition-colors opacity-80 whitespace-nowrap"
                      >
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Analyzing Sentiment...
                      </button>
                    ) : sentimentAnalysisState === 'complete' ? (
                      /* Show view results button when analysis is complete */
                      <button
                        onClick={() => {
                          localStorage.setItem('currentAnalysisType', 'sentiment');
                          setShowAnalysisDrawer(true);
                        }}
                        className="text-xs bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center justify-center gap-1 transition-colors shadow-md hover:shadow-lg whitespace-nowrap"
                      >
                        <BarChart2 className="h-4 w-4 mr-2" />
                        View Sentiment Analysis
                      </button>
                    ) : null}
                  </div>
                  
                  {/* Container for JTBD Analysis button - maintains fixed position */}
                  <div className="h-[36px] min-w-[180px]">
                    {/* Show loading spinner when JTBD analysis is loading */}
                    {jtbdAnalysisState === 'loading' ? (
                      <button
                        disabled
                        className="text-xs bg-purple-600 text-white px-4 py-2 rounded flex items-center justify-center gap-1 transition-colors opacity-80 whitespace-nowrap"
                      >
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Analyzing JTBD...
                      </button>
                    ) : jtbdAnalysisState === 'complete' ? (
                      /* Show view results button when analysis is complete */
                      <div className="flex items-center">
                        <button
                          onClick={() => {
                            localStorage.setItem('currentAnalysisType', 'jtbd');
                            setShowAnalysisDrawer(true);
                          }}
                          className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded flex items-center justify-center gap-1 transition-colors shadow-md hover:shadow-lg whitespace-nowrap"
                        >
                          <BarChart2 className="h-4 w-4 mr-2" />
                          View JTBD Analysis
                        </button>
                      
                        {/* JTBD Info Icon */}
                        <Dialog>
                          <DialogTrigger asChild>
                            <button className="ml-2 text-[#8a8e94] hover:text-[#dcddde] transition-colors" title="About JTBD Framework">
                              <Info className="h-4 w-4" />
                            </button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl bg-[#36393f] text-[#dcddde] border-[#202225]">
                            <DialogHeader>
                              <DialogTitle className="text-xl text-white">Jobs to be Done (JTBD) Framework</DialogTitle>
                            </DialogHeader>
                            <DialogDescription className="text-[#dcddde] mt-4">
                              <p className="mb-4">
                                The JTBD framework is fundamentally about uncovering the "jobs" people are trying to accomplish, whether those are functional (e.g., completing a task), emotional (e.g., feeling confident), or social (e.g., gaining approval).
                              </p>
                              <p className="mb-4">
                                In customer interviews, you get a deep, focused view of one person's goals through direct statements and follow-up questions. In a Discord channel, you're dealing with a broader, more fragmented dataset from many users, but the same types of insights—explicit goals, implicit motivations, frustrations, and aspirations—are still embedded in the posts.
                              </p>
                              <p className="mb-4">
                                The challenge is extracting and synthesizing these insights from a larger, less structured pool of data. By treating the collection of posts as a representation of collective user sentiment and experiences, you can identify common themes and apply JTBD analysis to understand the shared jobs users are hiring products or services to do.
                              </p>
                            
                              <h3 className="text-lg font-medium text-white mt-6 mb-3">Considerations and Challenges</h3>
                              <p className="mb-2">
                                While this approach works, there are a few things to keep in mind:
                              </p>
                              <ul className="list-disc pl-5 space-y-2 mb-4">
                                <li><strong>Context Loss:</strong> Unlike interviews, you can't ask follow-up questions. To avoid misinterpretation, look for corroborating posts (e.g., multiple users echoing the same issue) and stay conservative in your inferences.</li>
                                <li><strong>Representativeness:</strong> A vocal minority might dominate the channel. Check if post frequency aligns with broader user needs (e.g., via upvotes or reply volume).</li>
                                <li><strong>Casual Tone:</strong> Discord posts might be informal or jokey (e.g., "This feature is trash lol"). Interpret these thoughtfully, focusing on the underlying sentiment rather than surface-level phrasing.</li>
                                <li><strong>Scale:</strong> With lots of posts, manual analysis could get overwhelming. Consider using tools like keyword extraction to narrow your focus, then dive into key posts manually.</li>
                              </ul>
                            </DialogDescription>
                          </DialogContent>
                        </Dialog>
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Scrollable messages container with virtualization for large message sets */}
      <div
        ref={scrollContainerRef}
        className="overflow-hidden flex-1 h-[calc(100vh-300px)]"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-10 bg-[#36393f] rounded-md">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#7289da]"></div>
          </div>
        ) : messages.length > 0 ? (
          <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-300px)]">
            {messages.map((message: DiscordMessage) => (
              <div 
                key={message.id} 
                className="mb-4"
              >
                <div className="bg-[#36393f] p-3 rounded-md border border-[#40444b] hover:border-[#7289da]/30 mr-1">
                  <div className="flex items-center mb-2">
                    {/* Generate random real human avatar using pravatar.cc */}
                    <img 
                      src={`https://i.pravatar.cc/72?u=${message.id}`} 
                      alt={message.authorName}
                      className="w-9 h-9 rounded-full mr-2 shadow-sm object-cover"
                      onError={(e) => {
                        // Fallback if image fails to load
                        const imgElement = e.currentTarget as HTMLImageElement;
                        imgElement.style.display = 'none';
                        // Safely handle the next element sibling
                        const fallbackElement = imgElement.nextElementSibling as HTMLDivElement;
                        if (fallbackElement) {
                          fallbackElement.style.display = 'flex';
                        }
                      }}
                    />
                    <div 
                      className="w-9 h-9 rounded-full bg-gradient-to-br from-[#7289da] to-[#5865f2] flex items-center justify-center text-white mr-2 shadow-sm"
                      style={{display: 'none'}}
                    >
                      {message.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-white">{message.authorName}</div>
                      <div className="text-xs text-[#a3b1cf]">
                        {format(new Date(message.createdAt), 'MMM d, yyyy • h:mm a')}
                      </div>
                    </div>
                  </div>
                  <div className="pl-11 text-[#dcddde] whitespace-pre-wrap break-words">{message.content}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#36393f] p-4 rounded">
            <p className="text-[#72767d]">No recent messages in this channel.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
