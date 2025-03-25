import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/ui/sidebar";
import ActivityHeader from "@/components/ui/activity-header";
import StatsOverview from "@/components/ui/stats-overview";
import ServerSummary from "@/components/ui/server-summary";
import StatusFooter from "@/components/ui/status-footer";

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
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
  
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
      setExpandedServers(new Set([servers[0].id]));
    }
  }, [servers, selectedServerId]);
  
  // Fetch channels for all servers
  const {
    data: allChannels = [],
    isLoading: isLoadingChannels
  } = useQuery<Channel[]>({
    queryKey: ['/api/servers', selectedServerId, 'channels'],
    enabled: !!selectedServerId,
  });
  
  // Get channels for selected server
  const channels = allChannels.filter(channel => channel.serverId === selectedServerId);
  
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
  
  // Get server stats
  const {
    data: serverDetails,
    isLoading: isLoadingServerDetails
  } = useQuery<{ server: Server, stats: ServerStats }>({
    queryKey: ['/api/servers', selectedServerId, 'details'],
    enabled: !!selectedServerId,
    staleTime: 30000, // 30 seconds
    retry: 2, // Retry twice if it fails
  });
  
  // All data loading status
  const isLoading = isLoadingServers || isLoadingChannels || isLoadingSummaries || isLoadingServerDetails;
  
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
    onSuccess: () => {
      toast({
        title: "Refreshed",
        description: "Activity summaries have been refreshed.",
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/summaries', selectedServerId] });
      queryClient.invalidateQueries({ queryKey: ['/api/servers', selectedServerId, 'details'] });
    },
    onError: (error: any) => {
      // For timeout errors, give a more helpful message but still invalidate queries
      if (error.message?.includes('still running in the background')) {
        toast({
          title: "Processing in background",
          description: "The summaries are being generated in the background. Try refreshing the page in a minute.",
        });
        
        // Still invalidate queries so the user can see updated data if they refresh
        queryClient.invalidateQueries({ queryKey: ['/api/summaries', selectedServerId] });
        queryClient.invalidateQueries({ queryKey: ['/api/servers', selectedServerId, 'details'] });
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
  const handleRefresh = () => {
    refreshMutation.mutate();
  };
  
  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#36393f] text-[#dcddde]">
      <Sidebar onServerSelect={handleServerSelect} />
      
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
          
          {/* Selected Server Summary */}
          {selectedServerId && (
            <ServerSummary
              server={{ id: selectedServerId, name: serverDetails?.server?.name || "Loading..." }}
              channels={channels}
              summaries={summariesMap}
              isLoading={isLoading}
            />
          )}
          
          {/* Other Servers (Collapsed) */}
          {servers
            .filter(server => server.id !== selectedServerId)
            .map(server => {
              const serverChannels = allChannels.filter(channel => channel.serverId === server.id);
              const isExpanded = expandedServers.has(server.id);
              
              return (
                <ServerSummary
                  key={server.id}
                  server={server}
                  channels={serverChannels}
                  summaries={summariesMap}
                  collapsed={!isExpanded}
                  onViewDetails={() => {
                    if (isExpanded) {
                      setSelectedServerId(server.id);
                    } else {
                      toggleServerExpansion(server.id);
                    }
                  }}
                  isLoading={isLoading}
                />
              );
            })}
        </div>
        
        <StatusFooter />
      </main>
    </div>
  );
};

export default Dashboard;
