package com.internflow.backend.auth;

import java.util.UUID;

/**
 * Password-reset request result. The client uses {@code accountFound} to give
 * a clear next step before it asks the user for a code.
 */
public record PasswordResetResponse(UUID challengeId, long expiresIn, boolean accountFound) {}
