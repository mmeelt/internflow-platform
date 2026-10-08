package com.internflow.backend.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.util.UUID;

public record PasswordResetConfirmRequest(
        @NotNull UUID challengeId,
        @NotBlank @Pattern(regexp = "\\d{6}") String code,
        @NotBlank @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).{12,72}$",
                message = "Password must be at least 12 characters and include a letter and a digit") String newPassword
) {}
