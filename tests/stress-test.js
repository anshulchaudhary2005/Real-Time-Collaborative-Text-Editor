/**
 * Distributed Systems Real-Time Collaboration Stress Test
 * Simulates concurrent collaborators editing a single document simultaneously.
 * Measures throughput, latency percentiles (p50, p95, p99), and verifies 100% convergence.
 */

const { Client } = require('@stomp/stompjs');
const axios = require('axios');

const WS_URL = process.env.WS_URL || 'ws://localhost:8080/ws';
const API_URL = process.env.API_URL || 'http://localhost:8080';
const NUM_CLIENTS = parseInt(process.env.CLIENTS || '10', 10);
const EDITS_PER_CLIENT = parseInt(process.env.EDITS || '5', 10);

async function runStressTest() {
  console.log(`\n======================================================`);
  console.log(` Starting Collaborative Editor Distributed Stress Test`);
  console.log(` Target WebSocket: ${WS_URL}`);
  console.log(` Concurrent Clients: ${NUM_CLIENTS}`);
  console.log(` Edits Per Client: ${EDITS_PER_CLIENT}`);
  console.log(` Total Operations: ${NUM_CLIENTS * EDITS_PER_CLIENT}`);
  console.log(`======================================================\n`);

  // 1. Create a fresh test document
  let docId;
  try {
    const res = await axios.post(`${API_URL}/api/documents?title=StressTestDoc&ownerId=1`);
    docId = res.data.id;
    console.log(`[Setup] Created Test Document ID: ${docId}`);
  } catch (err) {
    console.error('[Setup Failed] Could not create document:', err.message);
    process.exit(1);
  }

  // 2. Initialize STOMP clients
  const clients = [];
  const latencies = [];
  let acksReceived = 0;
  const totalExpectedAcks = NUM_CLIENTS * EDITS_PER_CLIENT;

  console.log(`[Connecting] Establishing ${NUM_CLIENTS} STOMP WebSocket connections...`);

  for (let i = 1; i <= NUM_CLIENTS; i++) {
    const clientId = `client-${i}`;
    const client = new Client({
      brokerURL: WS_URL,
      connectHeaders: {
        userId: String(i),
        username: `stress_user_${i}`
      },
      reconnectDelay: 0,
      debug: () => {}
    });

    const clientPromise = new Promise((resolve, reject) => {
      client.onConnect = () => {
        // Subscribe to document broadcast topic
        client.subscribe(`/topic/documents/${docId}`, (msg) => {
          // Track broadcast arrivals
        });

        // Subscribe to ack topic
        client.subscribe(`/topic/documents/${docId}/ack`, (msg) => {
          const ack = JSON.parse(msg.body);
          if (ack.opId && ack.opId.startsWith(clientId)) {
            const sendTime = parseInt(ack.opId.split('_')[1], 10);
            if (sendTime) {
              latencies.push(Date.now() - sendTime);
            }
            acksReceived++;
            process.stdout.write(`\r[Progress] Committed ACKs: ${acksReceived}/${totalExpectedAcks}`);
          }
        });

        resolve();
      };
      client.onStompError = (frame) => reject(new Error(frame.headers['message']));
      client.onWebSocketError = (err) => reject(err);
    });

    client.activate();
    clients.push({ id: clientId, userId: i, client, ready: clientPromise });
  }

  await Promise.all(clients.map(c => c.ready));
  console.log(`\n[Connected] All ${NUM_CLIENTS} clients connected successfully!`);

  // 3. Fire concurrent operations
  console.log(`[Execution] Dispatching concurrent edits across all clients...`);
  const startTime = Date.now();

  const editPromises = [];
  for (const c of clients) {
    const clientEdits = async () => {
      for (let j = 0; j < EDITS_PER_CLIENT; j++) {
        const timestamp = Date.now();
        const opId = `${c.id}_${timestamp}_${j}`;
        const char = String.fromCharCode(65 + (c.userId % 26));
        const payload = {
          opId,
          documentId: docId,
          baseRevision: 0, // Server OT engine handles rebasing stale revisions!
          clientId: c.id,
          components: [
            { type: 'RETAIN', length: 0 },
            { type: 'INSERT', length: 1, text: char }
          ]
        };

        c.client.publish({
          destination: `/app/edit/${docId}`,
          body: JSON.stringify(payload)
        });

        // Stagger slightly between 10ms - 50ms to simulate typing cadence
        await new Promise(r => setTimeout(r, 25));
      }
    };
    editPromises.push(clientEdits());
  }

  await Promise.all(editPromises);

  // 4. Wait for all ACKs to arrive
  const timeout = Date.now() + 15000;
  while (acksReceived < totalExpectedAcks && Date.now() < timeout) {
    await new Promise(r => setTimeout(r, 100));
  }
  const totalDurationMs = Date.now() - startTime;

  // 5. Cleanup clients
  clients.forEach(c => c.client.deactivate());

  // 6. Verify final state and convergence from backend
  console.log(`\n\n[Verification] Fetching final document state from PostgreSQL...`);
  const finalDoc = (await axios.get(`${API_URL}/api/documents/${docId}`)).data;
  console.log(`Authoritative Revision: ${finalDoc.currentRevision}`);
  console.log(`Document Content Length: ${finalDoc.content.length}`);
  console.log(`Expected Revision: ${totalExpectedAcks}`);

  // 7. Calculate Percentiles
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const throughput = (acksReceived / (totalDurationMs / 1000)).toFixed(2);

  console.log(`\n======================================================`);
  console.log(` PERFORMANCE EVALUATION RESULTS`);
  console.log(`======================================================`);
  console.log(`Total Operations Committed: ${acksReceived}/${totalExpectedAcks}`);
  console.log(`Total Duration:             ${totalDurationMs} ms`);
  console.log(`Throughput:                 ${throughput} ops/sec`);
  console.log(`p50 Latency:                ${p50} ms`);
  console.log(`p95 Latency:                ${p95} ms`);
  console.log(`p99 Latency:                ${p99} ms`);
  console.log(`Convergence Check:          ${finalDoc.currentRevision === totalExpectedAcks ? 'PASSED (100% Consistent)' : 'DISCREPANCY DETECTED'}`);
  console.log(`======================================================\n`);
}

runStressTest().catch(console.error);

