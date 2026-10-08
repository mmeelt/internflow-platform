package com.internflow.backend.auth;

import java.util.UUID;

public record RegistrationResponse(
        String message,
        UUID challengeId,
        long expiresIn
) {}
