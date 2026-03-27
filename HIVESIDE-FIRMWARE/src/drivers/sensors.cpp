#include <math.h>
#include <sensors.h>
#include "logging.h"

namespace {
Adafruit_BME680 gBme;
bool gGasBaselineSet = false;
float gGasBaseline = 0.0f;

constexpr float kHumidityTarget = 40.0f;   // %RH target for comfort
constexpr float kHumidityWeight = 25.0f;   // Weight out of 100 before scaling
constexpr float kGasWeight = 75.0f;        // Weight out of 100 before scaling

bool beginBme680() {
    if (gBme.begin(0x77)) return true;
    if (gBme.begin(0x76)) return true;
    return false;
}
}

int sensors_begin() {
    if (!beginBme680()) {
        log_line("SENS", "Failed to initialize BME680! Check wiring/address (0x76/0x77).");
        return -1;
    }

    gBme.setTemperatureOversampling(BME680_OS_8X);
    gBme.setHumidityOversampling(BME680_OS_4X);
    gBme.setPressureOversampling(BME680_OS_4X);
    gBme.setIIRFilterSize(BME680_FILTER_SIZE_3);
    gBme.setGasHeater(320, 150); // 320C for 150ms

    log_line("SENS", "BME680 initialized (gas + T/H/P enabled).");
    return 0;
}

bool sensors_read(SensorReadings* out) {
    if (out == nullptr) return false;

    if (!gBme.performReading()) {
        log_line("SENS", "BME680 reading failed");
        return false;
    }

    const float tempC = gBme.temperature;
    const float humPct = gBme.humidity;
    const float pressureHpa = gBme.pressure / 100.0f;
    const float gasRes = gBme.gas_resistance;

    if (!gGasBaselineSet) {
        gGasBaseline = gasRes;
        gGasBaselineSet = true;
    } else {
        gGasBaseline = (gGasBaseline * 0.99f) + (gasRes * 0.01f); // slow-drift baseline
    }

    const float humidityDelta = fabsf(humPct - kHumidityTarget);
    float humidityScore = kHumidityWeight * (1.0f - (fminf(humidityDelta, 20.0f) / 20.0f));
    if (humidityScore < 0.0f) humidityScore = 0.0f;

    float gasRatio = (gGasBaseline > 0.0f) ? (gasRes / gGasBaseline) : 0.0f;
    gasRatio = fmaxf(fminf(gasRatio, 1.0f), 0.0f);
    float gasScore = kGasWeight * gasRatio;

    float iaq = (humidityScore + gasScore) * 5.0f; // scale 0-100 to 0-500
    if (iaq < 0.0f) iaq = 0.0f;
    if (iaq > 500.0f) iaq = 500.0f;

    out->temperatureC = tempC;
    out->humidityPct = humPct;
    out->iaq = iaq;
    out->pressureHpa = pressureHpa;
    return true;
}