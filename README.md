# Smart Appointment and Queue Management System

* **Complete IoT-enabled smart clinic system** including automated patient registration, biometric vital capture, and real-time queue management
* **Built with React, Node.js, and PostgreSQL**, providing a seamless full-stack web platform alongside Raspberry Pi and ESP32 edge devices
* **Supports advanced data flow mechanics** including real-time WebSocket synchronization, dynamic queue calculations, and QR code handoff from physical kiosks to smartphones
* **Provides dedicated web interfaces** including a patient check-in portal, an admin control dashboard for staff, and a live waiting room display board
* **Integrates custom hardware and AI** including vital sensors (MAX30102, MLX90614) and YOLOv8 computer vision models for automated, contactless patient intake

## System Architecture
* **Frontend:** React + Vite, Axios, React Router, Socket.io-client
* **Backend:** Node.js, Express, PostgreSQL (via Knex.js), Socket.io
* **Edge (Raspberry Pi):** Python 3, OpenCV, Ultralytics YOLO, Adafruit MLX90614 (Sensors)
* **Edge (ESP32):** C++, Wi-Fi/WebSocket polling, LCD displays

---

## Prerequisites: Setting Up a New Device

If you are setting up this project on a brand-new computer or edge device, you must install the following core software before running any code.

### 1. For the Development Machine (Windows/Mac/Linux)
* **Node.js (v18+):** Required to run the backend server and the frontend Vite build environment. 
* **PostgreSQL:** The core relational database. You must have the PostgreSQL server running locally or hosted remotely.
* **Git:** To clone the repository.

### 2. For the Edge Device (Raspberry Pi)
* **Python 3.9+ and pip:** Required to execute the edge inference scripts.
* **System Libraries for Camera & OpenCV:**
  Ensure you install the native camera and graphics libraries via your package manager (e.g., `apt`):
  ```bash
  sudo apt update
  sudo apt install python3-picamera2 libgl1-mesa-glx