package com.internflow.backend.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.internflow.backend.auth.AiChatRequest;
import com.internflow.backend.auth.AiChatResponse;
import com.internflow.backend.security.UserPrincipal;
import com.internflow.backend.service.AiService;
import com.internflow.backend.service.DocumentAiService;
import com.internflow.backend.service.ProjectReportAiService;
import com.internflow.backend.service.FeedbackDraftAiService;
import com.internflow.backend.service.SecurityRateLimiter;

@RestController
@RequestMapping("/api/ai")
public class AiController {
    private final AiService aiService;
    private final DocumentAiService documentAiService;
    private final ProjectReportAiService projectReportAiService;
    private final FeedbackDraftAiService feedbackDraftAiService;
    private final SecurityRateLimiter rateLimiter;

    public AiController(AiService aiService, DocumentAiService documentAiService,
                        ProjectReportAiService projectReportAiService, FeedbackDraftAiService feedbackDraftAiService,
                        SecurityRateLimiter rateLimiter) {
        this.aiService = aiService;
        this.documentAiService = documentAiService;
        this.projectReportAiService = projectReportAiService;
        this.feedbackDraftAiService = feedbackDraftAiService;
        this.rateLimiter = rateLimiter;
    }

    @PostMapping("/chat")
    public ResponseEntity<AiChatResponse> chat(
            @Valid @RequestBody AiChatRequest request,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest http
    ) {
        rateLimiter.require("ai-chat-user", principal.getId().toString(), 30, 900);
        rateLimiter.require("ai-chat-ip", rateLimiter.clientIp(http), 80, 900);
        return ResponseEntity.ok(aiService.answerGeneralQuestion(principal, request.message().trim()));
    }

    @PostMapping("/documents/{submissionId}/review")
    public ResponseEntity<AiChatResponse> reviewDocument(
            @org.springframework.web.bind.annotation.PathVariable Long submissionId,
            @AuthenticationPrincipal UserPrincipal principal, HttpServletRequest http
    ) {
        rateLimiter.require("ai-document-review-user", principal.getId().toString(), 10, 900);
        rateLimiter.require("ai-document-review-ip", rateLimiter.clientIp(http), 30, 900);
        return ResponseEntity.ok(documentAiService.review(submissionId, principal));
    }

    @PostMapping("/projects/{projectId}/chat")
    public ResponseEntity<AiChatResponse> projectReportChat(
            @org.springframework.web.bind.annotation.PathVariable Long projectId,
            @Valid @RequestBody AiChatRequest request,
            @AuthenticationPrincipal UserPrincipal principal, HttpServletRequest http
    ) {
        rateLimiter.require("ai-project-chat-user", principal.getId().toString(), 20, 900);
        rateLimiter.require("ai-project-chat-ip", rateLimiter.clientIp(http), 60, 900);
        return ResponseEntity.ok(projectReportAiService.answer(projectId, principal, request.message().trim()));
    }

    @PostMapping("/internships/{internshipId}/tasks/{taskId}/feedback-draft")
    public ResponseEntity<AiChatResponse> feedbackDraft(
            @org.springframework.web.bind.annotation.PathVariable Long internshipId,
            @org.springframework.web.bind.annotation.PathVariable Long taskId,
            @AuthenticationPrincipal UserPrincipal principal, HttpServletRequest http
    ) {
        rateLimiter.require("ai-feedback-draft-user", principal.getId().toString(), 12, 900);
        rateLimiter.require("ai-feedback-draft-ip", rateLimiter.clientIp(http), 35, 900);
        return ResponseEntity.ok(feedbackDraftAiService.draft(internshipId, taskId, principal));
    }
}
