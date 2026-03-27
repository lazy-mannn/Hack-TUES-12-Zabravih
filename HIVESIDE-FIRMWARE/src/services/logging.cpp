#include <cstdarg>
#include <cstring>
#include "logging.h"

namespace {
SemaphoreHandle_t s_log_mutex = nullptr;
bool s_log_init_attempted = false;
constexpr size_t kLogBufferSize = 256;
}

bool logging_init() {
    if (s_log_init_attempted) {
        return s_log_mutex != nullptr;
    }
    s_log_init_attempted = true;
    s_log_mutex = xSemaphoreCreateMutex();
    return s_log_mutex != nullptr;
}

static void lock_logging() {
    if (!s_log_mutex && !logging_init()) {
        return;
    }
    if (s_log_mutex) {
        xSemaphoreTake(s_log_mutex, portMAX_DELAY);
    }
}

static void unlock_logging() {
    if (s_log_mutex) {
        xSemaphoreGive(s_log_mutex);
    }
}

void logf(const char* tag, const char* fmt, ...) {
    char message[kLogBufferSize];
    va_list args;
    va_start(args, fmt);
    int len = vsnprintf(message, sizeof(message), fmt, args);
    va_end(args);

    if (len < 0) {
        return;
    }

    if (len >= static_cast<int>(sizeof(message))) {
        message[sizeof(message) - 1] = '\0';
    }

    size_t msg_len = strlen(message);
    if (msg_len > 0 && message[msg_len - 1] == '\n') {
        message[msg_len - 1] = '\0';
    }

    char line[kLogBufferSize + 32];
    if (tag && tag[0] != '\0') {
        snprintf(line, sizeof(line), "[%s] %s", tag, message);
    } else {
        snprintf(line, sizeof(line), "%s", message);
    }

    lock_logging();
    Serial.println(line);
    unlock_logging();
}

void log_line(const char* tag, const char* msg) {
    if (!msg) {
        return;
    }
    logf(tag, "%s", msg);
}
