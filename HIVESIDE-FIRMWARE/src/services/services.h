#pragma once
#include "Arduino.h"

#include "display.h"
#include "sensors.h"
#include "microphone.h"

extern float temp;
extern float hum;
extern float iaq;
extern bool successfulInit;
extern TaskHandle_t initTask_handle;
extern TaskHandle_t appTask_handle;

void initializeTask(void * params);
void appTask(void * params);