package com.internflow.backend.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** A short user question for the general Intern Portal assistant. */
public record AiChatRequest(
        @NotBlank @Size(max = 2_000) String message
) {}
