import { ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  return <div className="h-full animate-in fade-in slide-in-from-bottom-1 duration-200">{children}</div>;
}
