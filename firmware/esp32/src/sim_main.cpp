#if defined(__clang__) && !defined(__XTENSA__)
#define CFG_PIN_LEFT_AMBER 5
#define CFG_PIN_RIGHT_AMBER 18
#define CFG_PIN_TAIL_RED 19
int main() { return 0; }
#else

#include <Arduino.h>
#include <NimBLEDevice.h>

#include <array>
#include <cmath>
#include <cstdint>
#include <cstring>

namespace {

constexpr const char *BLE_SERVICE_UUID = "e4c53780-e0e0-4a8c-9f9a-4c5f3e2d1a00";
constexpr const char *CHAR_LIGHTS_CMD = "e4c53781-e0e0-4a8c-9f9a-4c5f3e2d1a01";
constexpr const char *CHAR_LIGHTS_STATUS = "e4c53782-e0e0-4a8c-9f9a-4c5f3e2d1a02";
constexpr const char *CHAR_TELEMETRY = "e4c53783-e0e0-4a8c-9f9a-4c5f3e2d1a03";

constexpr float TURN_LAT_THRESHOLD = 2.2f;
constexpr float TAIL_DECEL_THRESHOLD = -1.8f;
constexpr uint32_t INDICATOR_BLINK_MS = 450;
constexpr uint32_t TELEMETRY_PERIOD_MS = 100;
constexpr uint32_t STATUS_PERIOD_MS = 100;

constexpr uint8_t PIN_LEFT_AMBER = CFG_PIN_LEFT_AMBER;
constexpr uint8_t PIN_RIGHT_AMBER = CFG_PIN_RIGHT_AMBER;
constexpr uint8_t PIN_TAIL_RED = CFG_PIN_TAIL_RED;

enum class ManualTurn : uint8_t { Off = 0, Left = 1, Right = 2 };

struct LightsStatus {
  uint8_t headlightMode = 0;
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

NimBLECharacteristic *g_charStatus = nullptr;
NimBLECharacteristic *g_charTelemetry = nullptr;
volatile bool g_connected = false;

LightsStatus g_lights;
Telemetry g_telem;

uint32_t g_lastTickMs = 0;
uint32_t g_lastTelemNotifyMs = 0;
uint32_t g_lastStatusNotifyMs = 0;
uint32_t g_t0Ms = 0;
static uint32_t gBlinkT0Ms = 0;

template <typename T>
T clamp(T v, T lo, T hi) {
  return (v < lo) ? lo : ((v > hi) ? hi : v);
}

void applyLightPins(const LightsStatus &s) {
  digitalWrite(PIN_LEFT_AMBER, s.turnFrontLeft ? HIGH : LOW);
  digitalWrite(PIN_RIGHT_AMBER, s.turnFrontRight ? HIGH : LOW);
  digitalWrite(PIN_TAIL_RED, s.tailOn ? HIGH : LOW);
}

void putFloatLE(uint8_t *dst, float v) { std::memcpy(dst, &v, sizeof(float)); }
void putUint32LE(uint8_t *dst, uint32_t v) {
  dst[0] = static_cast<uint8_t>(v & 0xFFu);
  dst[1] = static_cast<uint8_t>((v >> 8) & 0xFFu);
  dst[2] = static_cast<uint8_t>((v >> 16) & 0xFFu);
  dst[3] = static_cast<uint8_t>((v >> 24) & 0xFFu);
}

std::array<uint8_t, 7> encodeLightsStatus(const LightsStatus &s) {
  return {
      static_cast<uint8_t>(clamp(s.headlightMode, static_cast<uint8_t>(0), static_cast<uint8_t>(2))),
      static_cast<uint8_t>(s.hazardsOn), static_cast<uint8_t>(s.tailOn ? 1u : 0u),
      static_cast<uint8_t>(s.turnFrontLeft ? 1u : 0u), static_cast<uint8_t>(s.turnFrontRight ? 1u : 0u),
      static_cast<uint8_t>(s.turnRearLeft ? 1u : 0u), static_cast<uint8_t>(s.turnRearRight ? 1u : 0u)};
}

std::array<uint8_t, 16> encodeTelemetry(const Telemetry &t, uint32_t timestampMs) {
  std::array<uint8_t, 16> out{};
  putFloatLE(out.data() + 0, t.speedMs);
  putFloatLE(out.data() + 4, t.accelAlongMs2);
  putFloatLE(out.data() + 8, t.accelLateralMs2);
  putUint32LE(out.data() + 12, timestampMs);
  return out;
}

void updateDerivedLights(uint32_t nowMs) {
  g_lights.tailOn = (g_telem.accelAlongMs2 <= TAIL_DECEL_THRESHOLD);

  const bool hazards = g_lights.hazardsOn;
  const bool manL = g_lights.manualTurn == ManualTurn::Left;
  const bool manR = g_lights.manualTurn == ManualTurn::Right;

  static bool prevHazard = false;
  static ManualTurn prevManual = ManualTurn::Off;
  if (gBlinkT0Ms == 0) {
    gBlinkT0Ms = nowMs;
  }
  if ((!prevHazard && hazards) || (g_lights.manualTurn != prevManual)) {
    gBlinkT0Ms = nowMs;
  }
  prevHazard = hazards;
  prevManual = g_lights.manualTurn;

  const bool wantLeft = hazards || manL || (g_telem.accelLateralMs2 <= -TURN_LAT_THRESHOLD);
  const bool wantRight = hazards || manR || (g_telem.accelLateralMs2 >= TURN_LAT_THRESHOLD);
  const bool blinkOn = (((nowMs - gBlinkT0Ms) / INDICATOR_BLINK_MS) % 2u) == 0u;
  const bool leftOut = wantLeft && blinkOn;
  const bool rightOut = wantRight && blinkOn;

  g_lights.turnFrontLeft = leftOut;
  g_lights.turnFrontRight = rightOut;
  g_lights.turnRearLeft = leftOut;
  g_lights.turnRearRight = rightOut;
}

class ServerCallbacks final : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer * /*server*/) override { g_connected = true; }
  void onDisconnect(NimBLEServer * /*server*/) override {
    g_connected = false;
    g_lights.hazardsOn = false;
    g_lights.manualTurn = ManualTurn::Off;
    NimBLEDevice::startAdvertising();
    updateDerivedLights(millis());
    applyLightPins(g_lights);
  }
};

class LightsCommandCallbacks final : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic *c) override {
    const auto value = c->getValue();
    if (value.size() < 2)
      return;

    const uint8_t head = static_cast<uint8_t>(value[0]);
    const uint8_t hazards = static_cast<uint8_t>(value[1]);
    const uint8_t manual = value.size() >= 3 ? static_cast<uint8_t>(value[2]) : 0u;

    g_lights.headlightMode = clamp(head, static_cast<uint8_t>(0), static_cast<uint8_t>(2));
    g_lights.hazardsOn = hazards != 0u;
    g_lights.manualTurn =
        (manual == 1u) ? ManualTurn::Left : (manual == 2u ? ManualTurn::Right : ManualTurn::Off);
    if (g_lights.hazardsOn)
      g_lights.manualTurn = ManualTurn::Off;

    updateDerivedLights(millis());
    applyLightPins(g_lights);
  }
};

void setupPins() {
  for (const uint8_t pin : {PIN_LEFT_AMBER, PIN_RIGHT_AMBER, PIN_TAIL_RED}) {
    pinMode(pin, OUTPUT);
    digitalWrite(pin, LOW);
  }
}

void setupBle() {
  NimBLEDevice::init("FenderBoard-SIM");
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);

  auto *server = NimBLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());
  auto *service = server->createService(BLE_SERVICE_UUID);

  auto *cmd = service->createCharacteristic(CHAR_LIGHTS_CMD, NIMBLE_PROPERTY::WRITE);
  g_charStatus =
      service->createCharacteristic(CHAR_LIGHTS_STATUS, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);
  g_charTelemetry =
      service->createCharacteristic(CHAR_TELEMETRY, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);
  cmd->setCallbacks(new LightsCommandCallbacks());

  const auto status = encodeLightsStatus(g_lights);
  g_charStatus->setValue(status.data(), status.size());
  const auto telem = encodeTelemetry(g_telem, millis());
  g_charTelemetry->setValue(telem.data(), telem.size());

  service->start();
  auto *adv = NimBLEDevice::getAdvertising();
  adv->addServiceUUID(BLE_SERVICE_UUID);
  adv->setName("FenderBoard-SIM");
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
  if (!g_connected)
    return;
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

} // namespace

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("");
  Serial.println("FenderBoard simulator boot");
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
