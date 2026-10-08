"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Welcome() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reveal = window.setTimeout(() => setVisible(true), 50);
    const fade = window.setTimeout(() => setLeaving(true), 2200);
    const redirect = window.setTimeout(() => {
      router.replace("/axes");
    }, 3100);
    return () => {
      window.clearTimeout(reveal);
      window.clearTimeout(fade);
      window.clearTimeout(redirect);
    };
  }, [router]);

  return (
    <main className="fixed inset-0 flex items-center justify-center overflow-hidden bg-slate-950 text-center">
      <div
        className={`absolute inset-0 bg-cover bg-center transition-all duration-[2200ms] ease-out ${
          visible ? "scale-105 brightness-[0.25] blur-none" : "scale-100 brightness-[0.08] blur-xl"
        }`}
        style={{ backgroundImage: "url('/images.jpg')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/20 to-slate-950" />

      <section
        className={`relative z-10 flex max-w-4xl flex-col items-center px-6 transition-all duration-1000 ease-out ${
          visible && !leaving ? "translate-y-0 scale-100 opacity-100" : "translate-y-8 scale-95 opacity-0"
        }`}
      >
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-md">
          <img src="/logo.svg" alt="InternFlow" className="h-full w-full object-contain" />
        </div>
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.4em] text-slate-400 sm:text-xs">
          Internship Management Platform
        </p>
        <h1 className="text-4xl font-black leading-tight tracking-tighter text-white sm:text-6xl lg:text-7xl">
          Welcome to{" "}
          <span className="bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            InternFlow
          </span>
        </h1>
        <p className="mt-6 rounded-full border-y border-white/10 bg-black/30 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-300 backdrop-blur-md sm:text-xs">
          Students · Supervisors · Administrators
        </p>
      </section>
    </main>
  );
}
