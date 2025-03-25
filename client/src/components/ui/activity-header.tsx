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
        <span className="ml-2 text-xs bg-[#7289da]/20 text-[#7289da] px-2 py-0.5 rounded-full">Last Hour</span>
      </div>
      
      <div className="flex items-center space-x-2">
        <span className="text-xs text-[#72767d]">
          Last updated: {lastUpdated ? lastUpdatedText : "never"}
        </span>
        <div className="flex">
          <button 
            className="p-2 rounded-full hover:bg-[#36393f]/50 transition-colors text-[#72767d] hover:text-[#dcddde]"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Generate new summaries (may take a minute)"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button 
            className="p-2 rounded-full hover:bg-[#36393f]/50 transition-colors text-[#72767d] hover:text-[#dcddde]"
            onClick={() => window.location.reload()}
            title="Reload the page to see latest data"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
              <path d="M3 3v5h5"></path>
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
              <path d="M16 21h5v-5"></path>
            </svg>
          </button>
          <Link to="/settings">
            <button className="p-2 rounded-full hover:bg-[#36393f]/50 transition-colors text-[#72767d] hover:text-[#dcddde]">
              <Settings className="h-4 w-4" />
            </button>
          </Link>
        </div>
      </div>
    </header>
  );
};

export default ActivityHeader;
