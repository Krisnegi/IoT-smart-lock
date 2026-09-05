package com.smartlock.audit.service;

import com.smartlock.audit.dto.AuditStatsDto;
import com.smartlock.audit.dto.LockEventDto;
import com.smartlock.audit.entity.AuditLog;
import com.smartlock.audit.entity.SecurityAnomaly;
import com.smartlock.audit.repository.AuditLogRepository;
import com.smartlock.audit.repository.SecurityAnomalyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.UUID;

/**
 * Service orchestrating audit log persistence, queries, and anomaly evaluation.
 */
@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);

    private final AuditLogRepository auditLogRepository;
    private final SecurityAnomalyRepository securityAnomalyRepository;
    private final AnomalyDetectionService anomalyDetectionService;

    public AuditService(AuditLogRepository auditLogRepository, 
                        SecurityAnomalyRepository securityAnomalyRepository,
                        AnomalyDetectionService anomalyDetectionService) {
        this.auditLogRepository = auditLogRepository;
        this.securityAnomalyRepository = securityAnomalyRepository;
        this.anomalyDetectionService = anomalyDetectionService;
    }

    /**
     * Processes an incoming event DTO, converts it into a JPA Entity,
     * persists it in PostgreSQL, and passes it to the Anomaly Detection Engine.
     */
    @Transactional
    public AuditLog processAndSaveEvent(LockEventDto dto) {
        // Idempotency Check: Don't process duplicate events
        if (dto.getEventId() != null && auditLogRepository.findByEventId(dto.getEventId()).isPresent()) {
            log.info("⏩ Skipping duplicate eventId [{}]", dto.getEventId());
            return auditLogRepository.findByEventId(dto.getEventId()).get();
        }

        OffsetDateTime timestamp;
        try {
            timestamp = dto.getTimestamp() != null 
                    ? OffsetDateTime.parse(dto.getTimestamp()) 
                    : OffsetDateTime.now();
        } catch (DateTimeParseException e) {
            log.warn("⚠️ Invalid timestamp format [{}], defaulting to now()", dto.getTimestamp());
            timestamp = OffsetDateTime.now();
        }

        String entityId = UUID.randomUUID().toString();
        String eventId = dto.getEventId() != null ? dto.getEventId() : "evt_" + System.currentTimeMillis();

        AuditLog auditLog = new AuditLog(
                entityId,
                eventId,
                dto.getLockId(),
                dto.getEventType(),
                dto.getMethod(),
                dto.getUserId(),
                dto.getPinUsed(),
                dto.getStatus(),
                timestamp,
                dto.getDetails()
        );

        AuditLog savedLog = auditLogRepository.save(auditLog);
        log.info("💾 Saved AuditLog [{}] for lock [{}] with status [{}]", 
                savedLog.getEventId(), savedLog.getLockId(), savedLog.getStatus());

        // Evaluate event against Anomaly Detection Rules
        anomalyDetectionService.evaluateAuditLog(savedLog);

        return savedLog;
    }

    @Transactional(readOnly = true)
    public Page<AuditLog> getAuditLogs(String lockId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        if (lockId != null && !lockId.trim().isEmpty()) {
            return auditLogRepository.findByLockIdOrderByTimestampDesc(lockId.trim().toLowerCase(), pageable);
        }
        return auditLogRepository.findAllByOrderByTimestampDesc(pageable);
    }

    @Transactional(readOnly = true)
    public List<SecurityAnomaly> getAnomalies(String lockId, Boolean unresolvedOnly) {
        if (lockId != null && !lockId.trim().isEmpty()) {
            return securityAnomalyRepository.findByLockIdOrderByDetectedAtDesc(lockId.trim().toLowerCase());
        }
        if (Boolean.TRUE.equals(unresolvedOnly)) {
            return securityAnomalyRepository.findByResolvedFalseOrderByDetectedAtDesc();
        }
        return securityAnomalyRepository.findAll();
    }

    @Transactional(readOnly = true)
    public AuditStatsDto getAuditStats() {
        long totalLogs = auditLogRepository.count();
        long totalSuccess = auditLogRepository.countByStatus("SUCCESS");
        long totalFailed = auditLogRepository.countByStatus("FAILED_UNAUTHORIZED") 
                + auditLogRepository.countByStatus("FAILED_EXPIRED_PIN");
        long unresolvedAnomalies = securityAnomalyRepository.countByResolvedFalse();

        return new AuditStatsDto(totalLogs, totalSuccess, totalFailed, unresolvedAnomalies);
    }
}
