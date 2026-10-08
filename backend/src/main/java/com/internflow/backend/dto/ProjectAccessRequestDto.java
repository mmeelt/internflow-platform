package com.internflow.backend.dto;

import java.time.Instant;

public record ProjectAccessRequestDto(
        Long id, Long projectId, String projectTitle, String assetType, String message,
        String status, Instant createdAt, String requesterName, String requesterEmail
) {}
