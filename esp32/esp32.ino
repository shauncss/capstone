#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <hd44780.h>
#include <hd44780ioClass/hd44780_I2Cexp.h>

// --- WiFi and Backend Config ---
const char* WIFI_SSID       = ""; 
const char* WIFI_PASSWORD   = ""; 
const char* BACKEND_IP      = "";
const int   BACKEND_PORT    = 5000;

// API Endpoints
String CONSULT_URL  = "http://" + String(BACKEND_IP) + ":" + String(BACKEND_PORT) + "/api/queue/current";
String PAYMENT_URL  = "http://" + String(BACKEND_IP) + ":" + String(BACKEND_PORT) + "/api/payment/queue";
String PHARMACY_URL = "http://" + String(BACKEND_IP) + ":" + String(BACKEND_PORT) + "/api/pharmacy/queue";

// --- I2C/LCD Config ---
#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22

// LCD 1: 16x2 (Announcer)
#define ADDR_LCD1 0x26
const int COLS_1 = 16;
const int ROWS_1 = 2;

// LCD 2: 20x4 (Dashboard)
#define ADDR_LCD2 0x27
const int COLS_2 = 20;
const int ROWS_2 = 4;

hd44780_I2Cexp lcd1(ADDR_LCD1, COLS_1, ROWS_1);
hd44780_I2Cexp lcd2(ADDR_LCD2, COLS_2, ROWS_2);

bool lcd1_found = false;
bool lcd2_found = false;

// --- Data Structures ---
struct ClinicState {
  String room1;
  String room2;
  String payment;
  String pharmacy;
};

// Current state and Previous state (to detect changes)
ClinicState currentState = {"--", "--", "--", "--"};
ClinicState previousState = {"--", "--", "--", "--"};

// Polling settings
unsigned long lastPoll = 0;
const unsigned long POLL_INTERVAL_MS = 2000; // Poll every 2 seconds

// --- Function Prototypes ---
void connectWiFi();
void fetchAllQueues();
String parseActiveTicket(String payload, String type, int roomId = -1);
void updateDashboardLCD();
void updateAnnouncerLCD();
void blinkLCD1();
void printPadded(hd44780_I2Cexp &lcd, int col, int row, const String &text, int width);

// ===================================================================
// --- SETUP ---
// ===================================================================

void setup() {
  Serial.begin(115200);
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  
  // Initialize LCDs
  if (lcd1.begin(COLS_1, ROWS_1) == 0) {
    lcd1.backlight();
    lcd1_found = true;
    lcd1.print("Init System...");
  }
  
  if (lcd2.begin(COLS_2, ROWS_2) == 0) {
    lcd2.backlight();
    lcd2_found = true;
    lcd2.print("Connecting WiFi...");
  }

  connectWiFi();
  
  if (lcd1_found) lcd1.clear();
  if (lcd2_found) lcd2.clear();
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" Connected");
}

// ===================================================================
// --- MAIN LOOP ---
// ===================================================================

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
  
  unsigned long now = millis();
  if (now - lastPoll > POLL_INTERVAL_MS) {
    lastPoll = now;
    
    // 1. Fetch Data
    fetchAllQueues();

    // 2. Update Dashboard (LCD 2 - 20x4)
    updateDashboardLCD();

    // 3. Update Announcer (LCD 1 - 16x2) if changed
    updateAnnouncerLCD();

    // Note: We do NOT update previousState globally here. 
    // It is updated selectively inside updateAnnouncerLCD.
  }
}

// ===================================================================
// --- DATA FETCHING & PARSING ---
// ===================================================================

String httpGet(String url) {
  HTTPClient http;
  String payload = "{}";
  if (http.begin(url)) {
    int code = http.GET();
    if (code == 200) {
      payload = http.getString();
    }
    http.end();
  }
  return payload;
}

void fetchAllQueues() {
  // Fetch raw JSON strings
  String consultJson = httpGet(CONSULT_URL);
  String paymentJson = httpGet(PAYMENT_URL);
  String pharmacyJson = httpGet(PHARMACY_URL);

  // Parse specific numbers needed
  // Consult Queue: Status="called" AND Room ID
  currentState.room1 = parseActiveTicket(consultJson, "consult", 1);
  currentState.room2 = parseActiveTicket(consultJson, "consult", 2);
  
  // Payment/Pharmacy: Status="ready"
  currentState.payment = parseActiveTicket(paymentJson, "payment");
  currentState.pharmacy = parseActiveTicket(pharmacyJson, "pharmacy");
}

String parseActiveTicket(String payload, String type, int roomId) {
  DynamicJsonDocument doc(2048); // Increased size for safety
  DeserializationError err = deserializeJson(doc, payload);
  
  if (err) return "--";

  JsonArray queue = doc["queue"].as<JsonArray>();
  if (queue.isNull()) return "--";

  // Iterate to find the active ticket
  for (JsonObject item : queue) {
    String status = item["status"].as<String>();
    
    if (type == "consult") {
      int rId = item["assigned_room_id"];
      // Look for patients currently being called/served in the specific room
      if ((status == "called" || status == "serving") && rId == roomId) {
        return item["queue_number"].as<String>();
      }
    } 
    else if (type == "payment" || type == "pharmacy") {
      // Look for patients ready for service
      if (status == "ready" || status == "called") {
        return item["queue_number"].as<String>();
      }
    }
  }
  return "--"; // Return dashes if no one is active
}

// ===================================================================
// --- DISPLAY LOGIC ---
// ===================================================================

// --- LCD 2: 20x4 Dashboard ---
void updateDashboardLCD() {
  if (!lcd2_found) return;

  // Line 1: Consultant Room1
  String l1 = "Consult R1: " + currentState.room1;
  printPadded(lcd2, 0, 0, l1, 20);

  // Line 2: Consultant Room2
  String l2 = "Consult R2: " + currentState.room2;
  printPadded(lcd2, 0, 1, l2, 20);

  // Line 3: Payment
  String l3 = "Payment   : " + currentState.payment;
  printPadded(lcd2, 0, 2, l3, 20);

  // Line 4: Pharm
  String l4 = "Pharm     : " + currentState.pharmacy;
  printPadded(lcd2, 0, 3, l4, 20);
}

// --- LCD 1: 16x2 Announcer with Blink ---
void updateAnnouncerLCD() {
  if (!lcd1_found) return;

  String announceTitle = "";
  String announceNum = "";
  bool changed = false;

  // Check queues one by one. If we find a change, we handle ONLY that one
  // and mark it as 'handled' in previousState. Other changes wait for next loop.
  
  if (currentState.room1 != previousState.room1 && currentState.room1 != "--") {
    announceTitle = "Consult Room 1";
    announceNum = currentState.room1;
    previousState.room1 = currentState.room1; 
    changed = true;
  } 
  else if (currentState.room2 != previousState.room2 && currentState.room2 != "--") {
    announceTitle = "Consult Room 2";
    announceNum = currentState.room2;
    previousState.room2 = currentState.room2;
    changed = true;
  }
  else if (currentState.payment != previousState.payment && currentState.payment != "--") {
    announceTitle = "Payment Counter";
    announceNum = currentState.payment;
    previousState.payment = currentState.payment;
    changed = true;
  }
  else if (currentState.pharmacy != previousState.pharmacy && currentState.pharmacy != "--") {
    announceTitle = "Pharmacy";
    announceNum = currentState.pharmacy;
    previousState.pharmacy = currentState.pharmacy;
    changed = true;
  }

  // Only update screen if there is a NEW change
  if (changed) {
    lcd1.clear();
    // Line 1: Counter Details
    lcd1.setCursor(0, 0);
    lcd1.print(announceTitle);
    
    // Line 2: Queue Number
    lcd1.setCursor(0, 1);
    lcd1.print("# " + announceNum);

    // Trigger Blinking Effect (Blocking)
    blinkLCD1();
  }
  
  // Sync states for items that became empty ("--") silently, so we can detect
  // when they become active again later.
  if (currentState.room1 == "--") previousState.room1 = "--";
  if (currentState.room2 == "--") previousState.room2 = "--";
  if (currentState.payment == "--") previousState.payment = "--";
  if (currentState.pharmacy == "--") previousState.pharmacy = "--";
}

void blinkLCD1() {
  if (!lcd1_found) return;
  
  // Blink 3 times (approx 1.2 seconds)
  for(int i=0; i<3; i++) {
    lcd1.noBacklight();
    delay(200);
    lcd1.backlight();
    delay(200);
  }
  
  // Hold for 3 seconds
  delay(3000);
}

// Helper to clean up LCD lines
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