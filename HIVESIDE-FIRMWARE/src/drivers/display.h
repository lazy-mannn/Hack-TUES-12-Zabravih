#pragma once

#include <Arduino.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define ADDR 0x3C
#define SDA 5
#define SCL 4

int display_begin();
void display_set(uint8_t hum, uint8_t temp, char* ipStr, bool bleMode);

