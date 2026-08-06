import type { ReactNode } from "react";

export default function PageBackground({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-bg-deep">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-35 -left-30 z-0 h-120 w-120 animate-drift-a rounded-full bg-purple opacity-[0.55] blur-[100px] motion-reduce:animate-none"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-25 -bottom-40 z-0 h-105 w-105 animate-drift-b rounded-full bg-accent-blue opacity-40 blur-[100px] motion-reduce:animate-none"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[40%] left-[55%] z-0 h-80 w-80 animate-drift-a-rev rounded-full bg-purple-soft opacity-25 blur-[100px] motion-reduce:animate-none"
      />
      {children}
    </div>
  );
}
