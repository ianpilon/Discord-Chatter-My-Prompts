import { RefreshCw, Settings } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";

interface ActivityHeaderProps {
  onRefresh: () => void;
  lastUpdated?: string;
  isRefreshing: boolean;
}

const ActivityHeader = ({ onRefresh, lastUpdated, isRefreshing }: ActivityHeaderProps) => {
  const [lastUpdatedText, setLastUpdatedText] = useState<string>("never");
  
  useEffect(() => {
    if (lastUpdated) {
      const updateText = () => {
        setLastUpdatedText(formatDistanceToNow(new Date(lastUpdated), { addSuffix: true }));
      };
      
      updateText();
      
      // Update the text every minute
      const interval = setInterval(updateText, 60000);
      
      return () => clearInterval(interval);
    }
  }, [lastUpdated]);
  
  return (
    <header className="bg-[#2f3136] p-4 border-b border-gray-700 flex items-center justify-between">
      <div className="flex items-center">
        <button className="md:hidden mr-4 text-[#72767d] hover:text-[#dcddde]">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-white">Activity Summary</h1>
        <span className="ml-2 text-xs bg-[#7289da]/20 text-[#7289da] px-2 py-0.5 rounded-full">Last 24h</span>
      </div>
      
      <div className="flex items-center space-x-2">
        <span className="text-xs text-[#72767d]">
          Last updated: {lastUpdated ? lastUpdatedText : "never"}
        </span>
        <button 
          className="p-2 rounded-full hover:bg-[#36393f]/50 transition-colors text-[#72767d] hover:text-[#dcddde]"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
        <Link to="/settings">
          <button className="p-2 rounded-full hover:bg-[#36393f]/50 transition-colors text-[#72767d] hover:text-[#dcddde]">
            <Settings className="h-4 w-4" />
          </button>
        </Link>
      </div>
    </header>
  );
};

export default ActivityHeader;
