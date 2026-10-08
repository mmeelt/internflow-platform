package com.internflow.backend.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record PasswordResetRequest(@NotBlank @Email String email) {}
