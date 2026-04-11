import { createContext, useContext, useMemo, type ReactNode } from "react";
import { darkTheme, lightTheme, type AppTheme } from "./colors";

const ThemeContext = createContext<AppTheme | null>(null);

export function ThemeProvider({
  isDark,
  children,
}: {
  isDark: boolean;
  children: ReactNode;
}) {
  const value = useMemo(() => (isDark ? darkTheme : lightTheme), [isDark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): AppTheme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used within ThemeProvider");
  }
  return ctx;
}
