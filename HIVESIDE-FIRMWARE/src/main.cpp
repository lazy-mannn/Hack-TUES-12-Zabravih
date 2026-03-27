#include <Arduino.h>
#include "WiFi.h"
#include "WiFi_STA.h"
#include <display.h>
#include <sensors.h>
#include <microphone.h>
#include "services.h"
#include "logging.h"

#include <Preferences.h>
#include "BLE_Provisioner.h"

// ======================== CONFIGURATION ========================
const int buttonPin = 9;

// ======================== GLOBAL VARIABLES ========================
Preferences preferences;
NimBLEServer *pBLEServer = nullptr;
NimBLECharacteristic *ssidCharacteristic = nullptr;
NimBLECharacteristic *passCharacteristic = nullptr;
bool bleConnected = false;
bool blePowered = false;

// ======================== BUTTON HANDLER ========================
void handleButtonReset()
{
  static unsigned long buttonPressTime = 0;
  static bool buttonPressed = false;
  int buttonState = digitalRead(buttonPin);

  if (buttonState == LOW && !buttonPressed)
  {
    buttonPressTime = millis();
    buttonPressed = true;
    log_line("BTN", "Button pressed. Release within 3 seconds to toggle BLE, hold for 3 seconds to reset WiFi...");
  }

  if (buttonState == HIGH && buttonPressed)
  {
    unsigned long pressDuration = millis() - buttonPressTime;

    if (pressDuration < 3000)
    {
      // Short press: toggle BLE
      if (blePowered)
      {
        stopBLEProvisioner();
      }
      else
      {
        startBLEProvisioner();
      }
    }
    else
    {
      // Long press: reset WiFi credentials
      ESP.restart();
    }

    buttonPressed = false;
  }
}

// ======================== STATUS REPORTING ========================
void printStatus()
{
  static unsigned long lastPrintTime = 0;
  if (millis() - lastPrintTime > 10000)
  {
    lastPrintTime = millis();

    String statusMsg = " | STA: ";
    statusMsg += isWiFiConnected() ? "Connected" : "Disconnected";
    if (isWiFiConnected())
    {
      statusMsg += " | IP: ";
      statusMsg += getWiFiIP().toString();
    }
    statusMsg += " | BLE: ";
    if (blePowered)
    {
      statusMsg += bleConnected ? "Connected" : "Advertising";
    }
    else
    {
      statusMsg += "Off";
    }
    logf("SYS", "%s", statusMsg.c_str());
  }
}

void setup()
{
  Serial.begin(2000000);
  logging_init();
  delay(2000);

  log_line("SYS", "=== ESP32-S3 WiFi AP+STA with BLE ===");

  pinMode(buttonPin, INPUT_PULLUP);

  // Initialize BLE provisioner (but don't start advertising yet)
  initBLEProvisioner();

  // Try to connect to saved WiFi
  if (!connectToWiFi())
  {
    log_line("SYS", "Note: Press button to enable BLE for WiFi provisioning");
    log_line("SYS", "Or press button for 3 seconds to reset WiFi credentials");
  }

  xTaskCreatePinnedToCore(initializeTask, "initTask", 8192, NULL, 1, &initTask_handle, 0);
}

void loop(){
  // microphone_log();

  handleButtonReset();
  printStatus();
  delay(100);
}