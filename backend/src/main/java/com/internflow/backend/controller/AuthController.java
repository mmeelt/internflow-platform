package com.internflow.backend.controller;

import com.internflow.backend.auth.AuthResponse;
import com.internflow.backend.auth.LoginRequest;
import com.internflow.backend.auth.RegisterRequest;
import com.internflow.backend.auth.MfaChallengeResponse;
import com.internflow.backend.auth.MfaVerifyRequest;
import com.internflow.backend.auth.RegistrationResponse;
import com.internflow.backend.auth.SupervisorOption;
import com.internflow.backend.auth.PasswordResetRequest;
import com.internflow.backend.auth.PasswordResetResponse;
import com.internflow.backend.auth.PasswordResetConfirmRequest;
import com.internflow.backend.auth.ChangePasswordRequest;
import com.internflow.backend.security.UserPrincipal;
import com.internflow.backend.service.AuthService;
import com.internflow.backend.service.SecurityRateLimiter;
import jakarta.servlet.http.HttpServletRequest;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.multipart.MultipartFile;

/**
 * Public authentication endpoints. Rate limiting (e.g. via bucket4j or an API gateway)
 * should be applied in front of /login and /register to blunt brute-force / credential
 * stuffing attempts — see security notes in README.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final String REFRESH_COOKIE = "internflow_refresh";

    private final AuthService authService;
    private final SecurityRateLimiter rateLimiter;

    @org.springframework.beans.factory.annotation.Value("${security.jwt.refresh-token-expiration-ms}")
    private long refreshTokenExpirationMs;

    @org.springframework.beans.factory.annotation.Value("${security.cookies.secure:false}")
    private boolean secureCookies;

    public AuthController(AuthService authService, SecurityRateLimiter rateLimiter) {
        this.authService = authService;
        this.rateLimiter = rateLimiter;
    }

    @PostMapping("/register")
    public ResponseEntity<RegistrationResponse> register(@Valid @RequestBody RegisterRequest request, HttpServletRequest http) {
        // A shared company network can legitimately register several interns.
        // Keep a per-email throttle, but do not lock all local testing/users
        // out after five registration attempts from the same NAT IP.
        rateLimiter.require("register-ip", rateLimiter.clientIp(http), 20, 3600);
        rateLimiter.require("register-email", request.email(), 5, 3600);
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    /** Uploads official student documents while the email-verification request is still pending. */
    @PostMapping(value = "/register/{challengeId}/documents", consumes = "multipart/form-data")
    public ResponseEntity<Void> uploadRegistrationDocuments(
            @PathVariable java.util.UUID challengeId,
            @RequestParam("identityCard") MultipartFile identityCard,
            @RequestParam("internshipAgreement") MultipartFile internshipAgreement,
            HttpServletRequest http) {
        rateLimiter.require("register-documents-ip", rateLimiter.clientIp(http), 8, 900);
        rateLimiter.require("register-documents-challenge", challengeId.toString(), 3, 900);
        authService.uploadStudentRegistrationDocuments(challengeId, identityCard, internshipAgreement);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        rateLimiter.require("login-ip", rateLimiter.clientIp(http), 20, 900);
        rateLimiter.require("login-account", request.email(), 8, 900);
        Object response = authService.login(request);
        if (response instanceof AuthResponse authResponse) {
            return authenticatedResponse(authResponse);
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping("/login/verify")
    public ResponseEntity<AuthResponse> verifyLogin(@Valid @RequestBody MfaVerifyRequest request, HttpServletRequest http) {
        rateLimiter.require("login-verify-ip", rateLimiter.clientIp(http), 20, 600);
        rateLimiter.require("login-verify-challenge", request.challengeId().toString(), 6, 600);
        return authenticatedResponse(authService.verifyMfa(request));
    }

    @PostMapping("/login/resend/{challengeId}")
    public ResponseEntity<MfaChallengeResponse> resendLogin(@PathVariable java.util.UUID challengeId, HttpServletRequest http) {
        rateLimiter.require("login-resend-ip", rateLimiter.clientIp(http), 5, 600);
        rateLimiter.require("login-resend-challenge", challengeId.toString(), 2, 120);
        return ResponseEntity.ok(authService.resendLogin(challengeId));
    }

    @PostMapping("/register/verify")
    public ResponseEntity<Void> verifyRegistration(@Valid @RequestBody MfaVerifyRequest request, HttpServletRequest http) {
        rateLimiter.require("register-verify-ip", rateLimiter.clientIp(http), 20, 600);
        rateLimiter.require("register-verify-challenge", request.challengeId().toString(), 6, 600);
        authService.verifyRegistration(request);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/register/resend/{challengeId}")
    public ResponseEntity<MfaChallengeResponse> resendRegistration(@PathVariable java.util.UUID challengeId, HttpServletRequest http) {
        rateLimiter.require("register-resend-ip", rateLimiter.clientIp(http), 10, 900);
        rateLimiter.require("register-resend-challenge", challengeId.toString(), 3, 120);
        return ResponseEntity.ok(authService.resendRegistration(challengeId));
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw com.internflow.backend.exception.ApiException.unauthorized("Invalid refresh token");
        }
        return authenticatedResponse(authService.refresh(refreshToken));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken) {
        authService.logout(refreshToken);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, expiredRefreshCookie().toString())
                .build();
    }

    @PostMapping("/password-reset")
    public ResponseEntity<PasswordResetResponse> requestPasswordReset(
            @Valid @RequestBody PasswordResetRequest request, HttpServletRequest http) {
        // Allow legitimate retries after a delayed email or a configuration
        // correction, while keeping a bounded per-IP and per-account limit.
        rateLimiter.require("password-reset-ip", rateLimiter.clientIp(http), 10, 900);
        rateLimiter.require("password-reset-email", request.email(), 4, 900);
        return ResponseEntity.ok(authService.requestPasswordReset(request));
    }

    @PostMapping("/password-reset/confirm")
    public ResponseEntity<AuthResponse> confirmPasswordReset(
            @Valid @RequestBody PasswordResetConfirmRequest request, HttpServletRequest http) {
        rateLimiter.require("password-reset-confirm-ip", rateLimiter.clientIp(http), 20, 600);
        rateLimiter.require("password-reset-code-challenge", request.challengeId().toString(), 6, 600);
        return authenticatedResponse(authService.confirmPasswordReset(request));
    }

    @PostMapping("/password-reset/verify")
    public ResponseEntity<Void> verifyPasswordResetCode(
            @Valid @RequestBody MfaVerifyRequest request, HttpServletRequest http) {
        rateLimiter.require("password-reset-confirm-ip", rateLimiter.clientIp(http), 20, 600);
        rateLimiter.require("password-reset-code-challenge", request.challengeId().toString(), 6, 600);
        authService.verifyPasswordResetCode(request);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/password/change")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest http) {
        rateLimiter.require("password-change-user", principal.getId().toString(), 5, 3600);
        authService.changePassword(principal, request);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, expiredRefreshCookie().toString())
                .build();
    }

    @GetMapping("/supervisors")
    public ResponseEntity<java.util.List<SupervisorOption>> getSupervisors(HttpServletRequest http) {
        rateLimiter.require("public-supervisors-ip", rateLimiter.clientIp(http), 30, 60);
        return ResponseEntity.ok(authService.getActiveSupervisors());
    }

    private ResponseEntity<AuthResponse> authenticatedResponse(AuthResponse response) {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookie(response.refreshToken()).toString())
                .body(response);
    }

    private ResponseCookie refreshCookie(String refreshToken) {
        return ResponseCookie.from(REFRESH_COOKIE, refreshToken)
                .httpOnly(true)
                .secure(secureCookies)
                .sameSite("Strict")
                .path("/api/auth")
                .maxAge(java.time.Duration.ofMillis(refreshTokenExpirationMs))
                .build();
    }

    private ResponseCookie expiredRefreshCookie() {
        return ResponseCookie.from(REFRESH_COOKIE, "")
                .httpOnly(true)
                .secure(secureCookies)
                .sameSite("Strict")
                .path("/api/auth")
                .maxAge(java.time.Duration.ZERO)
                .build();
    }
}
