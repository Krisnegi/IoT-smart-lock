package com.smartlock.audit.service;

import com.smartlock.audit.entity.AuditLog;
import com.smartlock.audit.entity.SecurityAnomaly;
import com.smartlock.audit.repository.AuditLogRepository;
import com.smartlock.audit.repository.SecurityAnomalyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * JUnit 5 + Mockito Unit Tests for AnomalyDetectionService.
 */
@ExtendWith(MockitoExtension.class)
class AnomalyDetectionServiceTest {

    @Mock
    private AuditLogRepository auditLogRepository;

    @Mock
    private SecurityAnomalyRepository securityAnomalyRepository;

    private AnomalyDetectionService anomalyDetectionService;

    @BeforeEach
    void setUp() {
        anomalyDetectionService = new AnomalyDetectionService(auditLogRepository, securityAnomalyRepository);
    }

    @Test
    @DisplayName("Should trigger HIGH severity Brute-Force anomaly when failed attempts >= 3")
    void shouldTriggerBruteForceAnomalyWhenThresholdExceeded() {
        // Given
        String lockId = "front-gate-01";
        AuditLog auditLog = new AuditLog(
                "log-1", "evt-1", lockId, "PIN_FAILED", "PIN",
                "user-1", "123456", "FAILED_UNAUTHORIZED",
                OffsetDateTime.now(), "Failed PIN attempt"
        );

        when(auditLogRepository.countRecentFailedAttempts(eq(lockId), any(OffsetDateTime.class)))
                .thenReturn(3L);

        // When
        anomalyDetectionService.evaluateAuditLog(auditLog);

        // Then
        ArgumentCaptor<SecurityAnomaly> captor = ArgumentCaptor.forClass(SecurityAnomaly.class);
        verify(securityAnomalyRepository, times(1)).save(captor.capture());

        SecurityAnomaly savedAnomaly = captor.getValue();
        assertEquals(lockId, savedAnomaly.getLockId());
        assertEquals("BRUTE_FORCE_PIN_ATTEMPT", savedAnomaly.getAnomalyType());
        assertEquals("HIGH", savedAnomaly.getSeverity());
        assertEquals(3, savedAnomaly.getFailedAttemptsCount());
        assertTrue(savedAnomaly.getDescription().contains("Brute-Force Alert"));
    }

    @Test
    @DisplayName("Should NOT trigger anomaly when failed attempts < 3")
    void shouldNotTriggerAnomalyWhenBelowThreshold() {
        // Given
        String lockId = "front-gate-01";
        AuditLog auditLog = new AuditLog(
                "log-1", "evt-1", lockId, "PIN_FAILED", "PIN",
                "user-1", "123456", "FAILED_UNAUTHORIZED",
                OffsetDateTime.now(), "Failed PIN attempt"
        );

        when(auditLogRepository.countRecentFailedAttempts(eq(lockId), any(OffsetDateTime.class)))
                .thenReturn(2L);

        // When
        anomalyDetectionService.evaluateAuditLog(auditLog);

        // Then
        verify(securityAnomalyRepository, never()).save(any());
    }
}
