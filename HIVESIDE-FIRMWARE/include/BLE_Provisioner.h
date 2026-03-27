#ifndef BLE_PROVISIONER_H
#define BLE_PROVISIONER_H

#include <NimBLEDevice.h>
#include <Preferences.h>

// ======================== BLE CONFIGURATION ========================
#define BLE_DEVICE_NAME "ESP32_Provisioner"
#define BLE_SERVICE_UUID "180A"
#define BLE_SSID_CHAR_UUID "2A25"
#define BLE_PASS_CHAR_UUID "2A28"

// Global variables for BLE
extern NimBLEServer* pBLEServer;
extern NimBLECharacteristic* ssidCharacteristic;
extern NimBLECharacteristic* passCharacteristic;
extern bool bleConnected;
extern bool blePowered;
extern Preferences preferences;

// ======================== BLE CALLBACKS ========================
class SSIDCharacteristicCallback : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic* pCharacteristic) {
        std::string ssid = pCharacteristic->getValue();
        Serial.printf("BLE SSID received: %s\n", ssid.c_str());
    }
};

class PasswordCharacteristicCallback : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic* pCharacteristic) {
        std::string ssid = ssidCharacteristic->getValue();
        std::string password = pCharacteristic->getValue();
        
        if (ssid.length() > 0 && password.length() > 0) {
            Serial.printf("BLE WiFi received - SSID: %s, Password: %s\n", ssid.c_str(), password.c_str());
            
            // Save credentials
            preferences.begin("wifi-provision", false);
            preferences.putString("ssid", String(ssid.c_str()));
            preferences.putString("password", String(password.c_str()));
            preferences.end();
            
            Serial.println("WiFi credentials saved! Rebooting...");
            delay(1000);
            ESP.restart();
        }
    }
};

class BLEServerCallback : public NimBLEServerCallbacks {
    void onConnect(NimBLEServer* pServer) {
        Serial.println("BLE Client connected");
        bleConnected = true;
        NimBLEDevice::startAdvertising();
    }
    
    void onDisconnect(NimBLEServer* pServer) {
        Serial.println("BLE Client disconnected");
        bleConnected = false;
    }
};

// ======================== BLE FUNCTIONS ========================
inline void initBLEProvisioner() {
    Serial.println("Initializing BLE provisioner...");
    NimBLEDevice::init(BLE_DEVICE_NAME);
    
    pBLEServer = NimBLEDevice::createServer();
    pBLEServer->setCallbacks(new BLEServerCallback());
    
    // Create service
    NimBLEService* pService = pBLEServer->createService(BLE_SERVICE_UUID);
    
    // Create SSID characteristic
    ssidCharacteristic = pService->createCharacteristic(
        BLE_SSID_CHAR_UUID,
        NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR
    );
    ssidCharacteristic->setCallbacks(new SSIDCharacteristicCallback());
    ssidCharacteristic->setValue("WiFi SSID");
    
    // Create Password characteristic
    passCharacteristic = pService->createCharacteristic(
        BLE_PASS_CHAR_UUID,
        NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR
    );
    passCharacteristic->setCallbacks(new PasswordCharacteristicCallback());
    passCharacteristic->setValue("WiFi Password");
    
    pService->start();
    Serial.println("BLE provisioner initialized");
}

inline void startBLEProvisioner() {
    if (pBLEServer == nullptr) {
        initBLEProvisioner();
    }
    
    // Start advertising
    NimBLEAdvertising* pAdvertising = NimBLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(BLE_SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06);
    pAdvertising->setMaxPreferred(0x12);
    NimBLEDevice::startAdvertising();
    
    blePowered = true;
    Serial.println("BLE advertising started");
}

inline void stopBLEProvisioner() {
    if (pBLEServer != nullptr) {
        NimBLEDevice::stopAdvertising();
        blePowered = false;
        Serial.println("BLE advertising stopped");
    }
}

#endif // BLE_PROVISIONER_H
