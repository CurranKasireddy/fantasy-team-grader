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
    <div className="flex flex-col gap-8 w-full max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Fantasy Team Grader</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Upload screenshots of your roster and get a stats-based grade on team strength.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">League settings</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            Scoring
            <select
              className="rounded border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-700"
              value={settings.scoring}
              onChange={(e) => onSettingsChange({ ...settings, scoring: e.target.value as ScoringFormat })}
            >
              <option value="std">Standard</option>
              <option value="half_ppr">Half PPR</option>
              <option value="ppr">Full PPR</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            # of teams
            <input
              type="number"
              min={4}
              max={20}
              className="rounded border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-700"
              value={settings.numTeams}
              onChange={(e) => onSettingsChange({ ...settings, numTeams: Number(e.target.value) || 12 })}
            />
          </label>
          <label className="flex items-center gap-2 self-end pb-1.5 text-sm">
            <input
              type="checkbox"
              checked={settings.superflex}
              onChange={(e) => onSettingsChange({ ...settings, superflex: e.target.checked })}
            />
            Superflex
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Roster screenshots</h2>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 px-6 py-10 text-center text-sm text-zinc-500 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400">
          <span>Click to choose image(s), or drag them here</span>
          <span className="mt-1 text-xs text-zinc-400">Any fantasy app — Sleeper, ESPN, Yahoo, etc.</span>
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
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, next/image doesn't apply */}
                <img src={src} alt={`Screenshot ${i + 1}`} className="aspect-[9/16] w-full rounded object-cover" />
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white"
                  aria-label={`Remove screenshot ${i + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="button"
        disabled={files.length === 0 || loading}
        onClick={handleSubmit}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {loading ? "Reading roster…" : `Analyze ${files.length || ""} screenshot${files.length === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
