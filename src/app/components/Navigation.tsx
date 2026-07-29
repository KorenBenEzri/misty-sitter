"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/food", label: "Food", icon: "🍖" },
  { href: "/instructions", label: "Info", icon: "📋" },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md">
      <div className="flex items-center justify-around rounded-2xl bg-white/90 backdrop-blur-lg border border-pink-100 card-shadow px-2 py-2">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 px-5 py-2 rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-pink-100 text-pink-600 scale-105"
                  : "text-gray-400 hover:text-pink-400 hover:bg-pink-50"
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="text-xs font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
