package com.collaborative.texteditor.observability;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicInteger;

@Component
public class CollaborationMetrics {

    private final Counter operationsReceived;
    private final Counter operationsCommitted;
    private final Counter operationsTransformed;
    private final Counter operationsRejected;
    private final Counter revisionGapsDetected;
    private final Timer operationProcessingTimer;
    private final Timer redisBroadcastTimer;
    private final AtomicInteger activeWebSocketSessions = new AtomicInteger(0);

    public CollaborationMetrics(MeterRegistry registry) {
        this.operationsReceived = Counter.builder("collab.operations.received")
                .description("Total number of operations received from clients")
                .register(registry);

        this.operationsCommitted = Counter.builder("collab.operations.committed")
                .description("Total number of operations successfully sequenced and committed")
                .register(registry);

        this.operationsTransformed = Counter.builder("collab.operations.transformed")
                .description("Total number of stale operations transformed against concurrent edits")
                .register(registry);

        this.operationsRejected = Counter.builder("collab.operations.rejected")
                .description("Total number of operations rejected due to permission or validation failure")
                .register(registry);

        this.revisionGapsDetected = Counter.builder("collab.reconnect.gap_detected")
                .description("Total number of revision gaps detected requiring catch-up")
                .register(registry);

        this.operationProcessingTimer = Timer.builder("collab.operations.latency")
                .description("Time taken to lock, transform, apply, and commit an operation to PostgreSQL")
                .publishPercentiles(0.5, 0.95, 0.99)
                .register(registry);

        this.redisBroadcastTimer = Timer.builder("collab.redis.pubsub.latency")
                .description("Time taken to publish committed operation to Redis Pub/Sub")
                .register(registry);

        registry.gauge("collab.websocket.active_sessions", activeWebSocketSessions);
    }

    public void incrementReceived() { operationsReceived.increment(); }
    public void incrementCommitted() { operationsCommitted.increment(); }
    public void incrementTransformed() { operationsTransformed.increment(); }
    public void incrementRejected() { operationsRejected.increment(); }
    public void incrementRevisionGap() { revisionGapsDetected.increment(); }

    public Timer getOperationProcessingTimer() { return operationProcessingTimer; }
    public Timer getRedisBroadcastTimer() { return redisBroadcastTimer; }

    public void sessionConnected() { activeWebSocketSessions.incrementAndGet(); }
    public void sessionDisconnected() { activeWebSocketSessions.decrementAndGet(); }
    public int getActiveSessions() { return activeWebSocketSessions.get(); }
}

