#include <Wire.h> 
#include <hd44780.h>          
#include <hd44780ioClass/hd44780_I2Cexp.h>

// --- Define I2C Pins for ESP32 NodeMCU-32S ---
#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22

// --- Define LCD Addresses and Dimensions ---
// LCD 1: 16 characters wide, 2 rows high, Address 0x26
#define ADDR_LCD1 0x26
const int COLS_1 = 16;
const int ROWS_1 = 2;

// LCD 2: 20 characters wide, 4 rows high, Address 0x27
#define ADDR_LCD2 0x27
const int COLS_2 = 20;
const int ROWS_2 = 4;

// Create two distinct LCD objects
hd44780_I2Cexp lcd1(ADDR_LCD1, COLS_1, ROWS_1);
hd44780_I2Cexp lcd2(ADDR_LCD2, COLS_2, ROWS_2);

// Flags to track successful initialization
bool lcd1_found = false;
bool lcd2_found = false;

void setup() {
  // *** ESP32 Change 1: Higher Baud Rate ***
  Serial.begin(115200); 
  Serial.println("Starting Dual LCD Test on ESP32...");
  
  // *** ESP32 Change 2: Explicit I2C Pin Initialization ***
  // Wire.begin(SDA, SCL);
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN); 

  // --- Initialize LCD 1 (16x2 @ 0x26) ---
  if (lcd1.begin(COLS_1, ROWS_1) == 0) {
    lcd1.backlight();
    lcd1.print("16x2 Ready!");
    lcd1_found = true;
  } else {
    Serial.println("Error: LCD 1 (0x26) failed to initialize.");
  }

  // --- Initialize LCD 2 (20x4 @ 0x27) ---
  if (lcd2.begin(COLS_2, ROWS_2) == 0) {
    lcd2.backlight();
    lcd2.print("20x4 Ready! ");
    lcd2_found = true;
  } else {
    Serial.println("Error: LCD 2 (0x27) failed to initialize.");
  }
}

void loop() {
  static int counter = 0;
  
  // ===================================================================
  // --- LCD 1: 16x2 Display (Fully utilized) ---
  // ===================================================================
  if (lcd1_found) {
    // Line 1: Static message with blinking cursor
    lcd1.setCursor(1, 0); 
    lcd1.print("16x2 Running!   "); 
    
    // Line 2: Fill the entire line with counter data
    lcd1.setCursor(0, 1);
    lcd1.print("CNT:"); // 4 chars
    
    char buffer[13];
    sprintf(buffer, "%012d", counter); // Pad remaining 12 characters
    lcd1.print(buffer);
  }

  // ===================================================================
  // --- LCD 2: 20x4 Display (Fully utilized) ---
  // ===================================================================
  if (lcd2_found) {
    // Line 1: Static message
    lcd2.setCursor(0, 0); 
    lcd2.print("--------------------"); // 20 dashes

    // Line 2: Fill entire row with a static label and the counter
    lcd2.setCursor(0, 1);
    lcd2.print("COUNT IS:"); // 10 chars
    char buffer2[11];
    sprintf(buffer2, "%010d", counter); // Pad remaining 10 chars with counter
    lcd2.print(buffer2);

    // Line 3: Static message with address confirmation
    lcd2.setCursor(0, 2);
    lcd2.print("ADDR 0x27 WORKS!    "); // Fill 20 chars

    // Line 4: Fill entire row with a scrolling character pattern
    lcd2.setCursor(0, 3);
    for (int i = 0; i < COLS_2; i++) {
        // Prints a character that scrolls
        lcd2.print((char)('A' + ((counter + i) % 4))); 
    }
  }
  
  counter++;
  delay(100); 
}