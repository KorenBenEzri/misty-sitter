"use client";

import { useState, useEffect, useRef } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Instruction } from "@/lib/types";
import Navigation from "../components/Navigation";

function getYouTubeEmbedUrl(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
  }
  return null;
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(url);
}

async function loadInstructions(): Promise<Instruction[]> {
  const { data } = await getSupabase()
    .from("instructions")
    .select("*")
    .order("sort_order");
  return (data ?? []) as Instruction[];
}

export default function InstructionsPage() {
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadInstructions()
      .then((data) => {
        setInstructions(data);
        setError(false);
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-full paw-bg pb-nav">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-pink-100">
        <div className="max-w-lg mx-auto px-4 py-3">
          <h1 className="text-lg font-bold text-gray-800">📋 הוראות טיפול</h1>
          <p className="text-xs text-gray-400">איך לטפל במיסטי</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
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
              instructions.map((instruction, index) => (
                <div
                  key={instruction.id}
                  className="bg-white rounded-2xl card-shadow overflow-hidden fade-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  {/* Video embed */}
                  {instruction.video_url && (
                    <div className="w-full">
                      {getYouTubeEmbedUrl(instruction.video_url) ? (
                        <div className="relative w-full pt-[56.25%]">
                          <iframe
                            className="absolute inset-0 w-full h-full"
                            src={getYouTubeEmbedUrl(instruction.video_url)!}
                            title={instruction.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      ) : isVideoUrl(instruction.video_url) ? (
                        <video controls className="w-full" preload="metadata">
                          <source src={instruction.video_url} />
                          הדפדפן שלך לא תומך בהפעלת וידאו.
                        </video>
                      ) : (
                        <a
                          href={instruction.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-3 bg-lavender-50 text-center text-sm text-lavender-300 hover:text-pink-500 transition-colors"
                        >
                          🎬 צפה בסרטון ↗
                        </a>
                      )}
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-5">
                    <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                      <span className="text-pink-400">🐾</span>
                      {instruction.title}
                    </h3>
                    {instruction.description && (
                      <p className="mt-2 text-sm text-gray-500 leading-relaxed whitespace-pre-line">
                        {instruction.description}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </main>

      <Navigation />
    </div>
  );
}
