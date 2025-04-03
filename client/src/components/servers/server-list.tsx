import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchServerDetails } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Hash, Users, MessageCircle } from "lucide-react";

interface ServerListProps {
  onServerSelect: (serverId: string) => void;
  selectedServerId?: string;
}

export function ServerList({ onServerSelect, selectedServerId }: ServerListProps) {
  const { data: servers, isLoading } = useQuery({
    queryKey: ["servers"],
    queryFn: () => fetchServerDetails(),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-[150px]" />
                <Skeleton className="h-4 w-[100px]" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-10rem)]">
      <div className="space-y-3 pr-4">
        {servers?.map((server) => (
          <Card
            key={server.id}
            className={`p-4 transition-colors hover:bg-accent/50 ${
              selectedServerId === server.id ? "bg-accent" : ""
            }`}
          >
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => onServerSelect(server.id)}
            >
              <div className="flex items-center space-x-4">
                {server.icon ? (
                  <Avatar>
                    <img src={server.icon} alt={server.name} />
                  </Avatar>
                ) : (
                  <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center">
                    <Hash className="h-6 w-6" />
                  </div>
                )}
                <div className="space-y-1">
                  <h3 className="font-medium">{server.name}</h3>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <span className="flex items-center">
                      <Users className="mr-1 h-4 w-4" />
                      {server.stats?.activeUsers || 0}
                    </span>
                    <span className="flex items-center">
                      <MessageCircle className="mr-1 h-4 w-4" />
                      {server.stats?.totalMessages || 0}
                    </span>
                  </div>
                </div>
              </div>
            </Button>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
