function Stroke({
  active,
}: {
  active?: boolean;
}) {
  return active ? "#ffffff" : "currentColor";
}

export function UploadIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <rect x="5" y="9" width="42" height="34" rx="12" fill="#F2F1EE" />
      <path d="M26 34V16" stroke="#0F766E" strokeWidth="3" strokeLinecap="round" />
      <path d="M18 23L26 15L34 23" stroke="#0F766E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 37H35" stroke="#7C3AED" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function TreeIcon({ active = false }: { active?: boolean }) {
  return (
    <span className={active ? "text-white" : "text-text-secondary"}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="9" cy="3" r="2" stroke={Stroke({ active })} strokeWidth="1.7" />
        <circle cx="4" cy="14" r="2" stroke={Stroke({ active })} strokeWidth="1.7" />
        <circle cx="14" cy="14" r="2" stroke={Stroke({ active })} strokeWidth="1.7" />
        <path d="M9 5V9M9 9H4M9 9H14M4 9V12M14 9V12" stroke={Stroke({ active })} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function DiagramIcon({ active = false }: { active?: boolean }) {
  return (
    <span className={active ? "text-white" : "text-text-secondary"}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <rect x="2" y="3" width="5" height="4" rx="1.5" stroke={Stroke({ active })} strokeWidth="1.7" />
        <rect x="11" y="3" width="5" height="4" rx="1.5" stroke={Stroke({ active })} strokeWidth="1.7" />
        <rect x="6.5" y="11" width="5" height="4" rx="1.5" stroke={Stroke({ active })} strokeWidth="1.7" />
        <path d="M7 5H11M9 7V11" stroke={Stroke({ active })} strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function ExplainIcon({ active = false }: { active?: boolean }) {
  return (
    <span className={active ? "text-white" : "text-text-secondary"}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M4 4.5H14C14.55 4.5 15 4.95 15 5.5V11.5C15 12.05 14.55 12.5 14 12.5H9L6 15V12.5H4C3.45 12.5 3 12.05 3 11.5V5.5C3 4.95 3.45 4.5 4 4.5Z" stroke={Stroke({ active })} strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M9 9.5V9.4C9 8.6 9.8 8.4 10.3 8C10.67 7.72 10.9 7.31 10.9 6.85C10.9 5.92 10.06 5.2 8.95 5.2C8.11 5.2 7.44 5.59 7 6.2" stroke={Stroke({ active })} strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="9" cy="11.8" r="0.8" fill={Stroke({ active })} />
      </svg>
    </span>
  );
}

export function StepBadge({ n, active = false }: { n: number; active?: boolean }) {
  return (
    <div className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm ${active ? "border-accent bg-accent text-white" : "border-border-medium text-text-secondary"}`}>
      {n}
    </div>
  );
}
