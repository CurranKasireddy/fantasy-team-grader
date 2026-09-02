"use client";

import { useState } from "react";
import type { LeagueSettings, ScoringFormat } from "@/lib/types";
import { fileToDataUri } from "@/lib/file-to-data-uri";

interface Props {
  settings: LeagueSettings;
  onSettingsChange: (settings: LeagueSettings) => void;
  onSubmit: (imageDataUris: string[]) => void;
  loading: boolean;
  error: string | null;
}

const MAX_IMAGES = 15;

export default function UploadStep({ settings, onSettingsChange, onSubmit, loading, error }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const next = [...files, ...Array.from(fileList)].slice(0, MAX_IMAGES);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  }

  function removeFile(index: number) {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  }

  async function handleSubmit() {
    const dataUris = await Promise.all(files.map(fileToDataUri));
    onSubmit(dataUris);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Grade your team</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Upload screenshots of your roster and get a stats-based grade on team strength.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">League settings</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Scoring</span>
            <select
              className="rounded-md border border-border bg-surface px-2.5 py-1.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              value={settings.scoring}
              onChange={(e) => onSettingsChange({ ...settings, scoring: e.target.value as ScoringFormat })}
            >
              <option value="std">Standard</option>
              <option value="half_ppr">Half PPR</option>
              <option value="ppr">Full PPR</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium"># of teams</span>
            <input
              type="number"
              min={4}
              max={20}
              className="rounded-md border border-border bg-surface px-2.5 py-1.5 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              value={settings.numTeams}
              onChange={(e) => onSettingsChange({ ...settings, numTeams: Number(e.target.value) || 12 })}
            />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
            <input
              type="checkbox"
              className="h-4 w-4 accent-accent"
              checked={settings.superflex}
              onChange={(e) => onSettingsChange({ ...settings, superflex: e.target.checked })}
            />
            Superflex
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Roster screenshots</h2>
        <label className="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-6 py-10 text-center transition-colors hover:border-accent hover:bg-accent-soft">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-lg group-hover:bg-accent-soft">
            📸
          </span>
          <span className="text-sm font-medium">Click to choose image(s), or drag them here</span>
          <span className="text-xs text-muted-foreground">Any fantasy app — Sleeper, ESPN, Yahoo, etc.</span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>

        {previews.length > 0 && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {previews.map((src, i) => (
              <div key={i} className="group relative overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, next/image doesn't apply */}
                <img src={src} alt={`Screenshot ${i + 1}`} className="aspect-[9/16] w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label={`Remove screenshot ${i + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={files.length === 0 || loading}
        onClick={handleSubmit}
        className="self-start rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "Reading roster…" : `Analyze ${files.length || ""} screenshot${files.length === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
