import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { usePacificScheduleDark } from "./usePacificScheduleDark";

const KEY = "fenderguard-theme-preference";

export type ThemePreference = "auto" | "light" | "dark";

export function useThemePreference(): {
  preference: ThemePreference;
  cyclePreference: () => void;
  isDark: boolean;
} {
  const scheduleDark = usePacificScheduleDark();
  const [preference, setPreference] = useState<ThemePreference>("auto");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const v = await AsyncStorage.getItem(KEY);
        if (cancelled) return;
        if (v === "light" || v === "dark" || v === "auto") {
          setPreference(v);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cyclePreference = useCallback(() => {
    setPreference((prev) => {
      const next: ThemePreference =
        prev === "auto" ? "light" : prev === "light" ? "dark" : "auto";
      void AsyncStorage.setItem(KEY, next);
      return next;
    });
  }, []);

  const isDark =
    preference === "auto" ? scheduleDark : preference === "dark";

  return { preference, cyclePreference, isDark };
}
