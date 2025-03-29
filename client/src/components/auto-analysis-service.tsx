import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Define types for our settings and server data
interface UserSettings {
  autoAnalysisEnabled: boolean;
  defaultEmailRecipient: string | null;
  messageThreshold: number;
  timeThreshold: number;
}

interface Channel {
  id: string;
  name: string;
}

interface Server {
  id: string;
  name: string;
  channels?: Channel[];
}

interface Message {
  id: string;
  content: string;
  author: string;
  timestamp: string;
}

// Service component that monitors for new messages and triggers automatic analysis
export const AutoAnalysisService: React.FC = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  
  // Use useRef instead of useState to ensure the data persists between renders
  const lastAnalysisTimeRef = useRef<{[channelId: string]: Date}>({});
  const messageCountRef = useRef<{[channelId: string]: number}>({});
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Fetch user settings 
  const fetchSettings = async (): Promise<void> => {
    try {
      const response = await apiRequest('GET', '/api/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      
      const data = await response.json();
      console.log('🔍 [Auto-Analysis] Settings loaded:', data);
      setSettings(data);
      
      if (data?.autoAnalysisEnabled) {
        console.log('✅ [Auto-Analysis] Feature is ENABLED with email:', data.defaultEmailRecipient);
        console.log(`✅ [Auto-Analysis] Message threshold: ${data.messageThreshold}, Time threshold: ${data.timeThreshold} minutes`);
      } else {
        console.log('❌ [Auto-Analysis] Feature is DISABLED in settings');
      }
    } catch (error) {
      console.error('❌ [Auto-Analysis] Error fetching settings:', error);
    }
  };
  
  // Fetch servers list
  const fetchServers = async (): Promise<void> => {
    try {
      const response = await apiRequest('GET', '/api/servers');
      if (!response.ok) throw new Error('Failed to fetch servers');
      
      const data = await response.json();
      if (data?.servers) {
        setServers(data.servers);
        console.log(`📋 [Auto-Analysis] Found ${data.servers.length} servers to monitor`);
      }
    } catch (error) {
      console.error('❌ [Auto-Analysis] Error fetching servers:', error);
    }
  };

  // Function to check for new messages in all channels of a server
  const checkForNewMessages = async (serverId: string): Promise<void> => {
    if (!settings?.autoAnalysisEnabled || !settings.defaultEmailRecipient) {
      console.log('❌ [Auto-Analysis] Feature disabled or no recipient email set');
      return;
    }
    
    try {
      // Get all channels for this server
      const channelsResponse = await apiRequest('GET', `/api/servers/${serverId}`);
      if (!channelsResponse.ok) throw new Error(`Failed to fetch channels for server ${serverId}`);
      
      const channelsData = await channelsResponse.json();
      
      if (channelsData.channels && Array.isArray(channelsData.channels)) {
        // For each channel, check message count
        for (const channel of channelsData.channels) {
          // Use getAllMessages function instead of just getting recent messages
          const messagesResponse = await apiRequest('GET', `/api/channels/${channel.id}/all-messages`);
          if (!messagesResponse.ok) {
            console.error(`❌ Failed to fetch messages for channel ${channel.id}`);
            continue;
          }
          
          const messagesData = await messagesResponse.json();
          
          if (messagesData.messages && Array.isArray(messagesData.messages)) {
            const currentCount = messagesData.messages.length;
            const prevCount = messageCountRef.current[channel.id] || 0;
            const newMessageCount = currentCount - prevCount;
            
            console.log(`📊 Channel ${channel.name} (${channel.id}): Previous: ${prevCount}, Current: ${currentCount}, New: ${newMessageCount}`);
            
            // Update the stored count
            messageCountRef.current[channel.id] = currentCount;
            
            // If we've reached the threshold for new messages and enough time has passed
            if (newMessageCount >= settings.messageThreshold && shouldRunAnalysis(channel.id)) {
              console.log(`🚀 Threshold reached for channel ${channel.name}! Starting auto-analysis...`);
              await triggerAnalysisAndEmail(channel.id, channel.name, messagesData.messages);
            } else if (newMessageCount > 0) {
              console.log(`⏳ New messages detected (${newMessageCount}) but threshold not reached yet. Configured threshold: ${settings.messageThreshold}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ [Auto-Analysis] Error checking for new messages:', error);
    }
  };
  
  // Determine if enough time has passed since the last analysis for a specific channel
  const shouldRunAnalysis = (channelId: string): boolean => {
    if (!settings) return false;
    
    const lastTime = lastAnalysisTimeRef.current[channelId];
    if (!lastTime) return true; // No previous analysis for this channel
    
    const now = new Date();
    const timeSinceLastAnalysis = now.getTime() - lastTime.getTime();
    const minimumInterval = settings.timeThreshold * 60 * 1000; // Convert minutes to milliseconds
    
    console.log(`⏱️ Last analysis for channel ${channelId} was ${(timeSinceLastAnalysis / (60 * 1000)).toFixed(1)} minutes ago (threshold: ${settings.timeThreshold} minutes)`);
    
    return timeSinceLastAnalysis >= minimumInterval;
  };
  
  // Trigger the analysis and email sending
  const triggerAnalysisAndEmail = async (channelId: string, channelName: string, messages: Message[]): Promise<void> => {
    try {
      // First run the sentiment analysis
      const sentimentResponse = await apiRequest('POST', `/api/channels/${channelId}/analyze-sentiment`, {
        messages,
      });
      
      if (!sentimentResponse.ok) throw new Error('Failed to run sentiment analysis');
      const sentimentData = await sentimentResponse.json();
      
      // Then run the JTBD analysis using the sentiment results
      const jtbdResponse = await apiRequest('POST', `/api/channels/${channelId}/analyze-jtbd`, {
        messages,
        sentimentAnalysis: sentimentData.analysis
      });
      
      if (!jtbdResponse.ok) throw new Error('Failed to run JTBD analysis');
      const jtbdData = await jtbdResponse.json();
      
      // Send the email with both analyses
      if (settings?.defaultEmailRecipient) {
        console.log(`📧 Sending analysis results to ${settings.defaultEmailRecipient}`);
        
        const emailResponse = await apiRequest('POST', '/api/email/send', {
          to: settings.defaultEmailRecipient,
          subject: `Discord Analysis for #${channelName}`,
          content: `Sentiment Analysis:\n\n${sentimentData.analysis}\n\nJobs-to-be-Done Analysis:\n\n${jtbdData.analysis}`,
          analysisType: 'combined'
        });
        
        if (!emailResponse.ok) throw new Error('Failed to send email');
        
        // Update last analysis time using the ref
        lastAnalysisTimeRef.current[channelId] = new Date();
        
        // Notify user
        toast({
          title: "Auto-Analysis Complete",
          description: `Analysis for #${channelName} has been emailed to ${settings.defaultEmailRecipient}`,
        });
      }
    } catch (error) {
      console.error('Error in automatic analysis:', error);
      toast({
        title: "Auto-Analysis Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };
  
  // Function to monitor all servers and check for new messages
  const monitorAllServers = async (): Promise<void> => {
    if (!settings?.autoAnalysisEnabled) {
      console.log('❌ [Auto-Analysis] Feature is disabled in settings');
      return;
    }
    
    if (servers.length === 0) {
      console.log('⚠️ [Auto-Analysis] No servers available to monitor');
      return;
    }
    
    console.log(`🔄 [Auto-Analysis] Checking for new messages across ${servers.length} servers...`);
    
    for (const server of servers) {
      await checkForNewMessages(server.id);
    }
  };
  
  // Initialize message counts for all channels in all servers
  const initializeMessageCounts = async (): Promise<void> => {
    console.log('📊 [Auto-Analysis] Initializing message counts...');
    
    if (servers.length === 0) {
      console.log('⚠️ [Auto-Analysis] No servers to initialize');
      return;
    }
    
    for (const server of servers) {
      try {
        const channelsResponse = await apiRequest('GET', `/api/servers/${server.id}`);
        if (!channelsResponse.ok) {
          console.error(`❌ Failed to fetch channels for server ${server.id}`);
          continue;
        }
        
        const channelsData = await channelsResponse.json();
        
        if (channelsData.channels && Array.isArray(channelsData.channels)) {
          for (const channel of channelsData.channels) {
            // Use getAllMessages function to get consistent message counts
            const messagesResponse = await apiRequest('GET', `/api/channels/${channel.id}/all-messages`);
            if (!messagesResponse.ok) {
              console.error(`❌ Failed to fetch messages for channel ${channel.id}`);
              continue;
            }
            
            const messagesData = await messagesResponse.json();
            
            if (messagesData.messages && Array.isArray(messagesData.messages)) {
              const count = messagesData.messages.length;
              messageCountRef.current[channel.id] = count;
              console.log(`📊 Initialized channel ${channel.name} (${channel.id}) with ${count} messages`);
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error initializing counts for server ${server.id}:`, error);
      }
    }
    
    console.log('✅ [Auto-Analysis] Message counts initialized successfully');
  };
  
  // Start or stop the monitoring based on settings
  const updateMonitoringState = (): void => {
    if (settings?.autoAnalysisEnabled && !isRunning) {
      console.log('🔁 [Auto-Analysis] Starting message monitoring service...');
      setIsRunning(true);
      
      // Clear any existing interval
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
      }
      
      // Set up a new monitoring interval
      monitoringIntervalRef.current = setInterval(monitorAllServers, 15000); // Check every 15 seconds
    } else if (!settings?.autoAnalysisEnabled && isRunning) {
      console.log('⏹️ [Auto-Analysis] Stopping message monitoring service...');
      setIsRunning(false);
      
      // Clear the interval
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
        monitoringIntervalRef.current = null;
      }
    }
  };
  
  // Initial data fetching on component mount
  useEffect(() => {
    console.log('🚀 [Auto-Analysis] Service initializing...');
    fetchSettings();
    fetchServers();
    
    // Set up regular polling for settings updates
    const settingsInterval = setInterval(fetchSettings, 10000); // Refresh settings every 10 seconds
    const serversInterval = setInterval(fetchServers, 30000); // Refresh servers every 30 seconds
    
    return () => {
      // Clean up all intervals on unmount
      clearInterval(settingsInterval);
      clearInterval(serversInterval);
      if (monitoringIntervalRef.current) {
        clearInterval(monitoringIntervalRef.current);
        monitoringIntervalRef.current = null;
      }
    };
  }, []);
  
  // Update monitoring state whenever settings or servers change
  useEffect(() => {
    if (settings && servers.length > 0 && !isRunning && settings.autoAnalysisEnabled) {
      // Initialize message counts when we have settings and servers but haven't started monitoring yet
      initializeMessageCounts().then(() => {
        updateMonitoringState();
      });
    } else {
      updateMonitoringState();
    }
  }, [settings, servers, isRunning]);
  
  // This component doesn't render anything visible
  return null;
};

export default AutoAnalysisService;
