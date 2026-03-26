#include <Preferences.h>
#include "WiFi_AP.h"
#include "BLE_Provisioner.h"

// ======================== CONFIGURATION ========================
const int buttonPin = 9;

// ======================== GLOBAL VARIABLES ========================
Preferences preferences;
NimBLEServer* pBLEServer = nullptr;
NimBLECharacteristic* ssidCharacteristic = nullptr;
NimBLECharacteristic* passCharacteristic = nullptr;
bool bleConnected = false;
bool blePowered = false;

// ======================== BUTTON HANDLER ========================
void handleButtonReset() {
  static unsigned long buttonPressTime = 0;
  static bool buttonPressed = false;
  int buttonState = digitalRead(buttonPin);
  
  if (buttonState == LOW && !buttonPressed) {
    buttonPressTime = millis();
    buttonPressed = true;
    Serial.println("\nButton pressed. Release within 3 seconds to toggle BLE, hold for 3 seconds to reset WiFi...");
  }
  
  if (buttonState == HIGH && buttonPressed) {
    unsigned long pressDuration = millis() - buttonPressTime;
    
    if (pressDuration < 3000) {
      // Short press: toggle BLE
      if (blePowered) {
        stopBLEProvisioner();
      } else {
        startBLEProvisioner();
      }
    } else {
      // Long press: factory reset
      clearWiFiCredentials();
      ESP.restart();
    }
    
    buttonPressed = false;
  }
}

// ======================== STATUS REPORTING ========================
void printStatus() {
  static unsigned long lastPrintTime = 0;
  if (millis() - lastPrintTime > 10000) {
    lastPrintTime = millis();
    
    Serial.print("AP Clients: ");
    Serial.print(getAPClientCount());
    Serial.print(" | STA: ");
    Serial.print(isWiFiConnected() ? "Connected" : "Disconnected");
    if (isWiFiConnected()) {
      Serial.print(" | IP: ");
      Serial.print(getWiFiIP());
    }
    Serial.print(" | BLE: ");
    if (blePowered) {
      Serial.print(bleConnected ? "Connected" : "Advertising");
    } else {
      Serial.print("Off");
    }
    Serial.println();
  }
}

void setup() {
  Serial.begin(115200);
  delay(2000);

  Serial.println("\n\n=== ESP32-S3 WiFi AP+STA with BLE ===");

  pinMode(buttonPin, INPUT_PULLUP);

  // Setup AP mode first
  setupWiFiAPMode();

  // Initialize BLE provisioner (but don't start advertising yet)
  initBLEProvisioner();

  // Try to connect to saved WiFi
  if (!connectToWiFi()) {
    Serial.println("\nNote: Press button to enable BLE for WiFi provisioning");
    Serial.println("Or press button for 3 seconds to reset WiFi credentials");
  }
}

void loop() {
  handleButtonReset();
  printStatus();
  delay(100);
}