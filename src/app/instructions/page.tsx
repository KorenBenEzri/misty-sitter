"use client";

import { useState, useEffect } from "react";
import { getSupabase } from "@/lib/supabase";
import Link from "next/link";
import type { Instruction } from "@/lib/types";

interface TaskInfo {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
}

interface InstructionWithTask extends Instruction {
  task: TaskInfo | null;
}

interface TaskGroup {
  task: TaskInfo | null;
  instructions: InstructionWithTask[];
}

async function loadInstructions(): Promise<InstructionWithTask[]> {
  const { data } = await getSupabase()
    .from("instructions")
    .select("*, task:tasks(id, name, icon, sort_order)")
    .order("sort_order");
  return (data ?? []) as InstructionWithTask[];
}

function groupByTask(instructions: InstructionWithTask[]): TaskGroup[] {
  const taskMap = new Map<string | null, TaskGroup>();

  for (const instruction of instructions) {
    const key = instruction.task_id ?? null;
    if (!taskMap.has(key)) {
      taskMap.set(key, {
        task: instruction.task ?? null,
        instructions: [],
      });
    }
    taskMap.get(key)!.instructions.push(instruction);
  }

  const groups = Array.from(taskMap.values());

  // Sort groups: tasks by sort_order, "General" (null) last
  groups.sort((a, b) => {
    if (!a.task && !b.task) return 0;
    if (!a.task) return 1;
    if (!b.task) return -1;
    return a.task.sort_order - b.task.sort_order;
  });

  return groups;
}

export default function InstructionsPage() {
  const [instructions, setInstructions] = useState<InstructionWithTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadInstructions()
      .then((data) => {
        if (!cancelled) setInstructions(data);
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

  const groups = groupByTask(instructions);

  return (
    <div className="min-h-full paw-bg">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-pink-100">
        <div className="max-w-lg mx-auto px-4 py-3">
          <Link
            href="/"
            className="text-xs text-pink-400 hover:text-pink-600 transition-colors"
          >
            ← חזרה
          </Link>
          <h1 className="text-lg font-bold text-gray-800">📋 הוראות טיפול</h1>
          <p className="text-xs text-gray-400">איך לטפל במיסטי</p>
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
            {instructions.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 card-shadow text-center fade-in">
                <p className="text-4xl mb-3">📋</p>
                <p className="text-gray-500 text-sm">אין הוראות עדיין</p>
                <p className="text-gray-400 text-xs mt-1">
                  הוראות יופיעו כאן ברגע שיתווספו למסד הנתונים.
                </p>
              </div>
            ) : (
              groups.map((group) => {
                const groupKey = group.task?.id ?? "general";
                const groupIcon = group.task?.icon ?? "📌";
                const groupName = group.task?.name ?? "כללי";

                return (
                  <section key={groupKey} className="space-y-3">
                    {/* Task group header */}
                    <h2 className="text-base font-bold text-gray-700 flex items-center gap-2 px-1">
                      <span>{groupIcon}</span>
                      {groupName}
                    </h2>

                    {group.instructions.map((instruction, index) => (
                      <div
                        key={instruction.id}
                        className="bg-white rounded-2xl card-shadow overflow-hidden fade-in"
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        {/* Content */}
                        <div className="p-5">
                          <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                            <span className="text-pink-400">🐾</span>
                            {instruction.title}
                          </h3>

                          {/* Description — prominent summary */}
                          {instruction.description && (
                            <p className="mt-2 text-sm text-gray-500 leading-relaxed whitespace-pre-line">
                              {instruction.description}
                            </p>
                          )}

                          {/* Steps — numbered list */}
                          {instruction.steps && instruction.steps.length > 0 && (
                            <ol className="mt-3 space-y-1.5 text-sm text-gray-600 list-decimal list-inside">
                              {instruction.steps.map((step, i) => (
                                <li key={i} className="leading-relaxed">
                                  {step}
                                </li>
                              ))}
                            </ol>
                          )}

                          {/* Collapsible transcript */}
                          {instruction.transcript && (
                            <details className="mt-3 border-t border-pink-50 pt-3">
                              <summary className="text-sm text-pink-400 hover:text-pink-500 transition-colors cursor-pointer select-none">
                                📝 תמלול מקורי
                              </summary>
                              <div className="mt-2 bg-gray-50 rounded-xl p-3">
                                <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-line">
                                  {instruction.transcript}
                                </p>
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                    ))}
                  </section>
                );
              })
            )}
          </>
        )}
      </main>
    </div>
  );
}
