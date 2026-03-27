#include <display.h>
#include "logging.h"

namespace {
constexpr uint8_t kScreenWidth = 128;
constexpr uint8_t kScreenHeight = 32;
constexpr int8_t kResetPin = -1;

Adafruit_SSD1306 gDisplay(kScreenWidth, kScreenHeight, &Wire, kResetPin);
}

int display_begin(){

	log_line("DISP", "Initializing SSD1306 display...");
	logf("DISP", "Resolution: %ux%u", kScreenWidth, kScreenHeight);
	logf("DISP", "I2C Address: 0x%X", ADDR);
	
	Wire.begin(SDA, SCL);
	log_line("DISP", "I2C bus initialized");

	if (!gDisplay.begin(SSD1306_SWITCHCAPVCC, ADDR)) {
		log_line("DISP", "ERROR: SSD1306 initialization failed at I2C address");
		log_line("DISP", "Check: wiring, I2C address, pull-ups");
		return -1;
	}

	log_line("DISP", "SSD1306 controller initialized");
	gDisplay.clearDisplay();
	gDisplay.setTextSize(1);
	gDisplay.setTextColor(SSD1306_WHITE);
	gDisplay.setCursor(0, 0);
	gDisplay.println(F("Display ready"));
	gDisplay.display();
	log_line("DISP", "Display buffer rendered and ready");
	
	return 0;
}

void display_set(float hum, float temp, float iaq, const char* ipStr, bool bleMode){
	gDisplay.clearDisplay();
	gDisplay.setCursor(0, 0);
	gDisplay.setTextSize(1);

	gDisplay.print(F("T: "));
	gDisplay.print(temp, 1);
	gDisplay.print(F("C  H: "));
	gDisplay.print(hum, 1);
	gDisplay.println(F("%"));

	gDisplay.print(F("IAQ: "));
	gDisplay.println(iaq, 0);

	gDisplay.print(F("IP: "));
	gDisplay.println(ipStr == nullptr ? "N/A" : ipStr);

	gDisplay.print(F("BLE: "));
	gDisplay.println(bleMode ? F("ON") : F("OFF"));

	gDisplay.display();
}