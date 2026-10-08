package com.internflow.backend.dto;

import java.time.Instant;

public record CoSupervisionInvitationDto(
        Long internshipId,
        String studentName,
        String projectTitle,
        String invitedBy,
        Instant createdAt
) {}
