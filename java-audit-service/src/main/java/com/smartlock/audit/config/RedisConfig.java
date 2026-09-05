package com.smartlock.audit.config;

import com.smartlock.audit.service.RedisEventSubscriber;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.listener.adapter.MessageListenerAdapter;

/**
 * Spring Configuration for Redis Pub/Sub listener container.
 */
@Configuration
public class RedisConfig {

    public static final String LOCK_EVENTS_CHANNEL = "lock.events";

    @Bean
    public ChannelTopic topic() {
        return new ChannelTopic(LOCK_EVENTS_CHANNEL);
    }

    @Bean
    public MessageListenerAdapter messageListenerAdapter(RedisEventSubscriber subscriber) {
        // Points directly to the receiveMessage method on RedisEventSubscriber
        return new MessageListenerAdapter(subscriber, "receiveMessage");
    }

    @Bean
    public RedisMessageListenerContainer redisMessageListenerContainer(
            RedisConnectionFactory connectionFactory,
            MessageListenerAdapter listenerAdapter,
            ChannelTopic topic) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        container.addMessageListener(listenerAdapter, topic);
        return container;
    }
}
