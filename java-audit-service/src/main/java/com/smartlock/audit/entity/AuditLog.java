package com.smartlock.audit.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

/**
 * JPA / Hibernate Entity mapping to the 'audit_logs' PostgreSQL table.
 */
@Entity
@Table(name = "audit_logs")
public class AuditLog {

    @Id
    @Column(name = "id", length = 36, nullable = false)
    private String id;

    @Column(name = "event_id", length = 64, unique = true, nullable = false)
    private String eventId;

    @Column(name = "lock_id", length = 64, nullable = false)
    private String lockId;

    @Column(name = "event_type", length = 32, nullable = false)
    private String eventType;

    @Column(name = "method", length = 16, nullable = false)
    private String method;

    @Column(name = "user_id", length = 64)
    private String userId;

    @Column(name = "pin_used", length = 16)
    private String pinUsed;

    @Column(name = "status", length = 32, nullable = false)
    private String status;

    @Column(name = "timestamp", nullable = false)
    private OffsetDateTime timestamp;

    @Column(name = "details", columnDefinition = "TEXT")
    private String details;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    // Default No-Args Constructor (Required by Hibernate JPA Spec)
    public AuditLog() {
    }

    public AuditLog(String id, String eventId, String lockId, String eventType, String method, 
                    String userId, String pinUsed, String status, OffsetDateTime timestamp, String details) {
        this.id = id;
        this.eventId = eventId;
        this.lockId = lockId;
        this.eventType = eventType;
        this.method = method;
        this.userId = userId;
        this.pinUsed = pinUsed;
        this.status = status;
        this.timestamp = timestamp;
        this.details = details;
    }

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

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

    public OffsetDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(OffsetDateTime timestamp) {
        this.timestamp = timestamp;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
