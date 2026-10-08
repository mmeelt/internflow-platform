"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { AxisTheme, applyAxisTheme } from "@/lib/axis-theme";

const axes: Array<{
  id: AxisTheme;
  name: string;
  logo: string;
}> = [
  {
    id: "ai",
    name: "AI Centre of Excellence",
    logo: "/ai-centre.svg",
  },
  {
    id: "industry",
    name: "Industry 4.0 Centre",
    logo: "/industry-centre.svg",
  },
];

export default function ChooseAxisPage() {
  const router = useRouter();

  const selectAxis = (axis: AxisTheme) => {
    applyAxisTheme(axis);
    router.push(`/login?axis=${axis}`);
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F8FAFC] p-6 font-sans text-[#0D1926]">
      <button
        type="button"
        onClick={() => router.push("/")}
        className="absolute left-6 top-6 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-[#0D1926]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      <section className="w-full max-w-[560px]">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
            <img src="/logo.svg" alt="InternFlow" className="h-7 w-7 object-contain" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#6F6F6E]">InternFlow</h1>
          <p className="mt-2 text-sm font-medium text-slate-500">Select your department workspace to continue</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgb(15,23,42,0.05)] sm:p-6">
          <div className="px-1 pb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Centre of Excellence</div>
          <div className="space-y-3">
            {axes.map((axis) => (
              <button
                key={axis.id}
                type="button"
                onClick={() => selectAxis(axis.id)}
                className="group flex min-h-[104px] w-full items-center gap-5 rounded-xl border border-slate-200 bg-white px-5 py-5 text-left transition-all hover:border-[#0D1926] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0D1926]/15 sm:px-6"
              >
                <div className="flex h-14 w-24 shrink-0 items-center justify-center border-r border-slate-100 pr-5">
                  <img src={axis.logo} alt={`${axis.name} logo`} className="h-full w-full object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-slate-900">{axis.name}</h2>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-all group-hover:translate-x-1 group-hover:text-[#0D1926]" />
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
