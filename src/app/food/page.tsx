"use client";

import { useState, useEffect } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Caregiver, FoodPack } from "@/lib/types";
import { relativeTime } from "@/lib/timeUtils";
import Navigation from "../components/Navigation";
import CaregiverPicker from "../components/CaregiverPicker";

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
      label: "EXPIRED",
      emoji: "🔴",
      color: "text-red-600",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      message: "DO NOT USE — Replace immediately!",
      hoursLeft: 0,
    };
  }
  if (hoursLeft <= 24) {
    return {
      status: "old",
      label: "Getting Old",
      emoji: "🟠",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-200",
      message: "Prep a new pack!",
      hoursLeft,
    };
  }
  if (hoursLeft <= 48) {
    return {
      status: "ok",
      label: "OK",
      emoji: "🟡",
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
      message: "Still good, keep an eye on it",
      hoursLeft,
    };
  }
  return {
    status: "fresh",
    label: "Fresh",
    emoji: "🟢",
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    message: "Nice and fresh!",
    hoursLeft,
  };
}

function formatHoursLeft(hours: number): string {
  if (hours <= 0) return "Expired";
  if (hours < 1) return `${Math.round(hours * 60)}m left`;
  if (hours < 24) return `${Math.round(hours)}h left`;
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  return `${days}d ${remainingHours}h left`;
}

async function loadFoodData() {
  const supabase = getSupabase();
  const { data: activePacks } = await getSupabase()
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
      const { data } = await getSupabase()
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

  const { data: past } = await getSupabase()
    .from("food_packs")
    .select("*")
    .in("status", ["replaced", "expired"])
    .order("defrosted_at", { ascending: false })
    .limit(10);

  const pastPacks: FoodPackWithCaregiver[] = (past ?? []).map((p) => ({
    ...p,
    placed_by_caregiver: null,
  })) as FoodPackWithCaregiver[];

  return { currentPack, pastPacks };
}

export default function FoodPage() {
  const [caregiver, setCaregiver] = useState<Caregiver | null>(null);
  const [currentPack, setCurrentPack] =
    useState<FoodPackWithCaregiver | null>(null);
  const [pastPacks, setPastPacks] = useState<FoodPackWithCaregiver[]>([]);
  const [defrosting, setDefrosting] = useState(false);
  const [justDefrosted, setJustDefrosted] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadFoodData().then((data) => {
      if (cancelled) return;
      setCurrentPack(data.currentPack);
      setPastPacks(data.pastPacks);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // Refresh every minute to update timers
  useEffect(() => {
    const interval = setInterval(() => setRefreshKey((k) => k + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const refresh = () => setRefreshKey((k) => k + 1);

  const handleDefrost = async () => {
    if (!caregiver || defrosting) return;
    setDefrosting(true);

    try {
      const supabase = getSupabase();
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
          label: "Natural Food Pack",
        });
      if (insertError) throw insertError;

      setJustDefrosted(true);
      setTimeout(() => setJustDefrosted(false), 2000);
      refresh();
    } catch (err) {
      console.error("Failed to defrost new pack:", err);
      alert("Something went wrong logging the new pack. Please try again.");
    } finally {
      setDefrosting(false);
    }
  };

  const status = currentPack ? getFoodStatus(currentPack) : null;

  return (
    <div className="min-h-full paw-bg pb-nav">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-pink-100">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">
              🍖 Food Tracker
            </h1>
            <p className="text-xs text-gray-400">Natural food pack status</p>
          </div>
          <CaregiverPicker onSelect={setCaregiver} selected={caregiver} />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Current Pack Status */}
        {currentPack && status ? (
          <div
            className={`rounded-2xl p-6 card-shadow border-2 ${status.bgColor} ${status.borderColor} fade-in`}
          >
            {/* Big visual indicator */}
            <div className="text-center mb-4">
              <div
                className={`text-6xl mb-2 ${status.status === "expired" || status.status === "old" ? "pulse-soft" : ""}`}
              >
                {status.emoji}
              </div>
              <h2 className={`text-2xl font-bold ${status.color}`}>
                {status.label}
              </h2>
              <p className={`text-sm mt-1 ${status.color} opacity-75`}>
                {status.message}
              </p>
            </div>

            {/* Time info */}
            <div className="bg-white/60 rounded-xl p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Defrosted</span>
                <span className="font-medium text-gray-700">
                  {relativeTime(currentPack.defrosted_at)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Expires</span>
                <span className={`font-medium ${status.color}`}>
                  {status.hoursLeft > 0
                    ? formatHoursLeft(status.hoursLeft)
                    : "Expired!"}
                </span>
              </div>
              {currentPack.placed_by_caregiver && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Placed by</span>
                  <span className="font-medium text-gray-700">
                    {currentPack.placed_by_caregiver.emoji}{" "}
                    {currentPack.placed_by_caregiver.name}
                  </span>
                </div>
              )}
            </div>

            {/* Expiry warning bar */}
            {status.status !== "expired" && (
              <div className="mt-4">
                <div className="w-full bg-white/60 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      status.status === "fresh"
                        ? "bg-green-400"
                        : status.status === "ok"
                          ? "bg-yellow-400"
                          : "bg-orange-400"
                    }`}
                    style={{
                      width: `${Math.max(0, Math.min(100, (status.hoursLeft / 72) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-8 card-shadow text-center fade-in">
            <p className="text-4xl mb-3">🧊</p>
            <p className="text-gray-500 text-sm">No active food pack</p>
            <p className="text-gray-400 text-xs mt-1">
              Defrost a new one below!
            </p>
          </div>
        )}

        {/* Defrost Button */}
        {caregiver && (
          <button
            onClick={handleDefrost}
            disabled={defrosting}
            className={`w-full py-4 rounded-2xl font-semibold text-base transition-all duration-300 card-shadow ${
              justDefrosted
                ? "bg-green-100 text-green-700"
                : "bg-gradient-to-r from-blue-400 to-cyan-400 text-white hover:from-blue-500 hover:to-cyan-500 active:scale-[0.98]"
            }`}
          >
            {justDefrosted
              ? "✅ New pack logged!"
              : "🧊 I defrosted a new pack"}
          </button>
        )}

        {/* Past Packs History */}
        {pastPacks.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1">
              📦 Past Packs
            </h2>
            {pastPacks.map((pack) => (
              <div
                key={pack.id}
                className="bg-white rounded-2xl p-4 card-shadow opacity-70"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">
                      {pack.status === "expired" ? "🔴" : "📦"}
                    </span>
                    <span className="text-sm text-gray-500">{pack.label}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {relativeTime(pack.defrosted_at)}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1 capitalize">
                  {pack.status}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>

      <Navigation />
    </div>
  );
}
