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
