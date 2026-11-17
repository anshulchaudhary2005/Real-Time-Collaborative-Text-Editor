package com.collaborative.texteditor.messaging;

import com.collaborative.texteditor.observability.CollaborationMetrics;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class RedisPublisher {

    private final RedisTemplate<String, Object> redisTemplate;
    private final ChannelTopic documentTopic;
    private final SimpMessagingTemplate localMessagingTemplate;
    private final CollaborationMetrics metrics;
    private final ObjectMapper objectMapper;

 
    public void publish(DocumentBroadcastMessage message) {
        message.setInstanceId(RedisConfig.INSTANCE_ID);
        String destination = "/topic/documents/" + message.getDocumentId();

        localMessagingTemplate.convertAndSend(destination, message);

        metrics.getRedisBroadcastTimer().record(() -> {
            try {
                String json = objectMapper.writeValueAsString(message);
                redisTemplate.convertAndSend(documentTopic.getTopic(), json);
                log.debug("Published operation rev {} for doc {} to Redis", message.getRevision(), message.getDocumentId());
            } catch (Exception ex) {
                log.warn("Failed to publish to Redis Pub/Sub (will rely on Transactional Outbox): {}", ex.getMessage());
            }
        });
    }
}

