export function TreeIcon({ active = false }: { active?: boolean }) {
  return <span className={active ? "text-white" : "text-text-secondary"}>Tree</span>;
}

export function DiagramIcon({ active = false }: { active?: boolean }) {
  return <span className={active ? "text-white" : "text-text-secondary"}>Diagram</span>;
}

export function ExplainIcon({ active = false }: { active?: boolean }) {
  return <span className={active ? "text-white" : "text-text-secondary"}>Explain</span>;
}

export function StepBadge({ n, active = false }: { n: number; active?: boolean }) {
  return (
    <div className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm ${active ? "border-accent bg-accent text-white" : "border-border-medium text-text-secondary"}`}>
      {n}
    </div>
  );
}

