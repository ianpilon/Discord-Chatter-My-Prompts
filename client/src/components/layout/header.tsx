import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Settings, MessageCircle } from "lucide-react";

export function Header() {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-7xl items-center">
        <Link href="/">
          <a className="flex items-center space-x-2 font-bold">
            <MessageCircle className="h-5 w-5" />
            <span>Discord Digest</span>
          </a>
        </Link>
        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-2">
            <Link href="/settings">
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
                <span className="sr-only">Settings</span>
              </Button>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
