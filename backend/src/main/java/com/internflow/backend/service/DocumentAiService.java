package com.internflow.backend.service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.internflow.backend.auth.AiChatResponse;
import com.internflow.backend.entity.Submission;
import com.internflow.backend.exception.ApiException;
import com.internflow.backend.repository.InternshipRepository;
import com.internflow.backend.repository.SubmissionRepository;
import com.internflow.backend.security.UserPrincipal;

/** Authorizes supervisor-only submission review before any file is read or sent to AI. */
@Service
public class DocumentAiService {
    private final SubmissionRepository submissions;
    private final InternshipRepository internships;
    private final DocumentTextExtractor textExtractor;
    private final AiService aiService;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    public DocumentAiService(SubmissionRepository submissions, InternshipRepository internships,
                             DocumentTextExtractor textExtractor, AiService aiService) {
        this.submissions = submissions;
        this.internships = internships;
        this.textExtractor = textExtractor;
        this.aiService = aiService;
    }

    @Transactional(readOnly = true)
    public AiChatResponse review(Long submissionId, UserPrincipal principal) {
        requireSupervisorOrAdmin(principal);
        Submission submission = submissions.findById(submissionId)
                .orElseThrow(() -> ApiException.notFound("Document not found"));
        var task = submission.getTask();
        var internship = task.getInternship();
        boolean owner = principal.getId().equals(internship.getSupervisor().getId());
        boolean coSupervisor = internships.existsAcceptedCoSupervisor(internship.getId(), principal.getId());
        if (!isAdmin(principal) && !owner && !coSupervisor) {
            throw ApiException.forbidden("You can only analyse documents submitted by your assigned interns");
        }

        Path file = storedFile(submission);
        try {
            String text = textExtractor.extract(file, submission.getName());
            return aiService.reviewSubmission(principal, submission.getName(), task.getTitle(), internship.getIntern().getName(), text);
        } catch (ApiException exception) {
            if (isScannedPdf(submission.getName(), exception)) {
                return aiService.reviewScannedPdf(principal, submission.getName(), task.getTitle(), internship.getIntern().getName(), file);
            }
            throw exception;
        }
    }

    private Path storedFile(Submission submission) {
        if (submission.getFilePath() == null || !submission.getFilePath().startsWith("/uploads/")) {
            throw ApiException.notFound("Document file is unavailable");
        }
        Path directory = Paths.get(uploadDir).toAbsolutePath().normalize();
        Path file = directory.resolve(submission.getFilePath().substring("/uploads/".length())).normalize();
        if (!file.startsWith(directory) || !Files.isRegularFile(file)) {
            throw ApiException.notFound("Document file is unavailable");
        }
        return file;
    }

    private void requireSupervisorOrAdmin(UserPrincipal principal) {
        if (!isAdmin(principal) && principal.getAuthorities().stream()
                .noneMatch(authority -> "ROLE_SUPERVISOR".equals(authority.getAuthority()))) {
            throw ApiException.forbidden("Only supervisors can use AI document review");
        }
    }

    private boolean isAdmin(UserPrincipal principal) {
        return principal.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }

    private boolean isScannedPdf(String name, ApiException exception) {
        return name != null && name.toLowerCase(java.util.Locale.ROOT).endsWith(".pdf")
                && exception.getMessage() != null && exception.getMessage().startsWith("No readable text was found");
    }
}
