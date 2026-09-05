package com.smartlock.audit.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartlock.audit.dto.LockEventDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Redis Pub/Sub Message Listener.
 * Receives raw JSON payload string from Redis channel 'lock.events' published by Node.js IoT gateway.
 */
@Service
public class RedisEventSubscriber {

    private static final Logger log = LoggerFactory.getLogger(RedisEventSubscriber.class);

    private final ObjectMapper objectMapper;
    private final AuditService auditService;

    public RedisEventSubscriber(ObjectMapper objectMapper, AuditService auditService) {
        this.objectMapper = objectMapper;
        this.auditService = auditService;
    }

    /**
     * Method invoked by Spring MessageListenerAdapter when a message arrives on Redis channel.
     */
    public void receiveMessage(String message) {
        log.info("📥 Redis PubSub Received on channel [lock.events]: {}", message);
        try {
            LockEventDto dto = objectMapper.readValue(message, LockEventDto.class);
            auditService.processAndSaveEvent(dto);
        } catch (Exception e) {
            log.error("❌ Failed to parse Redis PubSub message JSON: {}", message, e);
        }
    }
}
