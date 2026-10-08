package com.internflow.backend.controller;

import com.internflow.backend.auth.AuthResponse.UserSummary;
import com.internflow.backend.dto.SupervisorInternDto;
import com.internflow.backend.dto.SupervisorActivityDto;
import com.internflow.backend.dto.SupervisorDeadlineDto;
import com.internflow.backend.dto.CoSupervisionInvitationDto;
import com.internflow.backend.entity.Internship;
import com.internflow.backend.entity.User;
import com.internflow.backend.entity.enums.UserRole;
import com.internflow.backend.exception.ApiException;
import com.internflow.backend.repository.InternshipRepository;
import com.internflow.backend.repository.SubmissionRepository;
import com.internflow.backend.repository.TaskRepository;
import com.internflow.backend.repository.UserRepository;
import com.internflow.backend.repository.SupervisorProfileRepository;
import com.internflow.backend.repository.CoSupervisorAssignmentRepository;
import com.internflow.backend.security.UserPrincipal;
import com.internflow.backend.service.NotificationService;
import com.internflow.backend.service.InternshipProgressService;
import com.internflow.backend.service.PendingProjectAssignmentService;
import com.internflow.backend.entity.enums.NotificationType;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

@RestController
@RequestMapping("/api/supervisors")
@PreAuthorize("hasRole('SUPERVISOR')")
public class SupervisorController {

    private final UserRepository       userRepository;
    private final InternshipRepository internshipRepository;
    private final TaskRepository       taskRepository;
    private final SubmissionRepository submissionRepository;
    private final SupervisorProfileRepository supervisorProfileRepository;
    private final NotificationService notificationService;
    private final InternshipProgressService progressService;
    private final CoSupervisorAssignmentRepository coSupervisorAssignments;
    private final PendingProjectAssignmentService pendingProjectAssignments;

    public SupervisorController(UserRepository userRepository,
                                InternshipRepository internshipRepository,
                                TaskRepository taskRepository,
                                SubmissionRepository submissionRepository,
                                SupervisorProfileRepository supervisorProfileRepository,
                                NotificationService notificationService,
                                InternshipProgressService progressService,
                                CoSupervisorAssignmentRepository coSupervisorAssignments,
                                PendingProjectAssignmentService pendingProjectAssignments) {
        this.userRepository       = userRepository;
        this.internshipRepository = internshipRepository;
        this.taskRepository       = taskRepository;
        this.submissionRepository = submissionRepository;
        this.supervisorProfileRepository = supervisorProfileRepository;
        this.notificationService = notificationService;
        this.progressService = progressService;
        this.coSupervisorAssignments = coSupervisorAssignments;
        this.pendingProjectAssignments = pendingProjectAssignments;
    }

    @GetMapping("/co-supervision-invitations")
    public ResponseEntity<List<CoSupervisionInvitationDto>> getCoSupervisionInvitations(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(coSupervisorAssignments
                .findBySupervisorIdAndStatusOrderByCreatedAtDesc(principal.getId(), "pending")
                .stream()
                .map(assignment -> new CoSupervisionInvitationDto(
                        assignment.getInternship().getId(),
                        assignment.getInternship().getIntern().getName(),
                        assignment.getInternship().getTitle(),
                        assignment.getInternship().getSupervisor().getName(),
                        assignment.getCreatedAt()))
                .toList());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/supervisors
    // Returns all active supervisors — used by the co-supervisor picker dropdown.
    // ─────────────────────────────────────────────────────────────────────────
    @GetMapping
    public ResponseEntity<List<UserSummary>> getAllSupervisors() {
        List<UserSummary> result = userRepository
                .findByRoleAndStatus(UserRole.supervisor, "Active")
                .stream()
                .map(u -> new UserSummary(u.getId(), u.getEmail(), u.getName(),
                        u.getRole().name(), u.getStatus(), u.getPhotoUrl(), supervisorPost(u)))
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/supervisors/interns
    // Returns all interns assigned to the authenticated supervisor.
    // ─────────────────────────────────────────────────────────────────────────
    @GetMapping("/interns")
    @Transactional
    public ResponseEntity<List<SupervisorInternDto>> getMyInterns(
            @AuthenticationPrincipal UserPrincipal principal) {

        pendingProjectAssignments.finalizeReadyAssignments();

        List<SupervisorInternDto> result = internshipRepository
                .findReadableByUserId(principal.getId())
                .stream()
                .map(this::toInternDto)
                .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    @GetMapping("/activities/recent")
    public ResponseEntity<List<SupervisorActivityDto>> getRecentStudentActivity(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(submissionRepository
                .findRecentStudentActivityForSupervisor(principal.getId())
                .stream()
                .map(activity -> new SupervisorActivityDto(
                        activity.getId(), activity.getInternName(),
                        activity.getAction(), activity.getOccurredAt()))
                .toList());
    }

    @GetMapping("/deadlines/upcoming")
    public ResponseEntity<List<SupervisorDeadlineDto>> getUpcomingDeadlines(
            @AuthenticationPrincipal UserPrincipal principal) {
        LocalDate today = LocalDate.now();
        return ResponseEntity.ok(taskRepository.findUpcomingForSupervisor(principal.getId(), today)
                .stream()
                .limit(8)
                .map(task -> {
                    long days = ChronoUnit.DAYS.between(today, task.getDueDate());
                    String urgency = days <= 2 ? "high" : days <= 7 ? "medium" : "low";
                    return new SupervisorDeadlineDto(
                            task.getId(), task.getInternship().getId(), task.getTitle(),
                            task.getInternship().getIntern().getName(), task.getDueDate(), days, urgency);
                })
                .toList());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/supervisors/interns/pending
    // Returns all students awaiting review (status = "Need Review").
    // ─────────────────────────────────────────────────────────────────────────
    @GetMapping("/interns/pending")
    @Transactional
    public ResponseEntity<List<UserSummary>> getPendingStudents(
            @AuthenticationPrincipal UserPrincipal principal) {
        pendingProjectAssignments.finalizeReadyAssignments();
        List<UserSummary> pending = internshipRepository
                .findBySupervisorId(principal.getId())
                .stream()
                .map(Internship::getIntern)
                .filter(u -> isPendingReviewStatus(u.getStatus()))
                .map(u -> new UserSummary(u.getId(), u.getEmail(), u.getName(),
                        u.getRole().name(), u.getStatus(), u.getPhotoUrl(), null))
                .distinct()
                .collect(Collectors.toList());
        return ResponseEntity.ok(pending);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/supervisors/interns/{id}/approve
    // Approve a student and create an Internship record linking them to this supervisor.
    // ─────────────────────────────────────────────────────────────────────────
    @PostMapping("/interns/{id}/approve")
    @Transactional
    public ResponseEntity<UserSummary> approveStudent(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal) {

        User student = userRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Student not found"));

        if (student.getRole() != UserRole.student) {
            throw ApiException.badRequest("User is not a student");
        }
        if (!student.isEmailVerified()) {
            throw ApiException.badRequest("The student must verify their email before approval");
        }

        requireAssignedStudent(id, principal.getId());
        student.setStatus("Active");
        userRepository.save(student);
        notificationService.send(student.getId(), NotificationType.system,
                "Account approved", "Your supervisor approved your student account. You can now sign in.");

        return ResponseEntity.ok(new UserSummary(
                student.getId(), student.getEmail(), student.getName(),
                student.getRole().name(), student.getStatus(), student.getPhotoUrl(), null));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/supervisors/interns/{id}/reject
    // Reject a student's account.
    // ─────────────────────────────────────────────────────────────────────────
    @PostMapping("/interns/{id}/reject")
    @Transactional
    public ResponseEntity<UserSummary> rejectStudent(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal) {

        User student = userRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Student not found"));

        if (student.getRole() != UserRole.student) {
            throw ApiException.badRequest("User is not a student");
        }

        requireAssignedStudent(id, principal.getId());
        student.setStatus("Revoked");
        userRepository.save(student);
        notificationService.send(student.getId(), NotificationType.system,
                "Account denied", "Your student account request was denied.");

        return ResponseEntity.ok(new UserSummary(
                student.getId(), student.getEmail(), student.getName(),
                student.getRole().name(), student.getStatus(), student.getPhotoUrl(), null));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    private SupervisorInternDto toInternDto(Internship i) {
        User intern = i.getIntern();
        long internshipId   = i.getId();
        int  taskCount      = (int) taskRepository.countByInternshipId(internshipId);
        int  reviewedCount  = (int) taskRepository.countByInternshipIdAndStatus(internshipId, "reviewed");
        int  doneCount      = (int) (taskRepository.countByInternshipIdAndStatus(internshipId, "done")
                                   + reviewedCount);
        int  submissionCount = (int) submissionRepository.countByTaskInternshipId(internshipId);

        return new SupervisorInternDto(
                intern.getId(),
                intern.getName(),
                intern.getEmail(),
                intern.getPhotoUrl(),
                intern.getAvatarColor(),
                intern.getStatus(),
                internshipId,
                i.getTitle(),
                i.getInternRole() != null ? i.getInternRole() : "Intern",
                progressService.calculate(internshipId),
                i.getStatus(),
                taskCount,
                reviewedCount,
                doneCount,
                submissionCount
        );
    }

    private void requireAssignedStudent(Long studentId, Long supervisorId) {
        boolean assigned = internshipRepository.findBySupervisorId(supervisorId).stream()
                .anyMatch(internship -> internship.getIntern().getId().equals(studentId));
        if (!assigned) {
            throw ApiException.forbidden("You can only manage students assigned to you");
        }
    }

    private boolean isPendingReviewStatus(String status) {
        return status != null && "need review".equals(status.replace('_', ' ').trim().toLowerCase());
    }

    private String supervisorPost(User user) {
        return supervisorProfileRepository.findByUserId(user.getId())
                .map(profile -> profile.getPost())
                .orElse(null);
    }
}
