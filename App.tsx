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
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { SpeedReadout } from "./src/components/SpeedReadout";
import { SkateboardDiagram } from "./src/components/SkateboardDiagram";
import { useFender } from "./src/hooks/useFender";
import type { HeadlightMode } from "./src/protocol/types";
import { createDefaultTransport } from "./src/transport/createDefaultTransport";
import { C } from "./src/theme/colors";

export default function App() {
  const transport = useMemo(() => createDefaultTransport(), []);
  const {
    connected,
    connect,
    disconnect,
    lights,
    sendCommand,
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

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.top}>
            <View style={styles.topText}>
              <Text style={styles.company}>SSR Tech</Text>
              <Text style={styles.companyTag}>Skate, Scoot, Ride Technologies</Text>
              <Text style={styles.brand}>FenderGuard</Text>
              <Text style={styles.h1}>Rider console</Text>
              <Text style={styles.lead}>
                {Platform.OS === "web"
                  ? "Web preview: motion demo only — no Bluetooth. Use the iOS app on a real iPhone for BLE."
                  : isPreview
                    ? "Simulator uses a motion demo — no Bluetooth. Run on an iPhone for BLE."
                    : "Native iOS app: scan finds a fender advertising the FenderGuard BLE service."}
              </Text>
            </View>
            <Pressable
              onPress={() => setBtMenuOpen(true)}
              style={({ pressed }) => [
                styles.conn,
                styles.btHit,
                pressed && styles.btHitPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Bluetooth, open connection menu"
            >
              <Ionicons name="bluetooth" size={22} color={C.accent} />
              <View
                style={[
                  styles.pill,
                  {
                    backgroundColor: connected
                      ? "rgba(61, 220, 151, 0.15)"
                      : "rgba(255, 77, 77, 0.12)",
                    borderColor: connected
                      ? "rgba(61, 220, 151, 0.45)"
                      : "rgba(255, 77, 77, 0.35)",
                  },
                ]}
              >
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: connected ? C.green : C.red },
                  ]}
                />
                <Text style={styles.pillText}>
                  {connected ? "Connected" : "Disconnected"}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={C.muted} />
            </Pressable>
          </View>

          <Modal
            visible={btMenuOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setBtMenuOpen(false)}
          >
            <View style={styles.modalRoot}>
              <Pressable
                style={styles.modalBackdrop}
                onPress={() => setBtMenuOpen(false)}
              />
              <View style={styles.modalCenter} pointerEvents="box-none">
                <View style={styles.modalCard}>
                  <View style={styles.modalHeader}>
                    <Ionicons name="bluetooth" size={26} color={C.accent} />
                    <Text style={styles.modalTitle}>Bluetooth</Text>
                  </View>
                  <Text style={styles.modalProduct}>FenderGuard accessory</Text>
                  <Text style={styles.modalStatus}>
                    {connected ? "Connected to fender" : "Not connected"}
                  </Text>
                  <Text style={styles.modalBody}>
                    {Platform.OS === "web"
                      ? "Web preview has no Bluetooth. Use the iOS build on an iPhone to scan for a fender that advertises the FenderGuard service."
                      : isPreview
                        ? "Simulator uses the motion demo only. On a real iPhone, scan finds hardware advertising the FenderGuard BLE service."
                        : "Stay within range. The app scans for the FenderGuard service UUID — power on your fender and tap connect below."}
                  </Text>
                  <Pressable
                    onPress={() => void onModalPrimary()}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.btn,
                      (pressed || busy) && styles.btnPressed,
                      styles.modalBtn,
                    ]}
                  >
                    {busy ? (
                      <ActivityIndicator color="#081018" />
                    ) : (
                      <Text style={styles.btnText}>
                        {connected ? "Disconnect" : connectLabel}
                      </Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => setBtMenuOpen(false)}
                    style={styles.modalClose}
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
              onHeadChange={onHeadChange}
              onHazardToggle={onHazardToggle}
            />
          </View>

          <View style={styles.foot}>
            <Text style={styles.footText}>
              © SSR Tech · FenderGuard. Protocol UUIDs in{" "}
              <Text style={styles.code}>src/protocol/types.ts</Text>. Native iOS:{" "}
              <Text style={styles.code}>npx expo prebuild</Text> then{" "}
              <Text style={styles.code}>npx expo run:ios</Text>.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: {
    maxWidth: 920,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
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
  conn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-end",
  },
  btHit: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  btHitPressed: { opacity: 0.85 },
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
    borderColor: "rgba(61,158,255,0.5)",
    minWidth: 160,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  btnPressed: { opacity: 0.88 },
  btnText: {
    fontWeight: "700",
    fontSize: 14,
    color: "#081018",
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
