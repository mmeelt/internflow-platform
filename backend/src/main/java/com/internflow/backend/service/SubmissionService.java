package com.internflow.backend.service;

import com.internflow.backend.dto.SubmissionDto;
import com.internflow.backend.entity.Internship;
import com.internflow.backend.entity.Submission;
import com.internflow.backend.entity.Task;
import com.internflow.backend.entity.enums.SubmissionType;
import com.internflow.backend.entity.enums.NotificationType;
import com.internflow.backend.exception.ApiException;
import com.internflow.backend.repository.InternshipRepository;
import com.internflow.backend.repository.SubmissionRepository;
import com.internflow.backend.repository.TaskRepository;
import com.internflow.backend.repository.CoSupervisorAssignmentRepository;
import com.internflow.backend.security.UserPrincipal;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class SubmissionService {

    private final SubmissionRepository submissionRepository;
    private final TaskRepository taskRepository;
    private final InternshipRepository internshipRepository;
    private final NotificationService notificationService;
    private final CoSupervisorAssignmentRepository coSupervisorAssignmentRepository;
    private final FileSecurityValidator fileSecurityValidator;
    private final MalwareScanService malwareScanService;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    public SubmissionService(SubmissionRepository submissionRepository,
                             TaskRepository taskRepository,
                             InternshipRepository internshipRepository,
                             NotificationService notificationService,
                             CoSupervisorAssignmentRepository coSupervisorAssignmentRepository,
                             FileSecurityValidator fileSecurityValidator, MalwareScanService malwareScanService) {
        this.submissionRepository = submissionRepository;
        this.taskRepository = taskRepository;
        this.internshipRepository = internshipRepository;
        this.notificationService = notificationService;
        this.coSupervisorAssignmentRepository = coSupervisorAssignmentRepository;
        this.fileSecurityValidator = fileSecurityValidator;
        this.malwareScanService = malwareScanService;
    }

    @Transactional
    public SubmissionDto uploadSubmission(Long internshipId, Long taskId, MultipartFile file, UserPrincipal principal) {
        Task task = validateAccess(internshipId, taskId, principal, true);

        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename() != null ? file.getOriginalFilename() : "unnamed");
        String extension = fileSecurityValidator.validateSubmission(file);
        String uniqueFilename = UUID.randomUUID() + (extension.isEmpty() ? "" : "." + extension);

        try {
            Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
            Files.createDirectories(uploadPath);

            Path targetLocation = uploadPath.resolve(uniqueFilename);
            Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);
            try {
                malwareScanService.requireClean(targetLocation);
            } catch (RuntimeException exception) {
                Files.deleteIfExists(targetLocation);
                throw exception;
            }

            Submission submission = new Submission();
            submission.setTask(task);
            submission.setName(originalFilename);
            submission.setSize(formatSize(file.getSize()));
            submission.setType(determineType(extension));
            // Just store the relative path or a URL that could be served
            submission.setFilePath("/uploads/" + uniqueFilename);

            submission = submissionRepository.save(submission);
            notificationService.send(task.getInternship().getSupervisor().getId(), NotificationType.submission,
                    "New file submitted", task.getInternship().getIntern().getName() + " uploaded " + originalFilename + " for: " + task.getTitle());
            coSupervisorAssignmentRepository.findByInternshipId(internshipId).stream()
                    .filter(a -> "accepted".equalsIgnoreCase(a.getStatus()))
                    .forEach(a -> notificationService.send(a.getSupervisor().getId(), NotificationType.submission,
                            "New file submitted", task.getInternship().getIntern().getName() + " uploaded " + originalFilename + " for: " + task.getTitle()));
            return toDto(submission);

        } catch (IOException ex) {
            throw ApiException.internal("Could not store file " + originalFilename + ". Please try again!");
        }
    }

    @Transactional
    public void deleteSubmission(Long internshipId, Long taskId, Long submissionId, UserPrincipal principal) {
        validateAccess(internshipId, taskId, principal, true);

        Submission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> ApiException.notFound("Submission not found"));

        if (!submission.getTask().getId().equals(taskId)) {
            throw ApiException.notFound("Submission not found for this task");
        }

        // Delete from DB
        submissionRepository.delete(submission);
        
        // Delete from disk
        if (submission.getFilePath() != null && submission.getFilePath().startsWith("/uploads/")) {
            String filename = submission.getFilePath().substring("/uploads/".length());
            try {
                Path filePath = Paths.get(uploadDir).toAbsolutePath().normalize().resolve(filename);
                Files.deleteIfExists(filePath);
            } catch (IOException e) {
                // Ignore file delete errors for now
            }
        }
    }

    /** Returns a submitted file after verifying that the caller belongs to its internship. */
    @Transactional(readOnly = true)
    public DownloadFile downloadSubmission(Long internshipId, Long taskId, Long submissionId, UserPrincipal principal) {
        validateAccess(internshipId, taskId, principal, false);

        Submission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> ApiException.notFound("Submission not found"));
        if (!submission.getTask().getId().equals(taskId)) {
            throw ApiException.notFound("Submission not found for this task");
        }
        if (submission.getFilePath() == null || !submission.getFilePath().startsWith("/uploads/")) {
            throw ApiException.notFound("Submitted file is unavailable");
        }

        Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
        Path filePath = uploadPath.resolve(submission.getFilePath().substring("/uploads/".length())).normalize();
        if (!filePath.startsWith(uploadPath) || !Files.isRegularFile(filePath)) {
            throw ApiException.notFound("Submitted file is unavailable");
        }

        try {
            String contentType = Files.probeContentType(filePath);
            return new DownloadFile(Files.readAllBytes(filePath), submission.getName(), contentType);
        } catch (IOException ex) {
            throw ApiException.internal("Could not read the submitted file");
        }
    }

    public record DownloadFile(byte[] content, String filename, String contentType) {}

    private Task validateAccess(Long internshipId, Long taskId, UserPrincipal principal, boolean requireIntern) {
        Internship internship = internshipRepository.findById(internshipId)
                .orElseThrow(() -> ApiException.notFound("Internship not found"));
        
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> ApiException.notFound("Task not found"));

        if (!task.getInternship().getId().equals(internshipId)) {
            throw ApiException.notFound("Task not found");
        }

        boolean isIntern = internship.getIntern().getId().equals(principal.getId());
        boolean isSupervisor = internship.getSupervisor().getId().equals(principal.getId());
        boolean isAdmin = principal.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));

        if (requireIntern && !isIntern && !isAdmin) {
            throw ApiException.forbidden("Only the intern can modify submissions");
        } else if (!requireIntern && !isIntern && !isSupervisor && !internshipRepository.existsAcceptedCoSupervisor(internshipId, principal.getId()) && !isAdmin) {
            throw ApiException.forbidden("You do not have access to this task");
        }

        return task;
    }

    private String getExtension(String filename) {
        int dotIndex = filename.lastIndexOf('.');
        if (dotIndex > 0 && dotIndex < filename.length() - 1) {
            return filename.substring(dotIndex + 1).toLowerCase();
        }
        return "";
    }

    private SubmissionType determineType(String extension) {
        return switch (extension) {
            case "pdf" -> SubmissionType.pdf;
            case "jpg", "jpeg", "png", "gif" -> SubmissionType.image;
            case "mp4", "mov", "avi" -> SubmissionType.video;
            case "zip", "tar", "gz", "rar" -> SubmissionType.archive;
            case "java", "js", "ts", "py", "html", "css", "json" -> SubmissionType.code;
            default -> SubmissionType.file;
        };
    }

    private String formatSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        int exp = (int) (Math.log(bytes) / Math.log(1024));
        char pre = "KMGTPE".charAt(exp - 1);
        return String.format("%.1f %cB", bytes / Math.pow(1024, exp), pre);
    }

    private SubmissionDto toDto(Submission s) {
        return new SubmissionDto(
                s.getId(),
                s.getTask().getId(),
                s.getName(),
                s.getSize(),
                s.getType().name(),
                s.getFilePath(),
                s.getUploadedAt()
        );
    }
}
