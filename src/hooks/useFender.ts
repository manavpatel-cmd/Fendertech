import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FenderDeviceTransport } from "../protocol/device";
import type {
  FenderLightsCommand,
  FenderLightsStatus,
  FenderTelemetry,
  ManualTurn,
} from "../protocol/types";
import { MockFenderDevice } from "../protocol/mockDevice";

export type SpeedUnit = "mph" | "kmh";

function msToMph(ms: number): number {
  return ms * 2.2369362921;
}

function msToKmh(ms: number): number {
  return ms * 3.6;
}

/** Longitudinal acceleration in speed-units per second (derived from m/s²). */
function accelMs2ToRate(accelMs2: number, unit: SpeedUnit): number {
  return unit === "mph" ? accelMs2 * 2.2369362921 : accelMs2 * 3.6;
}

const NEAR_ZERO_MS = 0.05;
const IDLE_MS = 5 * 60 * 1000;
const SPEED_UNIT_KEY = "@fenderguard/speedUnit";

export function useFender(transport?: FenderDeviceTransport) {
  const device = useMemo(() => transport ?? new MockFenderDevice(), [transport]);
  const [connected, setConnected] = useState(false);
  const [lights, setLights] = useState<FenderLightsStatus>({
    headlightMode: "off",
    hazardsOn: false,
    tailOn: false,
    turnFrontLeft: false,
    turnFrontRight: false,
    turnRearLeft: false,
    turnRearRight: false,
  });
  const [telem, setTelem] = useState<FenderTelemetry>({
    speedMs: 0,
    accelAlongMs2: 0,
    accelLateralMs2: 0,
    timestampMs: 0,
  });
  const [speedUnit, setSpeedUnitState] = useState<SpeedUnit>("mph");
  const [lastSessionAvgMs, setLastSessionAvgMs] = useState<number | null>(null);
  const [stationaryLongConnected, setStationaryLongConnected] = useState(false);
  const [manualTurn, setManualTurnState] = useState<ManualTurn>("off");

  const sumMsRef = useRef(0);
  const countRef = useRef(0);
  const zeroSinceRef = useRef<number | null>(null);
  const prevConnectedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(SPEED_UNIT_KEY);
        if (!cancelled && (raw === "mph" || raw === "kmh")) {
          setSpeedUnitState(raw);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setSpeedUnit = useCallback((u: SpeedUnit) => {
    setSpeedUnitState(u);
    void AsyncStorage.setItem(SPEED_UNIT_KEY, u).catch(() => {});
  }, []);

  useEffect(() => {
    const unsub = device.subscribe((l, t) => {
      setLights(l);
      setTelem(t);
      const nowConnected = device.connected;
      setConnected(nowConnected);

      if (nowConnected) {
        sumMsRef.current += t.speedMs;
        countRef.current += 1;
        if (t.speedMs < NEAR_ZERO_MS) {
          if (zeroSinceRef.current === null) {
            zeroSinceRef.current = Date.now();
          }
        } else {
          zeroSinceRef.current = null;
        }
      }
    });
    return unsub;
  }, [device]);

  useEffect(() => {
    const c = connected;
    if (prevConnectedRef.current && !c) {
      if (countRef.current > 0) {
        setLastSessionAvgMs(sumMsRef.current / countRef.current);
      }
    }
    if (!prevConnectedRef.current && c) {
      sumMsRef.current = 0;
      countRef.current = 0;
      zeroSinceRef.current = null;
      setStationaryLongConnected(false);
    }
    prevConnectedRef.current = c;
  }, [connected]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!connected) {
        setStationaryLongConnected(false);
        return;
      }
      const z = zeroSinceRef.current;
      setStationaryLongConnected(
        z !== null && Date.now() - z >= IDLE_MS
      );
    }, 1000);
    return () => clearInterval(id);
  }, [connected]);

  const connect = useCallback(async () => {
    await device.connect();
    setConnected(device.connected);
  }, [device]);

  const disconnect = useCallback(() => {
    device.disconnect();
    setConnected(false);
  }, [device]);

  const sendCommand = useCallback(
    async (cmd: FenderLightsCommand) => {
      let mt: ManualTurn =
        cmd.manualTurn !== undefined ? cmd.manualTurn : manualTurn;
      if (cmd.hazardsOn) {
        mt = "off";
      }
      setManualTurnState(mt);
      await device.setCommand({
        headlightMode: cmd.headlightMode,
        hazardsOn: cmd.hazardsOn,
        manualTurn: mt,
      });
    },
    [device, manualTurn]
  );

  const setManualTurn = useCallback(
    (t: ManualTurn) => {
      void sendCommand({
        headlightMode: lights.headlightMode,
        hazardsOn: lights.hazardsOn,
        manualTurn: t,
      });
    },
    [sendCommand, lights.headlightMode, lights.hazardsOn]
  );

  const speedDisplay =
    speedUnit === "mph" ? msToMph(telem.speedMs) : msToKmh(telem.speedMs);

  const accelRateDisplay = accelMs2ToRate(telem.accelAlongMs2, speedUnit);

  const averageSpeedDisplay = useMemo(() => {
    const sessionAvgMs =
      countRef.current > 0 ? sumMsRef.current / countRef.current : null;
    const ms =
      connected && stationaryLongConnected
        ? sessionAvgMs
        : !connected
          ? lastSessionAvgMs
          : null;
    if (ms === null) return null;
    return speedUnit === "mph" ? msToMph(ms) : msToKmh(ms);
  }, [
    connected,
    stationaryLongConnected,
    lastSessionAvgMs,
    speedUnit,
    telem.timestampMs,
  ]);

  const showAverageColumn = !connected || stationaryLongConnected;

  return {
    connected,
    connect,
    disconnect,
    lights,
    telem,
    sendCommand,
    manualTurn,
    setManualTurn,
    speedUnit,
    setSpeedUnit,
    speedDisplay,
    accelRateDisplay,
    averageSpeedDisplay,
    showAverageColumn,
  };
}
