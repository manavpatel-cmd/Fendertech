import type { FenderDeviceTransport } from "../protocol/device";
import { MockFenderDevice } from "../protocol/mockDevice";

/** Browser preview: always the motion demo (no Bluetooth stack). */
export function createDefaultTransport(): FenderDeviceTransport {
  return new MockFenderDevice();
}
