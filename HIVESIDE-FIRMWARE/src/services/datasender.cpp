#include "services.h"
#include <Preferences.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WiFi.h>

TaskHandle_t datasenderTask_handle;

// --- Configurable Endpoints ---
const char* AUDIO_SERVER = "zabravih.org";
const char* UPLOAD_PATH = "/api/measurements/";

// --- Hardware Settings ---
#define BATTERY_PIN 10 // Change to your actual ADC pin
#define RECORD_TIME_SECONDS 10

float getBatteryVoltage() {
    int raw = analogRead(BATTERY_PIN);
    // Typical voltage divider (e.g., 200k/100k) mapped over 3.3v reference
    float voltage = (raw / 4095.0) * 3.3 * 2.0; 
    return voltage;
}

bool sendDataWithAudio(float temp, float hum, float battery, String macAddress) {
    WiFiClientSecure* client = new WiFiClientSecure;
    if (!client) return false;

    client->setInsecure(); // Disable SSL certificate verification for simplicity, use root CA if required
    client->setHandshakeTimeout(30);
    
    if(!client->connect(AUDIO_SERVER, 443)) {
        Serial.println("Audio stream connection failed");
        delete client;
        return false;
    }

    String boundary = "Esp32Boundary7b";
    
    JsonDocument doc;
    doc["temperature"] = temp;
    doc["humidity"] = hum;
    doc["battery"] = battery;
    String dataJson;
    serializeJson(doc, dataJson);

    String bodyStart = "--" + boundary + "\r\n";
    bodyStart += "Content-Disposition: form-data; name=\"data\"\r\n\r\n";
    bodyStart += dataJson + "\r\n";
    bodyStart += "--" + boundary + "\r\n";
    bodyStart += "Content-Disposition: form-data; name=\"file\"; filename=\"audio.wav\"\r\n";
    bodyStart += "Content-Type: audio/wav\r\n\r\n";

    String bodyEnd = "\r\n--" + boundary + "--\r\n";

    uint32_t sampleRate = 16000;
    uint16_t numChannels = 1;
    uint16_t bitsPerSample = 16;
    uint32_t byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    uint32_t dataSize = RECORD_TIME_SECONDS * byteRate;
    uint32_t fileSize = 36 + dataSize; // WAV file size

    uint32_t contentLength = bodyStart.length() + 44 + dataSize + bodyEnd.length();

    // 1. Send HTTP Header
    client->print(String("POST ") + UPLOAD_PATH + " HTTP/1.1\r\n");
    client->print(String("Host: ") + AUDIO_SERVER + "\r\n");
    client->print("Content-Type: multipart/form-data; boundary=" + boundary + "\r\n");
    client->print(String("Content-Length: ") + String(contentLength) + "\r\n");
    client->print("Mac-Address: " + macAddress + "\r\n");
    client->print("Connection: close\r\n\r\n");

    // 2. Transmit Body Start
    client->print(bodyStart);

    // 3. Transmit WAV Header (44 bytes)
    uint8_t wav_header[44] = {
        'R','I','F','F', 
        (uint8_t)(fileSize & 0xFF), (uint8_t)((fileSize >> 8) & 0xFF), (uint8_t)((fileSize >> 16) & 0xFF), (uint8_t)((fileSize >> 24) & 0xFF),
        'W','A','V','E', 
        'f','m','t',' ', 
        16, 0, 0, 0, 
        1, 0, 
        (uint8_t)numChannels, 0,
        (uint8_t)(sampleRate & 0xFF), (uint8_t)((sampleRate >> 8) & 0xFF), (uint8_t)((sampleRate >> 16) & 0xFF), (uint8_t)((sampleRate >> 24) & 0xFF),
        (uint8_t)(byteRate & 0xFF), (uint8_t)((byteRate >> 8) & 0xFF), (uint8_t)((byteRate >> 16) & 0xFF), (uint8_t)((byteRate >> 24) & 0xFF),
        (uint8_t)(numChannels * (bitsPerSample / 8)), 0,
        (uint8_t)bitsPerSample, 0,
        'd','a','t','a',
        (uint8_t)(dataSize & 0xFF), (uint8_t)((dataSize >> 8) & 0xFF), (uint8_t)((dataSize >> 16) & 0xFF), (uint8_t)((dataSize >> 24) & 0xFF)
    };
    client->write(wav_header, 44);

    // 4. Stream audio payload bit-by-bit
    size_t bytesRead = 0;
    uint32_t totalSent = 0;
    const size_t bufSize = 1024;
    uint8_t* audioBuf = (uint8_t*)malloc(bufSize);
    
    if(!audioBuf) {
        delete client;
        return false;
    }

    microphone_begin();
    while(totalSent < dataSize) {
        size_t toRead = bufSize;
        if(dataSize - totalSent < bufSize) {
            toRead = dataSize - totalSent;
        }
        
        if(microphone_read(audioBuf, toRead, &bytesRead)) {
            if(bytesRead > 0) {
                client->write(audioBuf, bytesRead);
                totalSent += bytesRead;
            }
        } else {
            vTaskDelay(10 / portTICK_PERIOD_MS); // Allow other tasks
        }
    }
    microphone_stop();
    free(audioBuf);
    
    // 5. Transmit Body End
    client->print(bodyEnd);

    // Process response
    int httpCode = 0;
    while(client->connected() || client->available()) {
        if(client->available()){
            String line = client->readStringUntil('\n');
            Serial.println(line);
            if (line.startsWith("HTTP/1.1")) {
                httpCode = line.substring(9, 12).toInt();
            }
            if (line == "\r" || line == "") break; 
        }else{
            vTaskDelay(10 / portTICK_PERIOD_MS);
        }
    }
    client->stop();
    delete client;

    return (httpCode >= 200 && httpCode < 300);
}

// Logic structure of task below:
void datasenderTask(void * params){
    // NTP sync (Timezone: Sofia, Bulgaria - UTC+2 / DST+1)
    configTime(7200, 3600, "pool.ntp.org", "time.nist.gov");
    struct tm timeinfo;
    while (!getLocalTime(&timeinfo)) {
        vTaskDelay(1000 / portTICK_PERIOD_MS);
    }
    Serial.print("Current time: ");
    Serial.println(asctime(&timeinfo));

    Preferences preferences;
    preferences.begin("app-settings", false);

    bool isRegistered = preferences.getBool("isRegistered", false);
    String macAddress = WiFi.macAddress();
    
    if (!isRegistered) {
        // Do registration logic here
        // preferences.putBool("isRegistered", true);
    }

    while (!successfulInit) {
        vTaskDelay(pdMS_TO_TICKS(100));
    }

    // --- TEST SSL HANDSHAKE ---
    Serial.println("Testing HTTPClient SSL Connection...");
    WiFiClientSecure* secureTestClient = new WiFiClientSecure;
    secureTestClient->setInsecure();
    HTTPClient testClient;
    if (testClient.begin(*secureTestClient, "https://zabravih.org/")) {
        int code = testClient.GET();
        Serial.printf("Test HTTP GET: %d\n", code);
        testClient.end();
    } else {
        Serial.println("Test testClient.begin() failed.");
    }
    delete secureTestClient;
    // --------------------------

    while(1){
        bool success = false;
        
        // Try up to 5 times
        for(int attempt = 0; attempt < 5; attempt++) {
            uint8_t hum = 0;
            uint8_t temp = 0;
            sensors_read(&hum, &temp);
            float batteryLevel = getBatteryVoltage();
            
            Serial.printf("Attempt %d: Sending JSON & Audio...\n", attempt + 1);
            
            success = sendDataWithAudio(temp, hum, batteryLevel, macAddress);
            
            if (success) {
                Serial.println("Data sent successfully!");
                break; // Break retry loop
            } else {
                Serial.println("Failed to send data, retrying...");
                vTaskDelay(pdMS_TO_TICKS(2000));
            }
        }
        
        // Sleep or Wait before next cycle
        vTaskDelay(pdMS_TO_TICKS(30000)); // Delay between transmissions
    }
}
