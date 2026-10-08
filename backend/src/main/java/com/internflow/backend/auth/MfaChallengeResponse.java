package com.internflow.backend.auth;

import java.util.UUID;

public record MfaChallengeResponse(UUID challengeId, boolean mfaRequired, long expiresIn) {}
