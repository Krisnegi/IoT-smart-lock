# IoT Smart Lock System Walkthrough

## Phase 1 - Project Setup & Infrastructure

### Changes Made
1. **Containerized Infrastructure Setup:**
   * Created [docker-compose.yml](file:///Users/krisnegi/Desktop/Personal/interview%20projects/IoT-smart-lock/docker-compose.yml) to spin up the local development containers:
     * **PostgreSQL** on host port `5433` (container port `5432`).
     * **Redis** on host port `6380` (container port `6379`).
     * **Eclipse Mosquitto MQTT Broker** on host port `1883` and `9001`.
   * Integrated inline entrypoint commands in Docker Compose for Mosquitto to override configuration and listen on external IPs without needing local path mounts (resolving macOS local file-sharing permissions).
2. **Project Initialization:**
   * Configured [package.json](file:///Users/krisnegi/Desktop/Personal/interview%20projects/IoT-smart-lock/package.json) with Express, Prisma, MQTT, ws, BullMQ, and TypeScript.
   * Created [tsconfig.json](file:///Users/krisnegi/Desktop/Personal/interview%20projects/IoT-smart-lock/tsconfig.json) for ES2022 CommonJS modules resolution.
   * Created [.env](file:///Users/krisnegi/Desktop/Personal/interview%20projects/IoT-smart-lock/.env) with local DB, Redis, and MQTT ports mapping.
3. **Boilerplate Express Code:**
   * Added configuration manager in [config/index.ts](file:///Users/krisnegi/Desktop/Personal/interview%20projects/IoT-smart-lock/src/config/index.ts).
   * Implemented Express app with CORS and JSON parser in [app.ts](file:///Users/krisnegi/Desktop/Personal/interview%20projects/IoT-smart-lock/src/app.ts).
   * Implemented server bootup and clean termination triggers in [server.ts](file:///Users/krisnegi/Desktop/Personal/interview%20projects/IoT-smart-lock/src/server.ts).
   * Exposed health check at `/api/health`.

### Verification & Validation Results
1. **Docker Service Verification:**
   * Checked with `docker compose ps` to ensure all containers run successfully:
     ```text
     smart_lock_mosquitto  Up About a minute   0.0.0.0:1883->1883/tcp
     smart_lock_postgres   Up About a minute   0.0.0.0:5433->5432/tcp
     smart_lock_redis      Up 28 seconds       0.0.0.0:6380->6379/tcp
     ```
2. **Server Health API Test:**
   * Started the development server using `npm run dev` and called `/api/health` via `curl`:
     ```json
     {
       "status": "UP",
       "timestamp": "2026-07-23T05:57:20.131Z",
       "uptime": 7.825038
     }
     ```

---

## Phase 2 - Database Setup & Authentication (JWT + RBAC)

### Changes Made
1. **Prisma Database Schema:**
   * Created [schema.prisma](file:///Users/krisnegi/Desktop/Personal/interview%20projects/IoT-smart-lock/prisma/schema.prisma) detailing our relations: `User` (Admin/Manager/User), `Lock`, `UserLockPermission`, `TemporaryPin`, and `AccessLog`.
   * Created and applied initial database migrations to PostgreSQL via Prisma.
2. **Prisma Client Config:**
   * Configured the global Prisma Client instance in [db.ts](file:///Users/krisnegi/Desktop/Personal/interview%20projects/IoT-smart-lock/src/config/db.ts) with dynamic query logging in development mode and automated disconnects on shutdown.
3. **Password Security & JSON Web Tokens:**
   * Hashed and salted passwords in registration with `bcrypt` (10 rounds).
   * Verified user credentials and signed JWT tokens upon login (payload details: id, email, role; expiry: 24 hours).
4. **Auth & RBAC Middleware:**
   * Added jwt authentication middleware and role-based access control guards in [auth.middleware.ts](file:///Users/krisnegi/Desktop/Personal/interview%20projects/IoT-smart-lock/src/middlewares/auth.middleware.ts).
   * Registered authentication and verification endpoints under `/api/auth` in [auth.routes.ts](file:///Users/krisnegi/Desktop/Personal/interview%20projects/IoT-smart-lock/src/routes/auth.routes.ts).

### Verification & Validation Results
* Created and executed a dedicated node verification script (test_auth.js) to test endpoints:
  * Fetching `/auth/me` without a token fails with `401 Unauthorized`.
  * Registering `ADMIN` user succeeds with `201 Created`.
  * Logging in works with `200 OK` and returns JWT token.
  * Accessing protected `/auth/me` and `/auth/admin-only` as Admin succeeds with `200 OK`.
  * Registering and logging in as standard `USER` works.
  * Attempting to access `/auth/admin-only` as standard User fails with `403 Forbidden` as expected.

---

## Phase 3 - Lock & Permission Management APIs

### Changes Made
1. **Lock CRUD Controller & Routes:**
   * Created [lock.controller.ts](file:///Users/krisnegi/Desktop/Personal/interview%20projects/IoT-smart-lock/src/controllers/lock.controller.ts) & [lock.routes.ts](file:///Users/krisnegi/Desktop/Personal/interview%20projects/IoT-smart-lock/src/routes/lock.routes.ts).
   * Implemented routes protected by Authentication and RBAC:
     * `POST /api/locks` - Registers a lock (Admin only).
     * `GET /api/locks` - Lists all locks (Admin & Manager).
     * `GET /api/locks/:id` - Detailed lock retrieval (Admin & Manager).
     * `PUT /api/locks/:id` - Updates lock status or details (Admin only).
     * `DELETE /api/locks/:id` - Unregisters lock (Admin only).
2. **Access Permissions Controller & Routes:**
   * Created [permission.controller.ts](file:///Users/krisnegi/Desktop/Personal/interview%20projects/IoT-smart-lock/src/controllers/permission.controller.ts) & [permission.routes.ts](file:///Users/krisnegi/Desktop/Personal/interview%20projects/IoT-smart-lock/src/routes/permission.routes.ts).
   * Implemented permissions mapping endpoints:
     * `POST /api/permissions/grant` - Grant access to a user on a specific lock (Admin & Manager).
     * `POST /api/permissions/revoke` - Revoke access from a user (Admin & Manager).
     * `GET /api/permissions/my-locks` - Returns only the locks the logged-in user has permission to access (Any Authentated user).
3. **Global Routing:**
   * Mounted lock and permission routing in [app.ts](file:///Users/krisnegi/Desktop/Personal/interview%20projects/IoT-smart-lock/src/app.ts).

### Verification & Validation Results
* Created and executed a dedicated validation script `scratch/test_locks.js` checking:
  * Admin successfully registers `lock-01` ("Front Gate Lock") and `lock-02` ("Back Door Lock") (`201 Created`).
  * Standard User attempting to register a lock is rejected with `403 Forbidden`.
  * Admin successfully lists all registered locks (lists both `lock-01` and `lock-02`).
  * Standard User attempting to list all registered locks is blocked with `403 Forbidden`.
  * Admin grants standard user access to `lock-01` (`201 Created`).
  * Standard User retrieves their allowed locks (`/my-locks`) and successfully sees `lock-01` but NOT `lock-02` (verifying isolation).
  * Admin revokes standard user access to `lock-01` (`200 OK`).
  * Standard User retrieves allowed locks and receives an empty list.
  * Admin cleans up and deletes both locks (`200 OK`).

---

## Phase 4 - MQTT Integration & Command-Ack Flow

### Changes Made
1. **MQTT Client Configuration:**
   * Created [config/mqtt.ts](file:///Users/krisnegi/Desktop/Personal/interview%20projects/IoT-smart-lock/src/config/mqtt.ts) connecting backend server to local Mosquitto MQTT broker on `port 1883`.
   * Subscribed to `locks/+/ack` topic for asynchronous device confirmations.
2. **Asynchronous Request-Response Bridge:**
   * Implemented [transaction.service.ts](file:///Users/krisnegi/Desktop/Personal/interview%20projects/IoT-smart-lock/src/services/transaction.service.ts) to bridge REST requests (sync) and MQTT messages (async) using an in-memory map of pending promises (tracked with `transactionId` and a 5-second automatic timeout reject).
   * Implemented [mqtt.service.ts](file:///Users/krisnegi/Desktop/Personal/interview%20projects/IoT-smart-lock/src/services/mqtt.service.ts) to publish `UNLOCK` commands to `locks/:lockId/commands` and process device ACKs on `locks/:lockId/ack`, which resolves the pending transaction.
3. **Lock Control Controller:**
   * Implemented the `POST /api/locks/:id/unlock` endpoint inside [lock.controller.ts](file:///Users/krisnegi/Desktop/Personal/interview%20projects/IoT-smart-lock/src/controllers/lock.controller.ts) which checks user permissions, fires the MQTT command, waits for acknowledgement, updates lock DB status to `UNLOCKED`, and logs audit records (`AccessLog` successes or timeouts/unauthorized failures).
4. **IoT Lock Simulator:**
   * Created [lock-simulator.ts](file:///Users/krisnegi/Desktop/Personal/interview%20projects/IoT-smart-lock/simulator/lock-simulator.ts) mimicking virtual hardware lock controller operations over MQTT.

### Verification & Validation Results
* Ran automated E2E verification script `scratch/test_mqtt_e2e.js`:
  * **Test 1 (Offline Lock):** Attempted unlocking `lock-01` without simulator. Triggered 5-second timeout, recorded audit log as `FAILED_OFFLINE`, and successfully returned `504 Gateway Timeout`.
  * **Test 2 (Online Lock):** Started simulator child process. Sent unlock request. Simulator received MQTT command, performed 1-second simulated mechanical lock turning, and published ACK success. Backend caught ACK, resolved original HTTP request in `1.0s` with status `200 OK`, changed status in database to `UNLOCKED`, and recorded `SUCCESS` audit log.
  * **Test 3 (Unauthorized Access):** Authenticated standard user without access permissions tries to unlock `lock-01`. Blocked instantly with `403 Forbidden` and saved `FAILED_UNAUTHORIZED` audit log.

---

## Phase 5 - Temporary Access & BullMQ Background Jobs

### Changes Made
1. **API for Temporary Credentials:**
   * Created `POST /api/locks/:id/temp-pin` in [lock.controller.ts](file:///Users/krisnegi/Desktop/Personal/interview%20projects/IoT-smart-lock/src/controllers/lock.controller.ts). Admins/Managers can create short-term PINs.
2. **Delayed Job Scheduler (BullMQ + Redis):**
   * Configured [pin-expiration.queue.ts](file:///Users/krisnegi/Desktop/Personal/interview%20projects/IoT-smart-lock/src/queues/pin-expiration.queue.ts) to enqueue delayed expiration jobs in Redis.
   * Built [pin-expiration.worker.ts](file:///Users/krisnegi/Desktop/Personal/interview%20projects/IoT-smart-lock/src/queues/pin-expiration.worker.ts) that polls Redis. Once the delay elapses, it deactivates the PIN in the database (`isActive = false`).
3. **Event-Driven Online PIN Verification:**
   * Configured MQTT listeners for `locks/+/validate-pin` and `locks/+/events` in [mqtt.service.ts](file:///Users/krisnegi/Desktop/Personal/interview%20projects/IoT-smart-lock/src/services/mqtt.service.ts).
   * **Keypad Entry Flow:**
     1. Lock simulator keypad input publishes query on `locks/:lockId/validate-pin` with `{ pin, transactionId }`.
     2. Backend validates against `TemporaryPin` DB table. If active and unexpired, replies `{ allowed: true, transactionId, userId }` on `locks/:lockId/validate-pin/reply`. (If invalid/expired, immediately logs failure audit in DB and replies `allowed: false`).
     3. Simulator turns mechanical lock and publishes confirmation event to `locks/:lockId/events` with `{ event: 'PIN_ACCESS_GRANTED', pin, userId }`.
     4. Backend catches confirmation event and commits `SUCCESS` audit log in the database.
4. **Simulator Keypad Press Implementation:**
   * Refactored [lock-simulator.ts](file:///Users/krisnegi/Desktop/Personal/interview%20projects/IoT-smart-lock/simulator/lock-simulator.ts) to accept numeric inputs from command-line standard input (`stdin`), publish validate queries, process replies, turn the motor, and publish success confirmation events.

### Verification & Validation Results
* Created and executed automated E2E script `scratch/test_bullmq_e2e.js`:
  * **Test A (Valid Keypad Entry):** Registered 5s temp PIN `4820`. Sent `4820` to simulator stdin. Simulator validated PIN, received `allowed: true`, unlocked, and sent confirmation event. Verification asserted a `SUCCESS` log with method `PIN` was inserted in DB.
  * **Worker Expiration Execution:** Verification script waited 4 seconds (8.5s total time). Verification asserted the BullMQ worker ran, updated the DB status to `isActive = false`, and successfully printed expiration logs.
  * **Test B (Expired Keypad Entry):** Sent `4820` to simulator stdin after expiration. Backend rejected validation, simulator denied access, and verification asserted a `FAILED_EXPIRED_PIN` log was written.
  * **Test C (Unauthorized Entry):** Sent random PIN `9999`. Validation failed, simulator denied access, and verification asserted a `FAILED_UNAUTHORIZED` log was written.
