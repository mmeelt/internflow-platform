package com.internflow.backend.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record ChangePasswordRequest(
        @NotBlank String currentPassword,
        @NotBlank @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).{12,72}$",
                message = "Password must be at least 12 characters and include a letter and a digit") String newPassword
) {}
