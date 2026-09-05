package com.smartlock.audit.service;

import com.smartlock.audit.dto.LockEventDto;
import com.smartlock.audit.entity.AuditLog;
import com.smartlock.audit.repository.AuditLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.UUID;

/**
 * Service orchestrating audit log persistence and anomaly evaluation.
 */
@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);

    private final AuditLogRepository auditLogRepository;
    private final AnomalyDetectionService anomalyDetectionService;

    public AuditService(AuditLogRepository auditLogRepository, 
                        AnomalyDetectionService anomalyDetectionService) {
        this.auditLogRepository = auditLogRepository;
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
}
