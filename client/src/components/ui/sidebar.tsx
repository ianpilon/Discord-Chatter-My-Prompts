import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings, Hash, ChevronRight, ChevronDown } from "lucide-react";
import { useMemo, useState, useCallback, useEffect } from "react";
import ConnectServerDialog from "./connect-server-dialog";

interface Server {
  id: string;
  name: string;
  icon: string | null;
  isActive: boolean;
}

interface Channel {
  id: string;
  serverId: string;
  name: string;
  type: string;
}

const Sidebar = ({ 
  onServerSelect, 
  onChannelSelect,
  selectedServerId,
  selectedChannelId 
}: { 
  onServerSelect: (serverId: string) => void;
  onChannelSelect: (channelId: string) => void;
  selectedServerId: string | null;
  selectedChannelId: string | null;
}) => {
  const [location] = useLocation();
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  // Initialize expandedServers from localStorage
  const [expandedServers, setExpandedServers] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('expandedServers');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error('Error loading expanded servers from localStorage:', e);
      return {};
    }
  });
  
  // Save expandedServers to localStorage whenever it changes
  useEffect(() => {
    if (Object.keys(expandedServers).length > 0) {
      localStorage.setItem('expandedServers', JSON.stringify(expandedServers));
    }
  }, [expandedServers]);
  const queryClient = useQueryClient();
  
  // Initialize hiddenChannels from localStorage
  const [hiddenChannels, setHiddenChannels] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('hiddenChannels');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Error loading hidden channels from localStorage:', e);
      return [];
    }
  });
  
  // Fetch servers
  const { data: servers = [], isLoading: isLoadingServers } = useQuery<Server[]>({
    queryKey: ['/api/servers'],
  });
  
  // Fetch channels for the selected server
  const { data: channels = [], isLoading: isLoadingChannels } = useQuery<Channel[]>({
    queryKey: ['/api/servers/', selectedServerId, '/channels'],
    enabled: !!selectedServerId,
    queryFn: async () => {
      if (!selectedServerId) return [];
      const response = await fetch(`/api/servers/${selectedServerId}/channels`);
      if (!response.ok) {
        throw new Error('Failed to fetch channels');
      }
      return response.json();
    }
  });
  
  // Get initials for server icon
  const getServerInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };
  
  // Get color for server icon
  const getServerColor = (name: string) => {
    const colors = [
      'bg-purple-600', 'bg-blue-600', 'bg-green-600', 
      'bg-red-600', 'bg-yellow-600', 'bg-indigo-600'
    ];
    
    const hashCode = name.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    return colors[Math.abs(hashCode) % colors.length];
  };
  
  // Toggle server expansion
  const toggleServerExpansion = (serverId: string) => {
    setExpandedServers(prev => ({
      ...prev,
      [serverId]: !prev[serverId]
    }));
  };
  
  // CHANGED APPROACH: Use a direct DOM operation for more reliable hiding
  const hideChannel = useCallback((channelId: string, event: React.MouseEvent) => {
    // Prevent event propagation
    event.stopPropagation();
    event.preventDefault();
    
    console.log('Hiding channel using new approach:', channelId);
    
    // First, try to find and hide the DOM element directly
    const channelElement = event.currentTarget.closest('.channel-item');
    if (channelElement) {
      // Hide the element immediately for visual feedback
      channelElement.setAttribute('style', 'display: none !important');
    }
    
    // Then update the React state and localStorage
    setHiddenChannels(prev => {
      const newHiddenChannels = [...prev, channelId];
      // Save to localStorage immediately
      try {
        localStorage.setItem('hiddenChannels', JSON.stringify(newHiddenChannels));
      } catch (e) {
        console.error('Error saving to localStorage:', e);
      }
      return newHiddenChannels;
    });
    
    // If this was the selected channel, clear the selection
    if (channelId === selectedChannelId) {
      onChannelSelect('');
    }
    
    // Force React Query cache invalidation to trigger component updates
    if (selectedServerId) {
      queryClient.invalidateQueries({ queryKey: ['/api/servers/', selectedServerId, '/channels'] });
    }
  }, [hiddenChannels, selectedChannelId, onChannelSelect, selectedServerId, queryClient]);
  
  // Server and channel items
  const serverItems = useMemo(() => {
    console.log('Recalculating server items - hidden channels:', hiddenChannels.length);
    return servers.map((server) => {
      const initials = getServerInitials(server.name);
      const bgColor = getServerColor(server.name);
      const isSelected = server.id === selectedServerId;
      // Allow server to be collapsed even when selected
      const isExpanded = expandedServers[server.id];
      
      // Filter channels for this server
      const serverChannels = channels.filter(channel => channel.serverId === server.id);
      
      return (
        <div key={server.id} className="mb-2">
          {/* Server Header */}
          <div 
            className={`flex items-center p-2 rounded cursor-pointer transition-colors ${
              isSelected ? 'bg-[#36393f]' : 'hover:bg-[#36393f]/50'
            }`}
            onClick={() => {
              onServerSelect(server.id);
              toggleServerExpansion(server.id);
            }}
          >
            <div className="flex-shrink-0">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-[#72767d]" />
              ) : (
                <ChevronRight className="h-4 w-4 text-[#72767d]" />
              )}
            </div>
            <div className="relative ml-1">
              {server.icon ? (
                <div className="w-6 h-6 rounded-full overflow-hidden">
                  <img src={server.icon} alt={server.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className={`w-6 h-6 ${bgColor} rounded-full flex items-center justify-center text-white`}>
                  <span className="text-xs font-bold">{initials}</span>
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-[#43b581] rounded-full border border-[#202225]"></div>
            </div>
            <span className="ml-2 text-sm text-white truncate">{server.name}</span>
          </div>
          
          {/* Channel List */}
          {isExpanded && (
            <div className="ml-4 mt-1">
              {serverChannels.length > 0 ? (
                // Filter out hidden channels - use memoized value to ensure stable rendering
                serverChannels.filter(channel => !hiddenChannels.includes(channel.id)).map(channel => (
                  <div
                    key={channel.id}
                    className={`channel-item flex items-center justify-between p-2 pl-3 rounded cursor-pointer group ${
                      channel.id === selectedChannelId 
                        ? 'bg-[#36393f] text-white' 
                        : 'text-[#72767d] hover:bg-[#36393f]/50 hover:text-[#dcddde]'
                    }`}
                    onClick={() => onChannelSelect(channel.id)}
                    data-channel-id={channel.id}
                  >
                    <div className="flex items-center overflow-hidden">
                      <Hash className="h-4 w-4 mr-1 flex-shrink-0" />
                      <span className="text-sm truncate">{channel.name}</span>
                    </div>
                    <button
                      type="button"
                      className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer text-[#72767d] hover:text-white hover:bg-[#ed4245] rounded p-1 min-w-[24px] min-h-[24px] focus:outline-none focus:ring-2 focus:ring-[#ed4245] focus:opacity-100"
                      onClick={(e) => hideChannel(channel.id, e)}
                      title="Hide channel"
                      aria-label="Hide channel"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18"></path>
                        <path d="M6 6l12 12"></path>
                      </svg>
                    </button>
                  </div>
                ))
              ) : (
                isLoadingChannels ? (
                  <div className="p-2 text-xs text-[#72767d]">Loading channels...</div>
                ) : (
                  <div className="p-2 text-xs text-[#72767d]">No channels found</div>
                )
              )}
              {/* Show hidden channels count if any */}
              {serverChannels.filter(channel => hiddenChannels.includes(channel.id)).length > 0 && (
                <div className="p-2 text-xs text-[#72767d] mt-2 border-t border-[#2f3136] pt-2">
                  <button
                    className="text-xs text-[#72767d] hover:text-[#dcddde] flex items-center"
                    onClick={() => {
                      // Clear hidden channels for this server
                      const newHiddenChannels = hiddenChannels.filter(
                        channelId => !serverChannels.some(channel => channel.id === channelId)
                      );
                      setHiddenChannels(newHiddenChannels);
                      localStorage.setItem('hiddenChannels', JSON.stringify(newHiddenChannels));
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                      <path d="M12 5v14"></path>
                      <path d="M5 12h14"></path>
                    </svg>
                    Show {serverChannels.filter(channel => hiddenChannels.includes(channel.id)).length} hidden channel(s)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      );
    });
  }, [servers, channels, selectedServerId, selectedChannelId, expandedServers, hiddenChannels, isLoadingChannels, onServerSelect, onChannelSelect]);
  
  return (
    <aside className="bg-[#202225] w-full md:w-16 lg:w-64 flex-shrink-0 overflow-hidden flex flex-col h-full">
      {/* App Logo */}
      <div className="p-4 flex items-center justify-center lg:justify-start">
        <div className="w-8 h-8 bg-[#7289da] rounded-full flex items-center justify-center text-white">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 16 16">
            <path d="M13.545 2.907a13.227 13.227 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.19 12.19 0 0 0-3.658 0 8.258 8.258 0 0 0-.412-.833.051.051 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.041.041 0 0 0-.021.018C.356 6.024-.213
9.047.066 12.032c.001.014.01.028.021.037a13.276 13.276 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019c.308-.42.582-.863.818-1.329a.05.05 0 0 0-.01-.059.051.051 0 0 0-.018-.011 8.875 8.875 0 0 1-1.248-.595.05.05 0 0 1-.02-.066.051.051 0 0 1 .015-.019c.084-.063.168-.129.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.052.052 0 0 1 .053.007c.08.066.164.132.248.195a.051.051 0 0 1-.004.085 8.254 8.254 0 0 1-1.249.594.05.05 0 0 0-.03.03.052.052 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.235 13.235 0 0 0 4.001-2.02.049.049 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.034.034 0 0 0-.02-.019Zm-8.198 7.307c-.789 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612Zm5.316 0c-.788 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612Z"/>
          </svg>
        </div>
        <h1 className="ml-2 text-xl font-bold hidden lg:block text-white">Discord Chatter</h1>
      </div>
      
      {/* Divider */}
      <div className="mx-4 border-b border-gray-700 my-2"></div>
      
      {/* Servers List */}
      <div className="p-2 flex-1 overflow-y-auto">
        <h2 className="px-2 text-[#72767d] text-xs uppercase font-semibold mb-2 hidden lg:block">Connected Servers</h2>
        
        {/* Server items */}
        <div className="space-y-1">
          {isLoadingServers ? (
            // Loading skeleton
            Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex items-center p-2 rounded">
                <div className="w-8 h-8 bg-[#36393f] rounded-full animate-pulse"></div>
                <div className="ml-2 hidden lg:block w-20 h-4 bg-[#36393f] rounded animate-pulse"></div>
              </div>
            ))
          ) : (
            serverItems
          )}
        </div>
        
        {/* Add server button */}
        <div className="mt-4">
          <button 
            onClick={() => setConnectDialogOpen(true)}
            className="w-full flex items-center justify-center lg:justify-start p-2 rounded bg-[#2f3136] hover:bg-[#36393f] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#7289da]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="ml-2 text-[#7289da] hidden lg:block">Connect Server</span>
          </button>
        </div>
        
        {/* Connect Server Dialog */}
        <ConnectServerDialog 
          open={connectDialogOpen} 
          onOpenChange={setConnectDialogOpen} 
        />
      </div>
      
      {/* User Profile */}
      <div className="p-3 bg-[#2f3136] mt-auto flex items-center">
        <div className="w-8 h-8 rounded-full bg-gray-500 flex-shrink-0 overflow-hidden">
          <svg className="h-full w-full text-gray-300" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
        <div className="ml-2 hidden lg:block">
          <div className="text-sm font-medium text-white">User</div>
          <div className="text-xs text-[#72767d]">Online</div>
        </div>
        <div className="ml-auto">
          <Link to="/settings" className="block">
            <button className="text-[#72767d] hover:text-white p-1 rounded-full hover:bg-[#36393f]/30 transition-colors">
              <Settings size={18} />
            </button>
          </Link>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
