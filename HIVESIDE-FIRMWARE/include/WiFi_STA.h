#ifndef WIFI_STA_H
#define WIFI_STA_H

#include <WiFi.h>
#include <Preferences.h>

// ======================== WIFI STA CONFIGURATION ========================
#define WIFI_CONNECTION_TIMEOUT 20000  // 20 seconds

// Global variables for WiFi
extern Preferences preferences;

// ======================== WIFI STA FUNCTIONS ========================

inline bool connectToWiFi() {
  preferences.begin("wifi-provision", true);
  String savedSSID = preferences.getString("ssid", "");
  String savedPassword = preferences.getString("password", "");
  preferences.end();
  // ... omitting unchanged logic inside for a moment, let's just do it cleanly.

  if (savedSSID.isEmpty()) {
    Serial.println("No saved Wi-Fi credentials found.");
    return false;
  }

  Serial.printf("Connecting to saved Wi-Fi: %s\n", savedSSID.c_str());

  // Setup mode but don't disconnect manually right now to avoid warning
  WiFi.mode(WIFI_STA);
  
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

inline void saveWiFiCredentials(const char* ssid, const char* password) {
  preferences.begin("wifi-provision", false);
  preferences.putString("ssid", String(ssid));
  preferences.putString("password", String(password));
  preferences.end();
  Serial.printf("WiFi credentials saved: %s\n", ssid);
}

inline void clearWiFiCredentials() {
  preferences.begin("wifi-provision", false);
  preferences.clear();
  preferences.end();
  Serial.println("WiFi credentials cleared. Factory reset complete.");
}

inline bool isWiFiConnected() {
  return WiFi.status() == WL_CONNECTED;
}

inline IPAddress getWiFiIP() {
  return WiFi.localIP();
}

#endif // WIFI_STA_H
