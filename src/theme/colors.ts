/**
 * Theme tokens for FenderGuard — "Modern Glassmorphism" (light) and
 * "Stealth Graphite" (dark). Screens consume via ThemeContext / useAppTheme().
 */

export type AppTheme = {
  bg: string;
  bgElevated: string;
  bgSubtle: string;
  bgWell: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentDim: string;
  green: string;
  red: string;
  headLow: string;
  headHigh: string;
  tail: string;
  hazard: string;
  turn: string;
  lampOff: string;
  lampStroke: string;
  deckLight: string;
  deckDark: string;
  deckWire: string;
  deckWireDim: string;
  wheel: string;
  truck: string;
  onHazardText: string;
  /** Speedometer track (behind zone colors) */
  gaugeTrack: string;
  /** Zone fills 0–20 / 20–30 / 30–40 */
  gaugeGreen: string;
  gaugeYellow: string;
  gaugeRed: string;
  /** Active segment in MPH/KM/H toggle */
  unitToggleActiveBg: string;
  unitToggleActiveBorder: string;
  /** Text on filled accent button */
  onAccentButton: string;
  radius: number;
  statusBarStyle: "light" | "dark";
};

/** Light — soft blue-grey glass feel */
export const lightTheme: AppTheme = {
  bg: "#dbeafe",
  bgElevated: "rgba(255, 255, 255, 0.78)",
  bgSubtle: "#f0f7ff",
  bgWell: "rgba(255, 255, 255, 0.55)",
  border: "rgba(148, 163, 184, 0.45)",
  text: "#1e3a5f",
  muted: "#5b6b82",
  accent: "#2563eb",
  accentDim: "rgba(37, 99, 235, 0.38)",
  green: "#0d9488",
  red: "#e11d48",
  headLow: "#3b82f6",
  headHigh: "#1d4ed8",
  tail: "#e11d48",
  hazard: "#d97706",
  turn: "#16a34a",
  lampOff: "#cbd5e1",
  lampStroke: "#94a3b8",
  deckLight: "#e8eef5",
  deckDark: "#d8e2ec",
  deckWire: "#0891b2",
  deckWireDim: "rgba(8, 145, 178, 0.4)",
  wheel: "#64748b",
  truck: "rgba(8, 145, 178, 0.55)",
  onHazardText: "#ffffff",
  gaugeTrack: "rgba(30, 58, 95, 0.18)",
  gaugeGreen: "#16a34a",
  gaugeYellow: "#ca8a04",
  gaugeRed: "#dc2626",
  unitToggleActiveBg: "rgba(37, 99, 235, 0.14)",
  unitToggleActiveBorder: "rgba(37, 99, 235, 0.35)",
  onAccentButton: "#ffffff",
  radius: 14,
  statusBarStyle: "dark",
};

/** Dark — charcoal + gold */
export const darkTheme: AppTheme = {
  bg: "#0c0e12",
  bgElevated: "#161a22",
  bgSubtle: "#1e232e",
  bgWell: "rgba(255, 255, 255, 0.06)",
  border: "#2d3544",
  text: "#f0d78c",
  muted: "#a89a72",
  accent: "#e8c547",
  accentDim: "rgba(232, 197, 71, 0.45)",
  green: "#6ee7b7",
  red: "#fb7185",
  headLow: "#60a5fa",
  headHigh: "#93c5fd",
  tail: "#fb7185",
  hazard: "#fbbf24",
  turn: "#4ade80",
  lampOff: "#475569",
  lampStroke: "#64748b",
  deckLight: "#1e293b",
  deckDark: "#0f172a",
  deckWire: "#d4a574",
  deckWireDim: "rgba(212, 165, 116, 0.35)",
  wheel: "#64748b",
  truck: "rgba(212, 165, 116, 0.45)",
  onHazardText: "#0c0e12",
  gaugeTrack: "rgba(168, 154, 114, 0.25)",
  gaugeGreen: "#4ade80",
  gaugeYellow: "#facc15",
  gaugeRed: "#f87171",
  unitToggleActiveBg: "rgba(232, 197, 71, 0.14)",
  unitToggleActiveBorder: "rgba(232, 197, 71, 0.4)",
  onAccentButton: "#0c0e12",
  radius: 14,
  statusBarStyle: "light",
};

/** @deprecated Use ThemeContext / useAppTheme() */
export const C = lightTheme;
