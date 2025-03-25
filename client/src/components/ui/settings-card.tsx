import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface UserSettings {
  id: number;
  userId: number;
  summaryFrequency: string;
  detailLevel: string;
  emailNotifications: boolean;
  webNotifications: boolean;
}

const SettingsCard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: settings, isLoading } = useQuery<UserSettings>({
    queryKey: ['/api/settings'],
  });
  
  // Local state for form values
  const [formValues, setFormValues] = useState<{
    summaryFrequency: string;
    detailLevel: string;
    emailNotifications: boolean;
    webNotifications: boolean;
  }>({
    summaryFrequency: settings?.summaryFrequency || "24h",
    detailLevel: settings?.detailLevel || "standard",
    emailNotifications: settings?.emailNotifications || false,
    webNotifications: settings?.webNotifications || true,
  });
  
  // Update local state when settings are loaded
  useState(() => {
    if (settings) {
      setFormValues({
        summaryFrequency: settings.summaryFrequency,
        detailLevel: settings.detailLevel,
        emailNotifications: settings.emailNotifications,
        webNotifications: settings.webNotifications,
      });
    }
  });
  
  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<UserSettings>) => {
      const res = await apiRequest('POST', '/api/settings', data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings updated",
        description: "Your settings have been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
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
          </div>
          
          <div className="mt-6 flex justify-end">
            <button 
              className="bg-[#7289da] hover:bg-[#7289da]/80 text-white px-4 py-2 rounded font-medium"
              type="submit"
              disabled={updateSettingsMutation.isPending}
            >
              {updateSettingsMutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default SettingsCard;
