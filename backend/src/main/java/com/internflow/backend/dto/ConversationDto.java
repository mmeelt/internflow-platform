package com.internflow.backend.dto;

import java.time.Instant;

public record ConversationDto(
        Long id,
        UserRef otherParticipant,
        Instant createdAt
) {
    public record UserRef(Long id, String name, String photoUrl, String avatarColor) {}
}
