package com.internflow.backend.dto;

import java.time.Instant;
import java.time.LocalDate;

public record TaskDto(
        Long id,
        Long internshipId,
        String title,
        String description,
        LocalDate dueDate,
        String priority,
        String status,
        int progress,
        String feedback,
        Instant reviewedAt,
        Instant createdAt,
        java.util.List<SubmissionDto> submissions,
        java.util.List<TaskFeedbackDto> feedbacks
) {}
