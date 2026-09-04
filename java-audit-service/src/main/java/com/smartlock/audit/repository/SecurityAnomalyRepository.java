package com.smartlock.audit.repository;

import com.smartlock.audit.entity.SecurityAnomaly;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Spring Data JPA Repository interface for SecurityAnomaly entity.
 */
@Repository
public interface SecurityAnomalyRepository extends JpaRepository<SecurityAnomaly, String> {

    List<SecurityAnomaly> findByLockIdOrderByDetectedAtDesc(String lockId);

    List<SecurityAnomaly> findByResolvedFalseOrderByDetectedAtDesc();

    long countByResolvedFalse();
}
