#include <display.h>

namespace {
constexpr uint8_t kScreenWidth = 128;
constexpr uint8_t kScreenHeight = 32;
constexpr int8_t kResetPin = -1;

Adafruit_SSD1306 gDisplay(kScreenWidth, kScreenHeight, &Wire, kResetPin);
}

int display_begin(){

	Serial.println(F("[DISPLAY] Initializing SSD1306 display..."));
	Serial.print(F("[DISPLAY] Resolution: "));
	Serial.print(kScreenWidth);
	Serial.print(F("x"));
	Serial.println(kScreenHeight);
	Serial.print(F("[DISPLAY] I2C Address: 0x"));
	Serial.println(ADDR, HEX);
	
	Wire.begin(SDA, SCL);
	Serial.println(F("[DISPLAY] I2C bus initialized"));

	if (!gDisplay.begin(SSD1306_SWITCHCAPVCC, ADDR)) {
		Serial.println(F("[DISPLAY] ERROR: SSD1306 initialization failed at I2C address"));
		Serial.println(F("[DISPLAY] Check: wiring, I2C address, pull-ups"));
		return -1;
	}

	Serial.println(F("[DISPLAY] SSD1306 controller initialized"));
	gDisplay.clearDisplay();
	gDisplay.setTextSize(1);
	gDisplay.setTextColor(SSD1306_WHITE);
	gDisplay.setCursor(0, 0);
	gDisplay.println(F("Display ready"));
	gDisplay.display();
	Serial.println(F("[DISPLAY] Display buffer rendered and ready"));
	
	return 0;
}

void display_set(uint8_t hum, uint8_t temp, char* ipStr, bool bleMode){
	gDisplay.clearDisplay();
	gDisplay.setCursor(0, 0);
	gDisplay.setTextSize(1);

	gDisplay.print(F("Humidity: "));
	gDisplay.print(hum);
	gDisplay.println(F("%"));

	gDisplay.print(F("Temp: "));
	gDisplay.print(temp);
	gDisplay.println(F(" C"));

	gDisplay.print(F("IP: "));
	gDisplay.println(ipStr == nullptr ? "N/A" : ipStr);

	gDisplay.print(F("BLE Prov: "));
	gDisplay.println(bleMode ? F("ON") : F("OFF"));

	gDisplay.display();
}