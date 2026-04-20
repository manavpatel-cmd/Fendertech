# FenderGuard ESP32 Firmware (PlatformIO)

This firmware exposes the BLE service/characteristics used by the app in `src/protocol/types.ts` and streams telemetry packets the app already decodes.

## What It Implements

- BLE Service UUID: `e4c53780-e0e0-4a8c-9f9a-4c5f3e2d1a00`
- Characteristics:
  - `CHAR_LIGHTS_CMD` (write): command payload `[head][hazards][manualTurn]`
  - `CHAR_LIGHTS_STATUS` (read/notify): 7-byte status payload
  - `CHAR_TELEMETRY` (read/notify): 16-byte telemetry payload
- IMU input from MPU-6050 over I2C
- Derived light logic:
  - hazards blink
  - manual turn override
  - automatic turn + tail-brake from acceleration thresholds

## Wiring Defaults

These come from `build_flags` in `platformio.ini` and can be changed there:

- I2C: `SDA=21`, `SCL=22`, `MPU_ADDR=0x68`
- Light outputs:
  - `HEAD_L=18`, `HEAD_R=19`
  - `TAIL_L=25`, `TAIL_R=26`
  - `TURN_FL=27`, `TURN_FR=14`
  - `TURN_RL=33`, `TURN_RR=32`

## Build / Flash

From this folder:

```bash
pio run
pio run -t upload
pio device monitor
```

Or in Cursor PlatformIO, open `firmware/esp32` as the PlatformIO project and click Upload.

## iPhone: why the ESP32 does not show in Settings → Bluetooth

**Settings → Bluetooth** on iOS is aimed at **Classic Bluetooth** pairing (cars, speakers, headphones). The ESP32 firmware uses **BLE (Bluetooth Low Energy)** as a custom GATT server. Many BLE devices **never appear** under “Other Devices” there, even when they are working.

To confirm the board is advertising:

1. Install **nRF Connect** or **LightBlue** from the App Store and run a **BLE scan** — you should see **FenderGuard-SIM** (simulator build) or **FenderGuard-ESP32** (MPU build).
2. In **FenderGuard**, open the Bluetooth menu and tap **Scan & connect** (not the iOS Settings screen).

Also check the serial monitor (`pio device monitor`, 115200 baud) for `FenderGuard ESP32 simulator boot` or `FenderGuard ESP32 boot` after flashing.

## Notes

- Axis mapping assumes MPU X=longitudinal, Y=lateral. If your sensor is mounted differently, swap/sign-flip in `main.cpp`.
- Headlight levels are currently digital on/off outputs. Replace with PWM/current-driver control if needed.
