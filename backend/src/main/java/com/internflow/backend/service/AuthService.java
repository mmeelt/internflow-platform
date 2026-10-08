package com.internflow.backend.service;

import com.internflow.backend.auth.AuthResponse;
import com.internflow.backend.auth.LoginRequest;
import com.internflow.backend.auth.PasswordResetRequest;
import com.internflow.backend.auth.PasswordResetResponse;
import com.internflow.backend.auth.PasswordResetConfirmRequest;
import com.internflow.backend.auth.ChangePasswordRequest;
import com.internflow.backend.auth.MfaChallengeResponse;
import com.internflow.backend.auth.MfaVerifyRequest;
import com.internflow.backend.auth.RegistrationResponse;
import com.internflow.backend.auth.RegisterRequest;
import com.internflow.backend.auth.SupervisorOption;
import com.internflow.backend.entity.User;
import com.internflow.backend.entity.enums.UserRole;
import com.internflow.backend.exception.ApiException;
import com.internflow.backend.repository.UserRepository;
import com.internflow.backend.repository.SupervisorProfileRepository;
import com.internflow.backend.repository.InternProfileRepository;
import com.internflow.backend.repository.InternSkillRepository;
import com.internflow.backend.repository.MfaChallengeRepository;
import com.internflow.backend.repository.InternshipRepository;
import com.internflow.backend.repository.EnterpriseProjectRepository;
import com.internflow.backend.entity.MfaChallenge;
import com.internflow.backend.entity.InternProfile;
import com.internflow.backend.entity.InternSkill;
import com.internflow.backend.entity.SupervisorProfile;
import com.internflow.backend.entity.Internship;
import com.internflow.backend.entity.EnterpriseProject;
import com.internflow.backend.security.JwtService;
import com.internflow.backend.security.UserPrincipal;
import com.internflow.backend.entity.enums.NotificationType;
import com.internflow.backend.service.PendingRegistrationService.PendingRegistration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final NotificationService notificationService;
    private final SupervisorProfileRepository supervisorProfileRepository;
    private final InternProfileRepository internProfileRepository;
    private final InternSkillRepository internSkillRepository;
    private final MfaChallengeRepository mfaChallengeRepository;
    private final EmailService emailService;
    private final PendingRegistrationService pendingRegistrationService;
    private final InternshipRepository internshipRepository;
    private final EnterpriseProjectRepository enterpriseProjectRepository;
    private final RefreshTokenSessionService refreshTokenSessions;
    private final RegistrationDocumentService registrationDocuments;
    private final PendingProjectAssignmentService pendingProjectAssignments;
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${security.jwt.access-token-expiration-ms}")
    private long accessTokenExpirationMs;

    @Value("${security.mfa.code-expiration-minutes}")
    private long mfaExpirationMinutes;

    @Value("${security.mfa.max-attempts}")
    private int mfaMaxAttempts;

    @Value("${security.password-reset.code-expiration-minutes}")
    private long passwordResetExpirationMinutes;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager,
            JwtService jwtService,
            NotificationService notificationService,
            SupervisorProfileRepository supervisorProfileRepository,
            InternProfileRepository internProfileRepository,
            InternSkillRepository internSkillRepository,
            MfaChallengeRepository mfaChallengeRepository,
            EmailService emailService,
            PendingRegistrationService pendingRegistrationService,
            InternshipRepository internshipRepository,
            EnterpriseProjectRepository enterpriseProjectRepository,
            RefreshTokenSessionService refreshTokenSessions,
            RegistrationDocumentService registrationDocuments,
            PendingProjectAssignmentService pendingProjectAssignments
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.notificationService = notificationService;
        this.supervisorProfileRepository = supervisorProfileRepository;
        this.internProfileRepository = internProfileRepository;
        this.internSkillRepository = internSkillRepository;
        this.mfaChallengeRepository = mfaChallengeRepository;
        this.emailService = emailService;
        this.pendingRegistrationService = pendingRegistrationService;
        this.internshipRepository = internshipRepository;
        this.enterpriseProjectRepository = enterpriseProjectRepository;
        this.refreshTokenSessions = refreshTokenSessions;
        this.registrationDocuments = registrationDocuments;
        this.pendingProjectAssignments = pendingProjectAssignments;
    }

    public RegistrationResponse register(RegisterRequest request) {
        String email = request.email().trim().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            // Generic message — don't confirm/deny account existence to unauthenticated callers
            throw ApiException.conflict("Unable to create account with the provided details");
        }

        UserRole role;
        try {
            role = UserRole.valueOf(request.role().toLowerCase());
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("Role must be 'student' or 'supervisor'");
        }

        if (role == UserRole.admin) {
            throw ApiException.forbidden("Administrator accounts cannot be created through registration");
        }
        if (role == UserRole.student && !pendingProjectAssignments.hasStudentAssignment(email)) {
            User supervisor = request.supervisorId() == null ? null
                    : userRepository.findById(request.supervisorId()).orElse(null);
            if (supervisor == null || supervisor.getRole() != UserRole.supervisor
                    || !"Active".equals(supervisor.getStatus())) {
                throw ApiException.badRequest("Select a valid active supervisor");
            }
        }

        String code = generateCode();
        PendingRegistration pending = pendingRegistrationService.create(
                request, role, passwordEncoder.encode(request.password()), code,
                Instant.now().plus(mfaExpirationMinutes, ChronoUnit.MINUTES)
        );
        try {
            emailService.sendRegistrationCode(email, request.name(), role.name(), code, mfaExpirationMinutes);
        } catch (RuntimeException exception) {
            pendingRegistrationService.remove(pending.challengeId());
            throw exception;
        }
        return new RegistrationResponse(
                "Verify your email to complete registration.",
                pending.challengeId(),
                mfaExpirationMinutes * 60
        );
    }

    public void uploadStudentRegistrationDocuments(UUID challengeId, MultipartFile identityCard, MultipartFile agreement) {
        RegistrationDocumentService.StoredDocuments stored = registrationDocuments.store(challengeId, identityCard, agreement);
        pendingRegistrationService.attachStudentDocuments(challengeId, stored.identityPath(), stored.identityName(),
                stored.agreementPath(), stored.agreementName());
    }

    @Transactional
    public Object login(LoginRequest request) {
        // Delegates to DaoAuthenticationProvider -> checks password hash via PasswordEncoder,
        // and throws BadCredentialsException (mapped to a generic 401) on any mismatch.
        var authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email().toLowerCase(), request.password())
        );

        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.unauthorized("Invalid email or password"));

        if ("Need Review".equals(user.getStatus()) || "Need_Review".equals(user.getStatus())) {
            throw ApiException.unauthorized("Invalid email or password");
        }
        if ("Revoked".equals(user.getStatus())) {
            throw ApiException.unauthorized("Invalid email or password");
        }

        // Administrators authenticate with their password and receive tokens
        // immediately. Student and supervisor accounts retain email MFA.
        if (user.getRole() == UserRole.admin) {
            return issueTokens(new UserPrincipal(user), user);
        }

        if (!user.isEmailVerified()) {
            throw ApiException.unauthorized("Email address has not been verified");
        }
        MfaChallenge challenge = createChallenge(user, "LOGIN");
        return new MfaChallengeResponse(challenge.getId(), true, mfaExpirationMinutes * 60);
    }

    @Transactional
    public AuthResponse verifyMfa(MfaVerifyRequest request) {
        MfaChallenge challenge = mfaChallengeRepository.findLockedById(request.challengeId())
                .orElseThrow(() -> ApiException.unauthorized("Invalid or expired verification code"));
        if (!"LOGIN".equals(challenge.getPurpose())) {
            throw ApiException.unauthorized("Invalid or expired verification code");
        }
        Instant now = Instant.now();
        if (challenge.getUsedAt() != null || challenge.getExpiresAt().isBefore(now)
                || challenge.getAttempts() >= mfaMaxAttempts) {
            throw ApiException.unauthorized("Invalid or expired verification code");
        }
        if (!passwordEncoder.matches(request.code(), challenge.getCodeHash())) {
            challenge.setAttempts(challenge.getAttempts() + 1);
            mfaChallengeRepository.save(challenge);
            throw ApiException.unauthorized("Invalid or expired verification code");
        }
        challenge.setUsedAt(now);
        mfaChallengeRepository.save(challenge);

        User user = challenge.getUser();
        if (!"Active".equals(user.getStatus())) {
            throw ApiException.unauthorized("Invalid or expired verification code");
        }
        return issueTokens(new UserPrincipal(user), user);
    }

    @Transactional
    public MfaChallengeResponse resendLogin(UUID challengeId) {
        MfaChallenge previous = mfaChallengeRepository.findLockedById(challengeId)
                .orElseThrow(() -> ApiException.unauthorized("Invalid verification request"));
        if (!"LOGIN".equals(previous.getPurpose()) || previous.getUsedAt() != null
                || previous.getUser().getRole() == UserRole.admin) {
            throw ApiException.unauthorized("Invalid verification request");
        }

        // Invalidate the previous code before creating and emailing its replacement.
        previous.setUsedAt(Instant.now());
        mfaChallengeRepository.save(previous);
        MfaChallenge replacement = createChallenge(previous.getUser(), "LOGIN");
        return new MfaChallengeResponse(replacement.getId(), true, mfaExpirationMinutes * 60);
    }

    @Transactional
    public void verifyRegistration(MfaVerifyRequest request) {
        PendingRegistration pending = pendingRegistrationService.verifyAndReserve(
                request.challengeId(), request.code(), mfaMaxAttempts
        );
        try {
            if (userRepository.existsByEmail(pending.email())) {
                throw ApiException.conflict("Unable to create account with the provided details");
            }
            if (pending.role() == UserRole.admin) {
                throw ApiException.forbidden("Administrator accounts cannot be created through registration");
            }
            if (pending.role() == UserRole.student
                    && (pending.identityCardPath() == null || pending.internshipAgreementPath() == null)) {
                throw ApiException.badRequest("Upload your identity card and internship agreement before verifying your email");
            }
            createVerifiedUser(pending);
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    pendingRegistrationService.complete(request.challengeId());
                }

                @Override
                public void afterCompletion(int status) {
                    if (status != STATUS_COMMITTED) {
                        pendingRegistrationService.release(request.challengeId());
                    }
                }
            });
        } catch (RuntimeException exception) {
            pendingRegistrationService.release(request.challengeId());
            throw exception;
        }
    }

    public MfaChallengeResponse resendRegistration(UUID challengeId) {
        String code = generateCode();
        PendingRegistration replacement = pendingRegistrationService.replaceCode(
                challengeId, code, Instant.now().plus(mfaExpirationMinutes, ChronoUnit.MINUTES)
        );
        try {
            emailService.sendRegistrationCode(
                    replacement.email(), replacement.name(), replacement.role().name(),
                    code, mfaExpirationMinutes
            );
        } catch (RuntimeException exception) {
            pendingRegistrationService.remove(replacement.challengeId());
            throw exception;
        }
        return new MfaChallengeResponse(replacement.challengeId(), true, mfaExpirationMinutes * 60);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public AuthResponse refresh(String refreshToken) {
        if (!jwtService.isRefreshToken(refreshToken)) {
            throw ApiException.unauthorized("Invalid refresh token");
        }
        String email = jwtService.extractUsername(refreshToken);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> ApiException.unauthorized("Invalid refresh token"));
        if (!"Active".equals(user.getStatus())) {
            throw ApiException.unauthorized("Invalid refresh token");
        }

        UserPrincipal principal = new UserPrincipal(user);
        if (!jwtService.isTokenValid(refreshToken, principal)
                || !jwtService.hasCurrentSessionVersion(refreshToken, principal.getSessionVersion())) {
            throw ApiException.unauthorized("Invalid or expired refresh token");
        }

        RefreshTokenSessionService.RotationResult rotation = refreshTokenSessions.rotate(refreshToken, user.getId());
        if (rotation == RefreshTokenSessionService.RotationResult.REUSED) {
            throw ApiException.unauthorized("Session expired. Please sign in again.");
        }
        if (rotation != RefreshTokenSessionService.RotationResult.ACCEPTED) {
            throw ApiException.unauthorized("Invalid or expired refresh token");
        }

        return issueTokens(principal, user);
    }

    public void logout(String refreshToken) {
        refreshTokenSessions.revoke(refreshToken);
    }

    public PasswordResetResponse requestPasswordReset(PasswordResetRequest request) {
        String email = request.email().trim().toLowerCase();
        UUID opaqueChallengeId = UUID.randomUUID();
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null || !"Active".equals(user.getStatus()) || !user.isEmailVerified()) {
            return new PasswordResetResponse(opaqueChallengeId, passwordResetExpirationMinutes * 60, false);
        }
        MfaChallenge challenge = createPasswordResetChallenge(user);
        return new PasswordResetResponse(challenge.getId(), passwordResetExpirationMinutes * 60, true);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public AuthResponse confirmPasswordReset(PasswordResetConfirmRequest request) {
        MfaChallenge challenge = validateChallenge(
                new MfaVerifyRequest(request.challengeId(), request.code()), "PASSWORD_RESET", true);
        User user = challenge.getUser();
        if (!"Active".equals(user.getStatus())) {
            throw ApiException.unauthorized("Invalid or expired verification code");
        }
        updatePassword(user, request.newPassword());
        // The reset code proves ownership of the account, so issue exactly one
        // new session after revoking every previous session in updatePassword.
        return issueTokens(new UserPrincipal(user), user);
    }

    /** Checks the reset code before the client displays the password step. */
    @Transactional
    public void verifyPasswordResetCode(MfaVerifyRequest request) {
        // Do not consume the code here: the final password-change request must
        // present the same code and consumes it atomically with the reset.
        validateChallenge(request, "PASSWORD_RESET", false);
    }

    @Transactional
    public void changePassword(UserPrincipal principal, ChangePasswordRequest request) {
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> ApiException.unauthorized("Invalid session"));
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw ApiException.unauthorized("Current password is incorrect");
        }
        updatePassword(user, request.newPassword());
    }

    public java.util.List<SupervisorOption> getActiveSupervisors() {
        return userRepository.findByRoleAndStatus(UserRole.supervisor, "Active").stream()
                .map(u -> new SupervisorOption(u.getId(), u.getName(), supervisorPost(u), supervisorAxis(u)))
                .toList();
    }

    private AuthResponse issueTokens(UserPrincipal principal, User user) {
        String accessToken = jwtService.generateAccessToken(principal);
        String refreshToken = jwtService.generateRefreshToken(principal);
        refreshTokenSessions.register(refreshToken, user);

        return new AuthResponse(
                accessToken,
                refreshToken,
                accessTokenExpirationMs / 1000,
                userSummary(user)
        );
    }

    private MfaChallenge validateChallenge(MfaVerifyRequest request, String purpose, boolean consume) {
        MfaChallenge challenge = mfaChallengeRepository.findLockedById(request.challengeId())
                .orElseThrow(() -> ApiException.unauthorized("Invalid or expired verification code"));
        Instant now = Instant.now();
        if (!purpose.equals(challenge.getPurpose()) || challenge.getUsedAt() != null
                || challenge.getExpiresAt().isBefore(now) || challenge.getAttempts() >= mfaMaxAttempts) {
            throw ApiException.unauthorized("Invalid or expired verification code");
        }
        if (!passwordEncoder.matches(request.code(), challenge.getCodeHash())) {
            challenge.setAttempts(challenge.getAttempts() + 1);
            mfaChallengeRepository.save(challenge);
            throw ApiException.unauthorized("Invalid or expired verification code");
        }
        if (consume) {
            challenge.setUsedAt(now);
            return mfaChallengeRepository.save(challenge);
        }
        return challenge;
    }

    private MfaChallenge createChallenge(User user, String purpose) {
        String code = String.format("%06d", secureRandom.nextInt(1_000_000));
        MfaChallenge challenge = new MfaChallenge();
        challenge.setId(UUID.randomUUID());
        challenge.setUser(user);
        challenge.setPurpose(purpose);
        challenge.setCodeHash(passwordEncoder.encode(code));
        challenge.setExpiresAt(Instant.now().plus(mfaExpirationMinutes, ChronoUnit.MINUTES));
        mfaChallengeRepository.save(challenge);
        emailService.sendLoginCode(user.getEmail(), user.getName(), user.getRole().name(), code, mfaExpirationMinutes);
        return challenge;
    }

    private MfaChallenge createPasswordResetChallenge(User user) {
        String code = generateCode();
        MfaChallenge challenge = new MfaChallenge();
        challenge.setId(UUID.randomUUID());
        challenge.setUser(user);
        challenge.setPurpose("PASSWORD_RESET");
        challenge.setCodeHash(passwordEncoder.encode(code));
        challenge.setExpiresAt(Instant.now().plus(passwordResetExpirationMinutes, ChronoUnit.MINUTES));
        mfaChallengeRepository.save(challenge);
        emailService.sendPasswordResetCode(user.getEmail(), user.getName(), code, passwordResetExpirationMinutes);
        return challenge;
    }

    private void updatePassword(User user, String newPassword) {
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setPasswordChangedAt(Instant.now());
        user.setSessionVersion(user.getSessionVersion() + 1);
        userRepository.save(user);
        refreshTokenSessions.revokeAll(user.getId());
    }

    private String generateCode() {
        return String.format("%06d", secureRandom.nextInt(1_000_000));
    }

    private void createVerifiedUser(PendingRegistration pending) {
        User user = new User();
        user.setEmail(pending.email());
        user.setPasswordHash(pending.passwordHash());
        user.setRole(pending.role());
        user.setName(pending.name());
        user.setPhone(pending.phone());
        user.setBio(pending.bio());
        if (pending.photoUrl() != null && pending.photoUrl().startsWith("data:image/")
                && pending.photoUrl().length() <= 3_000_000) {
            user.setPhotoUrl(pending.photoUrl());
        }
        user.setIdentityCardPath(pending.identityCardPath());
        user.setIdentityCardName(pending.identityCardName());
        user.setInternshipAgreementPath(pending.internshipAgreementPath());
        user.setInternshipAgreementName(pending.internshipAgreementName());
        user.setStatus("Need Review");
        user.setEmailVerified(true);
        userRepository.save(user);
        boolean hasAdministratorAssignment = pending.role() == UserRole.student
                && pendingProjectAssignments.claimAndFinalize(user);

        if (pending.role() == UserRole.student) {
            EnterpriseProject selectedProject = null;
            User supervisor = pending.supervisorId() == null ? null
                    : userRepository.findById(pending.supervisorId()).orElse(null);
            if (!hasAdministratorAssignment && (supervisor == null || supervisor.getRole() != UserRole.supervisor
                    || !"Active".equals(supervisor.getStatus()))) {
                throw ApiException.badRequest("Select a valid active supervisor");
            }
            if (pending.projectId() != null) {
                selectedProject = enterpriseProjectRepository.findById(pending.projectId())
                        .filter(EnterpriseProject::isAvailableForStudentSelection)
                        .filter(project -> internshipRepository.findByEnterpriseProjectId(project.getId()).isEmpty())
                        .orElseThrow(() -> ApiException.badRequest("The selected project is no longer available"));
            }
            InternProfile profile = new InternProfile();
            profile.setUser(user);
            profile.setUniversity(pending.university());
            profile.setDepartment(pending.department());
            profile.setYear(pending.year());
            profile.setPreviousInternships(pending.previousInternships());
            profile.setEnterprise(pending.enterprise());
            profile.setSpecialization(pending.specialization());
            profile.setSubjectOfInternship(selectedProject == null ? pending.subjectOfInternship() : selectedProject.getTitle());
            internProfileRepository.save(profile);
            pending.skills().stream()
                    .filter(skill -> skill != null && !skill.isBlank())
                    .map(String::trim)
                    .distinct()
                    .forEach(skill -> {
                        InternSkill item = new InternSkill();
                        item.setUser(user);
                        item.setSkill(skill);
                        internSkillRepository.save(item);
                    });

            // A student pre-assigned by an administrator may register before
            // their designated supervisor.  In that case the durable pending
            // assignment completes the internship when both accounts exist.
            if (!hasAdministratorAssignment && supervisor != null) {
                Internship internship = new Internship();
                internship.setIntern(user);
                internship.setSupervisor(supervisor);
                internship.setInternRole(pending.year());
                internship.setStartDate(pending.startDate());
                internship.setEndDate(pending.endDate());
                if (selectedProject != null) {
                    internship.setEnterpriseProject(selectedProject);
                    internship.setTitle(selectedProject.getTitle());
                    internship.setDomain(selectedProject.getDomain());
                    internship.setDescription(selectedProject.getDescription());
                    notificationService.send(supervisor.getId(), NotificationType.system,
                            "Student account awaiting approval",
                            user.getName() + " selected you as supervisor and needs your approval.");
                } else {
                    internship.setTitle(pending.subjectOfInternship() == null || pending.subjectOfInternship().isBlank()
                            ? "Internship project pending assignment" : pending.subjectOfInternship());
                    internship.setDomain(pending.domain());
                    internship.setDescription(pending.bio());
                    notificationService.send(supervisor.getId(), NotificationType.system,
                            "Student account awaiting approval",
                            user.getName() + " selected you as mentor and needs your approval.");
                    userRepository.findByRole(UserRole.admin).forEach(admin ->
                            notificationService.send(admin.getId(), NotificationType.system,
                                    "Student account awaiting project assignment",
                                    user.getName() + " registered without a project and needs an assignment."));
                }
                internshipRepository.save(internship);
            }
        } else if (pending.role() == UserRole.supervisor) {
            SupervisorProfile profile = new SupervisorProfile();
            profile.setUser(user);
            profile.setOrganization(pending.organization());
            profile.setDepartment(pending.department());
            profile.setPost(pending.post());
            profile.setSpecialization(pending.specialization());
            profile.setOtherEncadrantInfo(pending.otherEncadrantInfo());
            profile.setYearsExperience(pending.yearsExperience() == null ? 0 : pending.yearsExperience());
            supervisorProfileRepository.save(profile);
        }

        // Students are reviewed by the supervisor they selected above. Only a
        // new supervisor account needs an administrator alert and approval.
        if (pending.role() == UserRole.supervisor) {
            userRepository.findByRole(UserRole.admin).forEach(admin ->
                    notificationService.send(admin.getId(), NotificationType.system,
                            "New supervisor account awaiting approval",
                            user.getName() + " registered as a supervisor and needs approval."));
        }
        pendingProjectAssignments.finalizeReadyAssignments();
    }

    private AuthResponse.UserSummary userSummary(User user) {
        return new AuthResponse.UserSummary(
                user.getId(), user.getEmail(), user.getName(),
                user.getRole().name(), user.getStatus(), user.getPhotoUrl(), supervisorPost(user)
        );
    }

    private String supervisorPost(User user) {
        if (user.getRole() != UserRole.supervisor) return null;
        return supervisorProfileRepository.findByUserId(user.getId())
                .map(profile -> profile.getPost())
                .orElse(null);
    }

    private String supervisorAxis(User user) {
        if (user.getRole() != UserRole.supervisor) {
            return null;
        }
        return supervisorProfileRepository.findByUserId(user.getId())
                .map(profile -> profile.getSpecialization())
                .orElse(null);
    }
}
