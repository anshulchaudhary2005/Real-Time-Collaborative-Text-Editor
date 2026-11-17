# Real-Time Collaborative Document Editor

[![Java](https://img.shields.io/badge/Java-21-orange.svg)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.1.2-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v3.4-38bdf8.svg)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-dc382d.svg)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ed.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A distributed, high-concurrency real-time collaborative document editing platform. Multiple users can co-edit shared documents simultaneously with server-authoritative **Operational Transformation (OT)**, cross-instance synchronization via **Redis Pub/Sub**, durable ACID persistence with **PostgreSQL row-level locking**, role-based permissions (RBAC), and a responsive React frontend styled in a fresh **Mint & Teal** theme.

---

## Architecture Overview

```
 ┌──────────────────────┐         ┌──────────────────────┐
 │ Client A (Owner)     │         │ Client B (Editor)    │
 └──────────┬───────────┘         └──────────┬───────────┘
            │ STOMP / WebSocket              │ STOMP / WebSocket
            ▼                                ▼
 ┌─────────────────────────────────────────────────────────┐
 │                   Nginx Load Balancer                   │
 └────────────┬───────────────────────────────┬────────────┘
              │                               │
              ▼                               ▼
 ┌─────────────────────────┐     ┌─────────────────────────┐
 │ Spring Boot Instance 1  │     │ Spring Boot Instance 2  │
 │  • STOMP WebSocket      │     │  • STOMP WebSocket      │
 │  • OT Engine            │     │  • OT Engine            │
 │  • Transactional Outbox │     │  • Transactional Outbox │
 └────────────┬────────────┘     └────────────┬────────────┘
              │                               │
              ├───────────► Redis ◄───────────┤
              │       (Pub/Sub Cluster)       │
              ▼                               ▼
 ┌─────────────────────────────────────────────────────────┐
 │                   PostgreSQL Database                   │
 │   • documents (Pessimistic FOR UPDATE Locking)          │
 │   • document_operations (Append-Only Operation Log)     │
 │   • document_snapshots (Periodic Compaction)            │
 │   • document_members (Role-Based Permissions)           │
 │   • outbox_events (Guaranteed Relay)                    │
 └─────────────────────────────────────────────────────────┘
```

---

## Key Features

- **Server-Authoritative Operational Transformation (OT Engine):**
  - Text transformation handling concurrent insertions, deletions, and retentions.
  - Transformation Property 1 (TP1) & Property 2 (TP2) guarantees convergence across all connected clients.
  - Stale revision rebasing transforms older client edits against missing server revisions.

- **Strict Consistency & Concurrency Control:**
  - Row-level database locking (`SELECT ... FOR UPDATE` via JPA `PESSIMISTIC_WRITE`) guarantees strictly serialized execution per document.
  - Operation idempotency via unique constraints prevents duplicate execution on network retries.

- **Horizontal Scalability (Multi-Instance Clustering):**
  - Redis Pub/Sub channels broadcast sequenced operations across distributed backend nodes.
  - Transactional Outbox pattern ensures event delivery even if Redis experiences transient disconnects.

- **Fault Tolerance & Catch-Up Recovery:**
  - Automatic reconnection with exponential backoff on network dropouts.
  - Fast-forward revision catch-up endpoint (`/app/sync/{docId}` & `GET /api/documents/{id}/sync`) replays intervening operations to re-synchronize stale clients.

- **Granular Permissions & Role-Based Access Control (RBAC):**
  - **Owner:** Full editing access, document management, and member permission control.
  - **Editor:** Full write and real-time editing privileges.
  - **Viewer:** Read-only mode with live update streaming (typing locked).
  - **Blocked:** Blocked users are restricted from accessing or subscribing to the document.

- **Live Presence & Collaboration Awareness:**
  - Real-time active participant counter.
  - Active editor pills and typing presence notifications.

- **Observability & Metrics:**
  - Prometheus endpoints (`/actuator/prometheus`) tracking operations applied, transformed, rejected, and active WebSocket sessions.

- **Modern Responsive UI:**
  - Built with React 18, Vite, and Tailwind CSS.
  - Mint (`#e6f7f2`) background, crisp white document cards, slate typography, and teal accents.
  - WCAG 2.1 AA compliant with high-contrast accessibility.

---

## Tech Stack

| Component | Technology | Version | Description |
| :--- | :--- | :--- | :--- |
| **Backend** | Java | 21 / 25 | Modern LTS Java runtime |
| **Framework** | Spring Boot | 4.1.2 | WebSocket STOMP, Spring Data JPA, Actuator |
| **Frontend** | React | 18.x | Vite 5, Tailwind CSS 3.4, Lucide Icons |
| **Database** | PostgreSQL | 16 | Durable ACID operation log and document state |
| **Messaging** | Redis | 7.x | Cluster Pub/Sub for cross-instance sync |
| **Reverse Proxy** | Nginx | Alpine | Reverse proxy and WebSocket load balancer |
| **Containerization**| Docker & Docker Compose | - | Multi-service orchestration |
| **Testing** | JUnit 5, Mockito, k6 | - | Unit, concurrency, and load testing |

---

## Getting Started

### Prerequisites

- [Java 21+](https://adoptium.net/)
- [Node.js 18+](https://nodejs.org/) & npm
- [Docker & Docker Compose](https://www.docker.com/) (recommended)

---

### Option A: Run with Docker Compose (Recommended)

Start the entire distributed cluster (Nginx, 2 Spring Boot instances, PostgreSQL, Redis, and Prometheus) with one command:

```bash
docker compose up --build -d
```

- **Web Application:** `http://localhost`
- **Frontend Direct (Dev):** `http://localhost:5173`
- **Backend API:** `http://localhost:8080/api`
- **Prometheus Metrics:** `http://localhost:9090`
- **Actuator Health:** `http://localhost:8080/actuator/health`

To stop:
```bash
docker compose down
```

---

### Option B: Run Locally for Development

#### 1. Start Dependencies (PostgreSQL & Redis)
```bash
docker run -d --name collab-postgres -e POSTGRES_DB=collab_editor -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password -p 5432:5432 postgres:16-alpine
docker run -d --name collab-redis -p 6379:6379 redis:7-alpine
```

#### 2. Run the Backend
```bash
# Windows
.\mvnw.cmd spring-boot:run

# Linux / macOS
./mvnw spring-boot:run
```
The backend starts on `http://localhost:8080`.

#### 3. Run the Frontend
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
Open your browser at `http://localhost:5173`.

---

## API & WebSocket Reference

### REST Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate user and receive JWT token |
| `POST` | `/api/auth/register` | Register a new user |
| `GET` | `/api/auth/users` | List all users (for document sharing) |
| `GET` | `/api/documents` | Retrieve all accessible documents |
| `POST` | `/api/documents?title={title}&ownerId={id}` | Create a new document |
| `GET` | `/api/documents/{id}` | Get document content and metadata |
| `DELETE` | `/api/documents/{id}` | Delete a document |
| `GET` | `/api/documents/{id}/members` | List members and their permissions |
| `POST` | `/api/documents/{id}/members?ownerId={id}` | Assign member role (`EDITOR`, `VIEWER`, `BLOCKED`) |
| `DELETE` | `/api/documents/{id}/members/{userId}?ownerId={id}` | Remove member access |
| `GET` | `/api/documents/{id}/sync?clientRevision={rev}` | Fetch missing operations for catch-up |

### WebSocket STOMP Destinations

| Type | Destination | Payload | Description |
| :--- | :--- | :--- | :--- |
| **Send** | `/app/edit/{documentId}` | `OperationMessage` | Submit client text operation |
| **Send** | `/app/presence/{documentId}`| `PresenceMessage` | Send cursor / heartbeat presence |
| **Send** | `/app/sync/{documentId}` | `CatchupRequest` | Request missing operations |
| **Subscribe** | `/topic/documents/{documentId}`| `DocumentBroadcastMessage`| Receive broadcasted operations |
| **Subscribe** | `/topic/presence/{documentId}` | `PresenceMessage` | Receive active collaborator updates |
| **User Queue** | `/user/queue/ack` | `AckMessage` | Authoritative revision ACK |

---

## Testing & Verification

The project includes unit, property-based, concurrency, and stress test suites:

### 1. Backend Automated Tests (JUnit 5 & H2 Isolated Database)
```bash
# Windows
.\mvnw.cmd test

# Linux / macOS
./mvnw test
```
- **`OTEngineTest`**: Validates retention, insertion, deletion, and runs **100 randomized property-based trials** testing convergence under arbitrary interleavings.
- **`CollaborationConcurrencyTest`**: Validates pessimistic locking and idempotency under parallel thread execution.
- **`RBACSecurityTest`**: Validates role enforcement for owners, editors, and read-only viewers.

### 2. Multi-Client WebSocket Stress Benchmark
Tests 10 concurrent simulated clients sending simultaneous edits to a single document:
```bash
node tests/stress-test.js
```

### 3. Load Testing with k6
```bash
k6 run tests/k6-load-test.js
```

For detailed testing instructions, see [TESTING_GUIDE.md](TESTING_GUIDE.md).

---

## Documentation

- **[SYSTEM_DESIGN.md](SYSTEM_DESIGN.md)**: In-depth technical architecture, ER diagrams, sequence flows, architectural decision records (ADRs), and interview Q&A.
- **[TESTING_GUIDE.md](TESTING_GUIDE.md)**: Testing strategies, verification checklists, and load-testing execution scripts.

---

## License

This project is licensed under the [MIT License](LICENSE).
