package com.internflow.backend.service;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.internflow.backend.dto.EnterpriseProjectDto;
import com.internflow.backend.entity.EnterpriseProject;
import com.internflow.backend.exception.ApiException;
import com.internflow.backend.repository.EnterpriseProjectRepository;
import com.internflow.backend.repository.ProjectAssetRepository;
import com.internflow.backend.repository.ProjectAccessRequestRepository;
import com.internflow.backend.repository.UserRepository;
import com.internflow.backend.repository.ProjectRatingRepository;
import com.internflow.backend.repository.InternshipRepository;
import com.internflow.backend.repository.SupervisorProfileRepository;
import com.internflow.backend.entity.ProjectRating;
import com.internflow.backend.entity.enums.ImpactLevel;
import com.internflow.backend.entity.enums.UserRole;
import com.internflow.backend.security.UserPrincipal;
import com.internflow.backend.entity.ProjectAsset;
import com.internflow.backend.dto.ProjectAssetDto;
import com.internflow.backend.dto.ProjectAccessRequestDto;
import com.internflow.backend.entity.ProjectAccessRequest;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.beans.factory.annotation.Value;
import java.nio.file.*;
import java.io.IOException;
import java.util.UUID;
import java.time.Instant;
import com.internflow.backend.entity.User;

@Service
public class EnterpriseProjectService {
    private static final String AI_CENTRE_OF_EXCELLENCE = "AI Centre of Excellence";
    private static final String INDUSTRY_CENTRE_OF_EXCELLENCE = "Industry 4.0 Centre of Excellence";
    private final EnterpriseProjectRepository projects;
    private final ProjectAssetRepository assets;
    private final ProjectAccessRequestRepository accessRequests;
    private final UserRepository users;
    private final NotificationService notifications;
    private final ProjectRatingRepository ratings;
    private final FileSecurityValidator fileSecurityValidator;
    private final ProjectReportRagService reportRag;
    private final MalwareScanService malwareScanService;
    private final InternshipRepository internships;
    private final SupervisorProfileRepository supervisorProfiles;
    private final PendingProjectAssignmentService pendingAssignments;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    public EnterpriseProjectService(EnterpriseProjectRepository projects, ProjectAssetRepository assets,
                                    ProjectAccessRequestRepository accessRequests, UserRepository users,
                                    NotificationService notifications, ProjectRatingRepository ratings,
                                    FileSecurityValidator fileSecurityValidator, ProjectReportRagService reportRag,
                                    MalwareScanService malwareScanService, InternshipRepository internships,
                                    SupervisorProfileRepository supervisorProfiles,
                                    PendingProjectAssignmentService pendingAssignments) {
        this.projects = projects;
        this.assets = assets;
        this.accessRequests = accessRequests;
        this.users = users;
        this.notifications = notifications;
        this.ratings = ratings;
        this.fileSecurityValidator = fileSecurityValidator;
        this.reportRag = reportRag;
        this.malwareScanService = malwareScanService;
        this.internships = internships;
        this.supervisorProfiles = supervisorProfiles;
        this.pendingAssignments = pendingAssignments;
    }

    @Transactional(readOnly = true)
    public List<EnterpriseProjectDto> list(UserPrincipal principal) {
        return projects.findAllByOrderByIdDesc().stream()
                .filter(project -> isAdmin(principal)
                        || project.isVisibleInLibrary()
                        || (isSupervisor(principal) && project.getSupervisor() != null
                        && project.getSupervisor().getId().equals(principal.getId())))
                .map(this::dto).toList();
    }

    @Transactional(readOnly = true)
    public List<EnterpriseProjectDto> selectableForStudents(String axis) {
        // Centre of Excellence is a library search category, never an access
        // boundary. Every student can choose from every approved project.
        return projects.findAllByOrderByIdDesc().stream()
                .filter(EnterpriseProject::isAvailableForStudentSelection)
                .filter(project -> internships.findByEnterpriseProjectId(project.getId()).isEmpty())
                .filter(project -> !pendingAssignments.hasStudentAssignmentForProject(project.getId()))
                .map(this::dto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AssignmentUserDto> assignmentStudents() {
        return users.findAll().stream()
                .filter(user -> user.getRole() == UserRole.student)
                .map(user -> new AssignmentUserDto(user.getId(), user.getName(), user.getEmail()))
                .toList();
    }

    @Transactional(readOnly = true)
    public EnterpriseProjectDto get(Long id, UserPrincipal principal) {
        EnterpriseProject project = find(id);
        boolean related = hasRelatedInternshipAccess(project, principal);
        boolean pendingForStudent = isStudent(principal) && !project.isAvailableForStudentSelection();
        if (!isAdmin(principal) && (!project.isVisibleInLibrary() && !related || pendingForStudent)) {
            throw ApiException.forbidden("This project is awaiting admin approval");
        }
        return dto(project);
    }

    @Transactional
    public EnterpriseProjectDto updateVisibility(Long id, boolean visibleInLibrary, boolean availableForStudentSelection) {
        EnterpriseProject project = find(id);
        if (visibleInLibrary && !project.isAvailableForStudentSelection()) {
            throw ApiException.badRequest("Approve the project for student access before publishing it to the library");
        }
        project.setVisibleInLibrary(visibleInLibrary);
        project.setAvailableForStudentSelection(project.isAvailableForStudentSelection() || availableForStudentSelection);
        return dto(projects.save(project));
    }

    @Transactional
    public EnterpriseProjectDto approve(Long id) {
        EnterpriseProject project = find(id);
        var assignedInternship = internships.findByEnterpriseProjectId(id);
        boolean hasAssignedStudent = assignedInternship.isPresent();
        project.setAvailableForStudentSelection(true);
        EnterpriseProject approved = projects.save(project);
        if (approved.getSupervisor() != null) {
            notifications.send(approved.getSupervisor().getId(), com.internflow.backend.entity.enums.NotificationType.system,
                    "Project approved", "Your project '" + approved.getTitle()
                            + (hasAssignedStudent
                            ? "' is now available to its assigned student."
                            : "' is now available for student selection."));
        }
        // An assignment can exist before approval, but it must stay private
        // until an administrator approves the project. This is the first
        // point at which the assigned student is notified and can access it.
        assignedInternship.ifPresent(internship -> notifications.send(
                internship.getIntern().getId(),
                com.internflow.backend.entity.enums.NotificationType.system,
                "Project assigned",
                "Your supervisor assigned you to '" + approved.getTitle()
                        + "'. The administrator approved it, so it is now available in your workspace."
        ));
        return dto(approved);
    }

    @Transactional
    public EnterpriseProjectDto rate(Long id, Long userId, double rating) {
        if (rating < 0 || rating > 10) throw ApiException.badRequest("Rating must be between 0 and 10");
        EnterpriseProject project = find(id);
        var user = users.findById(userId).orElseThrow(() -> ApiException.unauthorized("Invalid user"));
        if (user.getRole() != UserRole.supervisor && user.getRole() != UserRole.admin) {
            throw ApiException.forbidden("Only administrators and supervisors can rate projects");
        }
        ProjectRating projectRating = ratings.findByProjectIdAndUserId(id, userId)
                .orElseGet(ProjectRating::new);
        projectRating.setProject(project);
        projectRating.setUser(user);
        projectRating.setRating(rating);
        projectRating.setUpdatedAt(Instant.now());
        ratings.save(projectRating);
        return dto(project);
    }

    @Transactional
    public EnterpriseProjectDto create(CreateRequest request, UserPrincipal principal) {
        if (request.title() == null || request.title().isBlank()) {
            throw ApiException.badRequest("Project title is required");
        }
        if (request.completionRate() < 0 || request.completionRate() > 100) {
            throw ApiException.badRequest("Completion rate must be between 0 and 100");
        }

        ImpactLevel impact;
        try {
            impact = ImpactLevel.valueOf(request.impact() == null ? "Medium" : request.impact());
        } catch (IllegalArgumentException error) {
            throw ApiException.badRequest("Impact must be High, Medium, or Low");
        }

        // Supervisors may only create projects under their own supervision.
        // Administrators can still choose or invite the responsible supervisor.
        User supervisor = isSupervisor(principal)
                ? users.findById(principal.getId())
                        .filter(user -> user.getRole() == UserRole.supervisor)
                        .orElseThrow(() -> ApiException.forbidden("Supervisor account not found"))
                : resolveExistingAssignee(request.supervisorId(), UserRole.supervisor, "supervisor");
        User intern = resolveExistingAssignee(request.internId(), UserRole.student, "student");
        boolean invitedSupervisor = hasCompleteInvitation(request.invitedSupervisorName(), request.invitedSupervisorEmail(), "supervisor");
        boolean invitedStudent = hasCompleteInvitation(request.invitedStudentName(), request.invitedStudentEmail(), "student");
        if (supervisor == null && !invitedSupervisor) {
            throw ApiException.badRequest("Choose a supervisor or add a new one");
        }

        EnterpriseProject project = new EnterpriseProject();
        project.setTitle(request.title().trim());
        project.setDescription(clean(request.description()));
        project.setDomain(clean(request.domain()));
        project.setYear(clean(request.year()));
        project.setInternName(intern != null ? intern.getName()
                : invitedStudent ? clean(request.invitedStudentName()) : clean(request.internName()));
        project.setSupervisor(supervisor);
        // Display name is a snapshot only; authorization uses supervisor_id.
        project.setSupervisorName(supervisor != null ? supervisor.getName() : clean(request.invitedSupervisorName()));
        project.setImpact(impact);
        project.setCompletionRate(request.completionRate());
        project.setMethodology(clean(request.methodology()));
        project.setResults(clean(request.results()));
        project.setHasCode(request.hasCode());
        project.setHasReport(request.hasReport());
        project.setHasVideo(request.hasVideo());
        project.setTech(cleanList(request.tech()));
        project.setKeyFindings(cleanList(request.keyFindings()));
        // A project created directly by an administrator is already approved.
        // A supervisor-created project remains pending until the admin approves it.
        project.setAvailableForStudentSelection(isAdmin(principal));
        EnterpriseProject saved = projects.save(project);
        if (isSupervisor(principal)) {
            users.findByRole(UserRole.admin).forEach(admin -> notifications.send(admin.getId(),
                    com.internflow.backend.entity.enums.NotificationType.system,
                    "Project awaiting approval", "Supervisor " + principal.getUsername()
                            + " submitted the project '" + saved.getTitle() + "' for approval."));
        }
        if (intern != null && supervisor != null) {
            var existingInternship = internships.findByInternId(intern.getId()).stream().findFirst();
            if (existingInternship.isPresent() && existingInternship.get().getEnterpriseProject() != null) {
                throw ApiException.badRequest("This student is already assigned to another project");
            }
            var internship = existingInternship.orElseGet(com.internflow.backend.entity.Internship::new);
            if (existingInternship.isEmpty()) {
                internship.setIntern(intern);
            }
            internship.setSupervisor(supervisor);
            internship.setEnterpriseProject(saved);
            internship.setTitle(saved.getTitle());
            internship.setDomain(saved.getDomain());
            internship.setDescription(saved.getDescription());
            internship.setInternRole("Intern");
            internships.save(internship);
        }
        // Do not create a disabled account for a person who has not registered.
        // Instead, store a pending email-to-project link. It is claimed only
        // after the person verifies their own account during registration.
        if (invitedStudent || (intern != null && supervisor == null)) {
            pendingAssignments.remember(saved,
                    intern != null ? intern.getName() : request.invitedStudentName(),
                    intern != null ? intern.getEmail() : request.invitedStudentEmail(),
                    UserRole.student, intern);
        }
        if (invitedSupervisor) {
            pendingAssignments.remember(saved,
                    supervisor != null ? supervisor.getName() : request.invitedSupervisorName(),
                    supervisor != null ? supervisor.getEmail() : request.invitedSupervisorEmail(),
                    UserRole.supervisor, supervisor);
        }
        return dto(saved);
    }

    @Transactional
    public void delete(Long id) {
        EnterpriseProject project = find(id);
        Path directory = Paths.get(uploadDir, "projects").toAbsolutePath().normalize();
        for (ProjectAsset asset : assets.findByProjectIdOrderByUploadedAtAsc(id)) {
            Path file = directory.resolve(asset.getStoredName()).normalize();
            if (file.startsWith(directory)) {
                try { Files.deleteIfExists(file); } catch (IOException ignored) {}
            }
        }
        // Remove dependent rows explicitly before deleting the project. This
        // works with both migrated databases and older local schemas whose
        // foreign keys were created without cascading deletes.
        accessRequests.deleteByProjectId(id);
        assets.deleteByProjectId(id);
        ratings.deleteByProjectId(id);
        reportRag.remove(id);
        projects.delete(project);
        projects.flush();
    }

    @Transactional
    public ProjectAssetDto uploadAsset(Long projectId, String type, MultipartFile file) {
        EnterpriseProject project = find(projectId);
        String validatedExtension = fileSecurityValidator.validateProjectAsset(type, file);

        String originalName = Paths.get(file.getOriginalFilename() == null ? "file" : file.getOriginalFilename()).getFileName().toString();
        String storedName = UUID.randomUUID() + "." + validatedExtension;
        Path projectDirectory = Paths.get(uploadDir, "projects").toAbsolutePath().normalize();
        Path target = projectDirectory.resolve(storedName).normalize();
        if (!target.startsWith(projectDirectory)) throw ApiException.badRequest("Invalid filename");
        try {
            Files.createDirectories(projectDirectory);
            file.transferTo(target);
            try {
                malwareScanService.requireClean(target);
            } catch (RuntimeException exception) {
                Files.deleteIfExists(target);
                throw exception;
            }
        } catch (IOException error) {
            throw ApiException.badRequest("Could not store project file");
        }

        ProjectAsset asset = new ProjectAsset();
        asset.setProject(project);
        asset.setAssetType(type);
        asset.setOriginalName(originalName);
        asset.setStoredName(storedName);
        asset.setContentType("video".equals(type) ? file.getContentType() : fileSecurityValidator.safeContentType(validatedExtension));
        asset.setFileSize(file.getSize());
        ProjectAsset saved = assets.save(asset);
        if ("report".equals(type)) reportRag.index(projectId, target, originalName);
        return assetDto(saved);
    }

    @Transactional(readOnly = true)
    public DownloadAsset downloadAsset(Long projectId, Long assetId, Long requesterId) {
        ProjectAsset asset = assets.findById(assetId).orElseThrow(() -> ApiException.notFound("Project file not found"));
        if (!asset.getProject().getId().equals(projectId)) throw ApiException.notFound("Project file not found");
        var requester = users.findById(requesterId).orElseThrow(() -> ApiException.unauthorized("Invalid user"));
        boolean admin = requester.getRole() == UserRole.admin;
        boolean projectOwner = requester.getRole() == UserRole.supervisor
                && asset.getProject().getSupervisor() != null
                && requesterId.equals(asset.getProject().getSupervisor().getId());
        boolean supervisorSharedAccess = requester.getRole() == UserRole.supervisor
                && ("report".equals(asset.getAssetType()) || "video".equals(asset.getAssetType()));
        boolean approved = accessRequests
                .findByProjectIdAndRequesterIdAndAssetType(projectId, requesterId, asset.getAssetType())
                .map(request -> "approved".equals(request.getStatus()))
                .orElse(false);
        if (!admin && !projectOwner && !supervisorSharedAccess && !approved) {
            throw ApiException.forbidden("Access to this project resource requires supervisor approval");
        }
        Path directory = Paths.get(uploadDir, "projects").toAbsolutePath().normalize();
        Path file = directory.resolve(asset.getStoredName()).normalize();
        if (!file.startsWith(directory) || !Files.isRegularFile(file)) throw ApiException.notFound("Project file not found");
        return new DownloadAsset(file, asset.getOriginalName(), asset.getContentType());
    }

    @Transactional(readOnly = true)
    public List<ProjectAccessRequestDto> accessRequests(Long projectId, Long requesterId) {
        find(projectId);
        return accessRequests.findByProjectIdAndRequesterId(projectId, requesterId).stream()
                .map(this::accessRequestDto).toList();
    }

    @Transactional
    public ProjectAccessRequestDto requestAccess(Long projectId, Long requesterId, String type, String message) {
        if (!List.of("report", "code", "video").contains(type)) {
            throw ApiException.badRequest("Access can only be requested for a report, source code, or demo video");
        }
        return accessRequests.findByProjectIdAndRequesterIdAndAssetType(projectId, requesterId, type)
                .map(this::accessRequestDto)
                .orElseGet(() -> {
                    ProjectAccessRequest request = new ProjectAccessRequest();
                    EnterpriseProject project = find(projectId);
                    var requester = users.findById(requesterId)
                            .orElseThrow(() -> ApiException.unauthorized("Invalid user"));
                    request.setProject(project);
                    request.setRequester(requester);
                    request.setAssetType(type);
                    request.setMessage(clean(message));
                    ProjectAccessRequest saved = accessRequests.save(request);
                    if (project.getSupervisor() != null) {
                        notifications.send(
                                project.getSupervisor().getId(),
                                com.internflow.backend.entity.enums.NotificationType.access,
                                "New document access request",
                                requester.getName() + " requested access to a protected project resource."
                        );
                    }
                    return accessRequestDto(saved);
                });
    }

    @Transactional(readOnly = true)
    public List<ProjectAccessRequestDto> supervisorAccessRequests(Long supervisorId) {
        return accessRequests.findByProject_Supervisor_IdAndStatusOrderByCreatedAtDesc(
                supervisorId, "pending").stream().map(this::accessRequestDto).toList();
    }

    @Transactional
    public ProjectAccessRequestDto decideAccessRequest(Long requestId, Long supervisorId, String status) {
        if (!List.of("approved", "denied").contains(status)) {
            throw ApiException.badRequest("Status must be approved or denied");
        }
        ProjectAccessRequest request = accessRequests.findById(requestId)
                .orElseThrow(() -> ApiException.notFound("Access request not found"));
        if (request.getProject().getSupervisor() == null
                || !supervisorId.equals(request.getProject().getSupervisor().getId())) {
            throw ApiException.forbidden("This request belongs to another supervisor");
        }
        request.setStatus(status);
        ProjectAccessRequest saved = accessRequests.save(request);
        String resource = switch (saved.getAssetType()) {
            case "report" -> "project report";
            case "code" -> "source code";
            default -> "demo video";
        };
        boolean approved = "approved".equals(status);
        notifications.send(saved.getRequester().getId(), com.internflow.backend.entity.enums.NotificationType.access,
                approved ? "Project access approved" : "Project access denied",
                "Your request for the " + resource + " of “" + saved.getProject().getTitle() + "” was "
                        + (approved ? "approved. You can now download it from the project library."
                                    : "denied by the project supervisor."));
        return accessRequestDto(saved);
    }

    private String clean(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private List<String> cleanList(List<String> values) {
        if (values == null) return List.of();
        return values.stream().filter(value -> value != null && !value.isBlank()).map(String::trim).distinct().toList();
    }

    private EnterpriseProject find(Long id) {
        return projects.findById(id).orElseThrow(() -> ApiException.notFound("Project not found"));
    }

    private boolean isAdmin(UserPrincipal principal) {
        return principal != null && principal.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }

    private boolean isSupervisor(UserPrincipal principal) {
        return principal != null && principal.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_SUPERVISOR".equals(authority.getAuthority()));
    }

    private boolean isStudent(UserPrincipal principal) {
        return principal != null && principal.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_STUDENT".equals(authority.getAuthority()));
    }

    private boolean hasRelatedInternshipAccess(EnterpriseProject project, UserPrincipal principal) {
        if (principal == null) return false;
        return internships.findByEnterpriseProjectId(project.getId()).map(internship ->
                internship.getIntern().getId().equals(principal.getId())
                        || internship.getSupervisor().getId().equals(principal.getId())
                        || (isSupervisor(principal)
                        && internships.existsAcceptedCoSupervisor(internship.getId(), principal.getId()))
        ).orElse(false);
    }

    private User resolveExistingAssignee(Long userId, UserRole role, String label) {
        if (userId == null) return null;
        return users.findById(userId)
                .filter(user -> user.getRole() == role)
                .orElseThrow(() -> ApiException.badRequest("Choose a valid " + label));
    }

    private boolean hasCompleteInvitation(String name, String email, String label) {
        boolean hasName = name != null && !name.isBlank();
        boolean hasEmail = email != null && !email.isBlank();
        if (!hasName && !hasEmail) return false;
        if (!hasName || !hasEmail) {
            throw ApiException.badRequest("Enter the new " + label + "'s full name and email");
        }
        String normalizedEmail = email.trim().toLowerCase();
        if (users.existsByEmail(normalizedEmail)) {
            throw ApiException.badRequest("This email already has an account. Choose the registered " + label + " from the list");
        }
        return true;
    }

    private EnterpriseProjectDto dto(EnterpriseProject p) {
        var internship = internships.findByEnterpriseProjectId(p.getId()).orElse(null);
        Long studentId = internship == null ? null : internship.getIntern().getId();
        String studentName = internship == null ? null : internship.getIntern().getName();
        Double studentRating = internship == null || internship.getIntern().getAdminRating() == null
                ? null : internship.getIntern().getAdminRating().doubleValue();
        return new EnterpriseProjectDto(
                p.getId(), p.getTitle(), p.getDescription(), p.getDomain(), p.getYear(),
                p.getInternName(), p.getSupervisorName(),
                p.getSupervisor() == null ? null : p.getSupervisor().getId(), supervisorAxis(p), p.getImpact().name(),
                p.getCompletionRate(), p.getMethodology(), p.getResults(),
                p.isHasCode(), p.isHasReport(), p.isHasVideo(),
                List.copyOf(p.getTech()), List.copyOf(p.getKeyFindings()),
                roundedAverage(p.getId()), ratings.countByProjectId(p.getId()),
                assets.findByProjectIdOrderByUploadedAtAsc(p.getId()).stream().map(this::assetDto).toList(),
                p.isVisibleInLibrary(), p.isAvailableForStudentSelection(),
                studentId, studentName, studentRating
        );
    }

    private Double roundedAverage(Long projectId) {
        Double average = ratings.averageByProjectId(projectId);
        return average == null ? null : Math.round(average * 10.0) / 10.0;
    }

    private String supervisorAxis(EnterpriseProject project) {
        if (project.getSupervisor() == null) return null;
        String axis = supervisorProfiles.findByUserId(project.getSupervisor().getId())
                .map(profile -> profile.getSpecialization())
                .orElse(null);
        return canonicalAxis(axis);
    }

    /** Keeps all project filtering tied to the two official Centre of Excellence values. */
    private String canonicalAxis(String axis) {
        if (axis == null || axis.isBlank()) return null;
        String normalized = axis.trim().replaceAll("\\s+", " ");
        if (AI_CENTRE_OF_EXCELLENCE.equalsIgnoreCase(normalized)) {
            return AI_CENTRE_OF_EXCELLENCE;
        }
        if (INDUSTRY_CENTRE_OF_EXCELLENCE.equalsIgnoreCase(normalized)) {
            return INDUSTRY_CENTRE_OF_EXCELLENCE;
        }
        return null;
    }

    private ProjectAssetDto assetDto(ProjectAsset asset) {
        return new ProjectAssetDto(asset.getId(), asset.getAssetType(), asset.getOriginalName(),
                asset.getContentType(), asset.getFileSize(), asset.getUploadedAt());
    }

    private ProjectAccessRequestDto accessRequestDto(ProjectAccessRequest request) {
        return new ProjectAccessRequestDto(request.getId(), request.getProject().getId(),
                request.getProject().getTitle(), request.getAssetType(), request.getMessage(),
                request.getStatus(), request.getCreatedAt(), request.getRequester().getName(),
                request.getRequester().getEmail());
    }

    public record CreateRequest(
            String title, String description, String domain, String year,
            String internName, Long supervisorId, Long internId,
            String invitedStudentName, String invitedStudentEmail,
            String invitedSupervisorName, String invitedSupervisorEmail,
            String impact, int completionRate,
            String methodology, String results, boolean hasCode, boolean hasReport,
            boolean hasVideo, List<String> tech, List<String> keyFindings
    ) {}

    public record DownloadAsset(Path path, String filename, String contentType) {}
    public record AssignmentUserDto(Long id, String name, String email) {}
}
