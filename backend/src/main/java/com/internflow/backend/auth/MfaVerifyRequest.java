package com.internflow.backend.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.util.UUID;

public record MfaVerifyRequest(
        @NotNull UUID challengeId,
        @NotBlank @Pattern(regexp = "\\d{6}", message = "Code must contain 6 digits") String code
) {}
