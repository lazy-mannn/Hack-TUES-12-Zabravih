#include <microphone.h>
#include <cstring>
#include "logging.h"

namespace {
constexpr size_t kReadSize = 512;
bool mic_initialized = false;
i2s_chan_handle_t rx_chan = NULL;
}

int microphone_begin() {
    if (mic_initialized) {
        log_line("MIC", "Already initialized, skipping...");
        return -1;
    }

    log_line("MIC", "Initializing I2S microphone (ESP-IDF v5)...");

    // 1. Allocate channel
    i2s_chan_config_t chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_0, I2S_ROLE_MASTER);
    esp_err_t result = i2s_new_channel(&chan_cfg, NULL, &rx_chan);
    if (result != ESP_OK) {
        logf("MIC", "ERROR: Failed to create I2S rx channel (%d)", result);
        return -1;
    }

    // 2. Initialize std mode
    i2s_std_config_t std_cfg = {
        .clk_cfg  = I2S_STD_CLK_DEFAULT_CONFIG(I2S_SAMPLE_RATE),
        .slot_cfg = I2S_STD_MSB_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_MONO),
        .gpio_cfg = {
            .mclk = I2S_GPIO_UNUSED,    // some codecs may require mclk
            .bclk = (gpio_num_t)I2S_CLK_PIN,
            .ws   = (gpio_num_t)I2S_WS_PIN,
            .dout = I2S_GPIO_UNUSED,
            .din  = (gpio_num_t)I2S_DATA_PIN,
            .invert_flags = {
                .mclk_inv = false,
                .bclk_inv = false,
                .ws_inv   = false,
            },
        },
    };

    std_cfg.slot_cfg.slot_mask = I2S_STD_SLOT_LEFT;

    result = i2s_channel_init_std_mode(rx_chan, &std_cfg);
    if (result != ESP_OK) {
        logf("MIC", "ERROR: Failed to init std mode (%d)", result);
        i2s_del_channel(rx_chan);
        return -1;
    }

    // 3. Enable the channel
    result = i2s_channel_enable(rx_chan);
    if (result != ESP_OK) {
        logf("MIC", "ERROR: Failed to enable I2S channel (%d)", result);
        i2s_del_channel(rx_chan);
        return -1;
    }

    mic_initialized = true;
    log_line("MIC", "I2S microphone ready for audio input");

    return 0;
}

void microphone_stop() {
    if (!mic_initialized) {
        return;
    }

    i2s_channel_disable(rx_chan);
    i2s_del_channel(rx_chan);
    mic_initialized = false;
    log_line("MIC", "I2S microphone stopped");
}

bool microphone_read(uint8_t* buffer, size_t buffer_size, size_t* bytes_read) {
    if (!mic_initialized) {
        log_line("MIC", "ERROR: Microphone not initialized");
        return false;
    }

    if (buffer == NULL || buffer_size == 0) {
        log_line("MIC", "ERROR: Invalid buffer");
        return false;
    }

    size_t read_bytes = 0;
    esp_err_t result = i2s_channel_read(
        rx_chan,
        buffer,
        buffer_size,
        &read_bytes,
        100 / portTICK_PERIOD_MS // increased from 10ms to 100ms
    );

    if (result == ESP_ERR_TIMEOUT) {
        // ESP_ERR_TIMEOUT is 263. This happens if I2S DMA cannot fill the buffer in time.
        return false;
    } else if (result != ESP_OK) {
        logf("MIC", "ERROR: i2s_read failed (%d)", result);
        return false;
    }

    if (bytes_read != NULL) {
        *bytes_read = read_bytes;
    }

    return true;
}

void microphone_get_config(char* config_str, size_t len) {
    if (config_str == NULL || len == 0) {
        return;
    }

    snprintf(
        config_str,
        len,
        "I2S Mic [%dHz, 16-bit, GPIO%d/CLK, GPIO%d/WS, GPIO%d/DATA]",
        I2S_SAMPLE_RATE,
        I2S_CLK_PIN,
        I2S_WS_PIN,
        I2S_DATA_PIN
    );
}

void microphone_log(){
  // Read and print microphone data
  static uint8_t mic_buffer[512];
  size_t bytes_read = 0;
  if (microphone_read(mic_buffer, sizeof(mic_buffer), &bytes_read))
  {
    if (bytes_read > 0)
    {
            char line[256];
            int written = snprintf(line, sizeof(line), "Read %u bytes: ", static_cast<unsigned>(bytes_read));
            size_t pos = (written > 0) ? static_cast<size_t>(written) : 0;

            for (size_t i = 0; i < bytes_read && i < 16 && pos < sizeof(line) - 1; i++)
            {
                int added = snprintf(line + pos, sizeof(line) - pos, "%u%s", mic_buffer[i], (i < bytes_read - 1 && i < 15) ? ", " : "");
                if (added < 0) {
                    break;
                }
                pos += static_cast<size_t>(added);
                if (pos >= sizeof(line) - 1) {
                    break;
                }
            }

            if (bytes_read > 16 && pos < sizeof(line) - 5) {
                strncat(line, " ...", sizeof(line) - pos - 1);
            }

            logf("MIC", "%s", line);
    }
  }
}
