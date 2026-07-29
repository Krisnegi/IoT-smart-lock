# IoT Smart Lock & Automated Access Management System

A production-grade, full-stack IoT Smart Lock simulation and administration platform. This system implements a complete request-acknowledgement flow, temporary guest PIN codes with background auto-expiration workers, real-time device heartbeat monitoring, offline device detection, and a reactive dashboard with live WebSocket feeds and a visual mock hardware keypad simulator.

---

## 🏗️ Architecture & E2E Flows

The system leverages a decoupled event-driven architecture connecting a React frontend, an Express REST/WebSocket server, a PostgreSQL database, a Redis-backed BullMQ worker queue, and an MQTT broker.

### System Diagram

```mermaid
graph TD
    %% Frontend Layer
    subgraph Frontend ["React SPA (Vite + Tailwind)"]
        Dashboard["Admin & Access Dashboard"]
        Keypad["Virtual Lock Keypad"]
    end

    %% API / Gateway Layer
    subgraph Gateway ["API & Communication Gateway"]
        Express["Express Server (Port 3000)"]
        WS["WebSocket Server (ws)"]
    end

    %% Database & Messaging Broker Layer
    subgraph Broker ["Message & Job Brokers"]
        Mosquitto["Eclipse Mosquitto MQTT Broker (Port 1883)"]
        Redis["Redis Memory Store (Port 6380)"]
    end

    %% Backend Background Services
    subgraph Services ["Backend Services"]
        Prisma["Prisma ORM & PostgreSQL (Port 5433)"]
        BullMQ["BullMQ Worker (PIN Expiration)"]
        Heartbeat["Background Heartbeat Monitor"]
        Simulator["Virtual Device Simulator (Demo Mode)"]
    end

    %% Connections
    Dashboard -->|REST API / HTTP| Express
    Keypad -->|REST API / Key Clicks| Express
    WS <->|WebSockets (Live Logs & Status)| Dashboard
    Express <->|Pub/Sub commands/acks| Mosquitto
    Express <->|Database Queries| Prisma
    Express -->|Schedule Expiration Jobs| Redis
    BullMQ <->|Poll Delayed Jobs| Redis
    BullMQ -->|Deactivate PINs| Prisma
    Heartbeat -->|Check Offline Devices| Prisma
    Heartbeat -->|Broadcast Status Change| WS
    Simulator <->|Pub/Sub heartbeats/PIN validate| Mosquitto
```

---

## ⚡ Core Features

1. **Dual Access Methods**:
   * **Remote API Commands**: Instant unlock commands sent from the dashboard over MQTT with a synchronous REST response waiting for the physical hardware acknowledgment (5s timeout fallback).
   * **Keypad PIN Entries**: Numeric PIN input processed securely via bcrypt verification on the backend.
2. **Temporary Guest Credentials with Auto-Expiration**:
   * Admin-generated PINs with customized active duration times.
   * Leverages **BullMQ** and **Redis** to run background delayed workers that automatically expire and deactivate PIN keys the instant their duration elapsed.
3. **Heartbeat Monitoring & Offline Detection**:
   * Physical/Virtual locks publish heartbeats every 10 seconds.
   * A background cron checker runs every 15 seconds. If a device misses its heartbeats for over 30 seconds, it is marked `OFFLINE` and alerts are broadcasted.
4. **Instant Auto-Relocking**:
   * Hardware simulates auto-relock mechanical safety and transitions state back to `LOCKED` 30 seconds after any successful PIN or API unlock.
5. **Real-time Live Event Streaming**:
   * Full WebSocket stream pipes locks' status updates and access activity logs (successes, incorrect PIN shakes, expired attempt blocks, and offline states) to the admin console instantly.
6. **OpenAPI API Documentation**:
   * Complete API specifications with sandbox testing capabilities served via Swagger UI.

---

## 🛠️ Technology Stack

* **Frontend**: React (Vite), TypeScript, Tailwind CSS, Lucide Icons, native WebSockets.
* **Backend**: Node.js, Express, TypeScript, Prisma ORM (PostgreSQL), ws.
* **Asynchronous Jobs**: BullMQ, Redis.
* **IoT Protocols**: MQTT (eclipse-mosquitto broker).
* **Documentation**: Swagger UI, OpenAPI 3.0.

---

## 📁 Directory Structure

```text
├── backend/                      # Node.js + Express backend service
│   ├── prisma/                   # Prisma database schemas & migrations
│   └── src/
│       ├── config/               # Database, MQTT, and Swagger definitions
│       ├── controllers/          # Request logic (auth, locks, permissions, simulator)
│       ├── middlewares/          # JWT authentication & Role-Based Access controls
│       ├── queues/               # BullMQ delayed workers for PIN auto-expiration
│       ├── routes/               # API endpoints mappings
│       ├── services/             # MQTT services, transaction trackers, & heartbeats
│       ├── ws/                   # WebSocket server broadcast managers
│       └── server.ts             # Application entrypoint
├── frontend/                     # React + Vite single page application
│   └── src/
│       ├── components/           # UI views (Dashboard, Keypad Dial, Login, Toasts)
│       ├── context/              # Authentication & WebSocket contexts
│       └── main.tsx              # React mounting root
└── docker-compose.yml            # Docker container configurations for PG, Redis & MQTT
```

---

## 🚀 Getting Started

### 📋 Prerequisites
Ensure you have the following installed on your machine:
* [Docker & Docker Compose](https://www.docker.com/products/docker-desktop/)
* [Node.js](https://nodejs.org/) (v18 or higher recommended)
* [npm](https://www.npmjs.com/) (v9 or higher)

---

### Step 1: Start the Infrastructure Containers
Spin up PostgreSQL, Redis, and Mosquitto MQTT broker using Docker Compose in the project root:
```bash
docker compose up -d
```
Verify that the containers are healthy and running:
```bash
docker compose ps
```

---

### Step 2: Configure & Seed the Backend
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Copy the example environment file and install dependencies:
   ```bash
   npm install
   ```
3. Set up the Database Schemas & Migrations:
   ```bash
   npx prisma migrate dev
   ```
4. Reset database tables to clear any legacy data and run seed setup (optional but recommended for a clean test):
   ```bash
   npx prisma migrate reset
   ```
   *(This clears PostgreSQL tables and prepares the automated seeder).*

---

### Step 3: Run the Services

#### A. Run Backend:
Start the backend developer server:
```bash
npm run dev
```
*Note: On start, the backend will auto-seed a default administrator account (`admin@example.com` / `adminpassword123`) and a default lock (`front-gate-01`) if they do not already exist.*

The server will bind to:
* **API Portal & WebSockets**: `http://localhost:3000`
* **Swagger API Documentation**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

---

#### B. Run Frontend:
1. Open a new terminal tab and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite React client dev server:
   ```bash
   npm run dev
   ```

Open your browser to the local Vite portal at:
👉 **[http://localhost:5173](http://localhost:5173)**

---

## 👥 Demo Credentials & Recruiter Testing Guide

For quick testing, the login screen includes a **One-Click Demo Admin Login** card. Alternatively, you can use these seeded credentials:
* **Email**: `admin@example.com`
* **Password**: `adminpassword123`

### Complete Walkthrough Testing Scenario
1. **Login**: Click **"One-Click Demo Admin Login"**. You'll instantly see the registered locks list.
2. **Examine Device State**: The `Front Gate Lock` (`front-gate-01`) is seeded and should display **ONLINE** (green badge) and **LOCKED** (gray badge).
3. **Send Remote Unlock**:
   * Click **"Remote Unlock"** on the front-gate card.
   * Confirm the browser modal alert.
   * The visual keypad simulator ring turns green, the status transitions to **UNLOCKED**, and a confirmation toast overlays.
   * Wait 30 seconds: the lock automatically performs its safety relock and returns to **LOCKED**.
4. **Issue a Guest Temporary PIN**:
   * Under the **"Generate Guest PIN"** card, select `Front Gate Lock`, select the guest email, type a 6-digit numeric PIN (e.g., `121212`), and set the active duration (e.g., `15 seconds`).
   * Click **"Generate PIN"**.
5. **Simulate Keypad Input**:
   * Select `front-gate-01` in the visual keypad widget dropdown.
   * Type `121212` on the digits (it auto-submits upon typing 6 digits).
   * The lock accepts the entry, turns green to display **UNLOCKED**, logs the successful keypad access audit, and then automatically relocks after 30 seconds.
6. **Verify BullMQ Expiration**:
   * Wait for the 15-second duration of the PIN to elapse.
   * Try typing `121212` again. The visual lock keypad will perform a red shake animation, outputting a denied status badge because the background worker successfully deactivated the expired key.
7. **Inspect Audit History**:
   * Click the info icon on the front-gate card. The responsive modal will list the live statistics and audit log timestamps for all remote commands, correct PIN entries, and expired/unauthorized denied access attempts.
