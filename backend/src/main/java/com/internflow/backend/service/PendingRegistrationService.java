package com.internflow.backend.service;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import com.internflow.backend.auth.RegisterRequest;
import com.internflow.backend.entity.enums.UserRole;
import com.internflow.backend.exception.ApiException;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Holds unverified registrations in server memory so no user or profile is
 * written to the database before ownership of the email address is proven.
 * Passwords and verification codes are only retained as one-way hashes.
 */
@Service
public class PendingRegistrationService {

    private final PasswordEncoder passwordEncoder;
    private final Map<UUID, PendingRegistration> registrations = new HashMap<>();

    public PendingRegistrationService(PasswordEncoder passwordEncoder) {
        this.passwordEncoder = passwordEncoder;
    }

    public synchronized PendingRegistration create(
            RegisterRequest request,
            UserRole role,
            String passwordHash,
            String code,
            Instant expiresAt
    ) {
        purgeExpired();
        String email = request.email().trim().toLowerCase();
        boolean emailAlreadyPending = registrations.values().stream()
                .anyMatch(item -> item.email().equals(email));
        if (emailAlreadyPending) {
            throw ApiException.conflict("A verification request is already pending for this email");
        }

        PendingRegistration pending = new PendingRegistration(
                UUID.randomUUID(), email, passwordHash, role, request.name(),
                request.photoUrl(), request.phone(), request.bio(), request.university(),
                request.department(), request.domain(), request.year(), request.previousInternships(),
                request.enterprise(), request.subjectOfInternship(), request.skills(),
                request.supervisorId(), request.projectId(), request.startDate(), request.endDate(),
                request.organization(), request.post(), request.specialization(),
                request.otherEncadrantInfo(), request.yearsExperience(),
                passwordEncoder.encode(code), expiresAt
        );
        registrations.put(pending.challengeId(), pending);
        return pending;
    }

    public synchronized PendingRegistration verifyAndReserve(UUID challengeId, String code, int maxAttempts) {
        purgeExpired();
        PendingRegistration pending = registrations.get(challengeId);
        if (pending == null || pending.reserved || pending.attempts >= maxAttempts
                || pending.expiresAt.isBefore(Instant.now())) {
            throw ApiException.unauthorized("Invalid or expired verification code");
        }
        if (!passwordEncoder.matches(code, pending.codeHash)) {
            pending.attempts++;
            throw ApiException.unauthorized("Invalid or expired verification code");
        }
        pending.reserved = true;
        return pending;
    }

    public synchronized PendingRegistration replaceCode(
            UUID challengeId,
            String newCode,
            Instant expiresAt
    ) {
        purgeExpired();
        PendingRegistration previous = registrations.get(challengeId);
        if (previous == null || previous.reserved) {
            throw ApiException.unauthorized("Invalid verification request");
        }
        PendingRegistration replacement = previous.withChallenge(
                UUID.randomUUID(), passwordEncoder.encode(newCode), expiresAt
        );
        registrations.remove(challengeId);
        registrations.put(replacement.challengeId(), replacement);
        return replacement;
    }

    public synchronized void complete(UUID challengeId) {
        registrations.remove(challengeId);
    }

    public synchronized void release(UUID challengeId) {
        PendingRegistration pending = registrations.get(challengeId);
        if (pending != null) pending.reserved = false;
    }

    public synchronized void remove(UUID challengeId) {
        registrations.remove(challengeId);
    }

    public synchronized void attachStudentDocuments(UUID challengeId, String identityPath, String identityName,
                                                    String agreementPath, String agreementName) {
        PendingRegistration pending = registrations.get(challengeId);
        if (pending == null || pending.reserved || pending.role() != UserRole.student || pending.expiresAt.isBefore(Instant.now())) {
            throw ApiException.unauthorized("Invalid registration request");
        }
        pending.setDocuments(identityPath, identityName, agreementPath, agreementName);
    }

    private void purgeExpired() {
        Instant now = Instant.now();
        // Keep an expired registration briefly so the user can request a new
        // code without submitting the entire form again. The expired code
        // itself remains unusable because verifyAndReserve checks expiresAt.
        registrations.values().removeIf(item ->
                item.expiresAt().plusSeconds(15 * 60L).isBefore(now));
    }

    public static final class PendingRegistration {
        private final UUID challengeId;
        private final String email;
        private final String passwordHash;
        private final UserRole role;
        private final String name;
        private final String photoUrl;
        private final String phone;
        private final String bio;
        private final String university;
        private final String department;
        private final String domain;
        private final String year;
        private final String previousInternships;
        private final String enterprise;
        private final String subjectOfInternship;
        private final java.util.List<String> skills;
        private final Long supervisorId;
        private final Long projectId;
        private final java.time.LocalDate startDate;
        private final java.time.LocalDate endDate;
        private final String organization;
        private final String post;
        private final String specialization;
        private final String otherEncadrantInfo;
        private final Integer yearsExperience;
        private final String codeHash;
        private final Instant expiresAt;
        private String identityCardPath;
        private String identityCardName;
        private String internshipAgreementPath;
        private String internshipAgreementName;
        private int attempts;
        private boolean reserved;

        private PendingRegistration(
                UUID challengeId, String email, String passwordHash, UserRole role, String name,
                String photoUrl, String phone, String bio, String university, String department, String domain,
                String year, String previousInternships, String enterprise, String subjectOfInternship,
                java.util.List<String> skills, Long supervisorId, Long projectId, java.time.LocalDate startDate,
                java.time.LocalDate endDate, String organization, String post, String specialization,
                String otherEncadrantInfo, Integer yearsExperience, String codeHash, Instant expiresAt
        ) {
            this.challengeId = challengeId;
            this.email = email;
            this.passwordHash = passwordHash;
            this.role = role;
            this.name = name;
            this.photoUrl = photoUrl;
            this.phone = phone;
            this.bio = bio;
            this.university = university;
            this.department = department;
            this.domain = domain;
            this.year = year;
            this.previousInternships = previousInternships;
            this.enterprise = enterprise;
            this.subjectOfInternship = subjectOfInternship;
            this.skills = skills == null ? java.util.List.of() : java.util.List.copyOf(skills);
            this.supervisorId = supervisorId;
            this.projectId = projectId;
            this.startDate = startDate;
            this.endDate = endDate;
            this.organization = organization;
            this.post = post;
            this.specialization = specialization;
            this.otherEncadrantInfo = otherEncadrantInfo;
            this.yearsExperience = yearsExperience;
            this.codeHash = codeHash;
            this.expiresAt = expiresAt;
        }

        private PendingRegistration withChallenge(UUID id, String hash, Instant expiry) {
            PendingRegistration replacement = new PendingRegistration(
                    id, email, passwordHash, role, name, photoUrl, phone, bio, university,
                    department, domain, year, previousInternships, enterprise, subjectOfInternship,
                    skills, supervisorId, projectId, startDate, endDate, organization, post, specialization, otherEncadrantInfo,
                    yearsExperience, hash, expiry
            );
            replacement.setDocuments(identityCardPath, identityCardName, internshipAgreementPath, internshipAgreementName);
            return replacement;
        }

        public UUID challengeId() { return challengeId; }
        public String email() { return email; }
        public String passwordHash() { return passwordHash; }
        public UserRole role() { return role; }
        public String name() { return name; }
        public String photoUrl() { return photoUrl; }
        public String phone() { return phone; }
        public String bio() { return bio; }
        public String university() { return university; }
        public String department() { return department; }
        public String domain() { return domain; }
        public String year() { return year; }
        public String previousInternships() { return previousInternships; }
        public String enterprise() { return enterprise; }
        public String subjectOfInternship() { return subjectOfInternship; }
        public java.util.List<String> skills() { return skills; }
        public Long supervisorId() { return supervisorId; }
        public Long projectId() { return projectId; }
        public java.time.LocalDate startDate() { return startDate; }
        public java.time.LocalDate endDate() { return endDate; }
        public String organization() { return organization; }
        public String post() { return post; }
        public String specialization() { return specialization; }
        public String otherEncadrantInfo() { return otherEncadrantInfo; }
        public Integer yearsExperience() { return yearsExperience; }
        public Instant expiresAt() { return expiresAt; }
        public String identityCardPath() { return identityCardPath; }
        public String identityCardName() { return identityCardName; }
        public String internshipAgreementPath() { return internshipAgreementPath; }
        public String internshipAgreementName() { return internshipAgreementName; }
        private void setDocuments(String identityPath, String identityName, String agreementPath, String agreementName) {
            this.identityCardPath = identityPath;
            this.identityCardName = identityName;
            this.internshipAgreementPath = agreementPath;
            this.internshipAgreementName = agreementName;
        }
    }
}
