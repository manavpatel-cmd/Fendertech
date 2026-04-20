import { Satisfy_400Regular, useFonts } from "@expo-google-fonts/satisfy";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Line,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

const TAGLINE_FONT = "Satisfy_400Regular";
import { hapticLight } from "../utils/haptics";

const BG = "#0d1b2a";

type Props = {
  onFinish: () => void;
};

/**
 * Animated intro after the static native splash: kickflip-style 3D flip + ollie arc.
 */
export function SplashStunt({ onFinish }: Props) {
  const { width, height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const finishedRef = useRef(false);
  const [fontsLoaded] = useFonts({ Satisfy_400Regular });

  const boardW = Math.min(320, width * 0.72);
  const boardH = boardW * 0.44;
  const taglineSize = Math.min(30, Math.max(22, width * 0.068));

  useEffect(() => {
    if (!fontsLoaded) return;

    let cancelled = false;

    const run = async () => {
      if (Platform.OS !== "web") {
        try {
          await SplashScreen.hideAsync();
        } catch {
          /* ignore */
        }
      }
      if (cancelled) return;

      Animated.timing(progress, {
        toValue: 1,
        duration: 2600,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished || cancelled || finishedRef.current) return;
        finishedRef.current = true;
        hapticLight();
        onFinish();
      });
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [fontsLoaded, onFinish, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 0.38, 0.55, 0.72, 1],
    outputRange: [0, -height * 0.11, -height * 0.035, height * 0.01, 0],
  });

  const rotateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "720deg"],
  });

  const rotateY = progress.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: ["-12deg", "14deg", "0deg"],
  });

  const rotateZ = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["-6deg", "8deg", "0deg"],
  });

  const scale = progress.interpolate({
    inputRange: [0, 0.35, 0.42, 0.62, 0.75, 1],
    outputRange: [1, 1.06, 0.94, 1.04, 0.98, 1],
  });

  const shadowOpacity = progress.interpolate({
    inputRange: [0, 0.38, 0.55, 1],
    outputRange: [0.35, 0.12, 0.28, 0.35],
  });

  const taglineOpacity = progress.interpolate({
    inputRange: [0, 0.1, 0.22, 1],
    outputRange: [0, 0.4, 1, 1],
  });

  if (!fontsLoaded) {
    return <View style={styles.root} />;
  }

  return (
    <View style={styles.root} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.column}>
        <View style={styles.boardBlock}>
          <Animated.View
            style={[
              styles.shadow,
              {
                width: boardW * 0.88,
                height: boardW * 0.12,
                borderRadius: boardW * 0.06,
                opacity: shadowOpacity,
                transform: [{ translateY: height * 0.055 }],
              },
            ]}
          />
          <Animated.View
            style={{
              width: boardW,
              height: boardH,
              transform: [
                { perspective: 900 },
                { translateY },
                { rotateX },
                { rotateY },
                { rotateZ },
                { scale },
              ],
            }}
          >
            <Svg width={boardW} height={boardH} viewBox="0 0 260 108">
              <Defs>
                <LinearGradient id="deck" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#ffe082" />
                  <Stop offset="35%" stopColor="#e6bc2f" />
                  <Stop offset="70%" stopColor="#c9a227" />
                  <Stop offset="100%" stopColor="#7a6220" />
                </LinearGradient>
                <LinearGradient id="deckEdge" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#5c4818" stopOpacity={0.55} />
                  <Stop offset="50%" stopColor="#f5e6a6" stopOpacity={0.35} />
                  <Stop offset="100%" stopColor="#5c4818" stopOpacity={0.55} />
                </LinearGradient>
                <LinearGradient id="grip" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#2d3a4d" />
                  <Stop offset="100%" stopColor="#1a2332" />
                </LinearGradient>
                <LinearGradient id="truckMetal" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#e8ecf0" />
                  <Stop offset="40%" stopColor="#9aa3ad" />
                  <Stop offset="100%" stopColor="#5c656e" />
                </LinearGradient>
                <LinearGradient id="wheelRubber" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#5a5a5a" />
                  <Stop offset="100%" stopColor="#1e1e1e" />
                </LinearGradient>
                <LinearGradient id="wheelSide" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor="#f5f5f5" />
                  <Stop offset="50%" stopColor="#d0d0d0" />
                  <Stop offset="100%" stopColor="#a8a8a8" />
                </LinearGradient>
              </Defs>

              <G>
                {/* Deck body — popsicle outline */}
                <Path
                  d="M 22 46
                     C 22 34, 34 28, 48 28
                     L 212 28
                     C 226 28, 238 34, 238 46
                     L 238 58
                     C 238 68, 230 74, 218 74
                     L 42 74
                     C 30 74, 22 68, 22 58
                     Z"
                  fill="url(#deck)"
                />
                <Path
                  d="M 22 46
                     C 22 34, 34 28, 48 28
                     L 212 28
                     C 226 28, 238 34, 238 46
                     L 238 58
                     C 238 68, 230 74, 218 74
                     L 42 74
                     C 30 74, 22 68, 22 58
                     Z"
                  fill="none"
                  stroke="url(#deckEdge)"
                  strokeWidth={1.2}
                />
                {/* Grip tape */}
                <Path
                  d="M 32 36 L 228 36 L 226 52 L 34 52 Z"
                  fill="url(#grip)"
                  opacity={0.92}
                />
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <Line
                    key={i}
                    x1={46 + i * 26}
                    y1={36}
                    x2={28 + i * 26}
                    y2={52}
                    stroke="#ffffff"
                    strokeOpacity={0.07}
                    strokeWidth={1.2}
                  />
                ))}
                {/* Hardware */}
                {(
                  [
                    [54, 62],
                    [74, 62],
                    [186, 62],
                    [206, 62],
                  ] as const
                ).map(([cx, cy], i) => (
                  <G key={`b-${i}`}>
                    <Circle cx={cx} cy={cy} r={3.2} fill="#4a4030" />
                    <Circle cx={cx} cy={cy} r={1.6} fill="#8a7a60" />
                  </G>
                ))}
                {/* Trucks (top view) */}
                <Rect x={44} y={66} width={52} height={7} rx={2} fill="url(#truckMetal)" />
                <Rect x={164} y={66} width={52} height={7} rx={2} fill="url(#truckMetal)" />
                <Rect x={58} y={64} width={24} height={3} rx={1} fill="#6a737c" opacity={0.9} />
                <Rect x={178} y={64} width={24} height={3} rx={1} fill="#6a737c" opacity={0.9} />
                {/* Wheels + highlights */}
                {(
                  [
                    [38, 84],
                    [62, 88],
                    [198, 88],
                    [222, 84],
                  ] as const
                ).map(([cx, cy], i) => (
                  <G key={`w-${i}`}>
                    <Circle cx={cx} cy={cy} r={11} fill="url(#wheelRubber)" />
                    <Ellipse cx={cx - 2} cy={cy - 3} rx={5} ry={7} fill="url(#wheelSide)" opacity={0.85} />
                    <Circle cx={cx} cy={cy} r={4.5} fill="#2a2a2a" />
                    <Circle cx={cx - 1.5} cy={cy - 1.5} r={1.4} fill="#606060" />
                  </G>
                ))}
                {/* Rail shine */}
                <Rect x={24} y={50} width={212} height={2} rx={1} fill="#ffffff" opacity={0.22} />
              </G>
            </Svg>
          </Animated.View>
        </View>

        <Animated.Text
          style={[
            styles.tagline,
            {
              fontSize: taglineSize,
              fontFamily: TAGLINE_FONT,
              opacity: taglineOpacity,
              marginTop: Math.min(28, height * 0.035),
            },
          ]}
        >
          Let&apos;s get you rollin
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: "center",
    alignItems: "center",
  },
  column: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  boardBlock: {
    alignItems: "center",
    justifyContent: "center",
  },
  shadow: {
    backgroundColor: "#000",
  },
  tagline: {
    color: "#f4d56a",
    textAlign: "center",
    letterSpacing: 0.6,
    textShadowColor: "rgba(122, 98, 32, 0.95)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    maxWidth: 340,
  },
});
