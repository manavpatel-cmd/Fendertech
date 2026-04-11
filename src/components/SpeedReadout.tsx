import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { G, Path, Polyline, Text as SvgText } from "react-native-svg";
import type { SpeedUnit } from "../hooks/useFender";
import { useAppTheme } from "../theme/ThemeContext";
import type { AppTheme } from "../theme/colors";
import { hapticLight } from "../utils/haptics";

const FONT_MAX = 1.35;

/** Gauge scale 0–40 (same for MPH and KM/H display on arc). */
export const GAUGE_MAX = 40;

/** ViewBox for gauge SVG (upper semicircle, center near bottom). */
const GW = 300;
const GH = 158;
const CX = GW / 2;
const CY = 128;
const R = 102;
const STROKE_TRACK = 10;
const STROKE_FILL = 11;

/** Upper semicircle path from left to right (bulge upward). */
function upperSemiPath(): string {
  const x0 = CX - R;
  const y0 = CY;
  const x1 = CX + R;
  const y1 = CY;
  return `M ${x0} ${y0} A ${R} ${R} 0 0 0 ${x1} ${y1}`;
}

/** Polar angle (rad): π = left, 0 = right — for tick placement vs speed/max. */
function angleForSpeedRatio(p: number): number {
  return Math.PI * (1 - Math.max(0, Math.min(1, p)));
}

function tickPosition(
  radius: number,
  speedRatio: number
): { x: number; y: number } {
  const a = angleForSpeedRatio(speedRatio);
  return {
    x: CX + radius * Math.cos(a),
    y: CY - radius * Math.sin(a),
  };
}

/**
 * Point on the upper semicircle: t ∈ [0,1] is position along the arc from
 * left (0) to right (1). Matches tick placement (10 mph → t = 10/40).
 */
function pointOnArcPath(t: number): { x: number; y: number } {
  const a = Math.PI * (1 - Math.max(0, Math.min(1, t)));
  return {
    x: CX + R * Math.cos(a),
    y: CY - R * Math.sin(a),
  };
}

/** Dense polyline along the arc from t0→t1 (same curve as the track). */
function arcPolylinePoints(t0: number, t1: number): string {
  if (t1 <= t0 + 1e-9) return "";
  const span = t1 - t0;
  const segs = Math.max(10, Math.ceil(56 * span));
  const coords: string[] = [];
  for (let i = 0; i <= segs; i++) {
    const u = t0 + (i / segs) * span;
    const p = pointOnArcPath(u);
    coords.push(`${p.x},${p.y}`);
  }
  return coords.join(" ");
}

type Props = {
  speed: number;
  accelRate: number;
  unit: SpeedUnit;
  onUnitChange: (u: SpeedUnit) => void;
  showAverageColumn?: boolean;
  averageSpeed: number | null;
  topSpeed: number | null;
};

function fmt(n: number, digits: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

type GaugeProps = {
  speed: number;
  unitLabel: string;
  colors: AppTheme;
};

function HalfCircleGauge({ speed, unitLabel, colors: C }: GaugeProps) {
  const d = upperSemiPath();
  /** Fraction of full semicircle (0–1); 10 mph → 0.25 → bar reaches the “10” tick. */
  const tr = Number.isFinite(speed)
    ? Math.max(0, Math.min(1, speed / GAUGE_MAX))
    : 0;

  const z1 = 20 / GAUGE_MAX;
  const z2 = 30 / GAUGE_MAX;

  const g1 = Math.min(tr, z1);
  const y0 = z1;
  const y1 = Math.min(tr, z2);
  const r0 = z2;
  const r1 = tr;

  const ptsG = g1 > 0 ? arcPolylinePoints(0, g1) : "";
  const ptsY = tr > z1 ? arcPolylinePoints(y0, y1) : "";
  const ptsR = tr > z2 ? arcPolylinePoints(r0, r1) : "";

  const labels: number[] = [0, 10, 20, 30, 40];

  return (
    <View style={gaugeStyles.wrap}>
      <Svg
        width="100%"
        height={GH}
        viewBox={`0 0 ${GW} ${GH}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <Path
          d={d}
          fill="none"
          stroke={C.gaugeTrack}
          strokeWidth={STROKE_TRACK}
          strokeLinecap="round"
        />
        {ptsG.length > 0 && (
          <Polyline
            points={ptsG}
            fill="none"
            stroke={C.gaugeGreen}
            strokeWidth={STROKE_FILL}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {ptsY.length > 0 && (
          <Polyline
            points={ptsY}
            fill="none"
            stroke={C.gaugeYellow}
            strokeWidth={STROKE_FILL}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {ptsR.length > 0 && (
          <Polyline
            points={ptsR}
            fill="none"
            stroke={C.gaugeRed}
            strokeWidth={STROKE_FILL}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {labels.map((v) => {
          const pr = v / GAUGE_MAX;
          const outer = tickPosition(R + 2, pr);
          const inner = tickPosition(R - 10, pr);
          const numPos = tickPosition(R + 18, pr);
          const major = v % 20 === 0;
          return (
            <G key={v}>
              <Path
                d={`M ${outer.x} ${outer.y} L ${inner.x} ${inner.y}`}
                stroke={C.border}
                strokeWidth={major ? 2 : 1}
                strokeLinecap="round"
              />
              <SvgText
                x={numPos.x}
                y={numPos.y + 4}
                fill={C.muted}
                fontSize={10}
                fontWeight="600"
                textAnchor="middle"
              >
                {v}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      <View style={gaugeStyles.center} pointerEvents="none">
        <Text style={[gaugeStyles.gaugeTitle, { color: C.muted }]} maxFontSizeMultiplier={FONT_MAX}>
          Ground Speed
        </Text>
        <Text style={[gaugeStyles.gaugeValue, { color: C.text }]} maxFontSizeMultiplier={FONT_MAX}>
          {fmt(speed, 1)}
        </Text>
        <Text style={[gaugeStyles.gaugeUnit, { color: C.muted }]} maxFontSizeMultiplier={FONT_MAX}>
          {unitLabel}
        </Text>
      </View>
    </View>
  );
}

const gaugeStyles = StyleSheet.create({
  wrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: 4,
  },
  center: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  gaugeTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  gaugeValue: {
    fontSize: 44,
    fontWeight: "700",
    letterSpacing: -1.2,
    fontVariant: ["tabular-nums"],
    lineHeight: 48,
  },
  gaugeUnit: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});

function createStyles(C: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: C.bgElevated,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: C.radius,
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 16,
    },
    rowTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 4,
    },
    rowTopSpacer: { flex: 1 },
    unitToggle: {
      flexDirection: "row",
      backgroundColor: C.bgWell,
      borderRadius: 10,
      padding: 3,
      borderWidth: 1,
      borderColor: C.border,
    },
    unitBtn: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
    },
    unitBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: C.muted,
    },
    unitBtnTextOn: {
      color: C.text,
    },
    speedColumns: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 14,
      marginBottom: 10,
    },
    speedColPrimary: {
      flex: 1,
      minWidth: 0,
    },
    speedColAvg: {
      flex: 1.15,
      minWidth: 0,
      borderLeftWidth: 1,
      borderLeftColor: C.border,
      paddingLeft: 14,
      justifyContent: "center",
      paddingTop: 24,
    },
    speedStatPair: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    speedStatCell: {
      flex: 1,
      minWidth: 0,
    },
    speedStatDivider: {
      borderLeftWidth: 1,
      borderLeftColor: C.border,
      paddingLeft: 12,
    },
    avgKicker: {
      fontSize: 11,
      fontWeight: "600",
      color: C.muted,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      marginBottom: 4,
    },
    avgValueRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 8,
    },
    avgValue: {
      fontSize: 36,
      fontWeight: "600",
      lineHeight: 40,
      color: C.text,
      letterSpacing: -0.5,
      fontVariant: ["tabular-nums"],
    },
    avgUnit: {
      fontSize: 15,
      fontWeight: "600",
      color: C.muted,
    },
    accelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    accelLabel: {
      fontSize: 14,
      color: C.muted,
    },
    accelValue: {
      fontSize: 15,
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
    },
  });
}

export function SpeedReadout({
  speed,
  accelRate,
  unit,
  onUnitChange,
  showAverageColumn = false,
  averageSpeed,
  topSpeed,
}: Props) {
  const C = useAppTheme();
  const styles = useMemo(() => createStyles(C), [C]);
  const unitLabel = unit === "mph" ? "MPH" : "KM/H";
  const rateLabel = unit === "mph" ? "mph/s" : "km/h/s";

  const unitOnStyle = {
    backgroundColor: C.unitToggleActiveBg,
    borderWidth: 1,
    borderColor: C.unitToggleActiveBorder,
  };

  return (
    <View
      style={styles.card}
      accessibilityLabel={`Ground speed ${fmt(speed, 1)} ${unitLabel}`}
    >
      <View style={styles.rowTop}>
        <View style={styles.rowTopSpacer} />
        <View
          style={styles.unitToggle}
          accessibilityRole="radiogroup"
          accessibilityLabel="Speed unit"
        >
          <Pressable
            onPress={() => {
              hapticLight();
              onUnitChange("mph");
            }}
            style={[styles.unitBtn, unit === "mph" && unitOnStyle]}
            accessibilityRole="radio"
            accessibilityState={{ selected: unit === "mph" }}
            accessibilityLabel="Miles per hour"
          >
            <Text
              style={[styles.unitBtnText, unit === "mph" && styles.unitBtnTextOn]}
              maxFontSizeMultiplier={FONT_MAX}
            >
              MPH
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              hapticLight();
              onUnitChange("kmh");
            }}
            style={[styles.unitBtn, unit === "kmh" && unitOnStyle]}
            accessibilityRole="radio"
            accessibilityState={{ selected: unit === "kmh" }}
            accessibilityLabel="Kilometers per hour"
          >
            <Text
              style={[styles.unitBtnText, unit === "kmh" && styles.unitBtnTextOn]}
              maxFontSizeMultiplier={FONT_MAX}
            >
              KM/H
            </Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.speedColumns}>
        <View style={styles.speedColPrimary}>
          <HalfCircleGauge speed={speed} unitLabel={unitLabel} colors={C} />
        </View>
        {showAverageColumn && (
          <View
            style={styles.speedColAvg}
            accessibilityLabel="Average and top speed"
          >
            <View style={styles.speedStatPair}>
              <View
                style={styles.speedStatCell}
                accessibilityLabel="Average speed"
              >
                <Text style={styles.avgKicker} maxFontSizeMultiplier={FONT_MAX}>
                  Average speed
                </Text>
                <View style={styles.avgValueRow}>
                  <Text style={styles.avgValue} maxFontSizeMultiplier={FONT_MAX}>
                    {averageSpeed === null ? "—" : fmt(averageSpeed, 1)}
                  </Text>
                  <Text style={styles.avgUnit} maxFontSizeMultiplier={FONT_MAX}>
                    {unitLabel}
                  </Text>
                </View>
              </View>
              <View
                style={[styles.speedStatCell, styles.speedStatDivider]}
                accessibilityLabel="Top speed"
              >
                <Text style={styles.avgKicker} maxFontSizeMultiplier={FONT_MAX}>
                  Top speed
                </Text>
                <View style={styles.avgValueRow}>
                  <Text style={styles.avgValue} maxFontSizeMultiplier={FONT_MAX}>
                    {topSpeed === null ? "—" : fmt(topSpeed, 1)}
                  </Text>
                  <Text style={styles.avgUnit} maxFontSizeMultiplier={FONT_MAX}>
                    {unitLabel}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
      <View style={styles.accelRow}>
        <Text style={styles.accelLabel} maxFontSizeMultiplier={FONT_MAX}>
          Accel / decel
        </Text>
        <Text
          style={[
            styles.accelValue,
            { color: accelRate >= 0 ? C.green : C.red },
          ]}
          maxFontSizeMultiplier={FONT_MAX}
          accessibilityLabel={`Acceleration ${accelRate >= 0 ? "positive" : "negative"} ${fmt(accelRate, 2)} ${rateLabel}`}
        >
          {accelRate >= 0 ? "+" : ""}
          {fmt(accelRate, 2)} {rateLabel}
        </Text>
      </View>
    </View>
  );
}
