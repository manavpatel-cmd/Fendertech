#if defined(__clang__) && !defined(__XTENSA__)
#define CFG_SDA_PIN 21
#define CFG_SCL_PIN 22
#define CFG_MPU_ADDR 0x68
#define CFG_PIN_LEFT_AMBER 5
#define CFG_PIN_RIGHT_AMBER 18
#define CFG_PIN_TAIL_RED 19
int main() { return 0; }
#else

#include <Arduino.h>
#include <NimBLEDevice.h>
#include <Wire.h>

#include <array>
#include <cmath>
#include <cstdint>
#include <cstring>

namespace {

constexpr const char *BLE_NAME = "FenderBoard";
constexpr const char *BLE_SERVICE_UUID = "e4c53780-e0e0-4a8c-9f9a-4c5f3e2d1a00";
constexpr const char *CHAR_LIGHTS_CMD = "e4c53781-e0e0-4a8c-9f9a-4c5f3e2d1a01";
constexpr const char *CHAR_LIGHTS_STATUS = "e4c53782-e0e0-4a8c-9f9a-4c5f3e2d1a02";
constexpr const char *CHAR_TELEMETRY = "e4c53783-e0e0-4a8c-9f9a-4c5f3e2d1a03";

constexpr uint8_t SDA_PIN = CFG_SDA_PIN;
constexpr uint8_t SCL_PIN = CFG_SCL_PIN;
constexpr uint8_t MPU_ADDR = CFG_MPU_ADDR;
constexpr uint8_t PIN_LEFT_AMBER = CFG_PIN_LEFT_AMBER;
constexpr uint8_t PIN_RIGHT_AMBER = CFG_PIN_RIGHT_AMBER;
constexpr uint8_t PIN_TAIL_RED = CFG_PIN_TAIL_RED;

constexpr uint8_t MPU_REG_PWR_MGMT_1 = 0x6B;
constexpr uint8_t MPU_REG_ACCEL_CONFIG = 0x1C;
constexpr uint8_t MPU_REG_ACCEL_XOUT_H = 0x3B;

constexpr float K_G = 9.80665f;
constexpr float K_ACCEL_LSB_PER_G_4G = 8192.0f; // +/-4g
constexpr float K_LOW_PASS_ALPHA = 0.85f;       // smoothed = 0.85*raw + 0.15*prev

constexpr float TURN_LAT_THRESHOLD = 2.2f;
constexpr float TAIL_DECEL_THRESHOLD = -1.8f;
constexpr float AUTO_LEAN_MIN_SPEED_MS = 1.0f;
constexpr float STATIONARY_ACCEL_MAG_THRESHOLD = 0.3f;
constexpr uint32_t STATIONARY_RESET_MS = 2000;
constexpr uint32_t BLINK_PERIOD_MS = 450;
constexpr uint32_t TELEMETRY_PERIOD_MS = 100;
constexpr uint32_t STATUS_PERIOD_MS = 100;
constexpr uint32_t DEBUG_PRINT_PERIOD_MS = 1000;

enum class ManualTurn : uint8_t { Off = 0, Left = 1, Right = 2 };

struct LightsState {
  uint8_t headlightMode = 0;
  bool hazardsOn = false;
  ManualTurn manualTurn = ManualTurn::Off;
  bool tailOn = false;
  bool turnFrontLeft = false;
  bool turnFrontRight = false;
  bool turnRearLeft = false;
  bool turnRearRight = false;
};

struct TelemetryState {
  float speedMs = 0.0f;
  float accelAlongMs2 = 0.0f;
  float accelLateralMs2 = 0.0f;
};

NimBLEServer *g_server = nullptr;
NimBLECharacteristic *g_charStatus = nullptr;
NimBLECharacteristic *g_charTelemetry = nullptr;
volatile bool g_connected = false;

LightsState g_lights;
TelemetryState g_telem;

uint32_t g_lastTickMs = 0;
uint32_t g_lastTelemNotifyMs = 0;
uint32_t g_lastStatusNotifyMs = 0;
uint32_t g_lastDebugPrintMs = 0;
uint32_t g_stationarySinceMs = 0;
float g_alongBiasMs2 = 0.0f;
float g_lateralBiasMs2 = 0.0f;

template <typename T>
T clamp(T v, T lo, T hi) {
  return (v < lo) ? lo : ((v > hi) ? hi : v);
}

void setOutputPins() {
  digitalWrite(PIN_LEFT_AMBER, g_lights.turnFrontLeft ? HIGH : LOW);
  digitalWrite(PIN_RIGHT_AMBER, g_lights.turnFrontRight ? HIGH : LOW);
  digitalWrite(PIN_TAIL_RED, g_lights.tailOn ? HIGH : LOW);
}

void putFloatLE(uint8_t *dst, float v) { std::memcpy(dst, &v, sizeof(float)); }
void putUint32LE(uint8_t *dst, uint32_t v) { std::memcpy(dst, &v, sizeof(uint32_t)); }

std::array<uint8_t, 16> encodeTelemetry(const TelemetryState &t, uint32_t nowMs) {
  std::array<uint8_t, 16> out{};
  putFloatLE(out.data() + 0, t.speedMs);
  putFloatLE(out.data() + 4, t.accelAlongMs2);
  putFloatLE(out.data() + 8, t.accelLateralMs2);
  putUint32LE(out.data() + 12, nowMs);
  return out;
}

std::array<uint8_t, 7> encodeStatus(const LightsState &s) {
  return {static_cast<uint8_t>(clamp<uint8_t>(s.headlightMode, 0, 2)),
          static_cast<uint8_t>(s.hazardsOn ? 1u : 0u), static_cast<uint8_t>(s.tailOn ? 1u : 0u),
          static_cast<uint8_t>(s.turnFrontLeft ? 1u : 0u), static_cast<uint8_t>(s.turnFrontRight ? 1u : 0u),
          static_cast<uint8_t>(s.turnRearLeft ? 1u : 0u), static_cast<uint8_t>(s.turnRearRight ? 1u : 0u)};
}

bool mpuWriteReg(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(reg);
  Wire.write(value);
  return Wire.endTransmission() == 0;
}

bool readMpuAccel(float &axMs2, float &ayMs2, float &azMs2) {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(MPU_REG_ACCEL_XOUT_H);
  if (Wire.endTransmission(false) != 0) return false;

  constexpr uint8_t kBytes = 6;
  if (Wire.requestFrom(static_cast<int>(MPU_ADDR), static_cast<int>(kBytes), static_cast<int>(true)) != kBytes) {
    return false;
  }

  const int16_t axRaw = static_cast<int16_t>((Wire.read() << 8) | Wire.read());
  const int16_t ayRaw = static_cast<int16_t>((Wire.read() << 8) | Wire.read());
  const int16_t azRaw = static_cast<int16_t>((Wire.read() << 8) | Wire.read());
  axMs2 = (static_cast<float>(axRaw) / K_ACCEL_LSB_PER_G_4G) * K_G;
  ayMs2 = (static_cast<float>(ayRaw) / K_ACCEL_LSB_PER_G_4G) * K_G;
  azMs2 = (static_cast<float>(azRaw) / K_ACCEL_LSB_PER_G_4G) * K_G;
  return true;
}

void calibrateMpuBias() {
  constexpr uint16_t kSamples = 160;
  float sumAlong = 0.0f;
  float sumLat = 0.0f;
  uint16_t ok = 0;
  for (uint16_t i = 0; i < kSamples; ++i) {
    float ax = 0.0f, ay = 0.0f, az = 0.0f;
    if (readMpuAccel(ax, ay, az)) {
      sumAlong += ax;
      sumLat += ay;
      ok++;
    }
    delay(5);
  }
  if (ok > 0) {
    g_alongBiasMs2 = sumAlong / static_cast<float>(ok);
    g_lateralBiasMs2 = sumLat / static_cast<float>(ok);
  } else {
    g_alongBiasMs2 = 0.0f;
    g_lateralBiasMs2 = 0.0f;
  }
  Serial.printf("[MPU] bias calibrated: along=%.3f lat=%.3f (samples=%u)\n", g_alongBiasMs2, g_lateralBiasMs2, ok);
}

void updateLights(uint32_t nowMs) {
  const bool blinkOn = ((nowMs / BLINK_PERIOD_MS) % 2u) == 0u;
  const bool hazards = g_lights.hazardsOn;

  if (hazards) {
    g_lights.turnFrontLeft = blinkOn;
    g_lights.turnRearLeft = blinkOn;
    g_lights.turnFrontRight = blinkOn;
    g_lights.turnRearRight = blinkOn;
    g_lights.tailOn = blinkOn; // hazards override everything, including tail behavior
    return;
  }

  const bool autoLeanEnabled = g_telem.speedMs >= AUTO_LEAN_MIN_SPEED_MS;
  const bool autoLeft = autoLeanEnabled && (g_telem.accelLateralMs2 <= -TURN_LAT_THRESHOLD);
  const bool autoRight = autoLeanEnabled && (g_telem.accelLateralMs2 >= TURN_LAT_THRESHOLD);
  const bool leftWant = (g_lights.manualTurn == ManualTurn::Left) || autoLeft;
  const bool rightWant = (g_lights.manualTurn == ManualTurn::Right) || autoRight;

  g_lights.turnFrontLeft = leftWant && blinkOn;
  g_lights.turnRearLeft = leftWant && blinkOn;
  g_lights.turnFrontRight = rightWant && blinkOn;
  g_lights.turnRearRight = rightWant && blinkOn;
  g_lights.tailOn = (g_telem.accelAlongMs2 <= TAIL_DECEL_THRESHOLD);
}

class ServerCallbacks final : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer * /*server*/) override {
    g_connected = true;
    Serial.println("[BLE] connected");
  }
  void onDisconnect(NimBLEServer * /*server*/) override {
    g_connected = false;
    g_lights.hazardsOn = false;
    g_lights.manualTurn = ManualTurn::Off;
    updateLights(millis());
    setOutputPins();
    Serial.println("[BLE] disconnected; restarting advertising");
    NimBLEDevice::startAdvertising();
  }
};

class LightsCmdCallbacks final : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic *c) override {
    const auto value = c->getValue();
    if (value.size() < 2) return;
    const uint8_t head = static_cast<uint8_t>(value[0]);
    const uint8_t hazards = static_cast<uint8_t>(value[1]);
    const uint8_t manual = value.size() >= 3 ? static_cast<uint8_t>(value[2]) : 0u;

    g_lights.headlightMode = clamp<uint8_t>(head, 0, 2);
    g_lights.hazardsOn = (hazards != 0u);
    g_lights.manualTurn = (manual == 1u)   ? ManualTurn::Left
                          : (manual == 2u) ? ManualTurn::Right
                                           : ManualTurn::Off;
    if (g_lights.hazardsOn) g_lights.manualTurn = ManualTurn::Off;

    updateLights(millis());
    setOutputPins();
  }
};

void notifyIfDue(uint32_t nowMs) {
  if (!g_connected) return;
  if (nowMs - g_lastTelemNotifyMs >= TELEMETRY_PERIOD_MS) {
    g_lastTelemNotifyMs = nowMs;
    const auto payload = encodeTelemetry(g_telem, nowMs);
    g_charTelemetry->setValue(payload.data(), payload.size());
    g_charTelemetry->notify();
  }
  if (nowMs - g_lastStatusNotifyMs >= STATUS_PERIOD_MS) {
    g_lastStatusNotifyMs = nowMs;
    const auto payload = encodeStatus(g_lights);
    g_charStatus->setValue(payload.data(), payload.size());
    g_charStatus->notify();
  }
}

void printDebugIfDue(uint32_t nowMs) {
  if (nowMs - g_lastDebugPrintMs < DEBUG_PRINT_PERIOD_MS) return;
  g_lastDebugPrintMs = nowMs;
  Serial.printf("[STAT] ble=%s speed=%.2f along=%.2f lat=%.2f | gpio5=%d gpio18=%d gpio19=%d\n",
                g_connected ? "connected" : "disconnected", g_telem.speedMs, g_telem.accelAlongMs2,
                g_telem.accelLateralMs2, digitalRead(PIN_LEFT_AMBER), digitalRead(PIN_RIGHT_AMBER),
                digitalRead(PIN_TAIL_RED));
}

void setupPins() {
  pinMode(PIN_LEFT_AMBER, OUTPUT);
  pinMode(PIN_RIGHT_AMBER, OUTPUT);
  pinMode(PIN_TAIL_RED, OUTPUT);
  digitalWrite(PIN_LEFT_AMBER, LOW);
  digitalWrite(PIN_RIGHT_AMBER, LOW);
  digitalWrite(PIN_TAIL_RED, LOW);
}

void setupMpu() {
  Wire.begin(SDA_PIN, SCL_PIN);
  delay(50);
  (void)mpuWriteReg(MPU_REG_PWR_MGMT_1, 0x00);
  delay(10);
  (void)mpuWriteReg(MPU_REG_ACCEL_CONFIG, 0x08); // +/-4g
}

void setupBle() {
  NimBLEDevice::init(BLE_NAME);
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);
  g_server = NimBLEDevice::createServer();
  g_server->setCallbacks(new ServerCallbacks());

  NimBLEService *service = g_server->createService(BLE_SERVICE_UUID);
  NimBLECharacteristic *cmd =
      service->createCharacteristic(CHAR_LIGHTS_CMD, NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
  g_charStatus = service->createCharacteristic(CHAR_LIGHTS_STATUS, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);
  g_charTelemetry = service->createCharacteristic(CHAR_TELEMETRY, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);
  cmd->setCallbacks(new LightsCmdCallbacks());

  const auto status = encodeStatus(g_lights);
  g_charStatus->setValue(status.data(), status.size());
  const auto telem = encodeTelemetry(g_telem, millis());
  g_charTelemetry->setValue(telem.data(), telem.size());

  service->start();
  NimBLEAdvertising *adv = NimBLEDevice::getAdvertising();
  adv->addServiceUUID(BLE_SERVICE_UUID);
  adv->setName(BLE_NAME);
  adv->setScanResponse(true);
  adv->start();
  Serial.println("[BLE] advertising as FenderBoard");
}

} // namespace

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println();
  Serial.println("FenderBoard production firmware boot");
  setupPins();
  setupMpu();
  calibrateMpuBias();
  setupBle();
  g_lastTickMs = millis();
}

void loop() {
  const uint32_t nowMs = millis();
  const float dt = clamp((nowMs - g_lastTickMs) / 1000.0f, 0.001f, 0.05f);
  g_lastTickMs = nowMs;

  float ax = 0.0f, ay = 0.0f, az = 0.0f;
  if (readMpuAccel(ax, ay, az)) {
    const float alongRaw = ax;   // X axis
    const float lateralRaw = ay; // Y axis
    const float alongNoBias = alongRaw - g_alongBiasMs2;
    const float lateralNoBias = lateralRaw - g_lateralBiasMs2;
    g_telem.accelAlongMs2 = K_LOW_PASS_ALPHA * alongNoBias + (1.0f - K_LOW_PASS_ALPHA) * g_telem.accelAlongMs2;
    g_telem.accelLateralMs2 =
        K_LOW_PASS_ALPHA * lateralNoBias + (1.0f - K_LOW_PASS_ALPHA) * g_telem.accelLateralMs2;
  }

  g_telem.speedMs += g_telem.accelAlongMs2 * dt;
  g_telem.speedMs = clamp(g_telem.speedMs, 0.0f, 28.0f);

  const float accelMag = sqrtf((g_telem.accelAlongMs2 * g_telem.accelAlongMs2) +
                               (g_telem.accelLateralMs2 * g_telem.accelLateralMs2));
  if (accelMag < STATIONARY_ACCEL_MAG_THRESHOLD) {
    if (g_stationarySinceMs == 0) g_stationarySinceMs = nowMs;
    if (nowMs - g_stationarySinceMs >= STATIONARY_RESET_MS) g_telem.speedMs = 0.0f;
  } else {
    g_stationarySinceMs = 0;
  }

  updateLights(nowMs);
  setOutputPins();
  notifyIfDue(nowMs);
  printDebugIfDue(nowMs);
  delay(2);
}

#endif
