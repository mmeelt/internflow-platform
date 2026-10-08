package com.internflow.backend.service;

import com.internflow.backend.auth.AuthResponse.UserSummary;
import com.internflow.backend.entity.User;
import com.internflow.backend.exception.ApiException;
import com.internflow.backend.repository.UserRepository;
import com.internflow.backend.repository.SupervisorProfileRepository;
import com.internflow.backend.entity.enums.NotificationType;
import com.internflow.backend.entity.enums.UserRole;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;
import java.math.BigDecimal;

@Service
public class AdminService {

    private static final Set<String> ALLOWED_STATUSES = Set.of("Active", "Revoked");

    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final SupervisorProfileRepository supervisorProfileRepository;

    public AdminService(UserRepository userRepository, NotificationService notificationService,
                        SupervisorProfileRepository supervisorProfileRepository) {
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.supervisorProfileRepository = supervisorProfileRepository;
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<UserSummary> listUsers(String status, int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw ApiException.badRequest("Page must be non-negative and size must be between 1 and 100");
        }
        size = Math.min(size, 100);
        Page<User> users = (status != null && !status.isBlank())
                ? userRepository.findByStatus(status, PageRequest.of(page, size))
                : userRepository.findAll(PageRequest.of(page, size));
        return users.map(this::toSummary);
    }

    // ── Commands ──────────────────────────────────────────────────────────────

    @Transactional
    public UserSummary updateStatus(Long userId, String newStatus) {
        if (!ALLOWED_STATUSES.contains(newStatus) && !"Need Review".equals(newStatus)) {
            throw ApiException.badRequest("Status must be one of: Active, Revoked, Need Review");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));
        if ("Active".equals(newStatus) && !user.isEmailVerified()) {
            throw ApiException.badRequest("The user must verify their email before approval");
        }
        user.setStatus(newStatus);
        User saved = userRepository.save(user);
        if ("Active".equals(newStatus)) {
            notificationService.send(saved.getId(), NotificationType.system, "Account approved", "Your " + saved.getRole().name() + " account has been approved. You can now sign in.");
        } else if ("Revoked".equals(newStatus)) {
            notificationService.send(saved.getId(), NotificationType.system, "Account denied", "Your account request has been denied. Please contact the administrator for more information.");
        }
        return toSummary(saved);
    }

    @Transactional
    public Double rateStudent(Long studentId, double rating) {
        if (!Double.isFinite(rating) || rating < 0 || rating > 10) {
            throw ApiException.badRequest("Rating must be between 0 and 10");
        }
        User student = userRepository.findById(studentId)
                .filter(user -> user.getRole() == UserRole.student)
                .orElseThrow(() -> ApiException.notFound("Student not found"));
        student.setAdminRating(BigDecimal.valueOf(rating));
        return userRepository.save(student).getAdminRating().doubleValue();
    }

    // ── Mapper ────────────────────────────────────────────────────────────────

    private UserSummary toSummary(User u) {
        String post = supervisorProfileRepository.findByUserId(u.getId())
                .map(profile -> profile.getPost())
                .orElse(null);
        return new UserSummary(u.getId(), u.getEmail(), u.getName(), u.getRole().name(), u.getStatus(), u.getPhotoUrl(), post);
    }
}
