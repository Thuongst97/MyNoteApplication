import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Palette } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { APP_THEMES, appTheme, type AppTheme } from "@/lib/appThemes";
import { cn } from "@/lib/utils";

/** Sidebar button that opens the list of app themes (light and dark). */
export function ThemePicker() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);
  const theme = useAppStore((s) => s.theme);
  const lightTheme = useAppStore((s) => s.lightTheme);
  const darkTheme = useAppStore((s) => s.darkTheme);
  const current =
    theme === "dark"
      ? appTheme(darkTheme, "dark")
      : appTheme(lightTheme, "light");

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) =>
      !ref.current?.contains(e.target as Node) &&
      !panelRef.current?.contains(e.target as Node) &&
      setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const section = (mode: "light" | "dark") => (
    <>
      <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide opacity-50">
        {mode === "light" ? "Light" : "Dark"}
      </div>
      {APP_THEMES.filter((t) => t.mode === mode).map((t) => (
        <ThemeItem
          key={t.id}
          t={t}
          active={current.id === t.id}
          chosen={(mode === "light" ? lightTheme : darkTheme) === t.id}
          onPick={() => useAppStore.getState().setAppTheme(t.id)}
        />
      ))}
    </>
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title={`Theme: ${current.name}`}
        aria-label="Theme"
        aria-expanded={open}
        onClick={(e) => {
          // Shown beside the sidebar (it would be clipped inside it).
          const r = e.currentTarget.getBoundingClientRect();
          setPos({
            left: Math.min(r.right + 8, window.innerWidth - 264),
            bottom: Math.max(8, window.innerHeight - r.bottom),
          });
          setOpen((o) => !o);
        }}
        className="flex h-[30px] w-[30px] items-center justify-center rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
      >
        <Palette size={16} className="opacity-70" />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="App theme"
            style={{ left: pos.left, bottom: pos.bottom }}
            className="fixed z-[350] max-h-[80vh] w-64 animate-pop-in overflow-y-auto rounded-lg border border-black/10 bg-white p-1 text-ink-light shadow-xl dark:border-white/10 dark:bg-[#252525] dark:text-ink-dark"
          >
            {section("light")}
            <div className="my-1 h-px bg-black/5 dark:bg-white/10" />
            {section("dark")}
            <div className="px-2 pb-1.5 pt-2 text-[11px] opacity-50">
              Ctrl+Shift+L switches between your light and dark theme.
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function ThemeItem({
  t,
  active,
  chosen,
  onPick,
}: {
  t: AppTheme;
  active: boolean;
  chosen: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      aria-label={`${t.name} theme`}
      onClick={onPick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10",
        active && "bg-black/5 dark:bg-white/10",
      )}
    >
      {/* A tiny window: sidebar | page with "Aa" in the theme's text color. */}
      <span
        className="flex h-7 w-11 shrink-0 overflow-hidden rounded border border-black/15 dark:border-white/20"
        aria-hidden
      >
        <span className="w-3" style={{ background: t.sidebar }} />
        <span
          className="flex flex-1 items-center justify-center text-[11px] font-semibold"
          style={{ background: t.canvas, color: t.ink }}
        >
          Aa
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{t.name}</span>
        <span className="block truncate text-[11px] opacity-50">{t.hint}</span>
      </span>
      {active ? (
        <Check size={14} className="text-[#2383e2]" />
      ) : chosen ? (
        <span
          className="h-1.5 w-1.5 rounded-full bg-current opacity-30"
          title="Your theme for this mode"
        />
      ) : null}
    </button>
  );
}
