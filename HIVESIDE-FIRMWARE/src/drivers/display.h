#pragma once

#include <Arduino.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define ADDR 0x3C
#define SDA 47
#define SCL 21

int display_begin();
void display_set(float hum, float temp, float iaq, const char* ipStr, bool bleMode);

