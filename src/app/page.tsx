"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Caregiver, Task, TaskCompletion, Visit, FoodPack } from "@/lib/types";
import { relativeTime, formatTime, todayStart } from "@/lib/timeUtils";
import Navigation from "./components/Navigation";
import CaregiverPicker from "./components/CaregiverPicker";

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
  const placed = new Date(pack.defrosted_at);
  const elapsed = (now.getTime() - placed.getTime()) / (1000 * 60 * 60);
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
      message: "אל תשתמשו! החליפו מיד!",
      hoursLeft: 0,
    };
  }
  // > 3 days elapsed (72h) → Getting old
  if (elapsed >= 48) {
    return {
      status: "old",
      label: "מתיישן",
      emoji: "🟠",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-200",
      message: "הכינו חבילה חדשה!",
      hoursLeft,
    };
  }
  // > 1 day elapsed (24h) → OK
  if (elapsed >= 24) {
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
  // < 1 day → Fresh
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

  const [tasksRes, completionsRes, visitsRes] = await Promise.all([
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
  ]);

  // Load current food pack
  const { data: activePacks } = await supabase
    .from("food_packs")
    .select("*")
    .in("status", ["defrosting", "ready"])
    .order("defrosted_at", { ascending: false })
    .limit(1);

  let currentPack: FoodPackWithCaregiver | null = null;
  if (activePacks && activePacks.length > 0) {
    const pack = activePacks[0];
    let placedByCaregiver: Caregiver | null = null;
    if (pack.placed_by) {
      const { data } = await supabase
        .from("caregivers")
        .select("*")
        .eq("id", pack.placed_by)
        .single();
      placedByCaregiver = data;
    }
    currentPack = {
      ...pack,
      placed_by_caregiver: placedByCaregiver,
    } as FoodPackWithCaregiver;
  }

  return {
    tasks: (tasksRes.data ?? []) as Task[],
    completions: (completionsRes.data ?? []) as CompletionWithCaregiver[],
    visits: (visitsRes.data ?? []) as (Visit & { caregivers: Caregiver })[],
    currentPack,
  };
}

export default function Home() {
  const [caregiver, setCaregiver] = useState<Caregiver | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<CompletionWithCaregiver[]>([]);
  const [todayVisits, setTodayVisits] = useState<
    (Visit & { caregivers: Caregiver })[]
  >([]);
  const [currentPack, setCurrentPack] =
    useState<FoodPackWithCaregiver | null>(null);
  const [celebratingTask, setCelebratingTask] = useState<string | null>(null);
  const [defrosting, setDefrosting] = useState(false);
  const [justDefrosted, setJustDefrosted] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadDashboard()
      .then((data) => {
        if (cancelled) return;
        setTasks(data.tasks);
        setCompletions(data.completions);
        setTodayVisits(data.visits);
        setCurrentPack(data.currentPack);
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

  // Auto check-in: insert a visit if caregiver hasn't checked in today
  const ensureCheckedIn = useCallback(
    async (cg: Caregiver) => {
      const alreadyVisited = todayVisits.some(
        (v) => v.caregiver_id === cg.id
      );
      if (alreadyVisited) return;
      try {
        await getSupabase()
          .from("visits")
          .insert({ caregiver_id: cg.id });
      } catch {
        // Silent — visit logging is best-effort
      }
    },
    [todayVisits]
  );

  const handleToggleTask = async (taskId: string) => {
    if (!caregiver) return;

    const existing = completions.find(
      (c) => c.task_id === taskId && c.caregiver_id === caregiver.id
    );

    try {
      if (existing) {
        const { error } = await getSupabase()
          .from("task_completions")
          .delete()
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        // Auto check-in on first task completion
        await ensureCheckedIn(caregiver);

        const { error } = await getSupabase()
          .from("task_completions")
          .insert({ task_id: taskId, caregiver_id: caregiver.id });
        if (error) throw error;
        setCelebratingTask(taskId);
        setTimeout(() => setCelebratingTask(null), 600);
      }
      refresh();
    } catch (err) {
      console.error("Failed to toggle task:", err);
      alert("משהו השתבש בעדכון המשימה. נסו שוב.");
      refresh();
    }
  };

  const handleDefrost = async () => {
    if (!caregiver || defrosting) return;
    setDefrosting(true);

    try {
      // Auto check-in
      await ensureCheckedIn(caregiver);

      // Mark current pack as replaced
      if (currentPack) {
        const { error: updateError } = await getSupabase()
          .from("food_packs")
          .update({
            status: "replaced",
            replaced_by: caregiver.id,
            replaced_at: new Date().toISOString(),
          })
          .eq("id", currentPack.id);
        if (updateError) throw updateError;
      }

      // Create new pack
      const { error: insertError } = await getSupabase()
        .from("food_packs")
        .insert({
          placed_by: caregiver.id,
          label: "חבילת אוכל טבעי",
        });
      if (insertError) throw insertError;

      setJustDefrosted(true);
      setTimeout(() => setJustDefrosted(false), 2000);
      refresh();
    } catch (err) {
      console.error("Failed to defrost new pack:", err);
      alert("משהו השתבש ברישום החבילה החדשה. נסו שוב.");
    } finally {
      setDefrosting(false);
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

  const completedCount = tasks.filter((t) => isCompletedByAnyone(t.id)).length;
  const totalTasks = tasks.length;
  const progressPercent =
    totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const foodStatus = currentPack ? getFoodStatus(currentPack) : null;

  return (
    <div className="min-h-full paw-bg pb-nav">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-pink-100">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">
              🐱 השומרים של מיסטי
            </h1>
            <p className="text-xs text-gray-400">מעקב טיפול בחתולה</p>
          </div>
          <CaregiverPicker onSelect={setCaregiver} selected={caregiver} />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
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
                          disabled={!caregiver}
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

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{task.icon}</span>
                            <span
                              className={`text-sm font-medium ${doneByAnyone ? "text-gray-400 line-through" : "text-gray-800"}`}
                            >
                              {task.name}
                            </span>
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
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500 px-1">
                🍖 מצב חבילת אוכל
              </h2>

              {currentPack && foodStatus ? (
                <div
                  className={`rounded-2xl p-4 card-shadow border-2 ${foodStatus.bgColor} ${foodStatus.borderColor} fade-in`}
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
                            width: `${Math.max(0, Math.min(100, (foodStatus.hoursLeft / 84) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-4 card-shadow text-center fade-in">
                  <p className="text-2xl mb-1">🧊</p>
                  <p className="text-gray-500 text-sm">אין חבילת אוכל פעילה</p>
                </div>
              )}

              {/* Defrost button */}
              {caregiver && (
                <button
                  onClick={handleDefrost}
                  disabled={defrosting}
                  className={`w-full py-3 rounded-2xl font-semibold text-sm transition-all duration-300 card-shadow ${
                    justDefrosted
                      ? "bg-green-100 text-green-700"
                      : "bg-gradient-to-l from-pink-400 to-pink-500 text-white hover:from-pink-500 hover:to-pink-600 active:scale-[0.98]"
                  }`}
                >
                  {justDefrosted
                    ? "✅ חבילה חדשה נרשמה!"
                    : "🧊 הוצאתי חבילה חדשה מהמקפיא"}
                </button>
              )}
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
          </>
        )}
      </main>

      <Navigation />
    </div>
  );
}
