#ifndef WIFI_AP_H
#define WIFI_AP_H

#include <WiFi.h>
#include <Preferences.h>

// ======================== WIFI AP CONFIGURATION ========================
#define AP_SSID "ESP32_AP"
#define AP_PASS "12345678"
#define WIFI_CONNECTION_TIMEOUT 10000  // 10 seconds

// Global variables for WiFi
extern Preferences preferences;

// ======================== WIFI AP FUNCTIONS ========================

void setupWiFiAPMode() {
  WiFi.mode(WIFI_AP_STA);
  
  // Configure AP
  WiFi.softAP(AP_SSID, AP_PASS);
  Serial.print("\nAP IP: ");
  Serial.println(WiFi.softAPIP());
  Serial.print("AP SSID: ");
  Serial.println(AP_SSID);
}

bool connectToWiFi() {
  preferences.begin("wifi-provision", true);
  String savedSSID = preferences.getString("ssid", "");
  String savedPassword = preferences.getString("password", "");
  preferences.end();

  if (savedSSID.isEmpty()) {
    Serial.println("No saved Wi-Fi credentials found.");
    return false;
  }

  Serial.printf("Connecting to saved Wi-Fi: %s\n", savedSSID.c_str());
  if (savedPassword.isEmpty()) {
    WiFi.begin(savedSSID.c_str());
  } else {
    WiFi.begin(savedSSID.c_str(), savedPassword.c_str());
  }

  unsigned long startTime = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - startTime > WIFI_CONNECTION_TIMEOUT) {
      Serial.println("Failed to connect to saved Wi-Fi.");
      return false;
    }
    delay(500);
    Serial.print(".");
  }

  Serial.printf("\nSuccessfully connected to %s\n", savedSSID.c_str());
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  return true;
}

void saveWiFiCredentials(const char* ssid, const char* password) {
  preferences.begin("wifi-provision", false);
  preferences.putString("ssid", String(ssid));
  preferences.putString("password", String(password));
  preferences.end();
  Serial.printf("WiFi credentials saved: %s\n", ssid);
}

void clearWiFiCredentials() {
  preferences.begin("wifi-provision", false);
  preferences.clear();
  preferences.end();
  Serial.println("WiFi credentials cleared. Factory reset complete.");
}

int getAPClientCount() {
  return WiFi.softAPgetStationNum();
}

bool isWiFiConnected() {
  return WiFi.status() == WL_CONNECTED;
}

IPAddress getWiFiIP() {
  return WiFi.localIP();
}

#endif // WIFI_AP_H
