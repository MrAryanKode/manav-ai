"use client";

import { motion } from "framer-motion";
import {
  MessageSquare,
  ListTodo,
  FolderKanban,
  Brain,
  Settings,
  Mic,
  ArrowUp,
  Sparkles,
} from "lucide-react";

const navigation = [
  { name: "Chat", icon: MessageSquare },
  { name: "Tasks", icon: ListTodo },
  { name: "Projects", icon: FolderKanban },
  { name: "Memory", icon: Brain },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050816] text-white">
      <div className="flex min-h-screen">

        {/* SIDEBAR */}
        <aside className="hidden w-64 border-r border-white/10 bg-[#070b17]/80 p-5 backdrop-blur-xl lg:flex lg:flex-col">

          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br0 from-blue-500 via-violet-500 to-cyan-400 shadow-lg shadow-blue-500/20">
              <span className="text-lg font-bold">M</span>
            </div>

            <div>
              <h1 className="text-lg font-semibold tracking-wide">
                MANAV
              </h1>

              <p className="text-xs text-slate-500">
                Autonomous AI
              </p>
            </div>
          </div>

          <nav className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.name}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-400 transition-all hover:bg-white/5 hover:text-white"
                >
                  <Icon size={18} />
                  {item.name}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto">
            <button className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white">
              <Settings size={18} />
              Settings
            </button>
          </div>
        </aside>

        {/* MAIN AREA */}
        <section className="relative flex min-h-screen flex-1 flex-col">

          {/* AMBIENT LIGHTS */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-1/2 top-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[140px]" />

            <div className="absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-violet-600/10 blur-[130px]" />

            <div className="absolute bottom-0 left-1/4 h-[300px] w-[300px] rounded-full bg-cyan-500/5 blur-[120px]" />
          </div>

          {/* TOP BAR */}
          <header className="relative z-10 flex h-16 items-center justify-between border-b border-white/10 px-6">

            <div>
              <p className="text-sm text-slate-500">
                MANAV AI SYSTEM
              </p>

              <h2 className="text-sm font-medium text-slate-200">
                Command Center
              </h2>
            </div>

            <div className="flex items-center gap-3">

              <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />

                <span className="text-xs text-emerald-300">
                  SYSTEM ONLINE
                </span>
              </div>

              <div className="hidden h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 md:flex">
                <span className="text-sm font-medium">
                  A
                </span>
              </div>

            </div>
          </header>

          {/* CENTER */}
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">

            {/* MANAV CORE */}
            <motion.div
              animate={{
                scale: [1, 1.04, 1],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="relative mb-10"
            >

              {/* OUTER GLOW */}
              <div className="absolute inset-[-70px] rounded-full bg-blue-500/10 blur-3xl" />

              {/* ROTATING RING */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  duration: 18,
                  repeat: Infinity,
                  ease: "linear",
                }}
                className="absolute inset-[-35px] rounded-full bg-[conic-gradient(from_0deg,transparent,#4f8cff,transparent,#8b5cf6,transparent)] opacity-70 blur-[1px]"
              />

              {/* CORE */}
              <div className="relative flex h-48 w-48 items-center justify-center rounded-full border border-white/10 bg-[#080d1b] shadow-[0_0_80px_rgba(79,140,255,0.18)]">

                <div className="absolute inset-5 rounded-full border border-blue-400/20" />

                <div className="absolute inset-10 rounded-full bg-gradient-to-br from-blue-500 via-violet-500 to-cyan-400 opacity-20 blur-2xl" />

                <div className="relative text-center">

                  <Sparkles
                    size={22}
                    className="mx-auto mb-2 text-cyan-300"
                  />

                  <div className="text-5xl font-semibold tracking-tight">
                    M
                  </div>

                  <div className="mt-2 text-[10px] tracking-[0.35em] text-slate-500">
                    MANAV
                  </div>

                </div>

              </div>
            </motion.div>

            {/* STATUS */}
            <div className="mb-8 text-center">

              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                How can I help you?
              </h1>

              <p className="mt-3 text-sm text-slate-500">
                Give MANAV an objective. I will plan and execute it.
              </p>

            </div>

            {/* COMMAND BOX */}
            <div className="w-full max-w-3xl">

              <div className="group relative rounded-2xl border border-white/10 bg-white/[0.035] p-2 shadow-2xl shadow-black/30 backdrop-blur-xl transition-all focus-within:border-blue-400/30 focus-within:shadow-blue-500/10">

                <textarea
                  placeholder="Tell MANAV what you want to accomplish..."
                  className="min-h-[80px] w-full resize-none bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600"
                />

                <div className="flex items-center justify-between px-2 pb-1">

                  <div className="flex items-center gap-2">

                    <button className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white/5 hover:text-white">
                      <Mic size={18} />
                    </button>

                    <span className="hidden text-xs text-slate-600 sm:block">
                      Voice available soon
                    </span>

                  </div>

                  <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 shadow-lg shadow-blue-500/20 transition hover:scale-105">
                    <ArrowUp size={18} />
                  </button>

                </div>

              </div>

              <div className="mt-4 flex flex-wrap justify-center gap-2">

                {[
                  "Build a website",
                  "Research something",
                  "Analyze my files",
                  "Write code",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    className="rounded-full border border-white/5 bg-white/[0.025] px-4 py-2 text-xs text-slate-500 transition hover:border-blue-400/20 hover:bg-blue-500/5 hover:text-slate-300"
                  >
                    {suggestion}
                  </button>
                ))}

              </div>

            </div>
          </div>

          {/* FOOTER */}
          <footer className="relative z-10 border-t border-white/5 px-6 py-3 text-center text-[11px] text-slate-600">
            MANAV • Autonomous AI Operating Layer
          </footer>

        </section>
      </div>
    </main>
  );
}