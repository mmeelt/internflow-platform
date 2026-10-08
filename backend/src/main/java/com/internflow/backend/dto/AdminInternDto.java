package com.internflow.backend.dto;

/**
 * Represents a student-intern as seen by the admin dashboard,
 * including the supervising supervisor's name and internship progress.
 */
public record AdminInternDto(
        Long   id,               // student User.id
        String name,
        String email,
        String photoUrl,
        String avatarColor,
        String userStatus,       // "Active" | "Need Review" | "Revoked"
        Long   internshipId,
        String title,            // internship title → "project"
        String internRole,
        int    progress,
        String supervisorName,
        String supervisorEmail,
        int    taskCount,
        int    reviewedCount,
        int    doneCount,
        int    submissionCount,
        Double adminRating
) {}
