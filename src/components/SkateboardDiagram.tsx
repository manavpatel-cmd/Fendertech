import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import { useAppTheme } from "../theme/ThemeContext";
import type { AppTheme } from "../theme/colors";
import type {
  FenderLightsStatus,
  HeadlightMode,
  ManualTurn,
} from "../protocol/types";
import { hapticLight } from "../utils/haptics";
import { useSyncedHazardPhase } from "./useSyncedHazardPhase";

/** Closed path: waisted skate deck (top view), viewBox 0 0 340 520, symmetric about x=170 */
const DECK_OUTLINE =
  "M 120 68 Q 170 44 220 68 C 232 125 228 200 203 256 C 192 295 215 385 220 448 Q 170 468 120 448 C 125 385 148 295 137 256 C 112 200 108 125 120 68 Z";

const TRUCK_X1 = 40;
const TRUCK_X2 = 300;
const TRUCK_Y_FRONT = 122;
const TRUCK_Y_REAR = 398;

type Props = {
  lights: FenderLightsStatus;
  connected: boolean;
  manualTurn: ManualTurn;
  onHeadChange: (mode: HeadlightMode) => void;
  onHazardToggle: () => void;
  onTurnArrowPress: (side: "left" | "right") => void;
};

export function SkateboardDiagram({
  lights,
  connected,
  manualTurn,
  onHeadChange,
  onHazardToggle,
  onTurnArrowPress,
}: Props) {
  const C = useAppTheme();
  const styles = useMemo(() => createDiagramStyles(C), [C]);
  const head = lights.headlightMode;
  const hazardPhase = useSyncedHazardPhase(lights.hazardsOn);
  const { width: winW } = useWindowDimensions();
  const svgW = Math.min(380, winW - 40);
  const svgH = (svgW / 340) * 520;

  const tailLit = lights.hazardsOn ? hazardPhase : lights.tailOn;

  return (
    <View style={styles.wrap} accessibilityLabel="Skateboard lighting">
      <View style={styles.header}>
        <Text style={styles.title} maxFontSizeMultiplier={1.35}>
          Board lights
        </Text>
        <Text style={styles.sub} maxFontSizeMultiplier={1.35}>
          Two headlamps and two tail lamps (left/right). Hazards flash in sync on
          both sides. Use the side arrows for turn indicators, or let the demo IMU
          steer them when hazards are off.
        </Text>
      </View>

      <View style={styles.diagram}>
        <View style={styles.diagramWithArrows}>
          <Pressable
            disabled={!connected || lights.hazardsOn}
            onPress={() => onTurnArrowPress("left")}
            style={({ pressed }) => [
              styles.turnArrow,
              manualTurn === "left" && styles.turnArrowActive,
              (!connected || lights.hazardsOn) && styles.turnArrowDisabled,
              pressed && connected && !lights.hazardsOn && styles.turnArrowPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Left turn signal"
            accessibilityHint="Toggles the left turn indicators. Tap again to turn off."
            accessibilityState={{
              disabled: !connected || lights.hazardsOn,
              selected: manualTurn === "left",
            }}
          >
            <Ionicons
              name="chevron-back"
              size={26}
              color={
                !connected || lights.hazardsOn
                  ? C.muted
                  : manualTurn === "left"
                    ? C.accent
                    : C.text
              }
            />
          </Pressable>
          <Svg width={svgW} height={svgH} viewBox="0 0 340 520">
          {/* Trucks + wheels (behind deck) */}
          <Line
            x1={TRUCK_X1}
            y1={TRUCK_Y_FRONT}
            x2={TRUCK_X2}
            y2={TRUCK_Y_FRONT}
            stroke={C.truck}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Line
            x1={TRUCK_X1}
            y1={TRUCK_Y_REAR}
            x2={TRUCK_X2}
            y2={TRUCK_Y_REAR}
            stroke={C.truck}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <Wheel cx={TRUCK_X1} cy={TRUCK_Y_FRONT} colors={C} />
          <Wheel cx={TRUCK_X2} cy={TRUCK_Y_FRONT} colors={C} />
          <Wheel cx={TRUCK_X1} cy={TRUCK_Y_REAR} colors={C} />
          <Wheel cx={TRUCK_X2} cy={TRUCK_Y_REAR} colors={C} />

          {/* Deck wireframe + centerline */}
          <Path
            d={DECK_OUTLINE}
            fill="none"
            stroke={C.deckWireDim}
            strokeWidth={5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Path
            d={DECK_OUTLINE}
            fill="none"
            stroke={C.deckWire}
            strokeWidth={1.75}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <Line
            x1={170}
            y1={76}
            x2={170}
            y2={444}
            stroke={C.deckWireDim}
            strokeWidth={1}
            strokeDasharray="4 6"
          />

          <SvgText
            x={170}
            y={268}
            textAnchor="middle"
            fill={C.muted}
            opacity={0.45}
            fontSize={12}
            fontWeight="600"
          >
            TOP VIEW
          </SvgText>

          <SvgText
            x={170}
            y={38}
            textAnchor="middle"
            fill={C.muted}
            fontSize={11}
            fontWeight="600"
          >
            Headlights (L / R)
          </SvgText>
          <HeadBulb cx={128} cy={58} head={head} interactive colors={C} />
          <HeadBulb cx={212} cy={58} head={head} interactive colors={C} />

          <CornerLamp
            cx={26}
            cy={TRUCK_Y_FRONT}
            turnOn={lights.turnFrontLeft}
            hazardOn={lights.hazardsOn}
            hazardPhase={hazardPhase}
            colors={C}
          />
          <CornerLamp
            cx={314}
            cy={TRUCK_Y_FRONT}
            turnOn={lights.turnFrontRight}
            hazardOn={lights.hazardsOn}
            hazardPhase={hazardPhase}
            colors={C}
          />
          <CornerLamp
            cx={26}
            cy={TRUCK_Y_REAR}
            turnOn={lights.turnRearLeft}
            hazardOn={lights.hazardsOn}
            hazardPhase={hazardPhase}
            colors={C}
          />
          <CornerLamp
            cx={314}
            cy={TRUCK_Y_REAR}
            turnOn={lights.turnRearRight}
            hazardOn={lights.hazardsOn}
            hazardPhase={hazardPhase}
            colors={C}
          />
          <SvgText
            x={26}
            y={TRUCK_Y_FRONT + 22}
            textAnchor="middle"
            fill={C.text}
            fontSize={9}
            fontWeight="700"
            opacity={0.85}
          >
            L
          </SvgText>
          <SvgText
            x={314}
            y={TRUCK_Y_FRONT + 22}
            textAnchor="middle"
            fill={C.text}
            fontSize={9}
            fontWeight="700"
            opacity={0.85}
          >
            R
          </SvgText>
          <SvgText
            x={26}
            y={TRUCK_Y_REAR + 22}
            textAnchor="middle"
            fill={C.text}
            fontSize={9}
            fontWeight="700"
            opacity={0.85}
          >
            L
          </SvgText>
          <SvgText
            x={314}
            y={TRUCK_Y_REAR + 22}
            textAnchor="middle"
            fill={C.text}
            fontSize={9}
            fontWeight="700"
            opacity={0.85}
          >
            R
          </SvgText>

          <SvgText
            x={170}
            y={418}
            textAnchor="middle"
            fill={C.muted}
            fontSize={11}
            fontWeight="600"
          >
            Tail lights (L / R)
          </SvgText>
          <TailBulb cx={128} cy={452} on={tailLit} colors={C} />
          <TailBulb cx={212} cy={452} on={tailLit} colors={C} />

        </Svg>
          <Pressable
            disabled={!connected || lights.hazardsOn}
            onPress={() => onTurnArrowPress("right")}
            style={({ pressed }) => [
              styles.turnArrow,
              manualTurn === "right" && styles.turnArrowActive,
              (!connected || lights.hazardsOn) && styles.turnArrowDisabled,
              pressed && connected && !lights.hazardsOn && styles.turnArrowPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Right turn signal"
            accessibilityHint="Toggles the right turn indicators. Tap again to turn off."
            accessibilityState={{
              disabled: !connected || lights.hazardsOn,
              selected: manualTurn === "right",
            }}
          >
            <Ionicons
              name="chevron-forward"
              size={26}
              color={
                !connected || lights.hazardsOn
                  ? C.muted
                  : manualTurn === "right"
                    ? C.accent
                    : C.text
              }
            />
          </Pressable>
        </View>

        <View
          style={[styles.headSeg, { width: svgW - 24, alignSelf: "center" }]}
          accessibilityRole="radiogroup"
          accessibilityLabel="Headlight brightness"
        >
          {(
            [
              ["off", "Off"],
              ["low", "Low"],
              ["high", "High"],
            ] as const
          ).map(([mode, label]) => (
            <Pressable
              key={mode}
              disabled={!connected}
              onPress={() => {
                hapticLight();
                onHeadChange(mode);
              }}
              style={({ pressed }) => [
                styles.segBtn,
                head === mode && styles.segBtnOn,
                !connected && styles.segBtnDisabled,
                pressed && connected && styles.segBtnPressed,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: head === mode, disabled: !connected }}
              accessibilityLabel={`Headlights ${label}`}
            >
              <Text
                style={[
                  styles.segBtnText,
                  head === mode && styles.segBtnTextOn,
                ]}
                maxFontSizeMultiplier={1.35}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.hazardBar, { maxWidth: svgW }]}>
          <Text style={styles.hazardLabel} maxFontSizeMultiplier={1.35}>
            Hazard lights
          </Text>
          <Pressable
            disabled={!connected}
            onPress={() => {
              hapticLight();
              onHazardToggle();
            }}
            style={({ pressed }) => [
              styles.hazardBtn,
              lights.hazardsOn && styles.hazardBtnOn,
              !connected && styles.btnDisabled,
              pressed && connected && styles.hazardBtnPressed,
            ]}
            accessibilityRole="switch"
            accessibilityState={{ checked: lights.hazardsOn, disabled: !connected }}
            accessibilityLabel="Hazard lights"
          >
            <Text
              style={[
                styles.hazardBtnText,
                lights.hazardsOn && styles.hazardBtnTextOn,
              ]}
              maxFontSizeMultiplier={1.35}
            >
              {lights.hazardsOn ? "On" : "Off"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.legend}>
          <View style={styles.li}>
            <View style={[styles.dot, { backgroundColor: C.headLow }]} />
            <Text style={styles.legendText} maxFontSizeMultiplier={1.35}>
              Head (app)
            </Text>
          </View>
          <View style={styles.li}>
            <View style={[styles.dot, { backgroundColor: C.turn }]} />
            <Text style={styles.legendText} maxFontSizeMultiplier={1.35}>
              Turn (IMU)
            </Text>
          </View>
          <View style={styles.li}>
            <View style={[styles.dot, { backgroundColor: C.tail }]} />
            <Text style={styles.legendText} maxFontSizeMultiplier={1.35}>
              Tail ×2 (decel)
            </Text>
          </View>
          <View style={styles.li}>
            <View style={[styles.dot, { backgroundColor: C.hazard }]} />
            <Text style={styles.legendText} maxFontSizeMultiplier={1.35}>
              Hazard (app)
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function Wheel({ cx, cy, colors: C }: { cx: number; cy: number; colors: AppTheme }) {
  return (
    <G transform={`translate(${cx},${cy})`}>
      <Rect
        x={-6}
        y={-16}
        width={12}
        height={32}
        rx={4}
        ry={4}
        fill={C.wheel}
        stroke={C.border}
        strokeWidth={0.75}
      />
    </G>
  );
}

function CornerLamp({
  cx,
  cy,
  turnOn,
  hazardOn,
  hazardPhase,
  colors: C,
}: {
  cx: number;
  cy: number;
  turnOn: boolean;
  hazardOn: boolean;
  hazardPhase: boolean;
  colors: AppTheme;
}) {
  let fill: string;
  let opacity: number;
  if (hazardOn) {
    fill = C.hazard;
    opacity = hazardPhase ? 1 : 0.22;
  } else {
    fill = turnOn ? C.turn : C.lampOff;
    opacity = turnOn ? 1 : 0.35;
  }
  return (
    <G>
      <Circle cx={cx} cy={cy} r={18} fill={fill} opacity={opacity * 0.35} />
      <Circle
        cx={cx}
        cy={cy}
        r={11}
        fill={fill}
        opacity={opacity}
        stroke={C.lampStroke}
        strokeWidth={1}
      />
    </G>
  );
}

function HeadBulb({
  cx,
  cy,
  head,
  interactive,
  colors: C,
}: {
  cx: number;
  cy: number;
  head: HeadlightMode;
  interactive?: boolean;
  colors: AppTheme;
}) {
  const color =
    head === "off" ? "dim" : head === "low" ? "headLow" : "headHigh";
  const fills = {
    dim: C.lampOff,
    headLow: C.headLow,
    headHigh: C.headHigh,
  } as const;
  const active = color !== "dim";
  const fill = fills[color];
  const opacity = active ? 1 : 0.4;
  return (
    <G>
      <Circle cx={cx} cy={cy} r={20} fill={fill} opacity={active ? 0.25 : 0.12} />
      <Circle
        cx={cx}
        cy={cy}
        r={12}
        fill={fill}
        opacity={opacity}
        stroke={interactive ? C.accentDim : C.lampStroke}
        strokeWidth={interactive ? 2 : 1}
      />
    </G>
  );
}

function TailBulb({
  cx,
  cy,
  on,
  colors: C,
}: {
  cx: number;
  cy: number;
  on: boolean;
  colors: AppTheme;
}) {
  const fill = on ? C.tail : C.lampOff;
  const opacity = on ? 1 : 0.35;
  return (
    <G>
      <Circle cx={cx} cy={cy} r={20} fill={fill} opacity={on ? 0.25 : 0.12} />
      <Circle
        cx={cx}
        cy={cy}
        r={12}
        fill={fill}
        opacity={opacity}
        stroke={C.lampStroke}
        strokeWidth={1}
      />
    </G>
  );
}

function createDiagramStyles(C: AppTheme) {
  return StyleSheet.create({
    wrap: {
      backgroundColor: C.bgElevated,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: C.radius,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 20,
    },
    header: { marginBottom: 14 },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: C.text,
      letterSpacing: -0.3,
    },
    sub: {
      marginTop: 8,
      fontSize: 14,
      lineHeight: 20,
      color: C.muted,
      maxWidth: 520,
    },
    diagram: { gap: 14 },
    diagramWithArrows: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      width: "100%",
    },
    turnArrow: {
      width: 40,
      minHeight: 200,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.bgWell,
      flexShrink: 0,
    },
    turnArrowActive: {
      backgroundColor: C.unitToggleActiveBg,
      borderColor: C.unitToggleActiveBorder,
    },
    turnArrowDisabled: { opacity: 0.45 },
    turnArrowPressed: { opacity: 0.88 },
    headSeg: {
      flexDirection: "row",
      gap: 6,
      justifyContent: "center",
      marginTop: 4,
    },
    segBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: C.bgWell,
      borderWidth: 1,
      borderColor: C.border,
      alignItems: "center",
    },
    segBtnOn: {
      backgroundColor: C.unitToggleActiveBg,
      borderColor: C.unitToggleActiveBorder,
    },
    segBtnPressed: { opacity: 0.85 },
    segBtnDisabled: { opacity: 0.45 },
    segBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: C.muted,
    },
    segBtnTextOn: { color: C.text },
    hazardBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: C.bgWell,
      borderWidth: 1,
      borderColor: C.border,
      alignSelf: "center",
      width: "100%",
    },
    hazardLabel: { fontSize: 14, fontWeight: "600", color: C.muted },
    hazardBtn: {
      paddingVertical: 8,
      paddingHorizontal: 18,
      borderRadius: 10,
      backgroundColor: C.bgSubtle,
      borderWidth: 1,
      borderColor: C.border,
    },
    hazardBtnOn: {
      backgroundColor: C.hazard,
      borderColor: "rgba(217, 119, 6, 0.45)",
    },
    hazardBtnPressed: { opacity: 0.9 },
    hazardBtnText: {
      fontSize: 14,
      fontWeight: "700",
      color: C.muted,
    },
    hazardBtnTextOn: { color: C.onHazardText },
    btnDisabled: { opacity: 0.45 },
    legend: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      marginTop: 4,
      gap: 10,
    },
    li: { flexDirection: "row", alignItems: "center", gap: 8 },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 999,
    },
    legendText: { fontSize: 12, color: C.muted },
  });
}
