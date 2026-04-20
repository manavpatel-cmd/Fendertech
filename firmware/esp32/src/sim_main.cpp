#if defined(__clang__) && !defined(__XTENSA__)
int main() { return 0; }
#else

#include <Arduino.h>
#include <NimBLEDevice.h>

#include <array>
#include <cmath>
#include <cstdint>
#include <cstring>

namespace {

constexpr const char* BLE_SERVICE_UUID = "e4c53780-e0e0-4a8c-9f9a-4c5f3e2d1a00";
constexpr const char* CHAR_LIGHTS_CMD = "e4c53781-e0e0-4a8c-9f9a-4c5f3e2d1a01";
constexpr const char* CHAR_LIGHTS_STATUS = "e4c53782-e0e0-4a8c-9f9a-4c5f3e2d1a02";
constexpr const char* CHAR_TELEMETRY = "e4c53783-e0e0-4a8c-9f9a-4c5f3e2d1a03";

constexpr float TURN_LAT_THRESHOLD = 2.2f;
constexpr float TAIL_DECEL_THRESHOLD = -1.8f;
constexpr uint32_t HAZARD_BLINK_MS = 450;
constexpr uint32_t TELEMETRY_PERIOD_MS = 50;
constexpr uint32_t STATUS_PERIOD_MS = 100;

constexpr uint8_t PIN_HEAD_L = CFG_HEADLIGHT_LEFT_PIN;
constexpr uint8_t PIN_HEAD_R = CFG_HEADLIGHT_RIGHT_PIN;
constexpr uint8_t PIN_TAIL_L = CFG_TAIL_LEFT_PIN;
constexpr uint8_t PIN_TAIL_R = CFG_TAIL_RIGHT_PIN;
constexpr uint8_t PIN_TURN_FL = CFG_TURN_FRONT_LEFT_PIN;
constexpr uint8_t PIN_TURN_FR = CFG_TURN_FRONT_RIGHT_PIN;
constexpr uint8_t PIN_TURN_RL = CFG_TURN_REAR_LEFT_PIN;
constexpr uint8_t PIN_TURN_RR = CFG_TURN_REAR_RIGHT_PIN;

enum class HeadlightMode : uint8_t { Off = 0, Low = 1, High = 2 };
enum class ManualTurn : uint8_t { Off = 0, Left = 1, Right = 2 };

struct LightsStatus {
  HeadlightMode headlightMode = HeadlightMode::Off;
  bool hazardsOn = false;
  bool tailOn = false;
  bool turnFrontLeft = false;
  bool turnFrontRight = false;
  bool turnRearLeft = false;
  bool turnRearRight = false;
  ManualTurn manualTurn = ManualTurn::Off;
};

struct Telemetry {
  float speedMs = 0.0f;
  float accelAlongMs2 = 0.0f;
  float accelLateralMs2 = 0.0f;
};

NimBLECharacteristic* g_charStatus = nullptr;
NimBLECharacteristic* g_charTelemetry = nullptr;
volatile bool g_connected = false;

LightsStatus g_lights;
Telemetry g_telem;

uint32_t g_lastTickMs = 0;
uint32_t g_lastTelemNotifyMs = 0;
uint32_t g_lastStatusNotifyMs = 0;
uint32_t g_t0Ms = 0;

template <typename T>
T clamp(T v, T lo, T hi) {
  return (v < lo) ? lo : ((v > hi) ? hi : v);
}

void applyLightPins(const LightsStatus& s) {
  const bool headOn = s.headlightMode != HeadlightMode::Off;
  digitalWrite(PIN_HEAD_L, headOn ? HIGH : LOW);
  digitalWrite(PIN_HEAD_R, headOn ? HIGH : LOW);
  digitalWrite(PIN_TAIL_L, s.tailOn ? HIGH : LOW);
  digitalWrite(PIN_TAIL_R, s.tailOn ? HIGH : LOW);
  digitalWrite(PIN_TURN_FL, s.turnFrontLeft ? HIGH : LOW);
  digitalWrite(PIN_TURN_FR, s.turnFrontRight ? HIGH : LOW);
  digitalWrite(PIN_TURN_RL, s.turnRearLeft ? HIGH : LOW);
  digitalWrite(PIN_TURN_RR, s.turnRearRight ? HIGH : LOW);
}

void putFloatLE(uint8_t* dst, float v) { std::memcpy(dst, &v, sizeof(float)); }
void putUint32LE(uint8_t* dst, uint32_t v) {
  dst[0] = static_cast<uint8_t>(v & 0xFFu);
  dst[1] = static_cast<uint8_t>((v >> 8) & 0xFFu);
  dst[2] = static_cast<uint8_t>((v >> 16) & 0xFFu);
  dst[3] = static_cast<uint8_t>((v >> 24) & 0xFFu);
}

std::array<uint8_t, 7> encodeLightsStatus(const LightsStatus& s) {
  return {static_cast<uint8_t>(s.headlightMode), static_cast<uint8_t>(s.hazardsOn),
          static_cast<uint8_t>(s.tailOn), static_cast<uint8_t>(s.turnFrontLeft),
          static_cast<uint8_t>(s.turnFrontRight), static_cast<uint8_t>(s.turnRearLeft),
          static_cast<uint8_t>(s.turnRearRight)};
}

std::array<uint8_t, 16> encodeTelemetry(const Telemetry& t, uint32_t timestampMs) {
  std::array<uint8_t, 16> out{};
  putFloatLE(out.data() + 0, t.speedMs);
  putFloatLE(out.data() + 4, t.accelAlongMs2);
  putFloatLE(out.data() + 8, t.accelLateralMs2);
  putUint32LE(out.data() + 12, timestampMs);
  return out;
}

void updateDerivedLights(uint32_t nowMs) {
  if (g_lights.hazardsOn) {
    const bool on = ((nowMs / HAZARD_BLINK_MS) % 2u) == 0u;
    g_lights.turnFrontLeft = on;
    g_lights.turnFrontRight = on;
    g_lights.turnRearLeft = on;
    g_lights.turnRearRight = on;
    g_lights.tailOn = on;
    return;
  }

  if (g_lights.manualTurn == ManualTurn::Left) {
    g_lights.turnFrontLeft = true;
    g_lights.turnRearLeft = true;
    g_lights.turnFrontRight = false;
    g_lights.turnRearRight = false;
    g_lights.tailOn = g_telem.accelAlongMs2 <= TAIL_DECEL_THRESHOLD;
    return;
  }

  if (g_lights.manualTurn == ManualTurn::Right) {
    g_lights.turnFrontLeft = false;
    g_lights.turnRearLeft = false;
    g_lights.turnFrontRight = true;
    g_lights.turnRearRight = true;
    g_lights.tailOn = g_telem.accelAlongMs2 <= TAIL_DECEL_THRESHOLD;
    return;
  }

  const bool left = g_telem.accelLateralMs2 <= -TURN_LAT_THRESHOLD;
  const bool right = g_telem.accelLateralMs2 >= TURN_LAT_THRESHOLD;
  g_lights.turnFrontLeft = left;
  g_lights.turnRearLeft = left;
  g_lights.turnFrontRight = right;
  g_lights.turnRearRight = right;
  g_lights.tailOn = g_telem.accelAlongMs2 <= TAIL_DECEL_THRESHOLD;
}

class ServerCallbacks final : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* /*server*/) override { g_connected = true; }
  void onDisconnect(NimBLEServer* /*server*/) override {
    g_connected = false;
    NimBLEDevice::startAdvertising();
    updateDerivedLights(millis());
    applyLightPins(g_lights);
  }
};

class LightsCommandCallbacks final : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* c) override {
    const auto value = c->getValue();
    if (value.size() < 2) return;

    const uint8_t head = static_cast<uint8_t>(value[0]);
    const uint8_t hazards = static_cast<uint8_t>(value[1]);
    const uint8_t manual = value.size() >= 3 ? static_cast<uint8_t>(value[2]) : 0u;

    g_lights.headlightMode =
        (head >= 2) ? HeadlightMode::High : (head == 1 ? HeadlightMode::Low : HeadlightMode::Off);
    g_lights.hazardsOn = hazards != 0u;
    g_lights.manualTurn =
        (manual == 1u) ? ManualTurn::Left : (manual == 2u ? ManualTurn::Right : ManualTurn::Off);
    if (g_lights.hazardsOn) g_lights.manualTurn = ManualTurn::Off;

    updateDerivedLights(millis());
    applyLightPins(g_lights);

    const auto status = encodeLightsStatus(g_lights);
    g_charStatus->setValue(status.data(), status.size());
    if (g_connected) g_charStatus->notify();
  }
};

void setupPins() {
  for (const uint8_t pin : {PIN_HEAD_L, PIN_HEAD_R, PIN_TAIL_L, PIN_TAIL_R, PIN_TURN_FL, PIN_TURN_FR,
                            PIN_TURN_RL, PIN_TURN_RR}) {
    pinMode(pin, OUTPUT);
    digitalWrite(pin, LOW);
  }
}

void setupBle() {
  NimBLEDevice::init("FenderGuard-SIM");
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);

  auto* server = NimBLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());
  auto* service = server->createService(BLE_SERVICE_UUID);

  auto* cmd = service->createCharacteristic(CHAR_LIGHTS_CMD, NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
  g_charStatus = service->createCharacteristic(CHAR_LIGHTS_STATUS, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);
  g_charTelemetry =
      service->createCharacteristic(CHAR_TELEMETRY, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);
  cmd->setCallbacks(new LightsCommandCallbacks());

  const auto status = encodeLightsStatus(g_lights);
  g_charStatus->setValue(status.data(), status.size());
  const auto telem = encodeTelemetry(g_telem, millis());
  g_charTelemetry->setValue(telem.data(), telem.size());

  service->start();
  auto* adv = NimBLEDevice::getAdvertising();
  adv->addServiceUUID(BLE_SERVICE_UUID);
  // Makes the name visible in BLE scanner apps (nRF Connect, LightBlue). iOS Settings
  // Bluetooth often does not list BLE peripherals — use those apps or FenderGuard Scan & connect.
  adv->setName("FenderGuard-SIM");
  adv->setScanResponse(true);
  adv->start();
}

void updateFakeTelemetry(uint32_t nowMs, float dt) {
  const float t = (nowMs - g_t0Ms) / 1000.0f;
  const float along = 3.0f * sinf(t * 0.7f) + 2.2f * sinf(t * 1.9f + 0.4f) +
                      ((sinf(t * 3.1f) > 0.85f) ? -4.0f : 0.0f);
  const float lateral = 3.8f * sinf(t * 1.1f + 0.2f) + 1.4f * sinf(t * 2.4f + 1.1f);

  g_telem.accelAlongMs2 = along * 0.85f + g_telem.accelAlongMs2 * 0.15f;
  g_telem.accelLateralMs2 = lateral * 0.82f + g_telem.accelLateralMs2 * 0.18f;
  g_telem.speedMs = clamp(g_telem.speedMs + g_telem.accelAlongMs2 * dt, 0.0f, 28.0f);
}

void publishIfDue(uint32_t nowMs) {
  if (!g_connected) return;
  if (nowMs - g_lastTelemNotifyMs >= TELEMETRY_PERIOD_MS) {
    g_lastTelemNotifyMs = nowMs;
    const auto telem = encodeTelemetry(g_telem, nowMs);
    g_charTelemetry->setValue(telem.data(), telem.size());
    g_charTelemetry->notify();
  }
  if (nowMs - g_lastStatusNotifyMs >= STATUS_PERIOD_MS) {
    g_lastStatusNotifyMs = nowMs;
    const auto status = encodeLightsStatus(g_lights);
    g_charStatus->setValue(status.data(), status.size());
    g_charStatus->notify();
  }
}

}  // namespace

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("");
  Serial.println("FenderGuard ESP32 simulator boot");
  setupPins();
  setupBle();
  g_t0Ms = millis();
  g_lastTickMs = g_t0Ms;
}

void loop() {
  const uint32_t nowMs = millis();
  const float dt = clamp((nowMs - g_lastTickMs) / 1000.0f, 0.001f, 0.05f);
  g_lastTickMs = nowMs;

  updateFakeTelemetry(nowMs, dt);
  updateDerivedLights(nowMs);
  applyLightPins(g_lights);
  publishIfDue(nowMs);
  delay(2);
}

#endif
