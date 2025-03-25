import { useQuery } from "@tanstack/react-query";
import { Cpu, MessageSquare } from "lucide-react";

interface StatusResponse {
  discord: string;
  openai: string;
  lastUpdated: string;
}

const StatusFooter = () => {
  const { data: status } = useQuery<StatusResponse>({
    queryKey: ['/api/status'],
    refetchInterval: 60000, // Refetch every minute
  });
  
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
        </span>
      </div>
    </footer>
  );
};

export default StatusFooter;
