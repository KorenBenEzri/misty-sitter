"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Caregiver, Task, TaskCompletion, Visit } from "@/lib/types";
import { relativeTime, formatTime, todayStart } from "@/lib/timeUtils";
import Navigation from "./components/Navigation";
import CaregiverPicker from "./components/CaregiverPicker";

interface CompletionWithCaregiver extends TaskCompletion {
  caregivers: Caregiver;
}

async function loadDashboard() {
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

  return {
    tasks: (tasksRes.data ?? []) as Task[],
    completions: (completionsRes.data ?? []) as CompletionWithCaregiver[],
    visits: (visitsRes.data ?? []) as (Visit & { caregivers: Caregiver })[],
  };
}

export default function Home() {
  const [caregiver, setCaregiver] = useState<Caregiver | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<CompletionWithCaregiver[]>([]);
  const [todayVisits, setTodayVisits] = useState<
    (Visit & { caregivers: Caregiver })[]
  >([]);
  const [celebratingTask, setCelebratingTask] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [justCheckedIn, setJustCheckedIn] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadDashboard().then((data) => {
      if (cancelled) return;
      setTasks(data.tasks);
      setCompletions(data.completions);
      setTodayVisits(data.visits);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const handleCheckIn = async () => {
    if (!caregiver || checkingIn) return;
    setCheckingIn(true);
    await supabase.from("visits").insert({ caregiver_id: caregiver.id });
    setJustCheckedIn(true);
    setTimeout(() => setJustCheckedIn(false), 2000);
    setCheckingIn(false);
    refresh();
  };

  const handleToggleTask = async (taskId: string) => {
    if (!caregiver) return;

    const existing = completions.find(
      (c) => c.task_id === taskId && c.caregiver_id === caregiver.id
    );

    if (existing) {
      await supabase.from("task_completions").delete().eq("id", existing.id);
    } else {
      await supabase
        .from("task_completions")
        .insert({ task_id: taskId, caregiver_id: caregiver.id });
      setCelebratingTask(taskId);
      setTimeout(() => setCelebratingTask(null), 600);
    }
    refresh();
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

  return (
    <div className="min-h-full paw-bg pb-nav">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-pink-100">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">
              🐱 Misty&apos;s Sitter
            </h1>
            <p className="text-xs text-gray-400">Cat Care Tracker</p>
          </div>
          <CaregiverPicker onSelect={setCaregiver} selected={caregiver} />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Check-in section */}
        {caregiver && (
          <div className="fade-in">
            <button
              onClick={handleCheckIn}
              disabled={checkingIn}
              className={`w-full py-4 rounded-2xl font-semibold text-base transition-all duration-300 card-shadow ${
                justCheckedIn
                  ? "bg-green-100 text-green-700 scale-[0.98]"
                  : "bg-gradient-to-r from-pink-400 to-pink-500 text-white hover:from-pink-500 hover:to-pink-600 active:scale-[0.98]"
              }`}
            >
              {justCheckedIn
                ? "✅ Checked in!"
                : `🐾 Check In as ${caregiver.name}`}
            </button>
          </div>
        )}

        {/* Progress */}
        {totalTasks > 0 && (
          <div className="bg-white rounded-2xl p-4 card-shadow fade-in">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">
                Today&apos;s Progress
              </span>
              <span className="text-sm font-bold text-pink-500">
                {completedCount}/{totalTasks}
              </span>
            </div>
            <div className="w-full bg-pink-100 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-pink-400 to-lavender-300 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {completedCount === totalTasks && totalTasks > 0 && (
              <p className="text-center text-sm mt-2 text-pink-500 font-medium">
                🎉 All tasks done! Misty is happy! 🐱
              </p>
            )}
          </div>
        )}

        {/* No caregiver selected */}
        {!caregiver && (
          <div className="bg-white rounded-2xl p-8 card-shadow text-center fade-in">
            <p className="text-4xl mb-3">🐱</p>
            <p className="text-gray-500 text-sm">
              Pick your name above to get started!
            </p>
          </div>
        )}

        {/* Task checklist */}
        {tasks.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1">
              🐾 Today&apos;s Checklist
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
                  } ${doneByAnyone ? "border-l-4 border-green-300" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handleToggleTask(task.id)}
                      disabled={!caregiver}
                      className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all duration-200 ${
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
                        <p className="text-xs text-gray-400 mt-0.5 ml-6">
                          {task.description}
                        </p>
                      )}

                      {/* Show who completed */}
                      {taskCompletions.length > 0 && (
                        <div className="mt-2 ml-6 space-y-1">
                          {taskCompletions.map((tc) => (
                            <p
                              key={tc.id}
                              className="text-xs text-gray-400 flex items-center gap-1"
                            >
                              <span>{tc.caregivers.emoji}</span>
                              <span>{tc.caregivers.name}</span>
                              <span className="text-gray-300">·</span>
                              <span>{formatTime(tc.completed_at)}</span>
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    {isCelebrating && (
                      <span className="absolute -top-2 -right-2 text-lg sparkle">
                        ✨
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Today's visits summary */}
        {todayVisits.length > 0 && (
          <div className="bg-lavender-50 rounded-2xl p-4 card-shadow fade-in">
            <h3 className="text-sm font-semibold text-lavender-300 mb-3 flex items-center gap-1">
              <span>📍</span> Today&apos;s Visits
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
      </main>

      <Navigation />
    </div>
  );
}
