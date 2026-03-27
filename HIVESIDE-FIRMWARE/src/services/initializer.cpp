#include "services.h"
#include "FreeRTOS.h"

float temp;
float hum;
float iaq;
bool successfulInit = false;

TaskHandle_t initTask_handle;
TaskHandle_t appTask_handle;


void initializeTask(void * params){
    delay(5000);
    xTaskCreatePinnedToCore(appTask, "appTask", 16384, NULL, 1, &appTask_handle, 0);

    vTaskDelete(NULL);
}