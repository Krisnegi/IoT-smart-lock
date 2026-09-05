package com.smartlock.audit.dto;

/**
 * DTO returning aggregated audit summary statistics for compliance dashboards.
 */
public class AuditStatsDto {

    private long totalAuditLogs;
    private long totalSuccessfulUnlocks;
    private long totalFailedAttempts;
    private long totalUnresolvedAnomalies;

    public AuditStatsDto() {
    }

    public AuditStatsDto(long totalAuditLogs, long totalSuccessfulUnlocks, 
                         long totalFailedAttempts, long totalUnresolvedAnomalies) {
        this.totalAuditLogs = totalAuditLogs;
        this.totalSuccessfulUnlocks = totalSuccessfulUnlocks;
        this.totalFailedAttempts = totalFailedAttempts;
        this.totalUnresolvedAnomalies = totalUnresolvedAnomalies;
    }

    public long getTotalAuditLogs() {
        return totalAuditLogs;
    }

    public void setTotalAuditLogs(long totalAuditLogs) {
        this.totalAuditLogs = totalAuditLogs;
    }

    public long getTotalSuccessfulUnlocks() {
        return totalSuccessfulUnlocks;
    }

    public void setTotalSuccessfulUnlocks(long totalSuccessfulUnlocks) {
        this.totalSuccessfulUnlocks = totalSuccessfulUnlocks;
    }

    public long getTotalFailedAttempts() {
        return totalFailedAttempts;
    }

    public void setTotalFailedAttempts(long totalFailedAttempts) {
        this.totalFailedAttempts = totalFailedAttempts;
    }

    public long getTotalUnresolvedAnomalies() {
        return totalUnresolvedAnomalies;
    }

    public void setTotalUnresolvedAnomalies(long totalUnresolvedAnomalies) {
        this.totalUnresolvedAnomalies = totalUnresolvedAnomalies;
    }
}
