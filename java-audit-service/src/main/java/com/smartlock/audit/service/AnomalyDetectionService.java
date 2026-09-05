package com.smartlock.audit.service;

import com.smartlock.audit.entity.AuditLog;
import com.smartlock.audit.entity.SecurityAnomaly;
import com.smartlock.audit.repository.AuditLogRepository;
import com.smartlock.audit.repository.SecurityAnomalyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Anomaly Detection Rules Engine.
 * Evaluates real-time audit logs to detect security threats like brute-force PIN attacks or lost device connections.
 */
@Service
public class AnomalyDetectionService {

    private static final Logger log = LoggerFactory.getLogger(AnomalyDetectionService.class);

    private static final int FAILED_ATTEMPTS_THRESHOLD = 3;
    private static final long TIME_WINDOW_SECONDS = 60;

    private final AuditLogRepository auditLogRepository;
    private final SecurityAnomalyRepository securityAnomalyRepository;

    public AnomalyDetectionService(AuditLogRepository auditLogRepository, 
                                   SecurityAnomalyRepository securityAnomalyRepository) {
        this.auditLogRepository = auditLogRepository;
        this.securityAnomalyRepository = securityAnomalyRepository;
    }

    /**
     * Evaluates an incoming AuditLog for security anomalies.
     */
    public void evaluateAuditLog(AuditLog auditLog) {
        // Rule 1: Brute-Force PIN Attack Detection (>3 failed attempts in 60s)
        if ("FAILED_UNAUTHORIZED".equals(auditLog.getStatus()) || "FAILED_EXPIRED_PIN".equals(auditLog.getStatus())) {
            checkBruteForceAttack(auditLog.getLockId());
        }

        // Rule 2: Device Offline Anomaly
        if ("OFFLINE_DETECTED".equals(auditLog.getEventType())) {
            flagDeviceOfflineAnomaly(auditLog.getLockId(), auditLog.getDetails());
        }
    }

    private void checkBruteForceAttack(String lockId) {
        OffsetDateTime windowStart = OffsetDateTime.now().minusSeconds(TIME_WINDOW_SECONDS);
        long recentFailuresCount = auditLogRepository.countRecentFailedAttempts(lockId, windowStart);

        log.info("🔍 Anomaly Check for lock [{}]: {} failed attempts in last {}s", 
                lockId, recentFailuresCount, TIME_WINDOW_SECONDS);

        if (recentFailuresCount >= FAILED_ATTEMPTS_THRESHOLD) {
            String anomalyId = UUID.randomUUID().toString();
            String description = String.format(
                    "Brute-Force Alert: Detected %d failed PIN entries on lock '%s' within %d seconds.",
                    recentFailuresCount, lockId, TIME_WINDOW_SECONDS
            );

            SecurityAnomaly anomaly = new SecurityAnomaly(
                    anomalyId,
                    lockId,
                    "BRUTE_FORCE_PIN_ATTEMPT",
                    "HIGH",
                    (int) recentFailuresCount,
                    description
            );

            securityAnomalyRepository.save(anomaly);
            log.warn("🚨 SECURITY ANOMALY TRIGGERED: {}", description);
        }
    }

    private void flagDeviceOfflineAnomaly(String lockId, String details) {
        String anomalyId = UUID.randomUUID().toString();
        String description = String.format("Communication Lost: Lock '%s' missed heartbeats (%s).", lockId, details);

        SecurityAnomaly anomaly = new SecurityAnomaly(
                anomalyId,
                lockId,
                "LOCK_COMMUNICATION_LOST",
                "MEDIUM",
                0,
                description
        );

        securityAnomalyRepository.save(anomaly);
        log.warn("⚠️ DEVICE ANOMALY TRIGGERED: {}", description);
    }
}
