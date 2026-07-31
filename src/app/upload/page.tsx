"use client";

import { useState, useEffect, useRef } from "react";
import { getSupabase, getStorageUrl } from "@/lib/supabase";
import Link from "next/link";
import type { Instruction } from "@/lib/types";

function sanitizeFilename(title: string): string {
  return title
    .trim()
    .replace(/[^a-zA-Z0-9\u0590-\u05FF]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export default function UploadPage() {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);
  const [existingVideos, setExistingVideos] = useState<Instruction[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    getSupabase()
      .from("instructions")
      .select("*")
      .not("video_path", "is", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!cancelled) {
          setExistingVideos((data ?? []) as Instruction[]);
          setLoadingVideos(false);
        }
      }, () => {
        if (!cancelled) setLoadingVideos(false);
      });
    return () => {
      cancelled = true;
    };
  }, [successUrl]); // re-fetch after successful upload

  const resetForm = () => {
    setTitle("");
    setFile(null);
    setProgress(0);
    setError(null);
    setSuccessUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("נא להזין כותרת לסרטון");
      return;
    }
    if (!file) {
      setError("נא לבחור קובץ וידאו");
      return;
    }

    setUploading(true);
    setProgress(10);

    try {
      const supabase = getSupabase();
      const sanitized = sanitizeFilename(title);
      const filename = `${Date.now()}-${sanitized}.mp4`;

      // Upload to Supabase Storage
      setProgress(20);
      const { error: uploadError } = await supabase.storage
        .from("instruction-videos")
        .upload(filename, file);

      if (uploadError) {
        throw new Error(`שגיאה בהעלאה: ${uploadError.message}`);
      }

      setProgress(70);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("instruction-videos")
        .getPublicUrl(filename);

      const publicUrl = urlData.publicUrl;

      // Insert row into instructions table
      const { error: insertError } = await supabase
        .from("instructions")
        .insert({
          title: title.trim(),
          video_path: filename,
          description: null,
          sort_order: 0,
        });

      if (insertError) {
        throw new Error(`שגיאה בשמירת הנתונים: ${insertError.message}`);
      }

      setProgress(100);
      setSuccessUrl(publicUrl);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "שגיאה לא צפויה בהעלאה";
      setError(message);
    } finally {
      setUploading(false);
    }
  };

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
          <h1 className="text-lg font-bold text-gray-800">
            📹 העלאת סרטון הוראות
          </h1>
          <p className="text-xs text-gray-400">העלו סרטון הדרכה למיסטי</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Success state */}
        {successUrl && (
          <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-5 card-shadow fade-in space-y-3">
            <p className="text-center text-green-700 font-semibold text-base">
              ✅ הסרטון הועלה בהצלחה!
            </p>
            <div className="bg-white rounded-xl p-3 break-all">
              <p className="text-xs text-gray-400 mb-1">כתובת הסרטון:</p>
              <a
                href={successUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-pink-500 hover:text-pink-600 underline"
              >
                {successUrl}
              </a>
            </div>
            <button
              onClick={resetForm}
              className="w-full py-3 rounded-2xl font-semibold text-sm bg-gradient-to-l from-pink-400 to-pink-500 text-white hover:from-pink-500 hover:to-pink-600 active:scale-[0.98] transition-all duration-300 card-shadow"
            >
              📹 העלה סרטון נוסף
            </button>
          </div>
        )}

        {/* Upload form */}
        {!successUrl && (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl p-5 card-shadow fade-in space-y-5"
          >
            {/* Title input */}
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium text-gray-600 mb-2"
              >
                🏷️ כותרת הסרטון
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="לדוגמה: הכנת אוכל"
                disabled={uploading}
                className="w-full px-4 py-3 text-base rounded-xl border-2 border-pink-200 focus:border-pink-400 focus:outline-none transition-colors bg-pink-50/30 placeholder:text-gray-300"
                dir="rtl"
              />
            </div>

            {/* File input */}
            <div>
              <label
                htmlFor="video-file"
                className="block text-sm font-medium text-gray-600 mb-2"
              >
                🎬 בחירת סרטון
              </label>
              <div className="relative">
                <input
                  id="video-file"
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  disabled={uploading}
                  className="w-full py-4 px-4 text-sm rounded-xl border-2 border-dashed border-pink-200 focus:border-pink-400 focus:outline-none transition-colors bg-pink-50/30 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-pink-100 file:text-pink-600 file:cursor-pointer"
                />
              </div>
              {file && (
                <p className="text-xs text-gray-400 mt-1.5">
                  📎 {file.name} ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 text-center">
                😿 {error}
              </div>
            )}

            {/* Progress bar */}
            {uploading && (
              <div className="space-y-2">
                <div className="w-full bg-pink-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-l from-pink-400 to-lavender-300 h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-center text-sm text-gray-400">
                  {progress < 70 ? "מעלה..." : progress < 100 ? "שומר..." : "הושלם!"}
                  {" "}
                  ({progress}%)
                </p>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={uploading || !title.trim() || !file}
              className={`w-full py-4 rounded-2xl font-semibold text-base transition-all duration-300 card-shadow ${
                uploading || !title.trim() || !file
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-l from-pink-400 to-pink-500 text-white hover:from-pink-500 hover:to-pink-600 active:scale-[0.98]"
              }`}
            >
              {uploading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="cat-saving">🐱</span> מעלה...
                </span>
              ) : (
                "📤 העלה סרטון"
              )}
            </button>
          </form>
        )}

        {/* Existing videos list */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 px-1">
            📹 סרטונים שהועלו
          </h2>

          {loadingVideos && (
            <div className="flex flex-col items-center justify-center py-8">
              <span className="text-2xl animate-bounce">🐱</span>
              <p className="text-gray-400 mt-1 text-sm">טוען...</p>
            </div>
          )}

          {!loadingVideos && existingVideos.length === 0 && (
            <div className="bg-white rounded-2xl p-6 card-shadow text-center fade-in">
              <p className="text-2xl mb-2">📹</p>
              <p className="text-gray-400 text-sm">אין סרטונים עדיין</p>
            </div>
          )}

          {!loadingVideos &&
            existingVideos.map((video) => {
              const videoUrl = video.video_path
                ? getStorageUrl("instruction-videos", video.video_path)
                : null;

              return (
                <div
                  key={video.id}
                  className="bg-white rounded-2xl p-4 card-shadow fade-in"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        🐾 {video.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(video.created_at).toLocaleDateString("he-IL")}
                      </p>
                    </div>
                    {videoUrl && (
                      <a
                        href={videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-pink-50 text-pink-400 hover:text-pink-500 text-xs font-medium transition-colors"
                      >
                        ▶ צפה
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </main>
    </div>
  );
}
