package com.smartlock.audit.dto;

import java.time.OffsetDateTime;

/**
 * Data Transfer Object (DTO) matching the JSON event payload sent by Node.js via Redis Pub/Sub.
 */
public class LockEventDto {

    private String eventId;
    private String lockId;
    private String eventType;
    private String method;
    private String userId;
    private String pinUsed;
    private String status;
    private String timestamp;
    private String details;

    public LockEventDto() {
    }

    // Getters and Setters
    public String getEventId() {
        return eventId;
    }

    public void setEventId(String eventId) {
        this.eventId = eventId;
    }

    public String getLockId() {
        return lockId;
    }

    public void setLockId(String lockId) {
        this.lockId = lockId;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
    }

    public String getMethod() {
        return method;
    }

    public void setMethod(String method) {
        this.method = method;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getPinUsed() {
        return pinUsed;
    }

    public void setPinUsed(String pinUsed) {
        this.pinUsed = pinUsed;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }
}
