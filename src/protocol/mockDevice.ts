import type { FenderDeviceTransport, FenderDeviceListener } from "./device";
import type { FenderLightsCommand, FenderLightsStatus, FenderTelemetry } from "./types";

const TURN_LAT_THRESHOLD = 2.2; // m/s² — demo tuning
const TAIL_DECEL_THRESHOLD = -1.8; // m/s² along axis
const HAZARD_BLINK_MS = 450;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Integrates noisy accel into a plausible speed + derives auto lights for UI preview.
 * Replace with real BLE notifications in production.
 */
export class MockFenderDevice implements FenderDeviceTransport {
  private listeners = new Set<FenderDeviceListener>();
  private raf = 0;
  private cmd: FenderLightsCommand = {
    headlightMode: "off",
    hazardsOn: false,
    manualTurn: "off",
  };
  private status: FenderLightsStatus = {
    headlightMode: "off",
    hazardsOn: false,
    tailOn: false,
    turnFrontLeft: false,
    turnFrontRight: false,
    turnRearLeft: false,
    turnRearRight: false,
  };
  private telem: FenderTelemetry = {
    speedMs: 0,
    accelAlongMs2: 0,
    accelLateralMs2: 0,
    timestampMs: performance.now(),
  };
  private _connected = false;
  private t0 = performance.now();
  private hazardPhase = false;

  get connected(): boolean {
    return this._connected;
  }

  async connect(): Promise<void> {
    if (this._connected) return;
    this._connected = true;
    this.t0 = performance.now();
    const loop = () => {
      this.tick();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  disconnect(): void {
    this._connected = false;
    cancelAnimationFrame(this.raf);
    this.emit();
  }

  async setCommand(cmd: FenderLightsCommand): Promise<void> {
    this.cmd = {
      ...cmd,
      manualTurn: cmd.manualTurn ?? "off",
    };
    this.applyCommandToStatus();
    this.emit();
  }

  subscribe(onUpdate: FenderDeviceListener): () => void {
    this.listeners.add(onUpdate);
    onUpdate({ ...this.status }, { ...this.telem });
    return () => this.listeners.delete(onUpdate);
  }

  private emit(): void {
    for (const fn of this.listeners) {
      fn({ ...this.status }, { ...this.telem });
    }
  }

  private applyCommandToStatus(): void {
    this.status.headlightMode = this.cmd.headlightMode;
    this.status.hazardsOn = this.cmd.hazardsOn;
  }

  private tick(): void {
    if (!this._connected) return;
    const t = (performance.now() - this.t0) / 1000;
    // Synthetic rider input: swooping lateral + throttle/brake along axis
    const along =
      3 * Math.sin(t * 0.7) +
      2.2 * Math.sin(t * 1.9 + 0.4) +
      (Math.sin(t * 3.1) > 0.85 ? -4 : 0);
    const lateral =
      3.8 * Math.sin(t * 1.1 + 0.2) + 1.4 * Math.sin(t * 2.4 + 1.1);

    const prevSpeed = this.telem.speedMs;
    const dt = 1 / 60;
    const speedMs = clamp(prevSpeed + along * dt, 0, 28);
    const smoothedAlong = along * 0.85 + this.telem.accelAlongMs2 * 0.15;
    const smoothedLat = lateral * 0.82 + this.telem.accelLateralMs2 * 0.18;

    this.telem = {
      speedMs,
      accelAlongMs2: smoothedAlong,
      accelLateralMs2: smoothedLat,
      timestampMs: performance.now(),
    };

    this.applyCommandToStatus();

    if (this.cmd.hazardsOn) {
      this.hazardPhase = Math.floor(performance.now() / HAZARD_BLINK_MS) % 2 === 0;
      const on = this.hazardPhase;
      this.status.turnFrontLeft = on;
      this.status.turnFrontRight = on;
      this.status.turnRearLeft = on;
      this.status.turnRearRight = on;
      this.status.tailOn = on;
    } else if (this.cmd.manualTurn === "left") {
      this.status.turnFrontLeft = true;
      this.status.turnRearLeft = true;
      this.status.turnFrontRight = false;
      this.status.turnRearRight = false;
      this.status.tailOn = smoothedAlong <= TAIL_DECEL_THRESHOLD;
    } else if (this.cmd.manualTurn === "right") {
      this.status.turnFrontLeft = false;
      this.status.turnRearLeft = false;
      this.status.turnFrontRight = true;
      this.status.turnRearRight = true;
      this.status.tailOn = smoothedAlong <= TAIL_DECEL_THRESHOLD;
    } else {
      const left = smoothedLat <= -TURN_LAT_THRESHOLD;
      const right = smoothedLat >= TURN_LAT_THRESHOLD;
      this.status.turnFrontLeft = left;
      this.status.turnRearLeft = left;
      this.status.turnFrontRight = right;
      this.status.turnRearRight = right;
      this.status.tailOn = smoothedAlong <= TAIL_DECEL_THRESHOLD;
    }

    this.emit();
  }
}
