import type { ReactNode } from "react";

const tones = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  zinc: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  red: "bg-red-50 text-red-700 ring-red-200",
};

export function Badge({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${tones[tone]}`}>
    {tone === "green" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
    {children}
  </span>;
}
