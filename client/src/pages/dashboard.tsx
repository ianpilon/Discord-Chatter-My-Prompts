import React, { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { fetchServerDetails } from "@/lib/api";
import { Hash } from "lucide-react";
import MessageList from "@/components/ui/message-list";
import Sidebar from "@/components/ui/sidebar";
import ActivityHeader from "@/components/ui/activity-header";
import StatsOverview from "@/components/ui/stats-overview";
import StatusFooter from "@/components/ui/status-footer";
import ConnectServerDialog from "@/components/ui/connect-server-dialog";
import { Button } from "@/components/ui/button";

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
  const [isOriginalMessagesExpanded, setIsOriginalMessagesExpanded] = useState(true);
  
  // Fetch servers
  const {
    data: servers = [],
    isLoading: isLoadingServers
  } = useQuery<Server[]>({
    queryKey: ['/api/servers'],
  });
  
  // Set initial selected server when servers are loaded
  useEffect(() => {
    if (servers.length > 0 && !selectedServerId) {
      setSelectedServerId(servers[0].id);
    }
  }, [servers, selectedServerId]);
  
  // Reset selected channel when server changes
  useEffect(() => {
    setSelectedChannelId(null);
  }, [selectedServerId]);
  
  
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
          queryClient.invalidateQueries({ queryKey: [`/api/channels/${selectedChannelId}/original-messages`] });
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
  
  // Fetch messages for each channel
  const {
    data: messagesMap = {},
    isLoading: isLoadingMessages
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
            messages[channel.id] = data.messages;
            console.log(`Fetched messages for channel ${channel.id}:`, data.messages);
          }
        } catch (error) {
          console.error(`Failed to fetch messages for channel ${channel.id}:`, error);
        }
      }
      
      return messages;
    }
  });
  
  // Fetch original messages (first messages in the last 24 hours) for each channel
  const {
    data: originalMessagesMap = {},
    isLoading: isLoadingOriginalMessages
  } = useQuery<Record<string, any>>({
    queryKey: ['/api/channel-original-messages', selectedServerId],
    enabled: !!selectedServerId && channels.length > 0,
    queryFn: async () => {
      const originalMessages: Record<string, any> = {};
      
      for (const channel of channels) {
        try {
          const response = await fetch(`/api/channels/${channel.id}/original-messages?limit=5`);
          if (response.ok) {
            const data = await response.json();
            originalMessages[channel.id] = data.messages;
            console.log(`Fetched original messages for channel ${channel.id}:`, data.messages);
          }
        } catch (error) {
          console.error(`Failed to fetch original messages for channel ${channel.id}:`, error);
        }
      }
      
      return originalMessages;
    }
  });
  
  // All data loading status
  const isLoading = isLoadingServers || isLoadingServerDetails || isLoadingSummaries || isLoadingMessages || isLoadingOriginalMessages;
  
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
                      
                      {/* Channel Summary */}
                      {summariesMap[selectedChannelId] ? (
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
                      ) : (
                        <div className="bg-[#36393f] p-4 rounded mb-6">
                          <p className="text-[#72767d]">No recent activity summary available for this channel.</p>
                        </div>
                      )}
                      
                      {/* Here we place both message sections in order - Original Messages first, then Recent Messages */}
                      
                      {/* Original Messages Accordion */}
                      <div className="mb-4">
                        {originalMessagesMap[selectedChannelId] && originalMessagesMap[selectedChannelId].length > 0 ? (
                          <>
                            <div 
                              className="flex items-center mb-2 cursor-pointer" 
                              onClick={() => setIsOriginalMessagesExpanded(!isOriginalMessagesExpanded)}
                            >
                              <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                className={`h-5 w-5 text-[#7289da] mr-2 transition-transform ${isOriginalMessagesExpanded ? 'rotate-90' : ''}`} 
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              <h3 className="text-lg font-semibold text-[#dcddde]">Original Messages</h3>
                              <span className="ml-2 bg-[#4f545c] text-white text-xs px-2 py-0.5 rounded">
                                {originalMessagesMap[selectedChannelId].length}
                              </span>
                              <span className="ml-2 text-[#72767d] text-xs">First messages in the last 24 hours</span>
                              {!isOriginalMessagesExpanded && (
                                <button 
                                  className="ml-auto text-xs text-[#7289da] hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsOriginalMessagesExpanded(true);
                                  }}
                                >
                                  Expand
                                </button>
                              )}
                            </div>
                            
                            {isOriginalMessagesExpanded && (
                              <MessageList 
                                channelId={selectedChannelId}
                                limit={10}
                                messageData={originalMessagesMap[selectedChannelId]}
                              />
                            )}
                          </>
                        ) : (
                          <div className="bg-[#36393f] p-4 rounded">
                            <div className="flex items-center mb-2">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#7289da] mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              <h3 className="text-lg font-semibold text-[#dcddde]">Original Messages</h3>
                            </div>
                            <p className="text-[#72767d]">No original messages found in the last 24 hours.</p>
                          </div>
                        )}
                      </div>
                      
                      {/* Recent Messages Accordion */}
                      <div className="mb-4">
                        {messagesMap[selectedChannelId] && messagesMap[selectedChannelId].length > 0 ? (
                          <>
                            <div 
                              className="flex items-center mb-2 cursor-pointer" 
                              onClick={() => setIsRecentMessagesExpanded(!isRecentMessagesExpanded)}
                            >
                              <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                className={`h-5 w-5 text-[#7289da] mr-2 transition-transform ${isRecentMessagesExpanded ? 'rotate-90' : ''}`} 
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              <h3 className="text-lg font-semibold text-[#dcddde]">Recent Messages</h3>
                              <span className="ml-2 bg-[#4f545c] text-white text-xs px-2 py-0.5 rounded">
                                {messagesMap[selectedChannelId].length}
                              </span>
                              {!isRecentMessagesExpanded && (
                                <button 
                                  className="ml-auto text-xs text-[#7289da] hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsRecentMessagesExpanded(true);
                                  }}
                                >
                                  Expand
                                </button>
                              )}
                            </div>
                            
                            {isRecentMessagesExpanded && (
                              <MessageList 
                                channelId={selectedChannelId}
                                limit={20}
                                messageData={messagesMap[selectedChannelId]}
                              />
                            )}
                          </>
                        ) : (
                          <div className="bg-[#36393f] p-4 rounded">
                            <p className="text-[#72767d]">No recent messages in this channel.</p>
                          </div>
                        )}
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
      </main>
    </div>
  );
};

export default Dashboard;
