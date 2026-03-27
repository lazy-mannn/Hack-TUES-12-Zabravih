#pragma once

#include <Arduino.h>
#include <driver/i2s_std.h>
#include <driver/i2s_common.h>

// ======================== I2S MICROPHONE CONFIGURATION ========================
#define I2S_PORT I2S_NUM_0
#define I2S_SAMPLE_RATE 16000
#define I2S_BITS_PER_SAMPLE I2S_BITS_PER_SAMPLE_16BIT
#define I2S_CHANNEL_NUM 1  // Mono
#define I2S_DMA_BUF_COUNT 4
#define I2S_DMA_BUF_LEN 1024

// Pin assignments for I2S microphone
#define I2S_CLK_PIN 17   // GPIO17 (BCLK)
#define I2S_WS_PIN 16    // GPIO16 (LRCLK/WS)
#define I2S_DATA_PIN 42  // GPIO42 (DOUT/SD)

// ======================== MICROPHONE FUNCTIONS ========================
int microphone_begin();
void microphone_stop();
bool microphone_read(uint8_t* buffer, size_t buffer_size, size_t* bytes_read);
void microphone_get_config(char* config_str, size_t len);
void microphone_log();
