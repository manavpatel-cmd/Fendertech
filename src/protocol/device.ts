import type {
  FenderLightsCommand,
  FenderLightsStatus,
  FenderTelemetry,
} from "./types";

export type FenderDeviceListener = (
  lights: FenderLightsStatus,
  telem: FenderTelemetry
) => void;

/** Implement with Web Bluetooth / native BLE; mock fills this contract in dev. */
export interface FenderDeviceTransport {
  connect(): Promise<void>;
  disconnect(): void;
  setCommand(cmd: FenderLightsCommand): Promise<void>;
  subscribe(
    onUpdate: FenderDeviceListener
  ): () => void;
  get connected(): boolean;
  /** BLE peripheral name when connected; null for mock / no peer. */
  get peerDisplayName(): string | null;
}
