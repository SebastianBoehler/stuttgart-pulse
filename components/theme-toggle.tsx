"use client";

import { LaptopMinimal, MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import type { Dictionary } from "@/lib/i18n";
import type { ThemeMode } from "@/lib/types";

const options = [
  { value: "system", icon: LaptopMinimal },
  { value: "light", icon: SunMedium },
  { value: "dark", icon: MoonStar },
] as const satisfies Array<{ value: ThemeMode; icon: React.ComponentType<{ className?: string }> }>;

type ThemeToggleProps = {
  dictionary: Dictionary;
};

export function ThemeToggle({ dictionary }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const isHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const currentTheme = (isHydrated ? theme : "system") as ThemeMode;

  return (
    <div className="flex items-center gap-1 rounded-full border border-line bg-card px-2 py-2 text-sm font-semibold">
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = currentTheme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 transition-colors ${
              isActive
                ? "bg-accent text-white shadow-sm shadow-accent/20"
                : "text-foreground/72 hover:bg-surface-soft hover:text-foreground"
            }`}
            aria-pressed={isActive}
            aria-label={dictionary.theme[option.value]}
          >
            <Icon className="size-4" />
            <span className="hidden lg:inline">{dictionary.theme[option.value]}</span>
          </button>
        );
      })}
    </div>
  );
}
