package com.smartlock.audit.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

/**
 * JPA / Hibernate Entity mapping to the 'security_anomalies' PostgreSQL table.
 */
@Entity
@Table(name = "security_anomalies")
public class SecurityAnomaly {

    @Id
    @Column(name = "id", length = 36, nullable = false)
    private String id;

    @Column(name = "lock_id", length = 64, nullable = false)
    private String lockId;

    @Column(name = "anomaly_type", length = 64, nullable = false)
    private String anomalyType;

    @Column(name = "severity", length = 16, nullable = false)
    private String severity;

    @Column(name = "failed_attempts_count")
    private int failedAttemptsCount;

    @Column(name = "description", nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(name = "detected_at", insertable = false, updatable = false)
    private OffsetDateTime detectedAt;

    @Column(name = "resolved", nullable = false)
    private boolean resolved = false;

    public SecurityAnomaly() {
    }

    public SecurityAnomaly(String id, String lockId, String anomalyType, String severity, 
                           int failedAttemptsCount, String description) {
        this.id = id;
        this.lockId = lockId;
        this.anomalyType = anomalyType;
        this.severity = severity;
        this.failedAttemptsCount = failedAttemptsCount;
        this.description = description;
    }

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getLockId() {
        return lockId;
    }

    public void setLockId(String lockId) {
        this.lockId = lockId;
    }

    public String getAnomalyType() {
        return anomalyType;
    }

    public void setAnomalyType(String anomalyType) {
        this.anomalyType = anomalyType;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public int getFailedAttemptsCount() {
        return failedAttemptsCount;
    }

    public void setFailedAttemptsCount(int failedAttemptsCount) {
        this.failedAttemptsCount = failedAttemptsCount;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public OffsetDateTime getDetectedAt() {
        return detectedAt;
    }

    public boolean isResolved() {
        return resolved;
    }

    public void setResolved(boolean resolved) {
        this.resolved = resolved;
    }
}
