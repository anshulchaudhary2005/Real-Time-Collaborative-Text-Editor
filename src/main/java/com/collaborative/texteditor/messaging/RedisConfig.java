package com.collaborative.texteditor.messaging;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.listener.adapter.MessageListenerAdapter;
import org.springframework.data.redis.serializer.RedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.util.UUID;

@Slf4j
@Configuration
public class RedisConfig {

    public static final String TOPIC_NAME = "collab:document-ops";
    public static final String INSTANCE_ID = UUID.randomUUID().toString();

    @Bean
    public ChannelTopic documentTopic() {
        return new ChannelTopic(TOPIC_NAME);
    }

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(RedisSerializer.json());
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(RedisSerializer.json());
        template.afterPropertiesSet();
        return template;
    }

    @Bean
    @Primary
    public RedisMessageListenerContainer redisMessageListenerContainer(
            RedisConnectionFactory connectionFactory,
            MessageListenerAdapter listenerAdapter,
            ChannelTopic documentTopic) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.addMessageListener(listenerAdapter, documentTopic);
        container.setAutoStartup(false);
        container.setRecoveryInterval(5000L);
        return container;
    }

    @Bean
    public MessageListenerAdapter listenerAdapter(RedisSubscriber subscriber) {
        return new MessageListenerAdapter(subscriber, "onMessage");
    }

    
    @Bean
    public ApplicationRunner startRedisIfAvailable(
            @Qualifier("redisMessageListenerContainer") RedisMessageListenerContainer container,
            RedisConnectionFactory connectionFactory) {
        return args -> {
            Thread probeThread = new Thread(() -> {
                try {
                    var conn = connectionFactory.getConnection();
                    conn.close();
                    container.start();
                    log.info("Successfully connected to Redis Pub/Sub cluster. Multi-node synchronization active.");
                } catch (Exception ex) {
                    log.warn("Redis is not running at localhost:6379. Application running in standalone mode with local WebSocket messaging. (To enable Redis clustering, start Redis in Docker: docker run -d -p 6379:6379 redis:7-alpine)");
                }
            }, "redis-probe-worker");
            probeThread.setDaemon(true);
            probeThread.start();
        };
    }
}
