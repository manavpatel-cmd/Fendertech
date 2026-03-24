import * as Device from "expo-device";
import type { FenderDeviceTransport } from "../protocol/device";
import { BlePlxTransport } from "../protocol/blePlxTransport";
import { MockFenderDevice } from "../protocol/mockDevice";

/**
 * Physical devices use BLE. Simulators have no Bluetooth — use the mock loop.
 */
export function createDefaultTransport(): FenderDeviceTransport {
  if (Device.isDevice) {
    return new BlePlxTransport();
  }
  return new MockFenderDevice();
}
