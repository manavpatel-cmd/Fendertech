import { useCallback, useEffect, useMemo, useState } from "react";
import type { FenderDeviceTransport } from "../protocol/device";
import type {
  FenderLightsCommand,
  FenderLightsStatus,
  FenderTelemetry,
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
  const [speedUnit, setSpeedUnit] = useState<SpeedUnit>("mph");

  useEffect(() => {
    const unsub = device.subscribe((l, t) => {
      setLights(l);
      setTelem(t);
      setConnected(device.connected);
    });
    return unsub;
  }, [device]);

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
      await device.setCommand(cmd);
    },
    [device]
  );

  const speedDisplay =
    speedUnit === "mph" ? msToMph(telem.speedMs) : msToKmh(telem.speedMs);

  const accelRateDisplay = accelMs2ToRate(telem.accelAlongMs2, speedUnit);

  return {
    connected,
    connect,
    disconnect,
    lights,
    telem,
    sendCommand,
    speedUnit,
    setSpeedUnit,
    speedDisplay,
    accelRateDisplay,
  };
}
