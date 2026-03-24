import { Pressable, StyleSheet, Text, View } from "react-native";
import { C } from "../theme/colors";
import type { SpeedUnit } from "../hooks/useFender";

type Props = {
  speed: number;
  accelRate: number;
  unit: SpeedUnit;
  onUnitChange: (u: SpeedUnit) => void;
};

function fmt(n: number, digits: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export function SpeedReadout({ speed, accelRate, unit, onUnitChange }: Props) {
  const unitLabel = unit === "mph" ? "MPH" : "KM/H";
  const rateLabel = unit === "mph" ? "mph/s" : "km/h/s";

  return (
    <View style={styles.card} accessibilityLabel="Speed and acceleration">
      <View style={styles.rowTop}>
        <Text style={styles.kicker}>Ground speed</Text>
        <View style={styles.unitToggle} accessibilityRole="radiogroup">
          <Pressable
            onPress={() => onUnitChange("mph")}
            style={[styles.unitBtn, unit === "mph" && styles.unitBtnOn]}
          >
            <Text style={[styles.unitBtnText, unit === "mph" && styles.unitBtnTextOn]}>
              MPH
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onUnitChange("kmh")}
            style={[styles.unitBtn, unit === "kmh" && styles.unitBtnOn]}
          >
            <Text style={[styles.unitBtnText, unit === "kmh" && styles.unitBtnTextOn]}>
              KM/H
            </Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.speedRow}>
        <Text style={styles.speedValue}>{fmt(speed, 1)}</Text>
        <Text style={styles.speedUnit}>{unitLabel}</Text>
      </View>
      <View style={styles.accelRow}>
        <Text style={styles.accelLabel}>Accel / decel</Text>
        <Text
          style={[
            styles.accelValue,
            { color: accelRate >= 0 ? C.green : C.red },
          ]}
        >
          {accelRate >= 0 ? "+" : ""}
          {fmt(accelRate, 2)} {rateLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.bgElevated,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: C.radius,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  kicker: {
    fontSize: 13,
    fontWeight: "600",
    color: C.muted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
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
  unitBtnOn: {
    backgroundColor: "rgba(61, 158, 255, 0.2)",
    borderWidth: 1,
    borderColor: C.accentDim,
  },
  unitBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.muted,
  },
  unitBtnTextOn: {
    color: C.text,
  },
  speedRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    marginBottom: 14,
  },
  speedValue: {
    fontSize: 52,
    fontWeight: "600",
    lineHeight: 56,
    color: C.text,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  speedUnit: {
    fontSize: 18,
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
