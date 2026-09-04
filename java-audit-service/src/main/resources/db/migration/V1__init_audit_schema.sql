-- Flyway Database Migration V1: Initial Audit & Security Anomaly Schema

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    event_id VARCHAR(64) UNIQUE NOT NULL,
    lock_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(32) NOT NULL,
    method VARCHAR(16) NOT NULL,
    user_id VARCHAR(64),
    pin_used VARCHAR(16),
    status VARCHAR(32) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS security_anomalies (
    id VARCHAR(36) PRIMARY KEY,
    lock_id VARCHAR(64) NOT NULL,
    anomaly_type VARCHAR(64) NOT NULL,
    severity VARCHAR(16) NOT NULL,
    failed_attempts_count INT DEFAULT 0,
    description TEXT NOT NULL,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN DEFAULT FALSE
);

-- Indexes for high-performance querying and analytics aggregation
CREATE INDEX IF NOT EXISTS idx_audit_logs_lock_id ON audit_logs(lock_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_anomalies_lock_id ON security_anomalies(lock_id);
