#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <hd44780.h>
#include <hd44780ioClass/hd44780_I2Cexp.h>

// --- WiFi and Backend Config ---
const char* WIFI_SSID       = "Mechacy_2.4GHz";
const char* WIFI_PASSWORD   = "Pijoy@IP1";
const char* BACKEND_HOST_IP = "192.168.0.103"; // CORRECTED IP
const int BACKEND_PORT      = 5000;

const char* CONSULT_URL  = "http://192.168.0.103:5000/api/queue/current";
const char* PHARMACY_URL = "http://192.168.0.103:5000/api/pharmacy/queue";

// --- I2C/LCD Config ---
#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22

#define ADDR_LCD1 0x26
const int COLS_1 = 16;
const int ROWS_1 = 2;

#define ADDR_LCD2 0x27
const int COLS_2 = 20;
const int ROWS_2 = 4;

hd44780_I2Cexp lcd1(ADDR_LCD1, COLS_1, ROWS_1);
hd44780_I2Cexp lcd2(ADDR_LCD2, COLS_2, ROWS_2);

bool lcd1_found = false;
bool lcd2_found = false;

// --- Polling and Data Structures ---
unsigned long lastPoll = 0;
// *** CHANGE: Reduced poll interval to 3000ms (3 seconds) ***
const unsigned long POLL_INTERVAL_MS = 3000; 

struct QueueTop {
  String nowServing;
  String nextUp;
};

QueueTop consultTop = {"--", "--"};
QueueTop pharmacyTop = {"--", "--"};
String statusMsg = "INIT"; 

// --- Function Prototypes ---
void connectWiFi();
QueueTop fetchTopFromEndpoint(const char* url);
void drawConsultLCD();
void drawPharmacyLCD();
void printPadded(hd44780_I2Cexp &lcd, int col, int row, const String &text, int width);

// ===================================================================
// --- WIFI & SETUP ---
// ===================================================================

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    statusMsg = "WIFI...";
    // Check if LCD1 is ready to print status during connection
    if (lcd1_found) { 
        lcd1.setCursor(0, 0); 
        lcd1.print("Connecting...   "); 
        lcd1.setCursor(0, 1);
        lcd1.print(statusMsg);
    }
  }
  Serial.println(" connected");
  statusMsg = "WiFi OK";
}

// ... (fetchTopFromEndpoint function remains unchanged) ...
QueueTop fetchTopFromEndpoint(const char* url) {
  QueueTop result = {"--", "--"};
  statusMsg = "HTTP...";
  if (WiFi.status() != WL_CONNECTED) {
    statusMsg = "No WiFi";
    return result;
  }

  HTTPClient http;
  
  if (http.begin(url)) {
    int code = http.GET();
    statusMsg = (code == 200) ? "HTTP OK" : "HTTP ERR";
    
    if (code == 200) {
      DynamicJsonDocument doc(1024);
      DeserializationError err = deserializeJson(doc, http.getStream());
      
      if (!err) {
        JsonArray queue = doc["queue"].as<JsonArray>();
        if (!queue.isNull() && queue.size() > 0) {
          result.nowServing = queue[0]["queue_number"].as<String>();
          if (queue.size() > 1) {
            result.nextUp = queue[1]["queue_number"].as<String>();
          }
        }
      } else {
        statusMsg = "JSON ERR";
        Serial.printf("JSON parsing failed: %s\n", err.c_str());
      }
    } else {
      Serial.printf("HTTP error %d for %s\n", code, url);
    }
  } else {
    statusMsg = "CONN ERR";
  }
  http.end();
  return result;
}

void setup() {
  Serial.begin(115200);
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  
  // Initialize LCDs
  if (lcd1.begin(COLS_1, ROWS_1) == 0) {
    lcd1.backlight();
    lcd1_found = true;
  }
  if (lcd2.begin(COLS_2, ROWS_2) == 0) {
    lcd2.backlight();
    lcd2_found = true;
  }

  // Connect network (will use LCDs for initial status)
  connectWiFi();
}

// ===================================================================
// --- DRAWING FUNCTIONS (Cleaned Up) ---
// ===================================================================

void drawConsultLCD() {
  if (!lcd1_found) return;
  
  // LCD 1 (16x2)
  
  // Line 1: Main Label (Total 16 characters)
  lcd1.setCursor(0, 0);
  lcd1.print("CONSULT NOW     "); // 12 chars + 4 spaces = 16 chars

  // Line 2: Now Serving Number (Total 16 characters)
  lcd1.setCursor(0, 1);
  printPadded(lcd1, 0, 1, consultTop.nowServing, COLS_1);
}

void drawPharmacyLCD() {
  if (!lcd2_found) return;
  
  // LCD 2 (20x4)
  lcd2.clear(); // ensures shorter text does not leave artifacts

  // Line 1: Centered Title (Total 20 characters)
  printPadded(lcd2, 0, 0, "    PHARMACY QUEUE  ", COLS_2);

  // Line 2: Pharmacy Now Serving
  printPadded(lcd2, 0, 1, "Pharm Now: " + pharmacyTop.nowServing, COLS_2);

  // Line 3: Consult Next
  printPadded(lcd2, 0, 2, "Consult Next:" + consultTop.nextUp, COLS_2);

  // Line 4: Pharmacy Next
  printPadded(lcd2, 0, 3, "Pharm Next: " + pharmacyTop.nextUp, COLS_2);
}

// Pads or trims text to exactly width characters so LCD lines stay clean
void printPadded(hd44780_I2Cexp &lcd, int col, int row, const String &text, int width) {
  lcd.setCursor(col, row);
  String out = text;
  if (out.length() > width) {
    out = out.substring(0, width);
  }
  int pad = width - out.length();
  lcd.print(out);
  for (int i = 0; i < pad; i++) {
    lcd.print(" ");
  }
}

// ===================================================================
// --- MAIN LOOP ---
// ===================================================================

void loop() {
  // Attempt to maintain WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
  
  unsigned long now = millis();
  if (now - lastPoll > POLL_INTERVAL_MS) { // Checks against 3000ms
    lastPoll = now;

    // Fetch data 
    consultTop = fetchTopFromEndpoint(CONSULT_URL);
    pharmacyTop = fetchTopFromEndpoint(PHARMACY_URL);

    drawConsultLCD();
    drawPharmacyLCD();
    
    // Print the network status to the serial monitor on every poll
    Serial.printf("Status: %s | Consult Now: %s | Pharm Now: %s\n", 
                  statusMsg.c_str(), 
                  consultTop.nowServing.c_str(), 
                  pharmacyTop.nowServing.c_str());
  }

  // Small delay to yield to the ESP32 OS tasks
  delay(10);
}