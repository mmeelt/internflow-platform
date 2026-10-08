package com.internflow.backend.dto;

import java.time.LocalDate;

public record PersonalCalendarTaskDto(Long id, String title, String description, LocalDate startDate,
                                      LocalDate dueDate, String category, String priority, String status) {}
