"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Caregiver } from "@/lib/types";

const PRESET_EMOJIS = ["🌟", "✨", "🌸", "🦋", "🌻", "💜", "🐱", "😊", "🎀", "💫"];

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
  const [showModal, setShowModal] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showAddNew, setShowAddNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState(PRESET_EMOJIS[0]);
  const [adding, setAdding] = useState(false);

  // Keep a stable ref to onSelect so the mount effect doesn't need it as a dependency
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const reloadCaregivers = useCallback(async () => {
    const data = await fetchCaregivers();
    setCaregivers(data);
    return data;
  }, []);

  // Load caregivers on mount
  useEffect(() => {
    let cancelled = false;
    fetchCaregivers().then((data) => {
      if (cancelled) return;
      setCaregivers(data);
      setLoaded(true);
      // Check localStorage for saved caregiver
      const saved = localStorage.getItem("misty-caregiver");
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Caregiver;
          const match = data.find((c) => c.id === parsed.id);
          if (match) {
            onSelectRef.current(match);
          } else {
            localStorage.removeItem("misty-caregiver");
            setShowModal(true);
          }
        } catch {
          localStorage.removeItem("misty-caregiver");
          setShowModal(true);
        }
      } else {
        // First visit — show modal
        setShowModal(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = (caregiver: Caregiver) => {
    onSelect(caregiver);
    localStorage.setItem("misty-caregiver", JSON.stringify(caregiver));
    setShowModal(false);
    setShowAddNew(false);
    setNewName("");
  };

  const handleAddNew = async () => {
    const trimmed = newName.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    try {
      const { data, error } = await getSupabase()
        .from("caregivers")
        .insert({ name: trimmed, emoji: newEmoji })
        .select()
        .single();
      if (error) throw error;
      if (data) {
        await reloadCaregivers();
        handleSelect(data as Caregiver);
      }
    } catch (err) {
      console.error("Failed to add caregiver:", err);
      alert("לא הצליח להוסיף. ייתכן שהשם כבר קיים.");
    } finally {
      setAdding(false);
    }
  };

  if (!loaded) return null;

  return (
    <>
      {/* Header pill — tap to switch */}
      {selected && (
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-50 rounded-full border border-pink-200 text-sm transition-all duration-200 hover:bg-pink-100 active:scale-95"
          aria-label="החלפת מטפל/ת"
        >
          <span>{selected.emoji}</span>
          <span className="font-medium text-gray-700">{selected.name}</span>
        </button>
      )}

      {/* Modal overlay */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              if (selected) setShowModal(false);
            }}
          />

          {/* Modal content */}
          <div className="relative bg-white rounded-2xl card-shadow w-full max-w-sm p-6 pop-in z-10">
            <h2 className="text-lg font-bold text-gray-800 text-center mb-1">
              🐱 מי את/ה?
            </h2>
            <p className="text-xs text-gray-400 text-center mb-4">
              בחרו מהרשימה או הוסיפו שם חדש
            </p>

            {/* Caregiver list */}
            <div className="space-y-2 max-h-52 overflow-y-auto mb-4">
              {caregivers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-start transition-all duration-200 ${
                    selected?.id === c.id
                      ? "bg-pink-100 border border-pink-300"
                      : "bg-gray-50 hover:bg-pink-50 border border-transparent"
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

            {/* Add new section */}
            {!showAddNew ? (
              <button
                onClick={() => setShowAddNew(true)}
                className="w-full py-3 rounded-xl border-2 border-dashed border-pink-200 text-sm text-pink-400 hover:bg-pink-50 transition-colors"
              >
                ➕ הוספת שם חדש
              </button>
            ) : (
              <div className="border-2 border-pink-200 rounded-xl p-4 space-y-3">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="השם שלך..."
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-pink-400"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddNew();
                  }}
                />

                {/* Emoji picker */}
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">בחרו אימוג׳י:</p>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => setNewEmoji(emoji)}
                        className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${
                          newEmoji === emoji
                            ? "bg-pink-100 border-2 border-pink-400 scale-110"
                            : "bg-gray-50 border border-gray-200 hover:bg-pink-50"
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleAddNew}
                    disabled={!newName.trim() || adding}
                    className="flex-1 py-2 rounded-lg bg-pink-500 text-white text-sm font-medium hover:bg-pink-600 disabled:opacity-50 transition-colors"
                  >
                    {adding ? "מוסיף..." : "הוספה"}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddNew(false);
                      setNewName("");
                    }}
                    className="px-4 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm hover:bg-gray-200 transition-colors"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}

            {/* Close button — only if already selected */}
            {selected && (
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-3 left-3 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors text-sm"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
