package com.smartlock.audit.controller;

import com.smartlock.audit.dto.AuditStatsDto;
import com.smartlock.audit.entity.AuditLog;
import com.smartlock.audit.entity.SecurityAnomaly;
import com.smartlock.audit.service.AuditService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST Controller exposing Audit Log & Security Compliance Reporting APIs.
 */
@RestController
@RequestMapping("/api/v1/audit-logs")
@CrossOrigin(origins = "*")
@Tag(name = "Audit & Compliance API", description = "Enterprise security audit trail and anomaly reporting endpoints")
public class AuditLogController {

    private final AuditService auditService;

    public AuditLogController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping
    @Operation(summary = "Get Paginated Audit Logs", description = "Retrieve audit logs sorted by timestamp descending with optional device filtering")
    public ResponseEntity<Page<AuditLog>> getAuditLogs(
            @Parameter(description = "Filter by Lock ID (e.g. front-gate-01)") 
            @RequestParam(required = false) String lockId,
            
            @Parameter(description = "Page number (0-indexed)") 
            @RequestParam(defaultValue = "0") int page,
            
            @Parameter(description = "Page size") 
            @RequestParam(defaultValue = "20") int size) {
        
        Page<AuditLog> logs = auditService.getAuditLogs(lockId, page, size);
        return ResponseEntity.ok(logs);
    }

    @GetMapping("/anomalies")
    @Operation(summary = "Get Security Anomalies", description = "Retrieve flagged security threats like brute-force PIN attempts or offline lock events")
    public ResponseEntity<List<SecurityAnomaly>> getAnomalies(
            @Parameter(description = "Filter by Lock ID") 
            @RequestParam(required = false) String lockId,
            
            @Parameter(description = "Show unresolved anomalies only") 
            @RequestParam(required = false, defaultValue = "false") Boolean unresolvedOnly) {
        
        List<SecurityAnomaly> anomalies = auditService.getAnomalies(lockId, unresolvedOnly);
        return ResponseEntity.ok(anomalies);
    }

    @GetMapping("/stats")
    @Operation(summary = "Get Summary Statistics", description = "Retrieve aggregated security compliance metrics for admin dashboard cards")
    public ResponseEntity<AuditStatsDto> getAuditStats() {
        AuditStatsDto stats = auditService.getAuditStats();
        return ResponseEntity.ok(stats);
    }
}
