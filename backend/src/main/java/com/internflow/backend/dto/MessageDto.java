package com.internflow.backend.dto;

import java.time.Instant;

public record MessageDto(
        Long id,
        Long conversationId,
        Long senderId,
        String senderName,
        String content,
        Instant createdAt
) {}
