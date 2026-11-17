package com.collaborative.texteditor.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

@Slf4j
@Service
@RequiredArgsConstructor
public class RedisSubscriber implements MessageListener {

    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            String body = new String(message.getBody(), StandardCharsets.UTF_8);
         
            if (body.startsWith("\"") && body.endsWith("\"")) {
                body = objectMapper.readValue(body, String.class);
            }

            DocumentBroadcastMessage broadcast = objectMapper.readValue(body, DocumentBroadcastMessage.class);

            if (RedisConfig.INSTANCE_ID.equals(broadcast.getInstanceId())) {
                return;
            }

            log.debug("Received remote broadcast rev {} for doc {} from instance {}",
                    broadcast.getRevision(), broadcast.getDocumentId(), broadcast.getInstanceId());

            messagingTemplate.convertAndSend("/topic/documents/" + broadcast.getDocumentId(), broadcast);
        } catch (Exception ex) {
            log.error("Failed to process message from Redis topic: {}", ex.getMessage());
        }
    }
}

