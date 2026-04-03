# Smart Appointment and Queue Management System

A complete IoT-enabled smart clinic system designed to automate patient registration, capture biometric vitals via edge devices, and manage real-time queues. 

This repository contains the full-stack web platform (React, Node.js, PostgreSQL) alongside the Python-based GUI and inference stack for the Raspberry Pi edge device.

## System Architecture
* **Frontend:** React + Vite, Axios, React Router, Socket.io-client
* **Backend:** Node.js, Express, PostgreSQL (via Knex.js), Socket.io
* **Edge (Raspberry Pi):** Python 3, OpenCV, Ultralytics YOLO, Adafruit MLX90614 (Sensors)

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
