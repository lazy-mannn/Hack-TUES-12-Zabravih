#pragma once
#include <Arduino.h>
#include <Adafruit_BME680.h>

struct SensorReadings {
	float temperatureC;
	float humidityPct;
	float iaq;          // Simple 0–500 heuristic score
	float pressureHpa;
};

int sensors_begin();
bool sensors_read(SensorReadings* out);