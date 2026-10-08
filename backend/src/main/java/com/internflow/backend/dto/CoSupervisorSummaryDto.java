package com.internflow.backend.dto;

/**
 * Lightweight projection of a co-supervisor assignment returned to the
 * primary supervisor so the UI can render name, email, avatar, and invitation status.
 */
public record CoSupervisorSummaryDto(
        Long   id,
        String name,
        String email,
        String photoUrl,
        String avatarColor,
        String status   // "pending" | "accepted" | "declined"
) {}
