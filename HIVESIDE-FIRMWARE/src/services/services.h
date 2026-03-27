#pragma once
#include "Arduino.h"

#include "display.h"
#include "sensors.h"
#include "microphone.h"

extern uint8_t temp;
extern uint8_t hum;
extern bool successfulInit;
extern TaskHandle_t initTask_handle;
extern TaskHandle_t visualizerTask_handle;
extern TaskHandle_t datasenderTask_handle;

void visualizerTask(void * params);
void datasenderTask(void * params);
void initializeTask(void * params);