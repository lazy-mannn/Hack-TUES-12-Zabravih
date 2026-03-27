#pragma once
#include <Arduino.h>
#include <Adafruit_AHTX0.h>

int sensors_begin();
void sensors_read(uint8_t* humidity, uint8_t* temperature);