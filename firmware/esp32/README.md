# FenderGuard ESP32 Firmware (PlatformIO)

Firmware for the smart-skateboard fender: NimBLE service/characteristics match `src/protocol/types.ts` in the app. Telemetry and light status notifications run at **100 ms** intervals when connected.

## Advertising name

| Build (`platformio.ini` env) | BLE name (GAP / scan response) |
|------------------------------|-------------------------------|
| `esp32dev` (real MPU6050)   | **FenderBoard** |
| `esp32sim` (fake motion)    | **FenderBoard-SIM** |

The iOS app connects by **service UUID**, not strictly by advertised name.

## BLE protocol

- Service UUID: `e4c53780-e0e0-4a8c-9f9a-4c5f3e2d1a00`
- `…a01` write: 3 bytes `[headlightMode][hazardsOn][manualTurn]` (manual: 0 off, 1 left, 2 right)
- `…a02` notify: 7-byte light status (see `types.ts`)
- `…a03` notify: 16-byte telemetry LE — floats `speedMs`, `accelAlongMs2`, `accelLateralMs2`, then `uint32` `millis()`

## Hardware layout (current default)

Pins are set via `build_flags` in `platformio.ini`:

### MPU6050 (I2C)

- `VCC` → ESP32 **3V3**
- `GND` → ESP32 **GND**
- `SDA` → **GPIO 21**
- `SCL` → **GPIO 22**
- MPU I2C address: `0x68`

### LED strings (via 2N2222 + 330 Ω base resistors — common‑emitter switches)

ESP32 grounds through transistors with LED **positive** leads on a separate **5 V** rail (e.g. Elegoo MB V2). **GND** rails are common (ESP32, MB, emitters).

| GPIO | Load |
|------|------|
| **5** | Left amber indicators (pairs) |
| **18** | Right amber indicators (pairs) |
| **19** | Tail brake / red LEDs |

### Light logic (firmware)

- **GPIO 19 (tail)** — automatic only: ON when smoothed longitudinal `accelAlongMs2 <= -1.8 m/s²` (braking), OFF otherwise. Not driven by hazards or app “tail”.
- **GPIO 5 / 18** — **450 ms** blink phase when: hazards, manual turn direction, or lateral accel thresholds (`≤ -2.2` left, `≥ 2.2` right).

Headlight modes from the app are stored and mirrored in BLE status bytes but **drive no pins** on this PCB.

## Build / flash

From `firmware/esp32`:

```bash
pio run
pio run -t upload
pio device monitor
```

## iPhone: BLE vs Settings → Bluetooth

The ESP32 is a **BLE GATT** peripheral. It often does **not** appear under **Settings → Bluetooth**.

Use **nRF Connect** or **LightBlue** to verify **FenderBoard** / **FenderBoard-SIM** is advertising. In **FenderGuard**, use **Scan & connect**.

## Notes

- Axis mapping assumes MPU **X ≈ longitudinal**, **Y ≈ lateral**. Adjust sign/mapping in `src/main.cpp` if the board is mounted differently.
- `speedMs` is integrated from longitudinal acceleration plus rolling drag near standstill — no GPS.
