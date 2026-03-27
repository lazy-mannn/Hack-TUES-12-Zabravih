#ifndef WIFI_STA_H
#define WIFI_STA_H

#include <WiFi.h>
#include <Preferences.h>
#include "logging.h"

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
    log_line("WIFI", "No saved Wi-Fi credentials found.");
    return false;
  }

  logf("WIFI", "Connecting to saved Wi-Fi: %s", savedSSID.c_str());

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
      log_line("WIFI", "Failed to connect to saved Wi-Fi.");
      return false;
    }
    delay(500);
    log_line("WIFI", "Waiting for Wi-Fi...");
  }

  logf("WIFI", "Successfully connected to %s | IP: %s", savedSSID.c_str(), WiFi.localIP().toString().c_str());
  return true;
}

inline void saveWiFiCredentials(const char* ssid, const char* password) {
  preferences.begin("wifi-provision", false);
  preferences.putString("ssid", String(ssid));
  preferences.putString("password", String(password));
  preferences.end();
  logf("WIFI", "WiFi credentials saved: %s", ssid);
}

inline void clearWiFiCredentials() {
  preferences.begin("wifi-provision", false);
  preferences.clear();
  preferences.end();
  log_line("WIFI", "WiFi credentials cleared. Factory reset complete.");
}

inline bool isWiFiConnected() {
  return WiFi.status() == WL_CONNECTED;
}

inline IPAddress getWiFiIP() {
  return WiFi.localIP();
}

#endif // WIFI_STA_H
