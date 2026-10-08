package com.internflow.backend.dto;

import java.time.Instant;

public record SupervisorActivityDto(
        Long id,
        String internName,
        String action,
        Instant occurredAt
) {}
