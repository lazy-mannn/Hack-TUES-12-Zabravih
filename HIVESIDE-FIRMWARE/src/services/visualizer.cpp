#include "services.h"
#include "WiFi_STA.h"
#include "BLE_Provisioner.h"

TaskHandle_t visualizerTask_handle;

#define VT_INTERVAL 1000

void visualizerTask(void * params){
    if (display_begin() != 0) {
        return;
    }
    if (sensors_begin() != 0) {
        return;
    }
    if (microphone_begin() != 0) {
        return;
    }
    sensors_begin();
    microphone_begin();
    temp=0,hum=0;

    successfulInit = true;

    while(1){
        sensors_read(&hum,&temp);
        char ipStr[16];
        if (isWiFiConnected()){
            IPAddress ip = getWiFiIP();
            snprintf(ipStr, sizeof(ipStr), "%d.%d.%d.%d", ip[0], ip[1], ip[2], ip[3]);
        }else {
            strncpy(ipStr, "N/A", sizeof(ipStr));
        }

        display_set(hum,temp,ipStr, blePowered);
        vTaskDelay(VT_INTERVAL/portTICK_PERIOD_MS);
    }
}