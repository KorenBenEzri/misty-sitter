"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "בית", icon: "🏠" },
  { href: "/instructions", label: "הוראות", icon: "📋" },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around rounded-t-2xl bg-white/90 backdrop-blur-lg border-t border-pink-100 card-shadow px-2 py-2 max-w-md mx-auto">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 flex-1 py-2 rounded-xl transition-all duration-200 ${
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
