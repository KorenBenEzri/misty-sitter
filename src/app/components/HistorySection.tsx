"use client";

import { useState, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import { formatTime } from "@/lib/timeUtils";
import type { Caregiver } from "@/lib/types";

/* ---------- Types ---------- */

interface HistoryVisit {
  id: string;
  checked_in_at: string;
  caregivers: Caregiver;
}

interface HistoryCompletion {
  id: string;
  completed_at: string;
  caregivers: Caregiver;
  tasks: { name: string; icon: string };
}

interface HistoryFoodPack {
  id: string;
  defrosted_at: string;
  status: string;
  placed_by_caregiver: Caregiver | null;
}

interface DayGroup {
  dateKey: string;
  label: string;
  visits: HistoryVisit[];
  completions: HistoryCompletion[];
  foodPacks: HistoryFoodPack[];
}

/* ---------- Helpers ---------- */

const DAYS_PER_PAGE = 14;

const foodStatusHebrew: Record<string, string> = {
  thawing: "בהפשרה במקרר",
  ready: "מוכן",
  expired: "פג תוקף",
  replaced: "הוחלף",
};

function formatHebrewDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function dateKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ---------- Data fetching ---------- */

async function loadHistory(daysCount: number) {
  const supabase = getSupabase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // "today" is excluded — history starts from yesterday
  const from = new Date(today);
  from.setDate(from.getDate() - daysCount);

  const fromISO = from.toISOString();
  const todayISO = today.toISOString();

  const [visitsRes, completionsRes, foodRes] = await Promise.all([
    supabase
      .from("visits")
      .select("id, checked_in_at, caregivers(*)")
      .gte("checked_in_at", fromISO)
      .lt("checked_in_at", todayISO)
      .order("checked_in_at", { ascending: false }),
    supabase
      .from("task_completions")
      .select("id, completed_at, caregivers(*), tasks(name, icon)")
      .gte("completed_at", fromISO)
      .lt("completed_at", todayISO)
      .order("completed_at", { ascending: false }),
    supabase
      .from("food_packs")
      .select("id, defrosted_at, status, placed_by")
      .gte("defrosted_at", fromISO)
      .lt("defrosted_at", todayISO)
      .order("defrosted_at", { ascending: false }),
  ]);

  const visits = (visitsRes.data ?? []) as unknown as HistoryVisit[];
  const completions =
    (completionsRes.data ?? []) as unknown as HistoryCompletion[];
  const rawPacks = (foodRes.data ?? []) as {
    id: string;
    defrosted_at: string;
    status: string;
    placed_by: string | null;
  }[];

  // Resolve caregiver names for food packs
  const caregiverIds = [
    ...new Set(rawPacks.map((p) => p.placed_by).filter(Boolean)),
  ] as string[];

  let caregiverMap: Record<string, Caregiver> = {};
  if (caregiverIds.length > 0) {
    const { data: cgs } = await supabase
      .from("caregivers")
      .select("*")
      .in("id", caregiverIds);
    if (cgs) {
      caregiverMap = Object.fromEntries(cgs.map((c: Caregiver) => [c.id, c]));
    }
  }

  const foodPacks: HistoryFoodPack[] = rawPacks.map((p) => ({
    id: p.id,
    defrosted_at: p.defrosted_at,
    status: p.status,
    placed_by_caregiver: p.placed_by ? caregiverMap[p.placed_by] ?? null : null,
  }));

  // Group by date
  const groups: Record<string, DayGroup> = {};

  for (const v of visits) {
    const dk = dateKey(v.checked_in_at);
    if (!groups[dk]) {
      groups[dk] = {
        dateKey: dk,
        label: formatHebrewDate(v.checked_in_at),
        visits: [],
        completions: [],
        foodPacks: [],
      };
    }
    groups[dk].visits.push(v);
  }

  for (const c of completions) {
    const dk = dateKey(c.completed_at);
    if (!groups[dk]) {
      groups[dk] = {
        dateKey: dk,
        label: formatHebrewDate(c.completed_at),
        visits: [],
        completions: [],
        foodPacks: [],
      };
    }
    groups[dk].completions.push(c);
  }

  for (const fp of foodPacks) {
    const dk = dateKey(fp.defrosted_at);
    if (!groups[dk]) {
      groups[dk] = {
        dateKey: dk,
        label: formatHebrewDate(fp.defrosted_at),
        visits: [],
        completions: [],
        foodPacks: [],
      };
    }
    groups[dk].foodPacks.push(fp);
  }

  // Sort by date descending
  return Object.values(groups).sort((a, b) =>
    b.dateKey.localeCompare(a.dateKey)
  );
}

/* ---------- Component ---------- */

export default function HistorySection() {
  const [showHistory, setShowHistory] = useState(false);
  const [days, setDays] = useState<DayGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [daysLoaded, setDaysLoaded] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchHistory = useCallback(async (count: number) => {
    setLoading(true);
    setError(false);
    try {
      const result = await loadHistory(count);
      setDays(result);
      setDaysLoaded(count);
      // If we got fewer day-groups than we might expect, there may be no more
      // We'll keep "show more" available unless we loaded a huge range
      setHasMore(count < 90);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggle = useCallback(() => {
    setShowHistory((prev) => !prev);
    if (!showHistory && daysLoaded === 0) {
      fetchHistory(DAYS_PER_PAGE);
    }
  }, [showHistory, daysLoaded, fetchHistory]);

  const handleShowMore = useCallback(() => {
    fetchHistory(daysLoaded + DAYS_PER_PAGE);
  }, [daysLoaded, fetchHistory]);

  return (
    <div className="fade-in">
      {/* Toggle button */}
      <button
        onClick={handleToggle}
        className="w-full bg-white/80 hover:bg-white rounded-2xl p-4 card-shadow transition-colors duration-200 flex items-center justify-between"
      >
        <span className="text-sm font-medium text-gray-600">
          📜 היסטוריה
        </span>
        <span
          className={`text-gray-400 text-sm transition-transform duration-200 ${showHistory ? "rotate-90" : ""}`}
        >
          ‹
        </span>
      </button>

      {/* Expanded content */}
      {showHistory && (
        <div className="mt-3 space-y-3">
          {loading && days.length === 0 && (
            <div className="text-center py-6">
              <span className="text-2xl animate-bounce inline-block">🐱</span>
              <p className="text-gray-400 text-sm mt-1">טוען היסטוריה...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-4 text-red-400 text-sm">
              😿 שגיאה בטעינת היסטוריה
            </div>
          )}

          {!loading && !error && days.length === 0 && (
            <div className="text-center py-4 text-gray-400 text-sm">
              אין פעילות קודמת
            </div>
          )}

          {days.map((day) => (
            <div
              key={day.dateKey}
              className="bg-white/60 rounded-2xl p-3 card-shadow"
            >
              {/* Day header */}
              <h3 className="text-xs font-bold text-gray-500 mb-2 px-1">
                {day.label}
              </h3>

              <div className="space-y-1.5">
                {/* Visits */}
                {day.visits.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-1.5 text-xs text-gray-500"
                  >
                    <span>{v.caregivers.emoji}</span>
                    <span className="font-medium">{v.caregivers.name}</span>
                    <span className="text-gray-300">·</span>
                    <span className="text-gray-400">
                      📍 ביקור {formatTime(v.checked_in_at)}
                    </span>
                  </div>
                ))}

                {/* Task completions */}
                {day.completions.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-1.5 text-xs text-gray-500"
                  >
                    <span>{c.caregivers.emoji}</span>
                    <span className="font-medium">{c.caregivers.name}</span>
                    <span className="text-gray-300">·</span>
                    <span className="text-gray-400">
                      {c.tasks.icon} {c.tasks.name}{" "}
                      {formatTime(c.completed_at)}
                    </span>
                  </div>
                ))}

                {/* Food packs */}
                {day.foodPacks.map((fp) => (
                  <div
                    key={fp.id}
                    className="flex items-center gap-1.5 text-xs text-gray-500"
                  >
                    <span>🧊</span>
                    <span className="text-gray-400">
                      חבילה הופשרה
                      {fp.placed_by_caregiver
                        ? ` ע״י ${fp.placed_by_caregiver.name}`
                        : ""}{" "}
                      — {foodStatusHebrew[fp.status] ?? fp.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Show more button */}
          {hasMore && days.length > 0 && (
            <button
              onClick={handleShowMore}
              disabled={loading}
              className="w-full py-2.5 rounded-2xl text-sm font-medium text-pink-500 bg-pink-50/80 hover:bg-pink-100/80 transition-colors duration-200 card-shadow disabled:opacity-50"
            >
              {loading ? "טוען..." : "הצג עוד"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
