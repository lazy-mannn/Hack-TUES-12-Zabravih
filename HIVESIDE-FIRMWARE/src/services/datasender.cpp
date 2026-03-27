#include "services.h"
#include "WiFi_STA.h"
#include <WiFiClientSecure.h>
#include <WiFi.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <time.h>
#include <string.h>
#include "logging.h"
#include "BLE_Provisioner.h"


// --- Configurable Endpoints ---
const char* AUDIO_SERVER = "zabravih.org";
const char* UPLOAD_PATH = "/api/measurements/";

// --- Hardware Settings ---
#define BATTERY_PIN 10
#define RECORD_TIME_SECONDS 10

struct SendResult {
    bool success;
    bool retriable;
    int httpCode;
    String reason;
};

static SendResult makeResult(bool success, bool retriable, int httpCode, const String& reason) {
    return {success, retriable, httpCode, reason};
}

float getBatteryVoltage() {
    int raw = analogRead(BATTERY_PIN);
    return (raw / 4095.0) * 3.3 * 2.0;
}

SendResult sendDataWithAudio(float temp, float hum, float iaqValue, float battery, String macAddress) {
    WiFiClientSecure client;
    client.setInsecure();
    client.setHandshakeTimeout(30);
    client.setTimeout(5000);

    if (!client.connect(AUDIO_SERVER, 443)) {
        log_line("DATA", "Audio stream connection failed");
        return makeResult(false, true, 0, "TLS connect failed");
    }

    const String boundary = "Esp32Boundary7b";

    String bodyStart;
    bodyStart.reserve(512);
    bodyStart += "--" + boundary + "\r\n";
    bodyStart += "Content-Disposition: form-data; name=\"temperature\"\r\n\r\n";
    bodyStart += String(temp, 2) + "\r\n";
    bodyStart += "--" + boundary + "\r\n";
    bodyStart += "Content-Disposition: form-data; name=\"humidity\"\r\n\r\n";
    bodyStart += String(hum, 2) + "\r\n";
    bodyStart += "--" + boundary + "\r\n";
    bodyStart += "Content-Disposition: form-data; name=\"battery_level\"\r\n\r\n";
    bodyStart += String(battery, 3) + "\r\n";
    bodyStart += "--" + boundary + "\r\n";
    bodyStart += "Content-Disposition: form-data; name=\"co2_level\"\r\n\r\n";
    bodyStart += String(iaqValue, 1) + "\r\n";
    bodyStart += "--" + boundary + "\r\n";
    bodyStart += "Content-Disposition: form-data; name=\"file\"; filename=\"audio.wav\"\r\n";
    bodyStart += "Content-Type: audio/wav\r\n\r\n";

    const String bodyEnd = "\r\n--" + boundary + "--\r\n";

    const uint32_t sampleRate = 16000;
    const uint16_t numChannels = 1;
    const uint16_t bitsPerSample = 16;
    const uint32_t byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const uint32_t dataSize = RECORD_TIME_SECONDS * byteRate;
    const uint32_t fileSize = 36 + dataSize;

    const uint32_t contentLength = bodyStart.length() + 44 + dataSize + bodyEnd.length();
    logf("DATA", "Content-Length: %u", contentLength);

    auto printBoth = [&](const String& s){ client.print(s); Serial.print(s); };
    auto printBothC = [&](const char* s){ client.print(s); Serial.print(s); };

    log_line("DATA", "=== BEGIN HTTP REQUEST ===");
    printBoth(String("POST ") + UPLOAD_PATH + " HTTP/1.1\r\n");
    printBoth(String("Host: ") + AUDIO_SERVER + "\r\n");
    printBothC("User-Agent: ESP32\r\n");
    printBothC("Accept: */*\r\n");
    printBoth("Content-Type: multipart/form-data; boundary=" + boundary + "\r\n");
    printBoth(String("Content-Length: ") + String(contentLength) + "\r\n");
    printBoth("Mac-Address: " + macAddress + "\r\n");
    printBothC("Connection: close\r\n\r\n");

    printBoth(bodyStart);

    const uint8_t wavHeader[44] = {
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
    client.write(wavHeader, 44); // do not mirror binary WAV header to Serial

    size_t bytesRead = 0;
    uint32_t totalSent = 0;
    const size_t bufSize = 1024;
    uint8_t* audioBuf = (uint8_t*)malloc(bufSize);
    if (!audioBuf) {
        return makeResult(false, true, 0, "No memory for audio buffer");
    }

    bool writeFailed = false;
    String writeFailReason;
    uint32_t lastWrite = millis();

    if (microphone_begin() != 0) {
        free(audioBuf);
        return makeResult(false, false, 0, "Microphone init failed");
    }

    while (totalSent < dataSize) {
        if (millis() - lastWrite > 5000) {
            writeFailReason = "Upload timeout";
            writeFailed = true;
            break;
        }

        size_t toRead = (dataSize - totalSent < bufSize) ? dataSize - totalSent : bufSize;

        if (microphone_read(audioBuf, toRead, &bytesRead)) {
            if (bytesRead > 0) {
                if (!client.connected()) {
                    writeFailReason = "Connection closed before write";
                    writeFailed = true;
                    break;
                }

                size_t written = client.write(audioBuf, bytesRead); // audio payload not mirrored to Serial
                if (written == 0 || written < bytesRead) {
                    writeFailReason = (written == 0) ? "Write returned 0" : "Partial write";
                    writeFailed = true;
                    break;
                }

                totalSent += written;
                lastWrite = millis();
            }
        } else {
            vTaskDelay(5 / portTICK_PERIOD_MS);
        }
    }

    microphone_stop();
    free(audioBuf);

    if (!writeFailed) {
        client.print(bodyEnd); // closing boundary not mirrored
        log_line("DATA", "=== END HTTP REQUEST (audio omitted from Serial) ===");
    }

    int httpCode = 0;
    String statusLine;
    bool headersDone = false;

    log_line("DATA", "=== BEGIN HTTP RESPONSE ===");
    while (client.connected() || client.available()) {
        if (client.available()) {
            if (!headersDone) {
                String line = client.readStringUntil('\n');
                if (line.startsWith("HTTP/1.1")) {
                    httpCode = line.substring(9, 12).toInt();
                    statusLine = line;
                }
                // Blank line marks end of headers
                if (line == "\r" || line == "") {
                    headersDone = true;
                    log_line("DATA", "--- RESPONSE BODY ---");
                } else {
                    Serial.print(line);
                }
            } else {
                uint8_t buf[128];
                size_t len = client.read(buf, sizeof(buf));
                if (len > 0) {
                    Serial.write(buf, len);
                }
            }
        } else {
            vTaskDelay(10 / portTICK_PERIOD_MS);
        }
    }
    Serial.println();
    log_line("DATA", "=== END HTTP RESPONSE ===");

    client.stop();

    if (writeFailed) {
        return makeResult(false, true, httpCode, writeFailReason.length() ? writeFailReason : "Write failed during upload");
    }

    if (httpCode >= 200 && httpCode < 300) return makeResult(true, false, httpCode, "OK");
    if (httpCode == 0) return makeResult(false, true, httpCode, "No HTTP status received");
    if (httpCode == 408 || httpCode >= 500) return makeResult(false, true, httpCode, statusLine.length() ? statusLine : "Server/timeout error");
    if (httpCode >= 400 && httpCode < 500) return makeResult(false, false, httpCode, statusLine.length() ? statusLine : "Client error");
    return makeResult(false, true, httpCode, statusLine.length() ? statusLine : "Unexpected status");
}

// --- Unified Task ---
static const TickType_t DISPLAY_INTERVAL = pdMS_TO_TICKS(1000);
static const uint32_t SEND_INTERVAL_MS = 30000;
static const int MAX_SEND_ATTEMPTS = 5;
static const TickType_t RETRY_DELAY = pdMS_TO_TICKS(2000);

void appTask(void * params){

    // Boost priority to minimize preemption during uploads
    vTaskPrioritySet(NULL, configMAX_PRIORITIES - 1);

    if (display_begin() != 0) {
        log_line("DATA", "Display init failed");
        vTaskDelete(NULL);
    }

    if (sensors_begin() != 0) {
        log_line("DATA", "Sensor init failed");
        vTaskDelete(NULL);
    }

    configTime(7200, 0, "pool.ntp.org", "time.nist.gov");

    struct tm timeinfo;
    while (!getLocalTime(&timeinfo)) {
        vTaskDelay(pdMS_TO_TICKS(1000));
    }

    logf("DATA", "Current time: %s", asctime(&timeinfo));

    String macAddress = WiFi.macAddress();
    successfulInit = true;

    uint32_t lastSendMs = 0;

    while(1){
        SensorReadings reading{};
        if (!sensors_read(&reading)) {
            log_line("DATA", "Sensor read failed; skipping cycle");
            vTaskDelay(DISPLAY_INTERVAL);
            continue;
        }

        hum = reading.humidityPct;
        temp = reading.temperatureC;
        iaq = reading.iaq;

        char ipStr[16];
        if (isWiFiConnected()){
            IPAddress ip = getWiFiIP();
            snprintf(ipStr, sizeof(ipStr), "%d.%d.%d.%d", ip[0], ip[1], ip[2], ip[3]);
        } else {
            strncpy(ipStr, "N/A", sizeof(ipStr));
            ipStr[sizeof(ipStr) - 1] = '\0';
        }

        display_set(hum, temp, iaq, ipStr, blePowered);

        uint32_t nowMs = millis();
        if (nowMs - lastSendMs >= SEND_INTERVAL_MS) {
            for(int attempt = 0; attempt < MAX_SEND_ATTEMPTS; attempt++) {

                float batteryLevel = getBatteryVoltage();

                logf("DATA", "Attempt %d: Sending telemetry & audio...", attempt + 1);
                // Do not suspend the scheduler here; LWIP/TCPIP needs its task to stay runnable.
                SendResult result = sendDataWithAudio(temp, hum, iaq, batteryLevel, macAddress);

                if (result.success) {
                    log_line("DATA", "Data sent successfully!");
                    break;
                }

                logf("DATA", "Send failed: %s (code=%d, retriable=%s)", result.reason.c_str(), result.httpCode, result.retriable ? "yes" : "no");

                if (!result.retriable) {
                    log_line("DATA", "Non-retriable error, aborting retries for this cycle");
                    break;
                }

                vTaskDelay(RETRY_DELAY);
            }

            lastSendMs = millis();
        }

        vTaskDelay(DISPLAY_INTERVAL);
    }

}
