# 🐝 SmeeHive Mainboard PCB

Mainboard PCB for the **SmeeHive Beehive Monitoring System**.  
This board is responsible for sensor acquisition, power management, and communication.

---

## 📌 Overview

The SmeeHive mainboard is designed to monitor beehive health using environmental and behavioral data. It integrates multiple sensors, power subsystems, and communication interfaces into a compact embedded platform.

---

## ⚙️ Features

- **ESP32-S3-based system**
  - Wi-Fi + BLE connectivity
  - Multiple GPIOs exposed
  - Dual UART support (debug + external modules)

- **Sensor Support**
  - Temperature & Humidity (I2C)
  - CO₂ Sensor (I2C)
  - NH₃ (Ammonia) Sensor
  - IMU (MPU6050)
  - Lid sensor input

- **Display**
  - I2C OLED display interface

- **Power System**
  - USB Type-C input
  - LiPo battery charging (BQ24090)
  - Solar input support
  - DC/DC Buck converter (TPSM84209)
  - LDO regulator (ME6211C33)

- **User Interface**
  - Reset & Boot buttons
  - Status LEDs (charging + system)

---

## 🔌 Power Architecture

The board supports multiple power sources:

- **USB Type-C (5V input)**
- **LiPo Battery (4.2V max)**
- **Solar Input**

### Key Components:
- Charger: `BQ24090`
- Buck Converter: `TPSM84209`
- LDO: `ME6211C33`

### Power Rails:
- `VBUS` – USB power
- `4.2V` – Battery rail
- `VCC (3.3V)` – Main system voltage

---

## 🔗 Interfaces

### I2C Buses
- **I2C1**
  - Temp/Humidity sensor
  - CO₂ sensor
  - OLED display

- **I2C2**
  - Additional peripherals

### UART
- **UART0** – Debug
- **UART1** – GPS / LoRa module

---

## 📡 Sensors

| Sensor Type       | Interface      | Notes                     |
|-------------------|----------------|---------------------------|
| Temp & Humidity   | I2C            | Primary environmental data|
| CO₂ Sensor        | I2C            | Air quality               |
| NH₃ Sensor        | GPIO / Analog  | Ammonia detection         |
| MPU6050           | I2C            | Motion / vibration        |
| Lid Sensor        | GPIO           | Hive activity detection   |

---

## 🔘 Buttons & Indicators

- **RESET Button**
- **BOOT Button**
- **Status LED**
- **Charging LED**

---

## ⚡ Connectors

- USB Type-C
- Terminal connectors for:
  - Battery
  - Solar input
  - External sensors
- UART headers

---

## 🧠 Firmware Notes

- Designed for **FreeRTOS-based firmware**
- Suggested tasks:
  - Sensor acquisition
  - Communication
  - Power management

---

## 🛠️ Design Notes

- Decoupling capacitors on all major rails  
- USB Type-C CC resistors included  
- Battery charging status feedback (`CHG_STATE`)  
- Voltage dividers for ADC monitoring (`VADC`, `BADC`)  

---

## 🚧 TODO / Future Improvements

- Add ESD/TVS protection on USB and external connectors  
- Improve environmental sealing for outdoor use  
- Standardize connectors (e.g., JST-PH)  
- Optional battery fuel gauge IC  

