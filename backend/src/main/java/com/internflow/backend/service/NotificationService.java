package com.internflow.backend.service;

import com.internflow.backend.dto.NotificationDto;
import com.internflow.backend.entity.Notification;
import com.internflow.backend.entity.User;
import com.internflow.backend.entity.enums.NotificationType;
import com.internflow.backend.exception.ApiException;
import com.internflow.backend.repository.NotificationRepository;
import com.internflow.backend.repository.UserRepository;
import com.internflow.backend.security.UserPrincipal;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;

    public NotificationService(NotificationRepository notificationRepository, UserRepository userRepository,
                               EmailService emailService) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.emailService = emailService;
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<NotificationDto> listForUser(UserPrincipal principal, int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw ApiException.badRequest("Page must be non-negative and size must be between 1 and 100");
        }
        size = Math.min(size, 50); // cap page size
        return notificationRepository
                .findByUserIdOrderByCreatedAtDesc(principal.getId(), PageRequest.of(page, size))
                .map(this::toDto);
    }

    @Transactional(readOnly = true)
    public long countUnread(UserPrincipal principal) {
        return notificationRepository.countByUserIdAndReadFalse(principal.getId());
    }

    // ── Commands ──────────────────────────────────────────────────────────────

    @Transactional
    public NotificationDto markRead(Long notificationId, UserPrincipal principal) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> ApiException.notFound("Notification not found"));
        // ownership check — a user may only mark their own notifications
        if (!notification.getUser().getId().equals(principal.getId())) {
            throw ApiException.forbidden("Access denied");
        }
        notification.setRead(true);
        return toDto(notificationRepository.save(notification));
    }

    @Transactional
    public void markAllRead(UserPrincipal principal) {
        notificationRepository.markAllReadByUserId(principal.getId());
    }

    /**
     * Internal helper — called by other services to create notifications.
     * Never exposed as a public API endpoint.
     */
    @Transactional
    public void send(Long userId, NotificationType type, String title, String description) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.notFound("User not found"));
        Notification n = new Notification();
        n.setUser(user);
        n.setType(type);
        n.setTitle(title);
        n.setDescription(description);
        notificationRepository.save(n);
        sendEmailSafely(user, type, title);
    }

    private void sendEmailSafely(User user, NotificationType type, String title) {
        String summary = switch (type) {
            case submission -> "A student uploaded a document. It is waiting for your review.";
            case review -> "A student completed a task. It is waiting for your review.";
            case access -> title.toLowerCase().contains("request")
                    ? "A user submitted an access request that is waiting for your decision."
                    : "The status of your access request has been updated.";
            case feedback -> "New feedback is available in your workspace.";
            case deadline -> "A task or deadline has been assigned or updated.";
            case message -> "You received a new message in your workspace.";
            case milestone -> "An internship milestone has been updated.";
            case system -> {
                String normalizedTitle = title == null ? "" : title.trim().toLowerCase();
                if (normalizedTitle.equals("account approved")) {
                    yield user.getRole() == com.internflow.backend.entity.enums.UserRole.student
                            ? "Your student account has been approved. You can now sign in to Intern Portal and access your workspace."
                            : "Your account has been approved. You can now sign in to Intern Portal and access your workspace.";
                }
                if (normalizedTitle.equals("project assigned")) {
                    yield "An administrator approved your project assignment. Open Intern Portal to view the project details.";
                }
                yield normalizedTitle.contains("project awaiting approval")
                        ? "A supervisor submitted a project that is waiting for your approval."
                        : normalizedTitle.contains("awaiting approval")
                        ? "A new account needs your approval."
                        : "An important account or workspace request needs your attention.";
            }
        };
        try {
            emailService.sendImportantNotification(user.getEmail(), user.getName(), title, summary);
        } catch (RuntimeException exception) {
            // The business action and in-app notification remain successful if
            // the mail provider is temporarily unavailable.
            log.warn("Important notification email could not be delivered to user {}", user.getId());
        }
    }

    // ── Mapper ────────────────────────────────────────────────────────────────

    private NotificationDto toDto(Notification n) {
        return new NotificationDto(
                n.getId(),
                n.getType().name(),
                n.getTitle(),
                n.getDescription(),
                n.isRead(),
                n.getCreatedAt()
        );
    }
}
