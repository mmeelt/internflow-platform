package com.internflow.backend.dto;

import java.time.LocalDate;

public record MilestoneDto(
        Long id,
        Long internshipId,
        String title,
        String status,
        LocalDate date
) {}
