import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Cpu, MessageSquare, RefreshCw } from "lucide-react";
import { refreshDiscordConnection } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface StatusResponse {
  discord: string;
  openai: string;
  lastUpdated: string;
}

const StatusFooter = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: status } = useQuery<StatusResponse>({
    queryKey: ['/api/status'],
    refetchInterval: 60000, // Refetch every minute
  });
  
  const refreshMutation = useMutation({
    mutationFn: refreshDiscordConnection,
    onSuccess: () => {
      // Invalidate the status query to refresh the status
      queryClient.invalidateQueries({ queryKey: ['/api/status'] });
      // Invalidate the servers query to refresh the server list
      queryClient.invalidateQueries({ queryKey: ['/api/servers'] });
      toast({
        title: "Discord connection refreshed",
        description: "Your Discord connection has been refreshed. Check if your messages are now visible.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error refreshing Discord connection",
        description: error.message || "An error occurred while refreshing your Discord connection.",
        variant: "destructive",
      });
    }
  });
  
  const handleRefreshDiscord = () => {
    refreshMutation.mutate();
  };
  
  const getStatusColor = (status: string | undefined) => {
    if (!status) return "text-[#72767d]";
    
    switch (status) {
      case "connected":
      case "operational":
        return "text-[#43b581]";
      case "disconnected":
      case "error":
        return "text-[#f04747]";
      default:
        return "text-[#faa61a]";
    }
  };
  
  const discordStatusColor = getStatusColor(status?.discord);
  const openaiStatusColor = getStatusColor(status?.openai);
  
  return (
    <footer className="bg-[#2f3136] py-2 px-4 border-t border-gray-700 flex items-center justify-between text-xs text-[#72767d]">
      <div>
        <span>© {new Date().getFullYear()} Discord Chatter</span>
        <span className="mx-2">|</span>
        <span>v1.0.0</span>
        <span className="mx-2">|</span>
        <a href="http://localhost:3000" target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline transition-colors">Documentation</a>
      </div>
      <div className="flex items-center">
        <span className="flex items-center mr-4">
          <Cpu className="mr-1 h-3 w-3" />
          AI System Status: <span className={`${openaiStatusColor} ml-1`}>
            {status?.openai || "Unknown"}
          </span>
        </span>
        <span className="flex items-center">
          <MessageSquare className="mr-1 h-3 w-3" />
          API Status: <span className={`${discordStatusColor} ml-1`}>
            {status?.discord || "Unknown"}
          </span>
          <button
            onClick={handleRefreshDiscord}
            disabled={refreshMutation.isPending}
            className="ml-2 p-1 rounded hover:bg-[#36393f] transition-colors"
            title="Refresh Discord connection"
          >
            <RefreshCw className={`h-3 w-3 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          </button>
        </span>
      </div>
    </footer>
  );
};

export default StatusFooter;
