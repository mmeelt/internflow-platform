package com.internflow.backend.service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Comparator;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.internflow.backend.auth.AiChatResponse;
import com.internflow.backend.entity.Submission;
import com.internflow.backend.exception.ApiException;
import com.internflow.backend.repository.InternshipRepository;
import com.internflow.backend.repository.SubmissionRepository;
import com.internflow.backend.repository.TaskRepository;
import com.internflow.backend.security.UserPrincipal;

/** Creates editable student-feedback drafts after verifying the assigned supervisor relationship. */
@Service
public class FeedbackDraftAiService {
    private static final int MAX_EVIDENCE_CHARS = 8_000;
    private final TaskRepository tasks;
    private final InternshipRepository internships;
    private final SubmissionRepository submissions;
    private final DocumentTextExtractor textExtractor;
    private final AiService aiService;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    public FeedbackDraftAiService(TaskRepository tasks, InternshipRepository internships,
                                  SubmissionRepository submissions, DocumentTextExtractor textExtractor,
                                  AiService aiService) {
        this.tasks = tasks;
        this.internships = internships;
        this.submissions = submissions;
        this.textExtractor = textExtractor;
        this.aiService = aiService;
    }

    @Transactional(readOnly = true)
    public AiChatResponse draft(Long internshipId, Long taskId, UserPrincipal principal) {
        var internship = internships.findById(internshipId)
                .orElseThrow(() -> ApiException.notFound("Internship not found"));
        var task = tasks.findById(taskId).orElseThrow(() -> ApiException.notFound("Task not found"));
        if (!task.getInternship().getId().equals(internshipId)) throw ApiException.notFound("Task not found");

        boolean primary = internship.getSupervisor() != null && principal.getId().equals(internship.getSupervisor().getId());
        boolean coSupervisor = internships.existsAcceptedCoSupervisor(internshipId, principal.getId());
        if (!isAdmin(principal) && !primary && !coSupervisor) {
            throw ApiException.forbidden("Only the assigned supervisor can draft feedback for this task");
        }

        List<Submission> taskSubmissions = submissions.findByTaskId(taskId);
        Submission newestReadable = taskSubmissions.stream()
                .filter(this::hasStoredFile)
                .max(Comparator.comparing(Submission::getUploadedAt))
                .orElse(null);
        String evidence = newestReadable == null ? "No readable submitted document is available." : readableText(newestReadable);
        String names = taskSubmissions.isEmpty() ? "No files submitted" : taskSubmissions.stream().map(Submission::getName).limit(8).reduce((a, b) -> a + ", " + b).orElse("");
        return aiService.draftStudentFeedback(principal, internship.getIntern().getName(), task.getTitle(),
                task.getDescription(), task.getProgress(), task.getStatus(), names, evidence);
    }

    private String readableText(Submission submission) {
        try {
            Path directory = Paths.get(uploadDir).toAbsolutePath().normalize();
            Path file = directory.resolve(submission.getFilePath().substring("/uploads/".length())).normalize();
            if (!file.startsWith(directory) || !Files.isRegularFile(file)) return "No readable submitted document is available.";
            String extracted = textExtractor.extract(file, submission.getName());
            if (extracted == null || extracted.isBlank()) return "No readable submitted document is available.";
            return extracted.length() <= MAX_EVIDENCE_CHARS
                    ? extracted
                    : extracted.substring(0, MAX_EVIDENCE_CHARS) + "\n\n[Document text truncated for a concise feedback draft.]";
        } catch (Exception ignored) {
            return "The submitted file could not be read as text. Base the draft only on the task information and file name.";
        }
    }

    private boolean hasStoredFile(Submission submission) {
        return submission.getFilePath() != null && submission.getFilePath().startsWith("/uploads/");
    }

    private boolean isAdmin(UserPrincipal principal) {
        return principal.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }
}
