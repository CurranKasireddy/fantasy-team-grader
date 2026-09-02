"use client";

import { useState } from "react";
import UploadStep from "@/components/UploadStep";
import ReviewStep from "@/components/ReviewStep";
import ReportStep from "@/components/ReportStep";
import StepIndicator from "@/components/StepIndicator";
import { DEFAULT_LEAGUE_SETTINGS } from "@/lib/types";
import type { ExtractedPlayer, LeagueSettings, TeamReport } from "@/lib/types";

type Step = "upload" | "review" | "report";

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [settings, setSettings] = useState<LeagueSettings>(DEFAULT_LEAGUE_SETTINGS);
  const [players, setPlayers] = useState<ExtractedPlayer[]>([]);
  const [report, setReport] = useState<TeamReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExtract(imageDataUris: string[]) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/extract-roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: imageDataUris }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to read roster from screenshots.");
      setPlayers(data.players as ExtractedPlayer[]);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGrade() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/grade-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players, settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to grade team.");
      setReport(data.report as TeamReport);
      setStep("report");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setStep("upload");
    setPlayers([]);
    setReport(null);
    setError(null);
  }

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-full max-w-3xl">
        <div className="mb-6">
          <StepIndicator current={step} />
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          {step === "upload" && (
            <UploadStep
              settings={settings}
              onSettingsChange={setSettings}
              onSubmit={handleExtract}
              loading={loading}
              error={error}
            />
          )}
          {step === "review" && (
            <ReviewStep
              players={players}
              onPlayersChange={setPlayers}
              onSubmit={handleGrade}
              onBack={() => setStep("upload")}
              loading={loading}
              error={error}
            />
          )}
          {step === "report" && report && <ReportStep report={report} onReset={handleReset} />}
        </div>
      </div>
    </div>
  );
}
