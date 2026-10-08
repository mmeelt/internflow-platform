package com.internflow.backend.dto;

import java.time.Instant;

public record TaskFeedbackDto(
        Long    id,
        Long    taskId,
        Long    authorId,
        String  authorName,
        String  content,
        Instant createdAt
) {}
