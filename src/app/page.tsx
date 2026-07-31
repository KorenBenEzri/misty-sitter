"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSupabase, getStorageUrl } from "@/lib/supabase";
import type { Caregiver, Task, TaskCompletion, Visit, FoodPack, Instruction } from "@/lib/types";
import { relativeTime, formatTime, todayStart } from "@/lib/timeUtils";
import Link from "next/link";
import CaregiverPicker from "./components/CaregiverPicker";
import HistorySection from "./components/HistorySection";
import ScheduleSection from "./components/ScheduleSection";

interface CompletionWithCaregiver extends TaskCompletion {
  caregivers: Caregiver;
}

interface FoodPackWithCaregiver extends FoodPack {
  placed_by_caregiver: Caregiver | null;
}

type FreshStatus = "fresh" | "ok" | "old" | "expired";

function getFoodStatus(pack: FoodPack): {
  status: FreshStatus;
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
  borderColor: string;
  message: string;
  hoursLeft: number;
} {
  const now = new Date();
  const expires = new Date(pack.expires_at);
  const hoursLeft = (expires.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursLeft <= 0 || pack.status === "expired") {
    return {
      status: "expired",
      label: "פג תוקף!",
      emoji: "🔴",
      color: "text-red-600",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      message: "החבילה פגה! יש להשליך",
      hoursLeft: 0,
    };
  }
  // Less than 18h left → Getting old (safety margin over 12h thaw time)
  if (hoursLeft < 18) {
    return {
      status: "old",
      label: "מתיישן",
      emoji: "🟠",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-200",
      message: "נא להוציא חבילה חדשה להפשרה במקרר",
      hoursLeft,
    };
  }
  // Less than 44h left → OK
  if (hoursLeft < 44) {
    return {
      status: "ok",
      label: "בסדר",
      emoji: "🟡",
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
      message: "עדיין טוב, שימו עין",
      hoursLeft,
    };
  }
  // 44+ hours left → Fresh
  return {
    status: "fresh",
    label: "טרי",
    emoji: "🟢",
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    message: "טרי ומוכן!",
    hoursLeft,
  };
}

function getThawStatus(pack: FoodPack): {
  isReady: boolean;
  hoursLeft: number;
  message: string;
} {
  if (!pack.thaw_until)
    return { isReady: true, hoursLeft: 0, message: "מוכן" };
  const thawEnd = new Date(pack.thaw_until).getTime();
  const now = Date.now();
  const rawHoursLeft = (thawEnd - now) / (1000 * 60 * 60);
  if (rawHoursLeft <= 0)
    return { isReady: true, hoursLeft: 0, message: "מוכנה לשימוש!" };
  return {
    isReady: false,
    hoursLeft: rawHoursLeft,
    message: `עוד ${formatHoursLeft(rawHoursLeft)} להפשרה`,
  };
}

function formatHoursLeft(hours: number): string {
  if (hours <= 0) return "פג תוקף";
  if (hours < 1) return `נשארו ${Math.round(hours * 60)} דקות`;
  if (hours < 24) return `נשארו ${Math.round(hours)} שעות`;
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  return `נשארו ${days} ימים ${remainingHours} שע׳`;
}

async function loadDashboard() {
  const supabase = getSupabase();
  const today = todayStart();

  const [tasksRes, completionsRes, visitsRes, instructionsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("task_completions")
      .select("*, caregivers(*)")
      .gte("completed_at", today)
      .order("completed_at", { ascending: false }),
    supabase
      .from("visits")
      .select("*, caregivers(*)")
      .gte("checked_in_at", today)
      .order("checked_in_at", { ascending: false }),
    supabase
      .from("instructions")
      .select("*")
      .not("task_id", "is", null),
  ]);

  // Load active food packs (ready + thawing)
  const { data: foodData } = await supabase
    .from("food_packs")
    .select("*")
    .in("status", ["thawing", "ready"])
    .order("defrosted_at", { ascending: false });

  // Resolve caregiver for each pack
  async function resolvePack(
    pack: FoodPack
  ): Promise<FoodPackWithCaregiver> {
    let placedByCaregiver: Caregiver | null = null;
    if (pack.placed_by) {
      const { data } = await supabase
        .from("caregivers")
        .select("*")
        .eq("id", pack.placed_by)
        .single();
      placedByCaregiver = data;
    }
    return { ...pack, placed_by_caregiver: placedByCaregiver };
  }

  const rawPacks = (foodData ?? []) as FoodPack[];

  // Auto-transition: if a thawing pack's thaw_until has passed, mark it ready
  // Create a new array to avoid mutating the original Supabase response objects.
  const packs = await Promise.all(
    rawPacks.map(async (pack) => {
      if (
        pack.status === "thawing" &&
        pack.thaw_until &&
        new Date(pack.thaw_until) <= new Date()
      ) {
        await supabase
          .from("food_packs")
          .update({ status: "ready" })
          .eq("id", pack.id);
        return { ...pack, status: "ready" as const };
      }
      return pack;
    })
  );

  const readyPackRaw = packs.find((p) => p.status === "ready") ?? null;
  const thawingPackRaw = packs.find((p) => p.status === "thawing") ?? null;

  const readyPack = readyPackRaw ? await resolvePack(readyPackRaw) : null;
  const thawingPack = thawingPackRaw
    ? await resolvePack(thawingPackRaw)
    : null;

  return {
    tasks: (tasksRes.data ?? []) as Task[],
    completions: (completionsRes.data ?? []) as CompletionWithCaregiver[],
    visits: (visitsRes.data ?? []) as (Visit & { caregivers: Caregiver })[],
    readyPack,
    thawingPack,
    taskInstructions: (instructionsRes.data ?? []) as Instruction[],
  };
}

export default function Home() {
  const [caregiver, setCaregiver] = useState<Caregiver | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<CompletionWithCaregiver[]>([]);
  const [todayVisits, setTodayVisits] = useState<
    (Visit & { caregivers: Caregiver })[]
  >([]);
  const [readyPack, setReadyPack] =
    useState<FoodPackWithCaregiver | null>(null);
  const [thawingPack, setThawingPack] =
    useState<FoodPackWithCaregiver | null>(null);
  const [celebratingTask, setCelebratingTask] = useState<string | null>(null);
  const [savingTasks, setSavingTasks] = useState<Set<string>>(new Set());
  const [savingFood, setSavingFood] = useState(false);
  const [justSavedFood, setJustSavedFood] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [taskInstructions, setTaskInstructions] = useState<Instruction[]>([]);
  const [expandedInstructions, setExpandedInstructions] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    loadDashboard()
      .then((data) => {
        if (cancelled) return;
        setTasks(data.tasks);
        setCompletions(data.completions);
        setTodayVisits(data.visits);
        setReadyPack(data.readyPack);
        setThawingPack(data.thawingPack);
        setTaskInstructions(data.taskInstructions);
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
  }, [refreshKey]);

  // Refresh food status every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey((k) => k + 1);
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const refresh = () => {
    setLoading(true);
    setError(false);
    setRefreshKey((k) => k + 1);
  };

  // Silent refresh: re-fetch data without showing full loading screen
  const silentRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  // Monotonic counter for temp IDs in optimistic updates
  const tempIdCounter = useRef(0);

  // Track which caregivers we've already checked in (or are checking in)
  // to avoid duplicate inserts from rapid concurrent actions.
  const checkedInRef = useRef<Set<string>>(new Set());

  // Reset tracked check-ins when todayVisits refreshes from server
  useEffect(() => {
    const visited = new Set(todayVisits.map((v) => v.caregiver_id));
    checkedInRef.current = visited;
  }, [todayVisits]);

  // Auto check-in: insert a visit if caregiver hasn't checked in today
  const ensureCheckedIn = useCallback(async (cg: Caregiver) => {
    if (checkedInRef.current.has(cg.id)) return;
    // Mark immediately to prevent concurrent duplicates
    checkedInRef.current.add(cg.id);
    try {
      await getSupabase()
        .from("visits")
        .insert({ caregiver_id: cg.id });
    } catch {
      // Roll back on failure so it can be retried
      checkedInRef.current.delete(cg.id);
    }
  }, []);

  const handleToggleTask = async (taskId: string) => {
    if (!caregiver) return;

    const existing = completions.find(
      (c) => c.task_id === taskId && c.caregiver_id === caregiver.id
    );

    // Snapshot this specific toggle for rollback (add or remove)
    const wasAdding = !existing;
    const removedEntry = existing ?? null;

    setSavingTasks((prev) => new Set(prev).add(taskId));

    if (existing) {
      // Remove completion optimistically
      setCompletions((prev) =>
        prev.filter((c) => c.id !== existing.id)
      );
    } else {
      // Add completion optimistically with a temp entry
      const tempCompletion: CompletionWithCaregiver = {
        id: `temp-${++tempIdCounter.current}`,
        task_id: taskId,
        caregiver_id: caregiver.id,
        completed_at: todayStart(),
        notes: null,
        caregivers: caregiver,
      };
      setCompletions((prev) => [tempCompletion, ...prev]);
      setCelebratingTask(taskId);
      setTimeout(() => setCelebratingTask(null), 600);
    }

    try {
      if (existing) {
        // If the entry has a temp ID, it hasn't been persisted yet — delete
        // by task_id + caregiver_id so we hit the real server-side row.
        const isTempId = existing.id.startsWith("temp-");
        const query = getSupabase()
          .from("task_completions")
          .delete();

        const { error: delError } = isTempId
          ? await query
              .eq("task_id", taskId)
              .eq("caregiver_id", caregiver.id)
              .gte("completed_at", todayStart())
          : await query.eq("id", existing.id);
        if (delError) throw delError;
      } else {
        // Auto check-in on first task completion
        await ensureCheckedIn(caregiver);

        const { error: insError } = await getSupabase()
          .from("task_completions")
          .insert({ task_id: taskId, caregiver_id: caregiver.id });
        if (insError) throw insError;
      }
      // Silently sync with server to get real IDs
      silentRefresh();
    } catch (err) {
      console.error("Failed to toggle task:", err);
      // Revert only this toggle's optimistic update using functional updater
      // to avoid clobbering concurrent toggles on other tasks.
      setCompletions((prev) => {
        if (wasAdding) {
          // We added a temp entry — remove it
          return prev.filter(
            (c) =>
              !(c.task_id === taskId && c.caregiver_id === caregiver.id)
          );
        }
        // We removed an entry — re-add it
        return removedEntry ? [removedEntry, ...prev] : prev;
      });
      alert("משהו השתבש בעדכון המשימה. נסו שוב.");
    } finally {
      setSavingTasks((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const handleStartThawing = async () => {
    if (!caregiver || savingFood) return;
    setSavingFood(true);

    try {
      // Auto check-in
      await ensureCheckedIn(caregiver);

      const supabase = getSupabase();

      // If there's an existing ready pack, mark it as replaced first
      if (readyPack) {
        const { error: replaceError } = await supabase
          .from("food_packs")
          .update({
            status: "replaced",
            replaced_by: caregiver.id,
            replaced_at: new Date().toISOString(),
          })
          .eq("id", readyPack.id);
        if (replaceError) throw replaceError;
      }

      const now = Date.now();
      const thawDurationMs = 12 * 60 * 60 * 1000; // 12 hours
      const expiryDurationMs = 66 * 60 * 60 * 1000; // 66 hours after thaw

      // Create thawing pack — expires_at starts counting AFTER thaw completes
      const { error: insertError } = await supabase
        .from("food_packs")
        .insert({
          placed_by: caregiver.id,
          label: "חבילת אוכל טבעי",
          status: "thawing",
          thaw_until: new Date(now + thawDurationMs).toISOString(),
          expires_at: new Date(
            now + thawDurationMs + expiryDurationMs
          ).toISOString(),
        });
      if (insertError) throw insertError;

      setJustSavedFood(true);
      setTimeout(() => setJustSavedFood(false), 2000);
      refresh();
    } catch (err) {
      console.error("Failed to start thawing pack:", err);
      alert("משהו השתבש ברישום החבילה החדשה. נסו שוב.");
    } finally {
      setSavingFood(false);
    }
  };

  const handleDiscardExpired = async () => {
    if (!caregiver || savingFood || !readyPack) return;
    setSavingFood(true);

    try {
      // Auto check-in
      await ensureCheckedIn(caregiver);

      const { error: updateError } = await getSupabase()
        .from("food_packs")
        .update({
          status: "replaced",
          replaced_by: caregiver.id,
          replaced_at: new Date().toISOString(),
        })
        .eq("id", readyPack.id);
      if (updateError) throw updateError;

      refresh();
    } catch (err) {
      console.error("Failed to discard expired pack:", err);
      alert("משהו השתבש בעדכון. נסו שוב.");
    } finally {
      setSavingFood(false);
    }
  };

  const isCompletedByMe = (taskId: string) =>
    completions.some(
      (c) => c.task_id === taskId && c.caregiver_id === caregiver?.id
    );

  const isCompletedByAnyone = (taskId: string) =>
    completions.some((c) => c.task_id === taskId);

  const getTaskCompletions = (taskId: string) =>
    completions.filter((c) => c.task_id === taskId);

  const getTaskInstruction = (taskId: string) =>
    taskInstructions.find((i) => i.task_id === taskId) ?? null;

  const toggleInstruction = (taskId: string) => {
    setExpandedInstructions((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const completedCount = tasks.filter((t) => isCompletedByAnyone(t.id)).length;
  const totalTasks = tasks.length;
  const progressPercent =
    totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const foodStatus = readyPack ? getFoodStatus(readyPack) : null;
  const thawStatus = thawingPack ? getThawStatus(thawingPack) : null;

  return (
    <div className="min-h-full paw-bg">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-pink-100">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">
              🐱 השומרים של מיסטי
            </h1>
            <p className="text-xs text-gray-400">מעקב טיפול בחתולה</p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/upload" className="text-pink-400 hover:text-pink-500 text-xl" title="העלאת סרטון">📹</a>
            <a href="/instructions" className="text-pink-400 hover:text-pink-500 text-xl" title="הוראות טיפול">📋</a>
            <CaregiverPicker onSelect={setCaregiver} selected={caregiver} />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Instructions link at top */}
        <div className="flex justify-center">
          <Link
            href="/instructions"
            className="inline-flex items-center gap-1.5 text-sm text-pink-400 hover:text-pink-500 transition-colors"
          >
            📋 הוראות טיפול
          </Link>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="text-4xl animate-bounce">🐱</span>
            <p className="text-gray-400 mt-2">טוען...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="text-center py-10 text-red-400">
            😿 שגיאה בטעינה. נסו לרענן.
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Progress */}
            {totalTasks > 0 && (
              <div className="bg-white rounded-2xl p-4 card-shadow fade-in">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">
                    ההתקדמות של היום
                  </span>
                  <span className="text-sm font-bold text-pink-500">
                    {completedCount}/{totalTasks}
                  </span>
                </div>
                <div className="w-full bg-pink-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-l from-pink-400 to-lavender-300 h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {completedCount === totalTasks && totalTasks > 0 && (
                  <p className="text-center text-sm mt-2 text-pink-500 font-medium">
                    🎉 כל המשימות הושלמו! מיסטי שמחה! 🐱
                  </p>
                )}
              </div>
            )}

            {/* Task checklist */}
            {tasks.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-500 px-1">
                  🐾 המשימות של היום
                </h2>
                {tasks.map((task) => {
                  const doneByMe = isCompletedByMe(task.id);
                  const doneByAnyone = isCompletedByAnyone(task.id);
                  const taskCompletions = getTaskCompletions(task.id);
                  const isCelebrating = celebratingTask === task.id;
                  const isSaving = savingTasks.has(task.id);

                  return (
                    <div
                      key={task.id}
                      className={`relative bg-white rounded-2xl p-4 card-shadow transition-all duration-200 ${
                        isCelebrating ? "celebrate" : ""
                      } ${doneByAnyone ? "border-e-4 border-green-300" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => handleToggleTask(task.id)}
                          disabled={!caregiver || isSaving}
                          role="checkbox"
                          aria-checked={doneByMe}
                          aria-label={task.name}
                          className={`mt-0.5 flex-shrink-0 w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all duration-200 ${
                            doneByMe
                              ? "bg-green-400 border-green-400 text-white"
                              : doneByAnyone
                                ? "bg-green-100 border-green-200 text-green-400"
                                : "border-pink-200 hover:border-pink-400"
                          } ${!caregiver ? "opacity-50 cursor-not-allowed" : "cursor-pointer active:scale-90"}`}
                        >
                          {(doneByMe || doneByAnyone) && (
                            <span className="text-sm">✓</span>
                          )}
                        </button>
                        {isSaving && (
                          <span className="cat-saving text-sm flex-shrink-0" aria-label="שומר...">🐱</span>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{task.icon}</span>
                            <span
                              className={`text-sm font-medium ${doneByAnyone ? "text-gray-400 line-through" : "text-gray-800"}`}
                            >
                              {task.name}
                            </span>
                            {getTaskInstruction(task.id) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleInstruction(task.id);
                                }}
                                className="text-sm opacity-60 hover:opacity-100 transition-opacity"
                                aria-label="הוראות"
                                title="הוראות"
                              >
                                ℹ️
                              </button>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-xs text-gray-400 mt-0.5 ms-6">
                              {task.description}
                            </p>
                          )}

                          {/* Show who completed */}
                          {taskCompletions.length > 0 && (
                            <div className="mt-2 ms-6 space-y-1">
                              {taskCompletions.map((tc) => (
                                <p
                                  key={tc.id}
                                  className="text-xs text-gray-400 flex items-center gap-1"
                                >
                                  <span>{tc.caregivers.emoji}</span>
                                  <span>
                                    הושלם ע״י {tc.caregivers.name}
                                  </span>
                                  <span className="text-gray-300">·</span>
                                  <span>{formatTime(tc.completed_at)}</span>
                                </p>
                              ))}
                            </div>
                          )}

                          {/* Inline instruction panel */}
                          {expandedInstructions.has(task.id) && (() => {
                            const instr = getTaskInstruction(task.id);
                            if (!instr) return null;
                            const instrVideoUrl = instr.video_path
                              ? getStorageUrl("instruction-videos", instr.video_path)
                              : instr.video_url;
                            return (
                              <div className="mt-3 ms-6 p-3 bg-pink-50/50 rounded-xl animate-slide-up">
                                {/* Steps */}
                                {instr.steps && instr.steps.length > 0 && (
                                  <ol className="space-y-1 text-xs text-gray-600 list-decimal list-inside mb-2">
                                    {instr.steps.map((step, i) => (
                                      <li key={i} className="leading-relaxed">
                                        {step}
                                      </li>
                                    ))}
                                  </ol>
                                )}
                                {/* Fallback to description if no steps */}
                                {(!instr.steps || instr.steps.length === 0) && instr.description && (
                                  <p className="text-xs text-gray-500 whitespace-pre-line mb-2">
                                    {instr.description}
                                  </p>
                                )}
                                {/* Video link */}
                                {instrVideoUrl && (
                                  <Link
                                    href="/instructions"
                                    className="inline-flex items-center gap-1 text-xs text-pink-400 hover:text-pink-500 transition-colors"
                                  >
                                    📹 וידאו
                                  </Link>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {isCelebrating && (
                          <span className="absolute -top-2 -start-2 text-lg sparkle">
                            ✨
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Food Pack Status */}
            <div className="bg-white rounded-2xl p-4 card-shadow fade-in space-y-3">
              <h2 className="text-sm font-semibold text-gray-500">
                🍖 מצב חבילת אוכל
              </h2>

              {/* Ready pack */}
              {readyPack && foodStatus ? (
                <div
                  className={`rounded-xl p-4 border-2 ${foodStatus.bgColor} ${foodStatus.borderColor}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-3xl ${foodStatus.status === "expired" || foodStatus.status === "old" ? "pulse-soft" : ""}`}
                    >
                      {foodStatus.emoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${foodStatus.color}`}>
                          {foodStatus.label}
                        </span>
                        <span className={`text-xs ${foodStatus.color} opacity-75`}>
                          {foodStatus.hoursLeft > 0
                            ? formatHoursLeft(foodStatus.hoursLeft)
                            : "פג תוקף!"}
                        </span>
                      </div>
                      <p className={`text-xs mt-0.5 ${foodStatus.color} opacity-75`}>
                        {foodStatus.message}
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {foodStatus.status !== "expired" && (
                    <div className="mt-3">
                      <div className="w-full bg-white/60 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            foodStatus.status === "fresh"
                              ? "bg-green-400"
                              : foodStatus.status === "ok"
                                ? "bg-yellow-400"
                                : "bg-orange-400"
                          }`}
                          style={{
                            width: `${Math.max(0, Math.min(100, (foodStatus.hoursLeft / 66) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Expired: discard button */}
                  {foodStatus.status === "expired" && caregiver && (
                    <button
                      onClick={handleDiscardExpired}
                      disabled={savingFood}
                      className="w-full mt-3 py-2.5 rounded-2xl font-semibold text-sm bg-red-100 text-red-700 hover:bg-red-200 transition-colors duration-200 card-shadow active:scale-[0.98]"
                    >
                      🗑️ השלכתי את החבילה
                    </button>
                  )}

                  {/* Old + no thawing pack: defrost reminder */}
                  {foodStatus.status === "old" && !thawingPack && (
                    <div className="mt-3 rounded-lg p-2.5 bg-yellow-100 border border-yellow-300">
                      <p className="text-xs font-medium text-yellow-800 text-center">
                        ⏰ נא להוציא חבילה חדשה להפשרה במקרר
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl p-4 bg-gray-50 text-center">
                  <p className="text-2xl mb-1">🧊</p>
                  <p className="text-gray-500 text-sm">אין חבילת אוכל פעילה</p>
                </div>
              )}

              {/* Thawing pack */}
              {thawingPack && thawStatus && (
                <div
                  className={`rounded-xl p-4 border-2 ${
                    thawStatus.isReady
                      ? "bg-green-50 border-green-200"
                      : "bg-blue-50 border-blue-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">
                      {thawStatus.isReady ? "✅" : "🧊"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span
                        className={`text-sm font-bold ${thawStatus.isReady ? "text-green-600" : "text-blue-600"}`}
                      >
                        {thawStatus.isReady
                          ? "ההפשרה הושלמה — מוכנה לשימוש"
                          : "חבילה בהפשרה"}
                      </span>
                      {!thawStatus.isReady && (
                        <p className="text-xs mt-0.5 text-blue-600 opacity-75">
                          {thawStatus.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Start thawing button — only when no thawing pack exists */}
              {caregiver && !thawingPack && (
                <button
                  onClick={handleStartThawing}
                  disabled={savingFood}
                  className={`w-full py-3 rounded-2xl font-semibold text-sm transition-all duration-300 card-shadow ${
                    justSavedFood
                      ? "bg-green-100 text-green-700"
                      : "bg-gradient-to-l from-pink-400 to-pink-500 text-white hover:from-pink-500 hover:to-pink-600 active:scale-[0.98]"
                  }`}
                >
                  {justSavedFood
                    ? "✅ חבילה חדשה נרשמה!"
                    : "🧊 הוצאתי חבילה להפשרה"}
                </button>
              )}
            </div>

            {/* Divider between food & schedule */}
            <div className="flex items-center gap-3 my-6" aria-hidden="true">
              <div className="flex-1 h-px bg-gradient-to-l from-pink-200 to-transparent"></div>
              <span className="text-2xl">🐾</span>
              <div className="flex-1 h-px bg-gradient-to-r from-pink-200 to-transparent"></div>
            </div>

            {/* Schedule calendar */}
            <ScheduleSection caregiverId={caregiver?.id} />

            {/* Divider between schedule & activity */}
            <div className="flex items-center gap-3 my-6" aria-hidden="true">
              <div className="flex-1 h-px bg-gradient-to-l from-pink-200 to-transparent"></div>
              <span className="text-2xl">🐾</span>
              <div className="flex-1 h-px bg-gradient-to-r from-pink-200 to-transparent"></div>
            </div>

            {/* Today's visits summary */}
            {todayVisits.length > 0 && (
              <div className="bg-lavender-50 rounded-2xl p-4 card-shadow fade-in">
                <h3 className="text-sm font-semibold text-lavender-300 mb-3 flex items-center gap-1">
                  <span>📍</span> הביקורים של היום
                </h3>
                <div className="space-y-2">
                  {todayVisits.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center gap-2 text-sm text-gray-600"
                    >
                      <span>{v.caregivers.emoji}</span>
                      <span className="font-medium">{v.caregivers.name}</span>
                      <span className="text-gray-300">·</span>
                      <span className="text-gray-400">
                        {relativeTime(v.checked_in_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History section */}
            <HistorySection />

            {/* Instructions link */}
            <Link
              href="/instructions"
              className="block bg-pink-50/80 hover:bg-pink-100/80 rounded-2xl p-4 card-shadow fade-in transition-colors duration-200"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">
                  📋 הוראות טיפול במיסטי
                </span>
                <span className="text-gray-400 text-sm">‹</span>
              </div>
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
