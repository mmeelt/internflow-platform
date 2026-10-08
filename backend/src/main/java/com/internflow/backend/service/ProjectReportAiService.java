package com.internflow.backend.service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.internflow.backend.auth.AiChatResponse;
import com.internflow.backend.entity.ProjectAsset;
import com.internflow.backend.exception.ApiException;
import com.internflow.backend.repository.EnterpriseProjectRepository;
import com.internflow.backend.repository.ProjectAssetRepository;
import com.internflow.backend.security.UserPrincipal;

/** Answers from a project report only after ProjectAiAccessGuard permits report access. */
@Service
public class ProjectReportAiService {
    private final ProjectAiAccessGuard accessGuard;
    private final EnterpriseProjectRepository projects;
    private final ProjectAssetRepository assets;
    private final DocumentTextExtractor textExtractor;
    private final ProjectReportRagService reportRag;
    private final AiService aiService;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    public ProjectReportAiService(ProjectAiAccessGuard accessGuard, EnterpriseProjectRepository projects,
                                  ProjectAssetRepository assets, DocumentTextExtractor textExtractor,
                                  ProjectReportRagService reportRag, AiService aiService) {
        this.accessGuard = accessGuard;
        this.projects = projects;
        this.assets = assets;
        this.textExtractor = textExtractor;
        this.reportRag = reportRag;
        this.aiService = aiService;
    }

    @Transactional(readOnly = true)
    public AiChatResponse answer(Long projectId, UserPrincipal principal, String question) {
        // This is intentionally the first operation: no metadata, file, vector, or provider access before authorization.
        accessGuard.requireReportAccess(projectId, principal.getId());
        var project = projects.findById(projectId).orElseThrow(() -> ApiException.notFound("Project not found"));
        ProjectAsset report = assets.findByProjectIdOrderByUploadedAtAsc(projectId).stream()
                .filter(asset -> "report".equals(asset.getAssetType()))
                .reduce((first, latest) -> latest)
                .orElseThrow(() -> ApiException.notFound("This project has no PDF report to analyse"));
        Path file = reportPath(report);
        String retrievedText = reportRag.retrieve(projectId, file, report.getOriginalName(), question);
        if (retrievedText != null) {
            return aiService.answerProjectReportQuestion(principal, project.getTitle(), project.getDescription(),
                    project.getMethodology(), project.getResults(), report.getOriginalName(), retrievedText, question);
        }
        try {
            String reportText = textExtractor.extract(file, report.getOriginalName());
            return aiService.answerProjectReportQuestion(principal, project.getTitle(), project.getDescription(),
                    project.getMethodology(), project.getResults(), report.getOriginalName(), reportText, question);
        } catch (ApiException exception) {
            if (isScannedPdf(report.getOriginalName(), exception)) {
                return aiService.answerScannedProjectReportQuestion(principal, project.getTitle(), project.getDescription(),
                        project.getMethodology(), project.getResults(), report.getOriginalName(), file, question);
            }
            throw exception;
        }
    }

    private Path reportPath(ProjectAsset report) {
        Path directory = Paths.get(uploadDir, "projects").toAbsolutePath().normalize();
        Path file = directory.resolve(report.getStoredName()).normalize();
        if (!file.startsWith(directory) || !Files.isRegularFile(file)) {
            throw ApiException.notFound("Project report file is unavailable");
        }
        return file;
    }

    private boolean isScannedPdf(String name, ApiException exception) {
        return name != null && name.toLowerCase(java.util.Locale.ROOT).endsWith(".pdf")
                && exception.getMessage() != null && exception.getMessage().startsWith("No readable text was found");
    }
}
