package com.internflow.backend.dto;

import java.time.Instant;

public record SubmissionDto(
        Long id,
        Long taskId,
        String name,
        String size,
        String type,
        String url,
        Instant uploadedAt
) {}
