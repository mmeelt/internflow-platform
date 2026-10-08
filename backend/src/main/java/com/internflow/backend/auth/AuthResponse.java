package com.internflow.backend.auth;

import com.fasterxml.jackson.annotation.JsonIgnore;

public record AuthResponse(
        String accessToken,
        @JsonIgnore String refreshToken,
        long expiresIn, // seconds, for the frontend to schedule a silent refresh
        UserSummary user
) {
    public record UserSummary(
            Long id,
            String email,
            String name,
            String role,
            String status,
            String photoUrl,
            String post
    ) {}
}
