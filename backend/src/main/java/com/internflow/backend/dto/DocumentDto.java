package com.internflow.backend.dto;

import java.time.Instant;

/** A submitted file enriched with the task and intern details needed by the document centre. */
public record DocumentDto(
        Long id,
        Long internshipId,
        Long taskId,
        String taskTitle,
        String taskStatus,
        Long internId,
        String internName,
        String internAvatarColor,
        String name,
        String size,
        String type,
        Instant uploadedAt
) {}
