import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Dumbbell, Apple, Scale, BarChart3, User } from "lucide-react";
import { useEffect } from "react";
import { useLocalStorage } from "@/lib/hlt/storage";
import { KEYS } from "@/lib/hlt/storage";
import { DEFAULT_PROFILE } from "@/lib/hlt/defaults";
import type { Profile } from "@/lib/hlt/types";

const NAV = [
  { to: "/", label: "Início", icon: Home },
  { to: "/treino", label: "Treino", icon: Dumbbell },
  { to: "/nutricao", label: "Nutrição", icon: Apple },
  { to: "/peso", label: "Peso", icon: Scale },
  { to: "/analytics", label: "Análise", icon: BarChart3 },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [profile] = useLocalStorage<Profile>(KEYS.profile, DEFAULT_PROFILE);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const theme = profile.theme ?? "dark";
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [profile.theme]);

  return (
    <div className="min-h-screen flex w-full bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-card/40 p-4 gap-1">
        <div className="px-2 py-4">
          <div className="text-xs label-up">Healthy Life</div>
          <div className="text-xl font-bold tracking-tight">Tracker</div>
        </div>
        {NAV.map((n) => {
          const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                active ? "bg-primary/15 text-primary font-semibold" : "hover:bg-accent text-foreground/80"
              }`}
            >
              <n.icon className="size-4" />
              {n.label}
            </Link>
          );
        })}
        <div className="mt-auto px-2 text-xs text-muted-foreground">
          v1.0 · {profile.name}
        </div>
      </aside>

      <main className="flex-1 pb-24 md:pb-6 min-w-0">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur">
        <div className="grid grid-cols-6">
          {NAV.map((n) => {
            const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <n.icon className="size-5" />
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card p-4 ${className}`}>{children}</div>;
}
