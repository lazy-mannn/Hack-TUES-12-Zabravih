#include <sensors.h>

Adafruit_AHTX0 aht;

int sensors_begin() {
    if (!aht.begin()) {
        Serial.println(F("[SENSORS] Failed to initialize AHT10 sensor! Check wiring."));
        while (1) delay(10);
        return -1;
    }
    Serial.println(F("[SENSORS] AHT10 sensor initialized successfully."));
    return 0;
}

void sensors_read(uint8_t* humidity, uint8_t* temperature) {
    sensors_event_t humidity_event, temp_event;
    aht.getEvent(&humidity_event, &temp_event);
    *humidity = static_cast<uint8_t>(humidity_event.relative_humidity);
    *temperature = static_cast<uint8_t>(temp_event.temperature);
}