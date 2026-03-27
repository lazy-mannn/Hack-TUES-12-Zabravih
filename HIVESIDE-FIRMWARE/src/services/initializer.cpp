#include "services.h"
#include "FreeRTOS.h"

uint8_t temp;
uint8_t hum;
bool successfulInit = false;

TaskHandle_t initTask_handle;


void initializeTask(void * params){
    delay(5000);
    xTaskCreatePinnedToCore(visualizerTask, "visualTask", 4096, NULL, 1, &visualizerTask_handle, 0);
    xTaskCreatePinnedToCore(datasenderTask, "dataSenderTask", 16384, NULL, 1, &datasenderTask_handle, 0);

    vTaskDelete(NULL);
}