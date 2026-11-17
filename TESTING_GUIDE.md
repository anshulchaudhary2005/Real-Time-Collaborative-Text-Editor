# Comprehensive Verification & Testing Guide

This guide gives you the exact methods and instructions to test **every single aspect** of the Real-Time Collaborative Document Editor:
- **Unit & Algorithmic Correctness** (OT Engine, tie-breaking, property tests)
- **Database Concurrency & Idempotency** (Row-level locks, deduplication)
- **RBAC Security** (Owner, Editor, Viewer access controls)
- **Cross-Instance Distributed Delivery** (Multi-node Spring Boot + Redis Pub/Sub)
- **Fault Tolerance & Connection Recovery** (Offline edits, reconnection catch-up)
- **Transactional Outbox Self-Healing** (Resilience during Redis outage)
- **Observability & Prometheus Metrics** (Actuator, latencies, active sessions)
- **High-Concurrency Stress Testing** (Automated multi-client simulation)

---

## 1. Test Operational Transformation Engine (Phase 3)

The OT Engine implements TP1 (Transformation Property 1), Retain/Insert/Delete composition, and deterministic tie-breaking.

Run the unit test suite and randomized property-based tests:
```powershell
.\mvnw.cmd test -Dtest=OTEngineTest
```

### What This Verifies:
1. `testBasicApply`: Verifies Retain, Insert, and Delete string manipulations.
2. `testSimultaneousInsertions`: Verifies deterministic tie-breaking when two clients insert text at the exact same cursor offset.
3. `testOverlappingDeletions`: Verifies that overlapping deletes do not double-delete characters.
4. `testInsertDeleteInteraction`: Verifies inserts inside deleted ranges converge.
5. `testSeparateRegionEdits`: Verifies independent edits in different parts of the document.
6. `testThreeWayConcurrency`: Verifies convergence across 3 concurrent clients ($O_A, O_B, O_C$).
7. `testOperationComposition`: Verifies that `apply(S, compose(op1, op2)) == apply(apply(S, op1), op2)`.
8. `testRandomizedConvergence`: Executes **100 randomized property-based concurrent edit trials** on randomized base strings to prove mathematical convergence.

---

## 2. Test Concurrency, Idempotency & Database Locks (Phase 4)

Test row-level locks, duplicate submission idempotency, and revision sequence advancing in PostgreSQL:
```powershell
.\mvnw.cmd test -Dtest=CollaborationConcurrencyTest
```

### What This Verifies:
1. `testIdempotency`: Submits the exact same `opId` twice. Verifies the database does not re-apply the edit and returns the original committed revision.
2. `testCatchupRecovery`: Sequences multiple operations, simulates a stale client with revision 0, and asserts that all missing operations are correctly retrieved from the append-only log.

---

## 3. Test Security & RBAC Permissions (Phase 7)

Verify that Owner and Editor can submit edits, while Viewers are strictly blocked by the server:
```powershell
.\mvnw.cmd test -Dtest=RBACSecurityTest
```

### What This Verifies:
1. `testOwnerCanEdit`: Document creator successfully commits operations.
2. `testEditorCanEdit`: User with assigned `EDITOR` role successfully commits operations.
3. `testViewerCannotEdit`: User with assigned `VIEWER` role is rejected with `SecurityException` (`403 FORBIDDEN`).

---

## 4. Test Cross-Instance Redis Pub/Sub & Multi-Backend Cluster (Phase 5)

Test two separate Spring Boot instances coordinating edits in real time via Redis Pub/Sub.

### Step 1: Start the Entire Distributed Stack via Docker Compose
```powershell
docker-compose up -d --build
```

Verify all 5 services are running:
```powershell
docker-compose ps
```
You should see:
- `collab_postgres` (Port 5432)
- `collab_redis` (Port 6379)
- `collab_backend_1` (Port 8080)
- `collab_backend_2` (Port 8081)
- `collab_nginx` (Port 80 - Load Balancer)

### Step 2: Open Two Browser Tabs Connected to Different Backend Nodes
1. Open **Browser Tab 1**: Go to `http://localhost:5173` (or direct backend 1 via proxy).
   - Sign in as **Nishant (Owner, User 1)**.
   - Open a document.
2. Open **Browser Tab 2** in an Incognito window:
   - Sign in as **Alice (Editor, User 2)**.
   - Open the same document URL.
3. Open the **OT Inspector** drawer in both tabs (button in top-right navbar).
4. Start typing in Tab 1:
   - Notice Tab 1 logs `SEND_OP` with component details.
   - Instance 1 commits to PostgreSQL and publishes to Redis.
   - Instance 2 receives the Redis notification and pushes it to Tab 2.
   - Notice Tab 2 instantly displays `BROADCAST_RECEIVED`, updates text, and advances its authoritative revision badge in real time!

---

## 5. Test Fault Tolerance & Reconnection Catch-up (Phase 6)

Test that no edits are lost during network disconnects or client tab crashes.

### Testing Procedure:
1. Open the collaborative editor in your browser.
2. Type some text (e.g. `Distributed System Design`).
3. Click the STOMP connection pill or turn off your network connection (or disconnect in DevTools -> Network -> Offline).
   - The status pill turns amber: `Connecting... / Reconnecting`.
4. While offline, open Tab 2 and make several edits (e.g. append ` — Tested with Redis`).
   - The server advances to Revision #10.
5. Re-enable network in Tab 1 (or click **Reconnect** in the status pill).
   - Tab 1 automatically dispatches a catch-up request: `/app/sync/{documentId}` with its last known revision.
   - The server delivers all intervening operations.
   - Tab 1 fast-forwards its state and displays `Rev #10` with identical content!

---

## 6. Test Redis Outage & Transactional Outbox Self-Healing (Phase 5 & 6)

Test that the system remains durable and self-heals even if Redis crashes while edits are being made.

### Testing Procedure:
1. Stop Redis:
   ```powershell
   docker stop collab_redis
   ```
2. Submit an edit in the browser editor.
   - The backend successfully commits the edit to PostgreSQL and advances the revision.
   - The edit is safely stored in `outbox_events` with `published_at = NULL`.
3. Restart Redis:
   ```powershell
   docker start collab_redis
   ```
4. Within 2 seconds, the `OutboxRelayService` automatically detects the pending outbox events, publishes them to Redis, and marks them published.
5. All other nodes and clients receive the pending updates. Zero data loss!

---

## 7. Test Observability & Prometheus Metrics (Phase 7)

The application exposes real-time distributed systems telemetry.

### Check Health:
```powershell
curl http://localhost:8080/actuator/health
```
Response:
```json
{"status":"UP","components":{"db":{"status":"UP"},"redis":{"status":"UP"}}}
```

### Check Live Collaboration Metrics:
```powershell
curl http://localhost:8080/actuator/prometheus | findstr collab_
```
Sample Prometheus metrics displayed:
- `collab_operations_received_total`: Total operations received
- `collab_operations_committed_total`: Total operations committed
- `collab_operations_transformed_total`: Operations rebased via OT
- `collab_operations_latency_seconds`: Percentiles for row-lock + OT transform + commit
- `collab_websocket_active_sessions`: Live connected WebSocket users
- `collab_reconnect_gap_detected_total`: Revision gaps caught up

---

## 8. Run Automated High-Concurrency Stress Test (Phase 8)

Simulate 10, 50, or 100 concurrent clients concurrently editing the exact same document over STOMP WebSocket.

### Run the Benchmark:
```powershell
# In project root:
node tests/stress-test.js
```

To run with 50 concurrent clients:
```powershell
$env:CLIENTS="50"; $env:EDITS="10"; node tests/stress-test.js
```

### Output Produced:
- Establishes 50 concurrent STOMP WebSocket connections.
- Dispatches 500 simultaneous OT operations.
- Collects and records individual operation ACK latencies.
- Queries PostgreSQL to verify 100% convergence.
- Displays throughput (ops/sec), p50, p95, and p99 latency percentiles!

---

## 9. Run k6 Load Test

If you have `k6` installed:
```powershell
k6 run tests/k6-load-test.js
```
Validates that 95% of HTTP/REST operations respond within 200ms under load with an error rate < 1%.

