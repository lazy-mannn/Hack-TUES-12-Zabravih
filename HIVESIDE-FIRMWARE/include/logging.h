#pragma once

#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

bool logging_init();
void log_line(const char* tag, const char* msg);
void logf(const char* tag, const char* fmt, ...);
