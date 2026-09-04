import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ColorTheme = "navy" | "purple" | "black" | "silverblue" | "rose";

const THEME_STORAGE_KEY = "zentragig-color-theme";

const themeConfigs: Record<ColorTheme, {
  primary: string;
  primaryForeground: string;
  primaryLight: string;
  primaryDark: string;
  ring: string;
  sidebarBg: string;
  sidebarAccent: string;
  sidebarBorder: string;
  gradientHero: string;
  darkPrimary: string;
  darkRing: string;
}> = {
  navy: {
    primary: "228 29% 17%",
    primaryForeground: "0 0% 100%",
    primaryLight: "228 25% 30%",
    primaryDark: "228 35% 10%",
    ring: "228 29% 17%",
    sidebarBg: "228 29% 17%",
    sidebarAccent: "228 22% 26%",
    sidebarBorder: "228 20% 30%",
    gradientHero: "linear-gradient(135deg, hsl(228 29% 17%) 0%, hsl(228 35% 10%) 100%)",
    darkPrimary: "228 25% 55%",
    darkRing: "228 25% 55%",
  },
  purple: {
    primary: "265 40% 42%",
    primaryForeground: "0 0% 100%",
    primaryLight: "265 38% 52%",
    primaryDark: "265 42% 32%",
    ring: "265 40% 42%",
    sidebarBg: "265 40% 42%",
    sidebarAccent: "265 38% 50%",
    sidebarBorder: "265 35% 35%",
    gradientHero: "linear-gradient(135deg, hsl(265 40% 42%) 0%, hsl(265 42% 32%) 100%)",
    darkPrimary: "265 38% 52%",
    darkRing: "265 38% 52%",
  },
  black: {
    primary: "0 0% 15%",
    primaryForeground: "0 0% 100%",
    primaryLight: "0 0% 30%",
    primaryDark: "0 0% 8%",
    ring: "0 0% 15%",
    sidebarBg: "0 0% 10%",
    sidebarAccent: "0 0% 20%",
    sidebarBorder: "0 0% 15%",
    gradientHero: "linear-gradient(135deg, hsl(0 0% 15%) 0%, hsl(0 0% 5%) 100%)",
    darkPrimary: "0 0% 75%",
    darkRing: "0 0% 75%",
  },
  silverblue: {
    primary: "212 38% 40%",
    primaryForeground: "0 0% 100%",
    primaryLight: "212 36% 52%",
    primaryDark: "212 40% 29%",
    ring: "212 38% 40%",
    sidebarBg: "212 38% 40%",
    sidebarAccent: "212 36% 49%",
    sidebarBorder: "212 34% 34%",
    gradientHero: "linear-gradient(135deg, hsl(212 38% 40%) 0%, hsl(212 40% 29%) 100%)",
    darkPrimary: "212 36% 52%",
    darkRing: "212 36% 52%",
  },
  rose: {
    primary: "350 45% 45%",
    primaryForeground: "0 0% 100%",
    primaryLight: "350 42% 56%",
    primaryDark: "350 48% 34%",
    ring: "350 45% 45%",
    sidebarBg: "350 45% 45%",
    sidebarAccent: "350 42% 52%",
    sidebarBorder: "350 40% 38%",
    gradientHero: "linear-gradient(135deg, hsl(350 45% 45%) 0%, hsl(350 48% 34%) 100%)",
    darkPrimary: "350 42% 56%",
    darkRing: "350 42% 56%",
  },
};

function applyTheme(theme: ColorTheme) {
  const config = themeConfigs[theme];
  const root = document.documentElement;
  root.style.setProperty("--primary", config.primary);
  root.style.setProperty("--primary-foreground", config.primaryForeground);
  root.style.setProperty("--ring", config.ring);
  root.style.setProperty("--sidebar-background", config.sidebarBg);
  root.style.setProperty("--sidebar-accent", config.sidebarAccent);
  root.style.setProperty("--sidebar-border", config.sidebarBorder);
  root.style.setProperty("--gradient-hero", config.gradientHero);
}

const validThemes: ColorTheme[] = ["navy", "purple", "black", "silverblue", "rose"];
function isValidTheme(v: string | null | undefined): v is ColorTheme {
  return !!v && validThemes.includes(v as ColorTheme);
}

interface ThemeContextType {
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  colorTheme: "navy",
  setColorTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    const theme = isValidTheme(saved) ? saved : "navy";
    applyTheme(theme);
    return theme;
  });

  // Latest colorTheme for the auth-subscription effect below, which intentionally
  // subscribes only once — reading via ref avoids both a stale closure and
  // tearing down/recreating the Supabase auth listener on every theme change.
  const colorThemeRef = useRef(colorTheme);
  useEffect(() => {
    colorThemeRef.current = colorTheme;
  }, [colorTheme]);

  // On auth state change (login), load theme from DB
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
        const { data } = await supabase
          .from("profiles")
          .select("theme_preference")
          .eq("id", session.user.id)
          .maybeSingle();

        const dbTheme = data?.theme_preference;
        if (isValidTheme(dbTheme) && dbTheme !== colorThemeRef.current) {
          localStorage.setItem(THEME_STORAGE_KEY, dbTheme);
          setColorThemeState(dbTheme);
          applyTheme(dbTheme);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const setColorTheme = useCallback(async (theme: ColorTheme) => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    setColorThemeState(theme);
    applyTheme(theme);

    // Persist to DB if logged in
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase
        .from("profiles")
        .update({ theme_preference: theme })
        .eq("id", session.user.id);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ colorTheme, setColorTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useColorTheme() {
  return useContext(ThemeContext);
}

export const THEME_OPTIONS: { value: ColorTheme; label: string; color: string }[] = [
  { value: "navy", label: "Navy", color: "hsl(228 29% 17%)" },
  { value: "purple", label: "Purple", color: "hsl(265 40% 42%)" },
  { value: "black", label: "Black", color: "hsl(0 0% 15%)" },
  { value: "silverblue", label: "Silver Blue", color: "hsl(212 38% 40%)" },
  { value: "rose", label: "Rose", color: "hsl(350 45% 45%)" },
];