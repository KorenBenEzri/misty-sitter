"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Caregiver, ScheduledVisit } from "@/lib/types";

/* ---------- Constants ---------- */

/** Fixed trip range: August 1 – September 2, 2026 (inclusive, 33 days) */
const TRIP_START = new Date(2026, 7, 1); // Aug 1 2026
const TRIP_END = new Date(2026, 8, 2); // Sep 2 2026
const TOTAL_TRIP_DAYS = 33;

const HEBREW_DAY_NAMES = [
  "ראשון",
  "שני",
  "שלישי",
  "רביעי",
  "חמישי",
  "שישי",
  "שבת",
];

const HEBREW_DAY_ABBR = ["א", "ב", "ג", "ד", "ה", "ו", "שבת"];

/* ---------- Types ---------- */

interface ScheduledVisitWithCaregiver extends ScheduledVisit {
  caregiver: Caregiver;
}

interface DayInfo {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  dayName: string;
  dayAbbr: string;
  hebrewLabel: string; // "יום שלישי, 30 ביולי"
  dayNumber: number;
  visitors: ScheduledVisitWithCaregiver[];
  isBlocked: boolean;
  blockedBy: Caregiver | null; // who caused the block (visited day before)
  hasMe: boolean;
  myVisitId: string | null;
  isPast: boolean;
}

/* ---------- Helpers ---------- */

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatHebrewDate(date: Date): string {
  const dayName = HEBREW_DAY_NAMES[date.getDay()];
  const formatted = date.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
  });
  return `יום ${dayName}, ${formatted}`;
}

function generateTripDates(): Date[] {
  const dates: Date[] = [];
  const start = new Date(TRIP_START);
  start.setHours(0, 0, 0, 0);
  const end = new Date(TRIP_END);
  end.setHours(0, 0, 0, 0);
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

/** Pre-computed trip start as YYYY-MM-DD (module-level, never changes) */
const TRIP_START_STR = toDateStr(TRIP_START);

/* ---------- Data ---------- */

async function loadScheduledVisits(
  fromDate: string
): Promise<ScheduledVisitWithCaregiver[]> {
  // Load from one day before fromDate so we can compute blocked-day logic
  // (a visit on D blocks D+1, so we need D-1 visits to know if fromDate is blocked)
  const dayBefore = new Date(fromDate + "T00:00:00");
  dayBefore.setDate(dayBefore.getDate() - 1);
  const filterDate = toDateStr(dayBefore);

  const { data, error } = await getSupabase()
    .from("scheduled_visits")
    .select("*, caregiver:caregivers(*)")
    .gte("scheduled_date", filterDate)
    .order("scheduled_date");
  if (error) throw error;
  return (data ?? []) as unknown as ScheduledVisitWithCaregiver[];
}

/* ---------- Props ---------- */

interface ScheduleSectionProps {
  caregiverId: string | undefined;
}

/* ---------- Component ---------- */

export default function ScheduleSection({ caregiverId }: ScheduleSectionProps) {
  const [visits, setVisits] = useState<ScheduledVisitWithCaregiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const todayStr = useMemo(() => toDateStr(new Date()), []);

  const fetchVisits = useCallback(async () => {
    try {
      const data = await loadScheduledVisits(TRIP_START_STR);
      setVisits(data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadScheduledVisits(TRIP_START_STR)
      .then((data) => {
        if (cancelled) return;
        setVisits(data);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------- Build day info ---------- */

  const dates = generateTripDates();

  // Group visits by date
  const visitsByDate: Record<string, ScheduledVisitWithCaregiver[]> = {};
  for (const v of visits) {
    const key = v.scheduled_date;
    if (!visitsByDate[key]) visitsByDate[key] = [];
    visitsByDate[key].push(v);
  }

  // Build blocked set: for each visit on date D, D+1 is blocked
  // But if D+1 itself has a visit, it is NOT blocked (someone committed)
  const blockedDates: Record<string, Caregiver> = {};
  for (const v of visits) {
    const d = new Date(v.scheduled_date + "T00:00:00");
    d.setDate(d.getDate() + 1);
    const nextStr = toDateStr(d);
    // Only mark as blocked if that day doesn't have its own visits
    if (!visitsByDate[nextStr]) {
      blockedDates[nextStr] = v.caregiver;
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayInfos: DayInfo[] = dates.map((date) => {
    const dateStr = toDateStr(date);
    const dayVisitors = visitsByDate[dateStr] ?? [];
    const hasMe = dayVisitors.some((v) => v.caregiver_id === caregiverId);
    const myVisit = dayVisitors.find((v) => v.caregiver_id === caregiverId);
    const isBlocked =
      !!blockedDates[dateStr] && dayVisitors.length === 0;
    const isPast = date < today;

    return {
      date,
      dateStr,
      dayName: HEBREW_DAY_NAMES[date.getDay()],
      dayAbbr: HEBREW_DAY_ABBR[date.getDay()],
      hebrewLabel: formatHebrewDate(date),
      dayNumber: date.getDate(),
      visitors: dayVisitors,
      isBlocked,
      blockedBy: isBlocked ? blockedDates[dateStr] : null,
      hasMe,
      myVisitId: myVisit?.id ?? null,
      isPast,
    };
  });

  // Coverage stats — count against the full trip length
  const coveredDays = dayInfos.filter((d) => d.visitors.length > 0).length;
  const totalDays = TOTAL_TRIP_DAYS;
  const coveragePercent =
    totalDays > 0 ? Math.round((coveredDays / totalDays) * 100) : 0;

  // Separate past days from future/today for card rendering
  const futureDayInfos = dayInfos.filter((d) => !d.isPast);

  /* ---------- Actions ---------- */

  const handleSignUp = async (dateStr: string) => {
    if (!caregiverId || actionLoading) return;
    // Guard against signing up on a blocked day (stale UI or direct call)
    const dayInfo = dayInfos.find((d) => d.dateStr === dateStr);
    if (dayInfo?.isBlocked) return;
    setActionLoading(dateStr);
    try {
      const { error: insertError } = await getSupabase()
        .from("scheduled_visits")
        .insert({ caregiver_id: caregiverId, scheduled_date: dateStr });
      if (insertError) throw insertError;
      await fetchVisits();
    } catch (err) {
      console.error("Failed to sign up:", err);
      alert("לא הצליח להירשם. נסו שוב.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (visitId: string, dateStr: string) => {
    if (!caregiverId || actionLoading) return;
    setActionLoading(dateStr);
    try {
      const { error: deleteError } = await getSupabase()
        .from("scheduled_visits")
        .delete()
        .eq("id", visitId);
      if (deleteError) throw deleteError;
      await fetchVisits();
    } catch (err) {
      console.error("Failed to cancel:", err);
      alert("לא הצליח לבטל. נסו שוב.");
    } finally {
      setActionLoading(null);
    }
  };

  const scrollToCard = (dateStr: string) => {
    const el = cardRefs.current[dateStr];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  /* ---------- Render ---------- */

  if (loading) {
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 px-1">
          📅 לוח ביקורים
        </h2>
        <div className="bg-white rounded-2xl p-6 card-shadow text-center">
          <span className="text-2xl animate-bounce inline-block">🐱</span>
          <p className="text-gray-400 text-sm mt-1">טוען לוח ביקורים...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 px-1">
          📅 לוח ביקורים
        </h2>
        <div className="bg-white rounded-2xl p-4 card-shadow text-center text-red-400 text-sm">
          😿 שגיאה בטעינת לוח הביקורים
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 fade-in">
      <h2 className="text-sm font-semibold text-gray-500 px-1">
        📅 לוח ביקורים
      </h2>

      {/* Mini calendar strip */}
      <div className="bg-white rounded-2xl p-3 card-shadow overflow-x-auto">
        <div
          className="flex gap-1"
          style={{ minWidth: `${TOTAL_TRIP_DAYS * 44}px`, direction: "rtl" }}
        >
          {dayInfos.map((day) => {
            const firstVisitorEmoji =
              day.visitors.length > 0
                ? day.visitors[0].caregiver.emoji
                : null;
            const statusEmoji = day.isBlocked
              ? "🔒"
              : firstVisitorEmoji ?? "😿";
            const isToday = todayStr === day.dateStr;

            return (
              <button
                key={day.dateStr}
                onClick={() => !day.isPast && scrollToCard(day.dateStr)}
                disabled={day.isPast}
                className={`flex flex-col items-center min-w-[40px] px-1 py-1.5 rounded-xl transition-all duration-200 ${
                  day.isPast
                    ? "opacity-40 cursor-default"
                    : isToday
                      ? "bg-pink-100 border border-pink-300"
                      : day.hasMe
                        ? "bg-amber-50 border border-amber-200"
                        : "hover:bg-gray-50"
                }`}
              >
                <span className="text-[10px] text-gray-400 font-medium">
                  {day.dayAbbr}
                </span>
                <span className="text-sm my-0.5">
                  {day.visitors.length === 0 && !day.isBlocked
                    ? "·"
                    : statusEmoji}
                </span>
                <span
                  className={`text-xs font-medium ${day.isPast ? "text-gray-400" : isToday ? "text-pink-600" : "text-gray-600"}`}
                >
                  {day.dayNumber}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day cards (only today and future) */}
      <div className="space-y-3">
        {futureDayInfos.map((day) => {
          const isActioning = actionLoading === day.dateStr;

          // Blocked day
          if (day.isBlocked) {
            return (
              <div
                key={day.dateStr}
                ref={(el) => {
                  cardRefs.current[day.dateStr] = el;
                }}
                className="rounded-2xl p-3 card-shadow border border-gray-200 opacity-60"
                style={{
                  background:
                    "repeating-linear-gradient(45deg, #f9fafb, #f9fafb 10px, rgba(0,0,0,0.03) 10px, rgba(0,0,0,0.03) 20px)",
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🔒</span>
                  <span className="text-sm font-bold text-gray-400">
                    {day.hebrewLabel}
                  </span>
                </div>
                {day.blockedBy && (
                  <p className="text-xs text-gray-400 mt-1 me-6">
                    חסום — {day.blockedBy.name} {day.blockedBy.emoji} מגיע/ה
                    ביום הקודם
                  </p>
                )}
              </div>
            );
          }

          // Has visitors
          if (day.visitors.length > 0) {
            return (
              <div
                key={day.dateStr}
                ref={(el) => {
                  cardRefs.current[day.dateStr] = el;
                }}
                className={`bg-white rounded-2xl p-4 card-shadow transition-all duration-200 ${
                  day.hasMe
                    ? "border-e-4 border-amber-400"
                    : "border-e-4 border-pink-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">🟢</span>
                  <span className="text-lg font-bold text-gray-700">
                    {day.hebrewLabel}
                  </span>
                </div>

                {/* Visitor chips */}
                <div className="space-y-2 mb-3">
                  {day.visitors.map((v) => {
                    const isMe = v.caregiver_id === caregiverId;
                    return (
                      <div
                        key={v.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
                          isMe ? "bg-amber-50" : "bg-pink-50/60"
                        }`}
                      >
                        <span className="text-base">
                          {isMe ? "⭐" : v.caregiver.emoji}
                        </span>
                        <span className="text-base font-medium text-gray-700">
                          {v.caregiver.name}
                        </span>
                        {v.caregiver.phone_number && (
                          <a
                            href={`tel:${v.caregiver.phone_number}`}
                            className="text-base hover:scale-110 transition-transform"
                            aria-label={`התקשרו ל${v.caregiver.name}`}
                          >
                            📞
                          </a>
                        )}
                        {isMe && (
                          <button
                            onClick={() => handleCancel(v.id, day.dateStr)}
                            disabled={isActioning}
                            className="me-auto text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
                          >
                            ביטול ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add me button (if not already signed up) */}
                {caregiverId && !day.hasMe && (
                  <button
                    onClick={() => handleSignUp(day.dateStr)}
                    disabled={isActioning}
                    className="w-full py-2 rounded-xl border-2 border-dashed border-pink-200 text-sm text-pink-500 hover:bg-pink-50 transition-colors disabled:opacity-50"
                  >
                    {isActioning ? "נרשם..." : "+ גם אני! 🐾"}
                  </button>
                )}
              </div>
            );
          }

          // Empty + available
          return (
            <div
              key={day.dateStr}
              ref={(el) => {
                cardRefs.current[day.dateStr] = el;
              }}
              className="bg-white rounded-2xl p-4 card-shadow border-2 border-dashed border-gray-200 transition-all duration-200"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">⚪</span>
                <span className="text-lg font-bold text-gray-700">
                  {day.hebrewLabel}
                </span>
              </div>

              <p className="text-sm text-gray-400 text-center mb-3">
                😿 אף אחד עדיין...
              </p>

              {caregiverId && (
                <button
                  onClick={() => handleSignUp(day.dateStr)}
                  disabled={isActioning}
                  className="w-full py-3 rounded-xl bg-gradient-to-l from-pink-400 to-pink-500 text-white font-semibold text-sm hover:from-pink-500 hover:to-pink-600 active:scale-[0.98] transition-all card-shadow disabled:opacity-50"
                >
                  {isActioning ? "נרשם..." : "אני אבוא! 🐾"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Coverage summary bar */}
      <div className="bg-white rounded-2xl p-4 card-shadow">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">🐱</span>
          <span className="text-sm font-medium text-gray-600">
            {coveredDays} מתוך {totalDays} ימים מכוסים
          </span>
          <span className="me-auto text-xs text-gray-400">
            {coveragePercent}%
          </span>
        </div>
        <div className="w-full bg-pink-100 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-l from-pink-400 to-lavender-300 h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${coveragePercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
