/**
 * App-controlled headlight mode (firmware maps to driver current/PWM).
 * Hardware: two headlamps (L/R) use the same mode.
 */
export type HeadlightMode = "off" | "low" | "high";

export interface FenderLightsCommand {
  headlightMode: HeadlightMode;
  hazardsOn: boolean;
}

/**
 * Reported by firmware; turn/tail driven by accelerometer logic on device.
 * Two tail lamps (L/R) share `tailOn`. UI syncs hazard flash timing locally.
 */
export interface FenderLightsStatus {
  headlightMode: HeadlightMode;
  hazardsOn: boolean;
  tailOn: boolean;
  turnFrontLeft: boolean;
  turnFrontRight: boolean;
  turnRearLeft: boolean;
  turnRearRight: boolean;
}

/** Speed along board axis + lateral for UI/diagnostics (firmware may send fused estimate). */
export interface FenderTelemetry {
  /** m/s along primary ride axis (signed: forward positive). */
  speedMs: number;
  /** m/s² along ride axis (forward positive ≈ acceleration). */
  accelAlongMs2: number;
  /** m/s² lateral (signed: right positive in board frame). */
  accelLateralMs2: number;
  timestampMs: number;
}

export interface FenderState {
  connected: boolean;
  lights: FenderLightsStatus;
  telemetry: FenderTelemetry;
}

/** Replace with your registered 128-bit UUIDs before production. */
export const BLE_SERVICE_UUID = "e4c53780-e0e0-4a8c-9f9a-4c5f3e2d1a00";
export const CHAR_LIGHTS_CMD = "e4c53781-e0e0-4a8c-9f9a-4c5f3e2d1a01";
export const CHAR_LIGHTS_STATUS = "e4c53782-e0e0-4a8c-9f9a-4c5f3e2d1a02";
export const CHAR_TELEMETRY = "e4c53783-e0e0-4a8c-9f9a-4c5f3e2d1a03";

/** Wire format: [head 0–2][hazards 0–1][tail][FL][FR][RL][RR] — booleans 0/1. */
export function encodeLightsCommand(cmd: FenderLightsCommand): Uint8Array {
  const head = cmd.headlightMode === "off" ? 0 : cmd.headlightMode === "low" ? 1 : 2;
  return new Uint8Array([head, cmd.hazardsOn ? 1 : 0]);
}

export function decodeLightsStatus(data: Uint8Array): FenderLightsStatus | null {
  if (data.length < 7) return null;
  const headByte = data[0];
  const head: HeadlightMode =
    headByte === 2 ? "high" : headByte === 1 ? "low" : "off";
  return {
    headlightMode: head,
    hazardsOn: data[1] !== 0,
    tailOn: data[2] !== 0,
    turnFrontLeft: data[3] !== 0,
    turnFrontRight: data[4] !== 0,
    turnRearLeft: data[5] !== 0,
    turnRearRight: data[6] !== 0,
  };
}

/** Float32 little-endian: speed, along, lateral + uint32 timestamp. */
export function decodeTelemetry(data: DataView): FenderTelemetry | null {
  if (data.byteLength < 16) return null;
  return {
    speedMs: data.getFloat32(0, true),
    accelAlongMs2: data.getFloat32(4, true),
    accelLateralMs2: data.getFloat32(8, true),
    timestampMs: data.getUint32(12, true),
  };
}
