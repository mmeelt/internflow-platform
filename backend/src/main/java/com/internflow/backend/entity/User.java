package com.internflow.backend.entity;

import jakarta.persistence.*;
import com.internflow.backend.entity.enums.UserRole;

import java.time.Instant;
import java.math.BigDecimal;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserRole role;

    @Column(nullable = false)
    private String name;

    private String phone;

    @Column(name = "photo_url")
    private String photoUrl;

    @Column(name = "identity_card_path")
    private String identityCardPath;

    @Column(name = "identity_card_name")
    private String identityCardName;

    @Column(name = "internship_agreement_path")
    private String internshipAgreementPath;

    @Column(name = "internship_agreement_name")
    private String internshipAgreementName;

    @Column(name = "signed_internship_agreement_path")
    private String signedInternshipAgreementPath;

    @Column(name = "signed_internship_agreement_name")
    private String signedInternshipAgreementName;

    @Column(name = "avatar_color")
    private String avatarColor;

    private String bio;

    @Column(name = "admin_rating")
    private BigDecimal adminRating;

    @Column(nullable = false)
    private String status = "Active";

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified;

    @Column(name = "password_changed_at")
    private Instant passwordChangedAt;

    @Column(name = "session_version", nullable = false)
    private int sessionVersion;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public UserRole getRole() { return role; }
    public void setRole(UserRole role) { this.role = role; }
    /**
     * User names are displayed consistently everywhere they are returned by
     * the API, including older rows that were entered in lower or upper case.
     */
    public String getName() { return formatDisplayName(name); }
    public void setName(String name) { this.name = formatDisplayName(name); }

    private static String formatDisplayName(String value) {
        if (value == null || value.isBlank()) return value;
        String normalized = value.trim().replaceAll("\\s+", " ").toLowerCase(java.util.Locale.ROOT);
        StringBuilder formatted = new StringBuilder(normalized.length());
        boolean startOfPart = true;
        for (int index = 0; index < normalized.length(); index++) {
            char character = normalized.charAt(index);
            if (Character.isLetter(character)) {
                formatted.append(startOfPart ? Character.toTitleCase(character) : character);
                startOfPart = false;
            } else {
                formatted.append(character);
                startOfPart = character == ' ' || character == '-' || character == '\'';
            }
        }
        return formatted.toString();
    }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getPhotoUrl() { return photoUrl; }
    public void setPhotoUrl(String photoUrl) { this.photoUrl = photoUrl; }
    public String getIdentityCardPath() { return identityCardPath; }
    public void setIdentityCardPath(String identityCardPath) { this.identityCardPath = identityCardPath; }
    public String getIdentityCardName() { return identityCardName; }
    public void setIdentityCardName(String identityCardName) { this.identityCardName = identityCardName; }
    public String getInternshipAgreementPath() { return internshipAgreementPath; }
    public void setInternshipAgreementPath(String internshipAgreementPath) { this.internshipAgreementPath = internshipAgreementPath; }
    public String getInternshipAgreementName() { return internshipAgreementName; }
    public void setInternshipAgreementName(String internshipAgreementName) { this.internshipAgreementName = internshipAgreementName; }
    public String getSignedInternshipAgreementPath() { return signedInternshipAgreementPath; }
    public void setSignedInternshipAgreementPath(String signedInternshipAgreementPath) { this.signedInternshipAgreementPath = signedInternshipAgreementPath; }
    public String getSignedInternshipAgreementName() { return signedInternshipAgreementName; }
    public void setSignedInternshipAgreementName(String signedInternshipAgreementName) { this.signedInternshipAgreementName = signedInternshipAgreementName; }
    public String getAvatarColor() { return avatarColor; }
    public void setAvatarColor(String avatarColor) { this.avatarColor = avatarColor; }
    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }
    public BigDecimal getAdminRating() { return adminRating; }
    public void setAdminRating(BigDecimal adminRating) { this.adminRating = adminRating; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public boolean isEmailVerified() { return emailVerified; }
    public void setEmailVerified(boolean emailVerified) { this.emailVerified = emailVerified; }
    public Instant getPasswordChangedAt() { return passwordChangedAt; }
    public void setPasswordChangedAt(Instant passwordChangedAt) { this.passwordChangedAt = passwordChangedAt; }
    public int getSessionVersion() { return sessionVersion; }
    public void setSessionVersion(int sessionVersion) { this.sessionVersion = sessionVersion; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
