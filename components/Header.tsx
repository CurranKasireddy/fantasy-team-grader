export default function Header() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-6 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">
          FG
        </span>
        <span className="text-base font-semibold tracking-tight">Fantasy Team Grader</span>
      </div>
    </header>
  );
}
