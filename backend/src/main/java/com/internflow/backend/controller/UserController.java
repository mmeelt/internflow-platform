package com.internflow.backend.controller;

import com.internflow.backend.auth.AuthResponse;
import com.internflow.backend.entity.User;
import com.internflow.backend.exception.ApiException;
import com.internflow.backend.repository.UserRepository;
import com.internflow.backend.repository.SupervisorProfileRepository;
import com.internflow.backend.security.UserPrincipal;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Template for every other protected resource controller in the app
 * (TaskController, SubmissionController, MessageController, ...):
 * inject the authenticated principal via @AuthenticationPrincipal,
 * never trust a user/role id sent in the request body for "who am I" checks.
 */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserRepository userRepository;
    private final SupervisorProfileRepository supervisorProfileRepository;

    public UserController(UserRepository userRepository, SupervisorProfileRepository supervisorProfileRepository) {
        this.userRepository = userRepository;
        this.supervisorProfileRepository = supervisorProfileRepository;
    }

    @GetMapping("/me")
    public ResponseEntity<AuthResponse.UserSummary> me(@AuthenticationPrincipal UserPrincipal principal) {
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));

        return ResponseEntity.ok(new AuthResponse.UserSummary(
                user.getId(), user.getEmail(), user.getName(),
                user.getRole().name(), user.getStatus(), user.getPhotoUrl(),
                supervisorProfileRepository.findByUserId(user.getId()).map(profile -> profile.getPost()).orElse(null)
        ));
    }
}
