import { fromByteArray, toByteArray } from "base64-js";
import { BleManager, State, type Device, type Subscription } from "react-native-ble-plx";
import type { FenderDeviceListener, FenderDeviceTransport } from "./device";
import type { FenderLightsCommand, FenderLightsStatus, FenderTelemetry } from "./types";
import {
  BLE_SERVICE_UUID,
  CHAR_LIGHTS_CMD,
  CHAR_LIGHTS_STATUS,
  CHAR_TELEMETRY,
  decodeLightsStatus,
  decodeTelemetry,
  encodeLightsCommand,
} from "./types";

function normUuid(u: string): string {
  return u.replace(/-/g, "").toLowerCase();
}

function uuidMatch(observed: string, expected: string): boolean {
  return normUuid(observed) === normUuid(expected);
}

function toBase64(bytes: Uint8Array): string {
  return fromByteArray(bytes);
}

function fromBase64(b64: string): Uint8Array {
  return new Uint8Array(toByteArray(b64));
}

const SCAN_MS = 30_000;

export class BlePlxTransport implements FenderDeviceTransport {
  private manager = new BleManager();
  private listeners = new Set<FenderDeviceListener>();
  private subs: Subscription[] = [];
  private device: Device | null = null;
  private _connected = false;
  private lights: FenderLightsStatus = {
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
    timestampMs: 0,
  };
  private pairing = false;
  private peerName: string | null = null;

  get connected(): boolean {
    return this._connected;
  }

  get peerDisplayName(): string | null {
    return this.peerName;
  }

  subscribe(onUpdate: FenderDeviceListener): () => void {
    this.listeners.add(onUpdate);
    onUpdate({ ...this.lights }, { ...this.telem });
    return () => this.listeners.delete(onUpdate);
  }

  private emit(): void {
    for (const fn of this.listeners) {
      fn({ ...this.lights }, { ...this.telem });
    }
  }

  private async ensurePoweredOn(): Promise<void> {
    const initial = await this.manager.state();
    if (initial === State.PoweredOn) return;
    await new Promise<void>((resolve, reject) => {
      const sub = this.manager.onStateChange((s) => {
        if (s === State.PoweredOn) {
          sub.remove();
          resolve();
        } else if (
          s === State.Unauthorized ||
          s === State.Unsupported ||
          s === State.PoweredOff
        ) {
          sub.remove();
          reject(new Error(`Bluetooth is ${s}. Enable Bluetooth and try again.`));
        }
      }, true);
    });
  }

  async connect(): Promise<void> {
    if (this._connected || this.pairing) return;
    this.pairing = true;
    try {
      await this.ensurePoweredOn();
      const found = await this.scanFirstMatch();
      await this.attach(found);
    } finally {
      this.pairing = false;
    }
  }

  private scanFirstMatch(): Promise<Device> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.manager.stopDeviceScan();
        reject(
          new Error(
            "No fender found. Power it on, stay nearby, and try again."
          )
        );
      }, SCAN_MS);

      this.manager.startDeviceScan([BLE_SERVICE_UUID], null, (error, d) => {
        if (settled) return;
        if (error) {
          settled = true;
          clearTimeout(timer);
          this.manager.stopDeviceScan();
          reject(error);
          return;
        }
        if (!d) return;
        settled = true;
        clearTimeout(timer);
        this.manager.stopDeviceScan();
        resolve(d);
      });
    });
  }

  private async attach(raw: Device): Promise<void> {
    const d = await raw.connect({ timeout: 15000 });
    await d.discoverAllServicesAndCharacteristics();

    const services = await d.services();
    const svc = services.find((s) => uuidMatch(s.uuid, BLE_SERVICE_UUID));
    if (!svc) {
      await d.cancelConnection();
      throw new Error("FenderGuard service not found on this device.");
    }

    const chars = await svc.characteristics();
    const byUuid = (u: string) => chars.find((c) => uuidMatch(c.uuid, u));

    const cmd = byUuid(CHAR_LIGHTS_CMD);
    const st = byUuid(CHAR_LIGHTS_STATUS);
    const tel = byUuid(CHAR_TELEMETRY);
    if (!cmd || !st || !tel) {
      await d.cancelConnection();
      throw new Error("Missing BLE characteristics. Update fender firmware.");
    }

    this.clearMonitors();
    this.device = d;
    this.peerName = d.name ?? d.localName ?? null;

    this.subs.push(
      d.monitorCharacteristicForService(
        BLE_SERVICE_UUID,
        CHAR_LIGHTS_STATUS,
        (err, c) => {
          if (err || !c?.value) return;
          const parsed = decodeLightsStatus(fromBase64(c.value));
          if (parsed) {
            this.lights = parsed;
            this.emit();
          }
        }
      )
    );

    this.subs.push(
      d.monitorCharacteristicForService(
        BLE_SERVICE_UUID,
        CHAR_TELEMETRY,
        (err, c) => {
          if (err || !c?.value) return;
          const bytes = fromBase64(c.value);
          const dv = new DataView(
            bytes.buffer,
            bytes.byteOffset,
            bytes.byteLength
          );
          const parsed = decodeTelemetry(dv);
          if (parsed) {
            this.telem = parsed;
            this.emit();
          }
        }
      )
    );

    d.onDisconnected(() => {
      this.handleDisconnect();
    });

    this._connected = true;
    this.emit();
  }

  private clearMonitors(): void {
    for (const s of this.subs) s.remove();
    this.subs = [];
  }

  private handleDisconnect(): void {
    this.clearMonitors();
    this.device = null;
    this.peerName = null;
    this._connected = false;
    this.emit();
  }

  disconnect(): void {
    this.manager.stopDeviceScan();
    this.clearMonitors();
    const d = this.device;
    this.device = null;
    this.peerName = null;
    this._connected = false;
    if (d) void d.cancelConnection();
    this.emit();
  }

  async setCommand(cmd: FenderLightsCommand): Promise<void> {
    const d = this.device;
    if (!d || !this._connected) return;
    const payload = toBase64(encodeLightsCommand(cmd));
    await d.writeCharacteristicWithResponseForService(
      BLE_SERVICE_UUID,
      CHAR_LIGHTS_CMD,
      payload
    );
    this.lights = {
      ...this.lights,
      headlightMode: cmd.headlightMode,
      hazardsOn: cmd.hazardsOn,
    };
    this.emit();
  }
}
