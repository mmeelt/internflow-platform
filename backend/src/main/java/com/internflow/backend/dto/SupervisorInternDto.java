package com.internflow.backend.dto;

/**
 * Represents a student-intern as seen by their supervisor, including
 * pre-computed task statistics so the frontend doesn't need raw task arrays.
 */
public record SupervisorInternDto(
        Long   id,               // student User.id
        String name,
        String email,
        String photoUrl,
        String avatarColor,
        String userStatus,       // "Active" | "Need Review" | "Revoked"
        Long   internshipId,
        String title,            // internship title  → shown as "project"
        String internRole,       // intern's role label in the project
        int    progress,         // internship progress 0-100
        String internshipStatus, // "Active" | ...
        int    taskCount,
        int    reviewedCount,
        int    doneCount,
        int    submissionCount
) {}
