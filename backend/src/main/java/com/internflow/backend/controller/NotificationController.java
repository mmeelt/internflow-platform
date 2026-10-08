package com.internflow.backend.controller;

import com.internflow.backend.dto.NotificationDto;
import com.internflow.backend.security.UserPrincipal;
import com.internflow.backend.service.NotificationService;

import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    /**
     * GET /api/notifications?page=0&size=20
     * Returns a page of the current user's notifications, newest first.
     */
    @GetMapping
    public ResponseEntity<Page<NotificationDto>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(notificationService.listForUser(principal, page, size));
    }

    /**
     * GET /api/notifications/unread-count
     * Lightweight endpoint for the bell badge — returns {"count": N}.
     */
    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> unreadCount(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(Map.of("count", notificationService.countUnread(principal)));
    }

    /** PATCH /api/notifications/{id}/read */
    @PatchMapping("/{id}/read")
    public ResponseEntity<NotificationDto> markRead(@PathVariable Long id,
                                                    @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(notificationService.markRead(id, principal));
    }

    /** PATCH /api/notifications/read-all */
    @PatchMapping("/read-all")
    public ResponseEntity<Void> markAllRead(@AuthenticationPrincipal UserPrincipal principal) {
        notificationService.markAllRead(principal);
        return ResponseEntity.noContent().build();
    }
}
