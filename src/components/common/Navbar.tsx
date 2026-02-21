"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Zap, Settings } from "lucide-react";

const navItems = [
  { href: "/library", label: "Knowledge Base", icon: BookOpen },
  { href: "/practice", label: "Practice", icon: Zap },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 bg-card border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link href="/library" className="flex items-center gap-2 font-semibold text-lg">
            <span className="text-primary">AI</span>
            <span>Practice Hub</span>
          </Link>

          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-secondary hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
