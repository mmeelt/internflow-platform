package com.internflow.backend.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.time.LocalDate;

public record RegisterRequest(
        @NotBlank @Email @Size(max = 255) String email,

        // Minimum 12 characters, including at least one letter and one digit.
        @NotBlank
        @Pattern(
            regexp = "^(?=.*[A-Za-z])(?=.*\\d).{12,72}$",
            message = "Password must be at least 12 characters and include a letter and a digit"
        )
        String password,

        @NotBlank @Size(max = 255) String name,

        @NotBlank String role, // "student" | "supervisor" (admin accounts are never self-registered)

        String photoUrl,
        String phone,
        String bio,
        String university,
        String department,
        String domain,
        String year,
        String previousInternships,
        String enterprise,
        String subjectOfInternship,
        List<String> skills,
        Long supervisorId,
        Long projectId,
        LocalDate startDate,
        LocalDate endDate,
        String organization,
        String post,
        String specialization,
        String otherEncadrantInfo,
        Integer yearsExperience
) {}
