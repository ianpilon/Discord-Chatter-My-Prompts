import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

interface UserSettings {
  id: number;
  userId: number;
  summaryFrequency: string;
  detailLevel: string;
  emailNotifications: boolean;
  webNotifications: boolean;
  // Auto-analysis settings
  autoAnalysisEnabled: boolean;
  defaultEmailRecipient: string | null;
  messageThreshold: number;
  timeThreshold: number;
}

const SettingsCard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Add state to track if preferences have been saved
  const [preferencesSaved, setPreferencesSaved] = useState(false);
  
  const { data: settings, isLoading } = useQuery<UserSettings>({
    queryKey: ['/api/settings'],
  });
  
  // Local state for form values
  const [formValues, setFormValues] = useState<{
    summaryFrequency: string;
    detailLevel: string;
    emailNotifications: boolean;
    webNotifications: boolean;
    // Auto-analysis settings
    autoAnalysisEnabled: boolean;
    defaultEmailRecipient: string;
    messageThreshold: number;
    timeThreshold: number;
  }>({
    summaryFrequency: "24h",
    detailLevel: "standard",
    emailNotifications: false,
    webNotifications: true,
    // Auto-analysis defaults
    autoAnalysisEnabled: false,
    defaultEmailRecipient: "",
    messageThreshold: 20,
    timeThreshold: 30,
  });
  
  // Store original form values to restore them when updating
  const [originalValues, setOriginalValues] = useState(formValues);
  
  // Update local state when settings are loaded
  // We need to use useEffect here, not useState, to properly respond to settings changes
  useEffect(() => {
    if (settings) {
      const newValues = {
        summaryFrequency: settings.summaryFrequency,
        detailLevel: settings.detailLevel,
        emailNotifications: settings.emailNotifications,
        webNotifications: settings.webNotifications,
        // Auto-analysis settings
        autoAnalysisEnabled: settings.autoAnalysisEnabled,
        defaultEmailRecipient: settings.defaultEmailRecipient || "",
        messageThreshold: settings.messageThreshold,
        timeThreshold: settings.timeThreshold,
      };
      setFormValues(newValues);
      setOriginalValues(newValues);
      // Default state should show the Save Changes button (preferencesSaved = false)
      // We'll only set preferencesSaved to true after the user actively saves
      setPreferencesSaved(false);
    }
  }, [settings]); // Re-run when settings change
  
  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<UserSettings>) => {
      console.log('Saving settings with values:', formValues);
      const res = await apiRequest('POST', '/api/settings', formValues);
      return res.json();
    },
    onSuccess: (data) => {
      console.log('✅ Settings successfully saved:', data);
      toast({
        title: "Settings updated",
        description: "Your settings have been saved successfully.",
      });
      // Set preferences as saved
      setPreferencesSaved(true);
      // Store the current values as original values
      setOriginalValues({...formValues});
      // Force a refetch of settings to update the UI and auto-analysis service
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      console.log('Settings cache invalidated, will refresh auto-analysis service state');
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update settings: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  const handleInputChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormValues({
      ...formValues,
      [e.target.name]: e.target.value,
    });
  };
  
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormValues({
      ...formValues,
      [e.target.name]: e.target.checked,
    });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettingsMutation.mutate(formValues);
  };
  
  // Handle updating preferences - clear form fields in Auto-Analysis section
  const handleUpdatePreferences = () => {
    // First set preferencesSaved to false to show the Save button immediately
    setPreferencesSaved(false);
    
    // Reset only the auto-analysis portion of the form
    setFormValues({
      ...formValues,
      autoAnalysisEnabled: false,
      defaultEmailRecipient: "",
      messageThreshold: 20,
      timeThreshold: 30,
    });
  };
  
  if (isLoading) {
    return (
      <div className="bg-[#2f3136] rounded-lg overflow-hidden mb-6 animate-pulse">
        <div className="p-4 border-b border-gray-700">
          <div className="h-5 w-40 bg-[#36393f]/50 rounded"></div>
        </div>
        <div className="p-4">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="space-y-1">
                  <div className="h-4 w-32 bg-[#36393f]/50 rounded"></div>
                  <div className="h-3 w-48 bg-[#36393f]/50 rounded"></div>
                </div>
                <div className="h-8 w-28 bg-[#36393f]/50 rounded"></div>
              </div>
            ))}
            <div className="mt-6 flex justify-end">
              <div className="h-10 w-24 bg-[#36393f]/50 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-[#2f3136] rounded-lg overflow-hidden mb-6">
      <div className="p-4 border-b border-gray-700">
        <h3 className="font-medium text-[#dcddde]">Settings & Configuration</h3>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="p-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-sm font-medium text-[#dcddde]">Summary Generation Frequency</h4>
                <p className="text-xs text-[#72767d]">How often should new summaries be generated</p>
              </div>
              <select 
                className="bg-[#36393f] border border-gray-700 rounded px-3 py-1 text-sm text-[#dcddde]"
                name="summaryFrequency"
                value={formValues.summaryFrequency}
                onChange={handleInputChange}
              >
                <option value="24h">Every 24 hours</option>
                <option value="12h">Every 12 hours</option>
                <option value="6h">Every 6 hours</option>
              </select>
            </div>
            
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-sm font-medium text-[#dcddde]">AI Summary Detail Level</h4>
                <p className="text-xs text-[#72767d]">How detailed should the AI-generated summaries be</p>
              </div>
              <select 
                className="bg-[#36393f] border border-gray-700 rounded px-3 py-1 text-sm text-[#dcddde]"
                name="detailLevel"
                value={formValues.detailLevel}
                onChange={handleInputChange}
              >
                <option value="standard">Standard</option>
                <option value="detailed">Detailed</option>
                <option value="concise">Concise</option>
              </select>
            </div>
            
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-sm font-medium text-[#dcddde]">Notification Preferences</h4>
                <p className="text-xs text-[#72767d]">When should you be notified about new summaries</p>
              </div>
              <div className="flex items-center">
                <label className="inline-flex items-center">
                  <input 
                    type="checkbox" 
                    className="rounded bg-[#36393f] border-gray-700 text-[#7289da] focus:ring-[#7289da]"
                    name="emailNotifications"
                    checked={formValues.emailNotifications}
                    onChange={handleCheckboxChange}
                  />
                  <span className="ml-2 text-sm text-[#dcddde]">Email</span>
                </label>
                <label className="inline-flex items-center ml-4">
                  <input 
                    type="checkbox" 
                    className="rounded bg-[#36393f] border-gray-700 text-[#7289da] focus:ring-[#7289da]"
                    name="webNotifications"
                    checked={formValues.webNotifications}
                    onChange={handleCheckboxChange}
                  />
                  <span className="ml-2 text-sm text-[#dcddde]">Web</span>
                </label>
              </div>
            </div>
            
            {/* Auto-Analysis Section Header */}
            <div className="mt-8 border-t border-gray-700 pt-6">
              <h3 className="text-md font-semibold text-[#dcddde] mb-4">Automatic Analysis & Email</h3>
            </div>
            
            {/* Auto-Analysis Toggle */}
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-sm font-medium text-[#dcddde]">Enable Auto-Analysis</h4>
                <p className="text-xs text-[#72767d]">Automatically analyze new messages and send reports by email</p>
              </div>
              <div className="flex items-center">
                <label className="inline-flex items-center">
                  <input 
                    type="checkbox" 
                    className="rounded bg-[#36393f] border-gray-700 text-[#7289da] focus:ring-[#7289da]"
                    name="autoAnalysisEnabled"
                    checked={formValues.autoAnalysisEnabled}
                    onChange={handleCheckboxChange}
                  />
                  <span className="ml-2 text-sm text-[#dcddde]">Enabled</span>
                </label>
              </div>
            </div>
            
            {/* Auto-Analysis Settings (always shown) */}
            <div className="mt-4 pl-4 border-l-2 border-[#4f545c] space-y-4">
              {/* Default Email Recipient */}
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-medium text-[#dcddde]">Default Email Recipient</h4>
                  <p className="text-xs text-[#72767d]">Where to send the analysis reports</p>
                </div>
                  <input
                    type="email"
                    className="bg-[#36393f] border border-gray-700 rounded px-3 py-1 text-sm text-[#dcddde] w-64"
                    name="defaultEmailRecipient"
                    value={formValues.defaultEmailRecipient}
                    onChange={(e) => setFormValues({...formValues, defaultEmailRecipient: e.target.value})}
                    placeholder="email@example.com"
                  />
                </div>
                
                {/* Message Threshold */}
                <div className="flex justify-between items-center">
                  <div className="flex items-start space-x-1">
                    <div>
                      <h4 className="text-sm font-medium text-[#dcddde]">Message Threshold</h4>
                      <p className="text-xs text-[#72767d]">How many new messages trigger an analysis</p>
                    </div>
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button 
                            type="button" 
                            onClick={(e) => {
                              e.preventDefault(); // Prevent form submission
                              e.stopPropagation(); // Prevent event bubbling
                            }} 
                            className="text-[#72767d] hover:text-[#dcddde] mt-0.5"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-[#18191c] text-[#dcddde] border-gray-700 max-w-xs">
                          <div className="space-y-2">
                            <p>This setting determines when automatic analysis is triggered:</p>
                            <ul className="pl-5 list-disc space-y-1 text-xs">
                              <li><strong>New Message Count:</strong> When this many new messages appear in a channel since the last check, analysis is triggered.</li>
                              <li><strong>Per Channel:</strong> This threshold applies separately to each channel.</li>
                              <li><strong>Finding Patterns:</strong> Higher values (20-30+) are better for identifying meaningful patterns and trends.</li>
                            </ul>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    className="bg-[#36393f] border border-gray-700 rounded px-3 py-1 text-sm text-[#dcddde] w-20"
                    name="messageThreshold"
                    value={formValues.messageThreshold}
                    onChange={(e) => setFormValues({...formValues, messageThreshold: parseInt(e.target.value)})}
                  />
                </div>
                
                {/* Time Threshold */}
                <div className="flex justify-between items-center">
                  <div className="flex items-start space-x-1">
                    <div>
                      <h4 className="text-sm font-medium text-[#dcddde]">Time Threshold (minutes)</h4>
                      <p className="text-xs text-[#72767d]">Minimum time between automatic analyses</p>
                    </div>
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button 
                            type="button" 
                            onClick={(e) => {
                              e.preventDefault(); // Prevent form submission
                              e.stopPropagation(); // Prevent event bubbling
                            }} 
                            className="text-[#72767d] hover:text-[#dcddde] mt-0.5"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="bg-[#18191c] text-[#dcddde] border-gray-700 max-w-xs">
                          <div className="space-y-2">
                            <p>This setting controls how frequently auto-analysis can be triggered:</p>
                            <ul className="pl-5 list-disc space-y-1 text-xs">
                              <li><strong>Cool-down Period:</strong> After an analysis runs for a channel, another analysis won't trigger until this time has passed.</li>
                              <li><strong>Prevents Spam:</strong> Even if message threshold is reached multiple times, you'll only get emails after the cool-down period.</li>
                              <li><strong>Resource Management:</strong> Helps control API usage by limiting how often analyses run.</li>
                            </ul>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <input
                    type="number"
                    min="5"
                    max="1440"
                    className="bg-[#36393f] border border-gray-700 rounded px-3 py-1 text-sm text-[#dcddde] w-20"
                    name="timeThreshold"
                    value={formValues.timeThreshold}
                    onChange={(e) => setFormValues({...formValues, timeThreshold: parseInt(e.target.value)})}
                  />
                </div>
              </div>
            </div>
          
          <div className="mt-6 flex justify-end space-x-4">
            {preferencesSaved ? (
              <>
                <button 
                  className="bg-[#4f545c] hover:bg-[#36393f] text-white px-4 py-2 rounded font-medium"
                  type="button"
                  onClick={handleUpdatePreferences}
                >
                  Update Preferences
                </button>
                <button 
                  className="bg-black text-white px-4 py-2 rounded font-medium cursor-default"
                  type="button"
                  disabled
                >
                  Preferences Saved
                </button>
              </>
            ) : (
              <button 
                className="bg-[#7289da] hover:bg-[#7289da]/80 text-white px-4 py-2 rounded font-medium"
                type="submit"
                disabled={updateSettingsMutation.isPending}
              >
                {updateSettingsMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default SettingsCard;
