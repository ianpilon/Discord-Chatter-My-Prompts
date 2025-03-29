import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ConnectServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ConnectServerDialog = ({ open, onOpenChange }: ConnectServerDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [botToken, setBotToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refresh servers mutation
  const refreshMutation = useMutation({
    mutationFn: async () => {
      setIsSubmitting(true);
      
      try {
        // 1. First update the bot token if provided
        if (botToken) {
          const tokenResponse = await fetch('/api/discord/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token: botToken }),
          });
          
          if (!tokenResponse.ok) {
            throw new Error('Failed to update Discord bot token');
          }
          
          const tokenData = await tokenResponse.json();
          if (!tokenData.valid) {
            throw new Error('Invalid Discord bot token');
          }
        }
        
        // 2. Refresh Discord connection
        const refreshResponse = await fetch('/api/discord/refresh', {
          method: 'POST',
        });
        
        if (!refreshResponse.ok) {
          throw new Error('Failed to refresh Discord connection');
        }
        
        // 3. Then sync servers
        const syncResponse = await fetch('/api/servers/sync', {
          method: 'POST',
        });
        
        if (!syncResponse.ok) {
          throw new Error('Failed to sync servers');
        }
        
        return syncResponse.json();
      } finally {
        setIsSubmitting(false);
      }
    },
    onSuccess: (data) => {
      toast({
        title: 'Success',
        description: `Successfully connected to ${data.servers.length} Discord servers.`,
      });
      
      // Invalidate the servers query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/servers'] });
      
      // Close the dialog
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to connect: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#36393f] text-[#dcddde] border-[#202225] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white">Connect to Discord Server</DialogTitle>
          <DialogDescription>
            To connect this app to your Discord server, you need to add the Discord bot to your server.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 overflow-y-auto pr-1 my-2" style={{ maxHeight: 'calc(70vh - 200px)' }}>
          <div className="bg-[#2f3136] p-4 rounded-md">
            <h3 className="font-medium text-white mb-2">Steps to create and add a Discord bot:</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li><strong>Create a Discord Bot</strong>:
                <ul className="list-disc ml-5 mt-1">
                  <li>Go to the <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Discord Developer Portal</a></li>
                  <li>Click "New Application" and give it a name</li>
                  <li>Go to the "Bot" tab and click "Add Bot"</li>
                  <li>Under "Privileged Gateway Intents", enable "MESSAGE CONTENT INTENT"</li>
                  <li>Save your changes</li>
                </ul>
              </li>
              <li><strong>Get your bot token</strong>:
                <ul className="list-disc ml-5 mt-1">
                  <li>In the Bot tab, click "Reset Token" and copy your token</li>
                  <li>Enter this token in the form below</li>
                </ul>
              </li>
              <li><strong>Invite the bot to your server</strong>:
                <ul className="list-disc ml-5 mt-1">
                  <li>Go to OAuth2 {'>'} URL Generator</li>
                  <li>Select the "bot" scope</li>
                  <li>Select these permissions: "Read Messages/View Channels", "Read Message History"</li>
                  <li>Copy the generated URL and open it in your browser</li>
                  <li>Select the server you want to add the bot to (you must have "Manage Server" permission)</li>
                  <li>Confirm the permissions</li>
                </ul>
              </li>
            </ol>
          </div>
          
          <div className="bg-[#2f3136] p-4 rounded-md mt-4">
            <h3 className="font-medium text-white mb-2">Enter your Discord Bot Token:</h3>
            <div className="space-y-2">
              <Label htmlFor="discord-token" className="text-sm text-gray-300">
                Bot Token (kept secure and never shared)
              </Label>
              <Input 
                id="discord-token"
                type="password" 
                className="bg-[#202225] border-[#1a1b1e] text-white"
                placeholder="Paste your Discord bot token here"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
              />
              <p className="text-xs text-gray-400">
                Your token will be stored securely on the server and used only to connect to your Discord servers.
              </p>
            </div>
          </div>
          

        </div>
        
        <DialogFooter className="flex justify-between items-center">
          <DialogClose asChild>
            <Button variant="outline" className="bg-[#2f3136] border-[#202225] text-[#dcddde] hover:bg-[#36393f] hover:text-white">
              Close
            </Button>
          </DialogClose>
          
          <Button 
            onClick={() => refreshMutation.mutate()} 
            disabled={refreshMutation.isPending || (!botToken.trim() && botToken !== '')}
            className="bg-[#5865F2] text-white hover:bg-[#4752C4]">
            {refreshMutation.isPending ? 'Connecting...' : botToken.trim() ? 'Connect with Token' : 'Refresh Servers'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectServerDialog;
