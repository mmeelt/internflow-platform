package com.internflow.backend.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record InternshipDto(
        Long id,
        String title,
        String domain,
        String description,
        String internRole,
        LocalDate startDate,
        LocalDate endDate,
        int progress,
        String status,
        UserRef intern,
        UserRef supervisor,
        Instant createdAt,
        /** All co-supervisor assignments for this internship (any status). */
        List<CoSupervisorSummaryDto> coSupervisors
) {
    /** Lightweight user reference embedded in internship responses. */
    public record UserRef(Long id, String name, String photoUrl, String avatarColor) {}
}
