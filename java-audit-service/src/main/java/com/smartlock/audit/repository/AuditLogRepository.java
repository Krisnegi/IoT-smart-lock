package com.smartlock.audit.repository;

import com.smartlock.audit.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Spring Data JPA Repository interface for AuditLog entity.
 * Spring Data JPA dynamically generates the SQL query implementation at runtime!
 */
@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, String> {

    Optional<AuditLog> findByEventId(String eventId);

    Page<AuditLog> findByLockIdOrderByTimestampDesc(String lockId, Pageable pageable);

    Page<AuditLog> findAllByOrderByTimestampDesc(Pageable pageable);

    /**
     * Counts the number of failed PIN verification attempts for a specific lock
     * within a sliding time window (e.g., last 60 seconds).
     * Used by the Anomaly Detection Rules Engine to trigger Brute-Force alerts!
     */
    @Query("SELECT COUNT(a) FROM AuditLog a WHERE a.lockId = :lockId AND a.status IN ('FAILED_UNAUTHORIZED', 'FAILED_EXPIRED_PIN') AND a.timestamp >= :sinceTime")
    long countRecentFailedAttempts(@Param("lockId") String lockId, @Param("sinceTime") OffsetDateTime sinceTime);

    long countByStatus(String status);
}
