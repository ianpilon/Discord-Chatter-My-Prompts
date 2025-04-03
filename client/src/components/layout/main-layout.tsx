import React from "react";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function MainLayout({ children, className }: MainLayoutProps) {
  return (
    <div className={cn(
      "min-h-screen bg-gradient-to-b from-background to-background/95",
      "flex flex-col",
      className
    )}>
      <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl">
        {children}
      </main>
    </div>
  );
}
