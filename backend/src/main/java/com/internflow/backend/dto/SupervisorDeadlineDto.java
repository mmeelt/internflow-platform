package com.internflow.backend.dto;

import java.time.LocalDate;

public record SupervisorDeadlineDto(
        Long taskId,
        Long internshipId,
        String title,
        String internName,
        LocalDate dueDate,
        long daysRemaining,
        String urgency
) {}
