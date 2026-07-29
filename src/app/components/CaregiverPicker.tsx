"use client";

import { useState, useEffect } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Caregiver } from "@/lib/types";

interface CaregiverPickerProps {
  onSelect: (caregiver: Caregiver) => void;
  selected: Caregiver | null;
}

async function fetchCaregivers(): Promise<Caregiver[]> {
  const { data } = await getSupabase()
    .from("caregivers")
    .select("*")
    .order("name");
  return data ?? [];
}

export default function CaregiverPicker({
  onSelect,
  selected,
}: CaregiverPickerProps) {
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCaregivers().then((data) => {
      if (!cancelled) {
        setCaregivers(data);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load from localStorage on mount — validate against fetched caregivers
  useEffect(() => {
    if (!loaded || selected) return;
    const saved = localStorage.getItem("misty-caregiver");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Caregiver;
        const match = caregivers.find((c) => c.id === parsed.id);
        if (match) {
          onSelect(match);
        } else {
          // Caregiver no longer exists in DB — clear stale data
          localStorage.removeItem("misty-caregiver");
        }
      } catch {
        localStorage.removeItem("misty-caregiver");
      }
    }
  }, [loaded, caregivers, onSelect, selected]);

  const handleSelect = (caregiver: Caregiver) => {
    onSelect(caregiver);
    localStorage.setItem("misty-caregiver", JSON.stringify(caregiver));
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-2xl border border-pink-200 card-shadow hover:card-shadow-hover transition-all duration-200 min-w-[140px]"
      >
        {selected ? (
          <>
            <span className="text-xl">{selected.emoji}</span>
            <span className="text-sm font-medium text-gray-700 truncate">
              {selected.name}
            </span>
          </>
        ) : (
          <>
            <span className="text-xl">🐱</span>
            <span className="text-sm text-gray-400">בחרי מי את/ה</span>
          </>
        )}
        <span className="text-xs text-gray-300 me-auto">▼</span>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 start-0 end-0 bg-white rounded-2xl border border-pink-100 card-shadow overflow-hidden z-50 pop-in min-w-[200px]">
          {caregivers.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelect(c)}
              className={`flex items-center gap-3 w-full px-4 py-3 text-start hover:bg-pink-50 transition-colors ${
                selected?.id === c.id ? "bg-pink-50" : ""
              }`}
            >
              <span className="text-xl">{c.emoji}</span>
              <span className="text-sm font-medium text-gray-700">
                {c.name}
              </span>
              {selected?.id === c.id && (
                <span className="me-auto text-pink-400">✓</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}
