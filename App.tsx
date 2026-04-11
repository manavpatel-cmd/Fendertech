/**
 * FenderGuard (SSR Tech) — main screen.
 * Edit UI in ./src/components/ and colors in ./src/theme/colors.ts.
 * preview.html is a standalone browser demo only; this Expo app is the source you iterate on.
 */
import * as Device from "expo-device";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { SpeedReadout } from "./src/components/SpeedReadout";
import { SkateboardDiagram } from "./src/components/SkateboardDiagram";
import { useFender } from "./src/hooks/useFender";
import type { HeadlightMode } from "./src/protocol/types";
import { createDefaultTransport } from "./src/transport/createDefaultTransport";
import {
  useThemePreference,
  type ThemePreference,
} from "./src/hooks/useThemePreference";
import { ThemeProvider, useAppTheme } from "./src/theme/ThemeContext";
import type { AppTheme } from "./src/theme/colors";
import { hapticLight, hapticMedium } from "./src/utils/haptics";

const FONT_MAX = 1.35;

function createAppStyles(C: AppTheme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    scroll: {
      maxWidth: 920,
      width: "100%",
      alignSelf: "center",
      paddingBottom: 40,
      paddingTop: 12,
      flexGrow: 1,
    },
    top: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: 20,
      marginBottom: 28,
    },
    topText: { flex: 1, minWidth: 240 },
    company: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: C.muted,
    },
    companyTag: {
      marginTop: 2,
      marginBottom: 4,
      fontSize: 12,
      color: C.muted,
      opacity: 0.9,
    },
    brand: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 2,
      textTransform: "uppercase",
      color: C.accent,
    },
    h1: {
      marginTop: 6,
      marginBottom: 8,
      fontSize: 28,
      fontWeight: "700",
      color: C.text,
      letterSpacing: -0.5,
    },
    lead: {
      fontSize: 15,
      lineHeight: 22,
      color: C.muted,
      maxWidth: 480,
    },
    topActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      alignSelf: "flex-end",
    },
    conn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    btHit: {
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.bgWell,
    },
    btHitPressed: { opacity: 0.85 },
    themePress: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.bgWell,
      maxWidth: 200,
    },
    themePressLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: C.text,
      letterSpacing: 0.2,
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
    },
    pillText: { fontSize: 13, fontWeight: "600", color: C.text },
    dot: { width: 8, height: 8, borderRadius: 999 },
    btn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: C.accent,
      borderWidth: 1,
      borderColor: C.accentDim,
      minWidth: 160,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
    },
    btnPressed: { opacity: 0.88 },
    btnBusyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    btnText: {
      fontWeight: "700",
      fontSize: 14,
      color: C.onAccentButton,
    },
    grid: { gap: 18 },
    foot: {
      marginTop: 28,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    footText: {
      fontSize: 13,
      lineHeight: 21,
      color: C.muted,
    },
    code: {
      fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
      fontSize: 12,
      color: C.text,
    },
    modalRoot: { flex: 1 },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.55)",
    },
    modalCenter: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    modalCard: {
      backgroundColor: C.bgElevated,
      borderRadius: C.radius,
      borderWidth: 1,
      borderColor: C.border,
      padding: 22,
      maxWidth: 400,
      width: "100%",
      alignSelf: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 8,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 6,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: C.text,
    },
    modalProduct: {
      fontSize: 14,
      color: C.muted,
      marginBottom: 12,
    },
    modalStatus: {
      fontSize: 15,
      fontWeight: "600",
      color: C.text,
      marginBottom: 10,
    },
    modalBody: {
      fontSize: 14,
      lineHeight: 21,
      color: C.muted,
    },
    modalBtn: { marginTop: 16, width: "100%" },
    modalClose: { marginTop: 14, alignItems: "center", paddingVertical: 8 },
    modalCloseText: {
      fontSize: 15,
      fontWeight: "600",
      color: C.accent,
    },
  });
}

type AppShellProps = {
  themePreference: ThemePreference;
  onCycleTheme: () => void;
};

function AppShell({ themePreference, onCycleTheme }: AppShellProps) {
  const { width: winW } = useWindowDimensions();
  const C = useAppTheme();
  const styles = useMemo(() => createAppStyles(C), [C]);
  const scrollPadH = winW < 360 ? 14 : Math.min(22, Math.max(16, winW * 0.05));
  const transport = useMemo(() => createDefaultTransport(), []);
  const {
    connected,
    connect,
    disconnect,
    lights,
    sendCommand,
    manualTurn,
    setManualTurn,
    speedUnit,
    setSpeedUnit,
    speedDisplay,
    accelRateDisplay,
    averageSpeedDisplay,
    showAverageColumn,
  } = useFender(transport);
  const [busy, setBusy] = useState(false);
  const [btMenuOpen, setBtMenuOpen] = useState(false);

  const isPreview =
    Platform.OS === "web" || !Device.isDevice;
  const connectLabel = isPreview ? "Connect (demo)" : "Scan & connect";

  const onModalPrimary = async () => {
    if (connected) {
      disconnect();
      setBtMenuOpen(false);
      return;
    }
    setBusy(true);
    try {
      await connect();
      setBtMenuOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      Alert.alert("Could not connect", msg);
    } finally {
      setBusy(false);
    }
  };

  const onHeadChange = (mode: HeadlightMode) => {
    void sendCommand({ headlightMode: mode, hazardsOn: lights.hazardsOn });
  };

  const onHazardToggle = () => {
    void sendCommand({
      headlightMode: lights.headlightMode,
      hazardsOn: !lights.hazardsOn,
    });
  };

  const onTurnArrowPress = (side: "left" | "right") => {
    hapticLight();
    const next =
      manualTurn === side ? "off" : side === "left" ? "left" : "right";
    setManualTurn(next);
  };

  const pillConnected = {
    backgroundColor:
      C.statusBarStyle === "light"
        ? "rgba(110, 231, 183, 0.12)"
        : "rgba(13, 148, 136, 0.12)",
    borderColor:
      C.statusBarStyle === "light"
        ? "rgba(110, 231, 183, 0.4)"
        : "rgba(13, 148, 136, 0.38)",
  };
  const pillDisconnected = {
    backgroundColor: "rgba(251, 113, 133, 0.1)",
    borderColor: "rgba(251, 113, 133, 0.35)",
  };

  return (
    <>
      <StatusBar style={C.statusBarStyle} />
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: scrollPadH }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.top}>
            <View style={styles.topText}>
              <Text style={styles.company} maxFontSizeMultiplier={FONT_MAX}>
                SSR Tech
              </Text>
              <Text style={styles.companyTag} maxFontSizeMultiplier={FONT_MAX}>
                Skate, Scoot, Ride Technologies
              </Text>
              <Text style={styles.brand} maxFontSizeMultiplier={FONT_MAX}>
                FenderGuard
              </Text>
              <Text style={styles.h1} maxFontSizeMultiplier={FONT_MAX}>
                Rider console
              </Text>
              <Text style={styles.lead} maxFontSizeMultiplier={FONT_MAX}>
                {Platform.OS === "web"
                  ? "Web preview: motion demo only — no Bluetooth. Use the iOS app on a real iPhone for BLE."
                  : isPreview
                    ? "Simulator uses a motion demo — no Bluetooth. Run on an iPhone for BLE."
                    : "Native iOS app: scan finds a fender advertising the FenderGuard BLE service."}
              </Text>
            </View>
            <View style={styles.topActions}>
              <Pressable
                onPress={() => {
                  hapticLight();
                  onCycleTheme();
                }}
                style={({ pressed }) => [
                  styles.themePress,
                  pressed && styles.btHitPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  themePreference === "auto"
                    ? "Theme automatic, Pacific schedule. Tap to switch to light."
                    : themePreference === "light"
                      ? "Theme light. Tap to switch to dark."
                      : "Theme dark. Tap to switch to automatic schedule."
                }
              >
                <Ionicons
                  name={
                    themePreference === "auto"
                      ? "sync-outline"
                      : themePreference === "light"
                        ? "sunny-outline"
                        : "moon"
                  }
                  size={20}
                  color={C.accent}
                  importantForAccessibility="no"
                />
                <Text style={styles.themePressLabel} maxFontSizeMultiplier={FONT_MAX}>
                  {themePreference === "auto"
                    ? "Auto"
                    : themePreference === "light"
                      ? "Light"
                      : "Dark"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  hapticLight();
                  setBtMenuOpen(true);
                }}
                style={({ pressed }) => [
                  styles.conn,
                  styles.btHit,
                  pressed && styles.btHitPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Bluetooth"
                accessibilityHint="Opens a menu to connect or disconnect from the fender"
                accessibilityState={{ expanded: btMenuOpen }}
              >
                <Ionicons name="bluetooth" size={22} color={C.accent} importantForAccessibility="no" />
                <View
                  style={[
                    styles.pill,
                    connected ? pillConnected : pillDisconnected,
                  ]}
                >
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: connected ? C.green : C.red },
                    ]}
                    importantForAccessibility="no"
                  />
                  <Text style={styles.pillText} maxFontSizeMultiplier={FONT_MAX}>
                    {connected ? "Connected" : "Disconnected"}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color={C.muted} importantForAccessibility="no" />
              </Pressable>
            </View>
          </View>

          <Modal
            visible={btMenuOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setBtMenuOpen(false)}
            accessibilityViewIsModal
          >
            <View style={styles.modalRoot}>
              <Pressable
                style={styles.modalBackdrop}
                onPress={() => setBtMenuOpen(false)}
                accessibilityLabel="Dismiss"
              />
              <View style={styles.modalCenter} pointerEvents="box-none">
                <View style={styles.modalCard} accessibilityRole="none">
                  <View style={styles.modalHeader}>
                    <Ionicons name="bluetooth" size={26} color={C.accent} importantForAccessibility="no" />
                    <Text style={styles.modalTitle} maxFontSizeMultiplier={FONT_MAX}>
                      Bluetooth
                    </Text>
                  </View>
                  <Text style={styles.modalProduct} maxFontSizeMultiplier={FONT_MAX}>
                    FenderGuard accessory
                  </Text>
                  <Text style={styles.modalStatus} maxFontSizeMultiplier={FONT_MAX}>
                    {connected ? "Connected to fender" : "Not connected"}
                  </Text>
                  <Text style={styles.modalBody} maxFontSizeMultiplier={FONT_MAX}>
                    {Platform.OS === "web"
                      ? "Web preview has no Bluetooth. Use the iOS build on an iPhone to scan for a fender that advertises the FenderGuard service."
                      : isPreview
                        ? "Simulator uses the motion demo only. On a real iPhone, scan finds hardware advertising the FenderGuard BLE service."
                        : "Stay within range. The app scans for the FenderGuard service UUID — power on your fender and tap connect below."}
                  </Text>
                  <Pressable
                    onPress={() => {
                      hapticMedium();
                      void onModalPrimary();
                    }}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.btn,
                      (pressed || busy) && styles.btnPressed,
                      styles.modalBtn,
                    ]}
                    accessibilityLabel={
                      busy
                        ? "Connecting"
                        : connected
                          ? "Disconnect from fender"
                          : connectLabel
                    }
                    accessibilityState={{ busy }}
                  >
                    {busy ? (
                      <View style={styles.btnBusyRow}>
                        <ActivityIndicator color={C.onAccentButton} />
                        <Text style={styles.btnText}>Connecting…</Text>
                      </View>
                    ) : (
                      <Text style={styles.btnText}>
                        {connected ? "Disconnect" : connectLabel}
                      </Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setBtMenuOpen(false);
                    }}
                    style={styles.modalClose}
                    accessibilityLabel="Close Bluetooth menu"
                  >
                    <Text style={styles.modalCloseText}>Close</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>

          <View style={styles.grid}>
            <SpeedReadout
              speed={speedDisplay}
              accelRate={accelRateDisplay}
              unit={speedUnit}
              onUnitChange={setSpeedUnit}
              showAverageColumn={showAverageColumn}
              averageSpeed={averageSpeedDisplay}
            />
            <SkateboardDiagram
              lights={lights}
              connected={connected}
              manualTurn={manualTurn}
              onHeadChange={onHeadChange}
              onHazardToggle={onHazardToggle}
              onTurnArrowPress={onTurnArrowPress}
            />
          </View>

          <View style={styles.foot}>
            <Text style={styles.footText} maxFontSizeMultiplier={FONT_MAX}>
              © SSR Tech · FenderGuard. Protocol UUIDs in{" "}
              <Text style={styles.code}>src/protocol/types.ts</Text>. Native iOS:{" "}
              <Text style={styles.code}>npx expo prebuild</Text> then{" "}
              <Text style={styles.code}>npx expo run:ios</Text>.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

export default function App() {
  const { isDark, preference, cyclePreference } = useThemePreference();
  return (
    <SafeAreaProvider>
      <ThemeProvider isDark={isDark}>
        <AppShell themePreference={preference} onCycleTheme={cyclePreference} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
