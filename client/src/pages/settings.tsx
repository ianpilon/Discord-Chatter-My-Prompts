import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import SettingsCard from "@/components/ui/settings-card";
import StatusFooter from "@/components/ui/status-footer";

const Settings = () => {
  return (
    <div className="flex flex-col min-h-screen bg-[#36393f] text-[#dcddde]">
      <header className="bg-[#2f3136] p-4 border-b border-gray-700 flex items-center">
        <Link to="/">
          <button className="text-[#72767d] hover:text-[#dcddde] p-1 rounded-full hover:bg-[#36393f]/30 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </Link>
        <h1 className="text-lg font-bold ml-3 text-white">Settings</h1>
      </header>
      
      <main className="flex-1 p-4 max-w-3xl mx-auto w-full">
        <SettingsCard />
        
        <div className="bg-[#2f3136] rounded-lg overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-700">
            <h3 className="font-medium text-[#dcddde]">About Discord Chatter</h3>
          </div>
          <div className="p-4">
            <p className="text-sm text-[#dcddde] mb-4">
              Discord Chatter is an AI-powered tool that provides summaries of your Discord server conversations.
              It automatically analyzes messages from the past 24 hours and generates concise overviews of discussions,
              making it easy to catch up on what you missed.
            </p>
            
            <div className="mt-4 bg-[#36393f] p-4 rounded-lg">
              <h4 className="text-sm font-medium text-[#7289da] mb-2">Features</h4>
              <ul className="list-disc pl-5 text-sm text-[#dcddde] space-y-1">
                <li>Automatic daily summaries of Discord conversations</li>
                <li>Channel-specific activity tracking</li>
                <li>Topic identification and extraction</li>
                <li>Server activity statistics</li>
                <li>Customizable summary frequency and detail level</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
      
      <StatusFooter />
    </div>
  );
};

export default Settings;
