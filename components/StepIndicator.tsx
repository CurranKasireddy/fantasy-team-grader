type Step = "upload" | "review" | "report";

const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "review", label: "Confirm roster" },
  { key: "report", label: "Report" },
];

export default function StepIndicator({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <ol className="flex items-center gap-2 sm:gap-3">
      {STEPS.map((step, i) => {
        const state = i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming";
        return (
          <li key={step.key} className="flex flex-1 items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <span
                className={
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
                  (state === "done"
                    ? "bg-accent text-accent-foreground"
                    : state === "current"
                      ? "border-2 border-accent text-accent"
                      : "border border-border text-muted-foreground")
                }
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span
                className={
                  "hidden text-sm sm:inline " +
                  (state === "upcoming" ? "text-muted-foreground" : "font-medium text-foreground")
                }
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={"h-px flex-1 " + (state === "done" ? "bg-accent" : "bg-border")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
