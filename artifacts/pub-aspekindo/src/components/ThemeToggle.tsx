import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("pub-theme");
    const isDark = saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("pub-theme", next ? "dark" : "light");
  };

  return (
    <button
      onClick={toggle}
      className="relative w-14 h-8 md:w-9 md:h-9 rounded-full md:rounded-lg border border-border bg-muted/50 flex items-center md:justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
      title={dark ? "Light mode" : "Dark mode"}
    >
      {/* Mobile: pill toggle */}
      <span className={`md:hidden absolute top-1 w-6 h-6 rounded-full bg-pub-amber shadow-md flex items-center justify-center transition-transform duration-300 ${dark ? "translate-x-7" : "translate-x-1"}`}>
        {dark ? <Sun className="w-3.5 h-3.5 text-pub-navy" /> : <Moon className="w-3.5 h-3.5 text-pub-navy" />}
      </span>
      {/* Desktop: icon only */}
      <span className="hidden md:block">
        {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </span>
    </button>
  );
}
