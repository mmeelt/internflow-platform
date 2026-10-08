package com.internflow.backend.controller;

import com.internflow.backend.auth.AuthResponse.UserSummary;
import com.internflow.backend.dto.AdminInternDto;
import com.internflow.backend.entity.Internship;
import com.internflow.backend.repository.InternshipRepository;
import com.internflow.backend.repository.SubmissionRepository;
import com.internflow.backend.repository.TaskRepository;
import com.internflow.backend.service.AdminService;
import com.internflow.backend.service.InternshipProgressService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

/**
 * All endpoints here require ROLE_ADMIN — enforced both at the SecurityConfig
 * level (/api/admin/** → hasRole("ADMIN")) and with @PreAuthorize as defense-in-depth.
 */
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService         adminService;
    private final InternshipRepository internshipRepository;
    private final TaskRepository       taskRepository;
    private final SubmissionRepository submissionRepository;
    private final InternshipProgressService progressService;

    public AdminController(AdminService adminService,
                           InternshipRepository internshipRepository,
                           TaskRepository taskRepository,
                           SubmissionRepository submissionRepository,
                           InternshipProgressService progressService) {
        this.adminService         = adminService;
        this.internshipRepository = internshipRepository;
        this.taskRepository       = taskRepository;
        this.submissionRepository = submissionRepository;
        this.progressService = progressService;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/admin/users?status=Need+Review&page=0&size=20
    // Lists users, optionally filtered by status.
    // ─────────────────────────────────────────────────────────────────────────
    @GetMapping("/users")
    public ResponseEntity<Page<UserSummary>> listUsers(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(adminService.listUsers(status, page, size));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PATCH /api/admin/users/{id}/status
    // Approve ("Active") or reject ("Revoked") a user account.
    // ─────────────────────────────────────────────────────────────────────────
    @PatchMapping("/users/{id}/status")
    public ResponseEntity<UserSummary> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody StatusBody body) {
        return ResponseEntity.ok(adminService.updateStatus(id, body.status()));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/admin/interns
    // Returns ALL students that have been approved and assigned to an internship.
    // ─────────────────────────────────────────────────────────────────────────
    @GetMapping("/interns")
    public ResponseEntity<List<AdminInternDto>> listInterns() {
        List<AdminInternDto> interns = internshipRepository.findAll()
                .stream()
                .map(this::toAdminInternDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(interns);
    }

    @PatchMapping("/students/{studentId}/rating")
    public ResponseEntity<Double> rateStudent(@PathVariable Long studentId, @RequestBody RatingBody body) {
        return ResponseEntity.ok(adminService.rateStudent(studentId, body.rating()));
    }

    // ── Request bodies ────────────────────────────────────────────────────────

    public record StatusBody(@NotBlank String status) {}
    public record RatingBody(double rating) {}

    // ── Private helpers ───────────────────────────────────────────────────────

    private AdminInternDto toAdminInternDto(Internship i) {
        var intern      = i.getIntern();
        var supervisor  = i.getSupervisor();
        long iid        = i.getId();
        int  taskCount  = (int) taskRepository.countByInternshipId(iid);
        int  reviewed   = (int) taskRepository.countByInternshipIdAndStatus(iid, "reviewed");
        int  done       = (int) (taskRepository.countByInternshipIdAndStatus(iid, "done") + reviewed);
        int  subs       = (int) submissionRepository.countByTaskInternshipId(iid);

        return new AdminInternDto(
                intern.getId(),
                intern.getName(),
                intern.getEmail(),
                intern.getPhotoUrl(),
                intern.getAvatarColor(),
                intern.getStatus(),
                iid,
                i.getTitle(),
                i.getInternRole() != null ? i.getInternRole() : "Intern",
                progressService.calculate(iid),
                supervisor.getName(),
                supervisor.getEmail(),
                taskCount,
                reviewed,
                done,
                subs,
                intern.getAdminRating() == null ? null : intern.getAdminRating().doubleValue()
        );
    }
}
