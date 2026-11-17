package com.collaborative.texteditor.messaging;

import com.collaborative.texteditor.document.OutboxEvent;
import com.collaborative.texteditor.repository.OutboxEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Service
@EnableScheduling
@RequiredArgsConstructor
public class OutboxRelayService {

    private final OutboxEventRepository outboxRepository;
    private final RedisTemplate<String, Object> redisTemplate;
    private final ChannelTopic documentTopic;
    private final AtomicBoolean redisWarned = new AtomicBoolean(false);

    @Scheduled(fixedDelay = 3000)
    @Transactional
    public void relayPendingEvents() {
        List<OutboxEvent> pending = outboxRepository.findPendingEvents();
        if (pending.isEmpty()) return;

        for (OutboxEvent event : pending) {
            try {
                redisTemplate.convertAndSend(documentTopic.getTopic(), event.getPayload());
                event.setPublishedAt(LocalDateTime.now());
                outboxRepository.save(event);
                log.info("Relayed outbox event {} for document {}", event.getId(), event.getAggregateId());
                redisWarned.set(false);
            } catch (Exception ex) {
                if (!redisWarned.getAndSet(true)) {
                    log.debug("Outbox relay paused: Redis offline. Events remain safely durable in PostgreSQL.");
                }
                break;
            }
        }
    }
}
