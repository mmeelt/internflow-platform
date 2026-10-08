package com.internflow.backend.dto;

import java.time.Instant;

public record NotificationDto(
        Long id,
        String type,
        String title,
        String description,
        boolean read,
        Instant createdAt
) {}
