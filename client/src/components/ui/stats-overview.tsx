import { MessageSquare, Users, Hash, Server } from "lucide-react";

interface StatsData {
  totalMessages: number;
  activeUsers: number;
  activeChannels: number;
  connectedServers: number;
  percentChange: {
    messages: number;
    users: number;
    channels: number;
  };
}

interface StatsOverviewProps {
  data: StatsData;
  isLoading: boolean;
}

const StatCard = ({ 
  icon: Icon, 
  title, 
  value, 
  change, 
  bgColor 
}: { 
  icon: React.ElementType; 
  title: string; 
  value: number; 
  change: number;
  bgColor: string;
}) => {
  let changeColor = "text-[#72767d]";
  let changeIcon = null;
  
  if (change > 0) {
    changeColor = "text-[#43b581]";
    changeIcon = (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    );
  } else if (change < 0) {
    changeColor = "text-[#f04747]";
    changeIcon = (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  } else {
    changeIcon = (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
      </svg>
    );
  }
  
  return (
    <div className="bg-[#2f3136] rounded-lg p-4 shadow-sm">
      <div className="flex items-center">
        <div className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="ml-3">
          <div className="text-xs text-[#72767d]">{title}</div>
          <div className="text-2xl font-bold text-white">{value.toLocaleString()}</div>
        </div>
      </div>
      <div className={`mt-2 text-xs ${changeColor} flex items-center`}>
        {changeIcon}
        <span>
          {change !== 0 
            ? `${Math.abs(change).toFixed(0)}% from yesterday` 
            : "No change"}
        </span>
      </div>
    </div>
  );
};

const StatsOverview = ({ data, isLoading }: StatsOverviewProps) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-[#2f3136] rounded-lg p-4 shadow-sm animate-pulse">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-[#36393f]/50"></div>
              <div className="ml-3 space-y-2">
                <div className="h-2 w-16 bg-[#36393f]/50 rounded"></div>
                <div className="h-5 w-12 bg-[#36393f]/50 rounded"></div>
              </div>
            </div>
            <div className="mt-2 h-3 w-32 bg-[#36393f]/50 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard 
        icon={MessageSquare} 
        title="Total Messages" 
        value={data.totalMessages}
        change={data.percentChange.messages}
        bgColor="bg-[#7289da]/20 text-[#7289da]"
      />
      
      <StatCard 
        icon={Users} 
        title="Active Users" 
        value={data.activeUsers}
        change={data.percentChange.users}
        bgColor="bg-purple-500/20 text-purple-500"
      />
      
      <StatCard 
        icon={Hash} 
        title="Active Channels" 
        value={data.activeChannels}
        change={data.percentChange.channels}
        bgColor="bg-green-500/20 text-green-500"
      />
      
      <StatCard 
        icon={Server} 
        title="Connected Servers" 
        value={data.connectedServers}
        change={0}
        bgColor="bg-blue-500/20 text-blue-500"
      />
    </div>
  );
};

export default StatsOverview;
