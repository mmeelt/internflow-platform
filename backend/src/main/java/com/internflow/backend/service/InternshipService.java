package com.internflow.backend.service;

import com.internflow.backend.dto.CoSupervisorSummaryDto;
import com.internflow.backend.dto.InternshipDto;
import com.internflow.backend.dto.InternshipDto.UserRef;
import com.internflow.backend.entity.CoSupervisorAssignment;
import com.internflow.backend.entity.Internship;
import com.internflow.backend.entity.User;
import com.internflow.backend.entity.enums.UserRole;
import com.internflow.backend.exception.ApiException;
import com.internflow.backend.repository.CoSupervisorAssignmentRepository;
import com.internflow.backend.repository.InternshipRepository;
import com.internflow.backend.repository.UserRepository;
import com.internflow.backend.security.UserPrincipal;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class InternshipService {

    private final InternshipRepository internshipRepository;
    private final UserRepository userRepository;
    private final CoSupervisorAssignmentRepository coSupervisorRepo;
    private final InternshipProgressService progressService;
    private final PendingProjectAssignmentService pendingProjectAssignments;

    public InternshipService(InternshipRepository internshipRepository,
                             UserRepository userRepository,
                             CoSupervisorAssignmentRepository coSupervisorRepo,
                             InternshipProgressService progressService,
                             PendingProjectAssignmentService pendingProjectAssignments) {
        this.internshipRepository = internshipRepository;
        this.userRepository = userRepository;
        this.coSupervisorRepo = coSupervisorRepo;
        this.progressService = progressService;
        this.pendingProjectAssignments = pendingProjectAssignments;
    }

    // ── Queries ──────────────────────────────────────────────────────────────

    @Transactional
    public List<InternshipDto> listForPrincipal(UserPrincipal principal) {
        pendingProjectAssignments.finalizeReadyAssignments();
        List<Internship> internships;
        String role = principal.getAuthorities().iterator().next().getAuthority();

        if ("ROLE_ADMIN".equals(role)) {
            internships = internshipRepository.findAll();
        } else if ("ROLE_SUPERVISOR".equals(role)) {
            internships = internshipRepository.findReadableByUserId(principal.getId());
        } else {
            // A student sees an assigned project only after the administrator approves it.
            internships = internshipRepository.findByInternId(principal.getId()).stream()
                    .filter(internship -> internship.getEnterpriseProject() == null
                            || internship.getEnterpriseProject().isAvailableForStudentSelection())
                    .toList();
        }

        return internships.stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public InternshipDto findById(Long id, UserPrincipal principal) {
        Internship internship = internshipRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Internship not found"));
        checkReadAccess(internship, principal);
        return toDto(internship);
    }

    // ── Commands ─────────────────────────────────────────────────────────────

    @Transactional
    @PreAuthorize("hasAnyRole('SUPERVISOR','ADMIN')")
    public InternshipDto create(CreateRequest req, UserPrincipal principal) {
        User intern = userRepository.findById(req.internId())
                .orElseThrow(() -> ApiException.notFound("Intern not found"));
        User supervisor;

        if ("ROLE_ADMIN".equals(principal.getAuthorities().iterator().next().getAuthority())) {
            supervisor = userRepository.findById(req.supervisorId())
                    .orElseThrow(() -> ApiException.notFound("Supervisor not found"));
        } else {
            // supervisor always assigns themselves
            supervisor = userRepository.findById(principal.getId())
                    .orElseThrow(() -> ApiException.notFound("User not found"));
        }

        Internship internship = new Internship();
        internship.setIntern(intern);
        internship.setSupervisor(supervisor);
        internship.setTitle(req.title());
        internship.setDomain(req.domain());
        internship.setDescription(req.description());
        internship.setInternRole(req.internRole());
        internship.setStartDate(req.startDate());
        internship.setEndDate(req.endDate());

        return toDto(internshipRepository.save(internship));
    }

    @Transactional
    public InternshipDto updateProgress(Long id, int progress, UserPrincipal principal) {
        if (progress < 0 || progress > 100) {
            throw ApiException.badRequest("Progress must be between 0 and 100");
        }
        Internship internship = internshipRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Internship not found"));
        checkWriteAccess(internship, principal);
        // Progress is derived from completed tasks and cannot be overridden
        // manually. Keep this legacy endpoint compatible by returning the
        // current calculated value.
        return toDto(internship);
    }

    // ── Request record ────────────────────────────────────────────────────────

    public record CreateRequest(
            Long internId,
            Long supervisorId, // only used when caller is admin
            String title,
            String domain,
            String description,
            String internRole,
            LocalDate startDate,
            LocalDate endDate
    ) {}

    // ── Access checks ─────────────────────────────────────────────────────────

    private void checkReadAccess(Internship internship, UserPrincipal principal) {
        if (isAdmin(principal)) return;
        Long uid = principal.getId();
        if (internship.getIntern().getId().equals(uid) && internship.getEnterpriseProject() != null
                && !internship.getEnterpriseProject().isAvailableForStudentSelection()) {
            throw ApiException.forbidden("This project is awaiting admin approval");
        }
        if (!internship.getIntern().getId().equals(uid) && !internship.getSupervisor().getId().equals(uid)
                && !internshipRepository.existsAcceptedCoSupervisor(internship.getId(), uid)) {
            throw ApiException.forbidden("You do not have access to this internship");
        }
    }

    private void checkWriteAccess(Internship internship, UserPrincipal principal) {
        if (isAdmin(principal)) return;
        Long uid = principal.getId();
        if (!internship.getSupervisor().getId().equals(uid)) {
            throw ApiException.forbidden("Only the assigned supervisor may modify this internship");
        }
    }

    private boolean isAdmin(UserPrincipal principal) {
        return "ROLE_ADMIN".equals(principal.getAuthorities().iterator().next().getAuthority());
    }

    // ── Mapper ────────────────────────────────────────────────────────────────

    private InternshipDto toDto(Internship i) {
        List<CoSupervisorSummaryDto> coSups = coSupervisorRepo
                .findByInternshipId(i.getId())
                .stream()
                .map(this::toCoSupDto)
                .toList();

        return new InternshipDto(
                i.getId(),
                i.getTitle(),
                i.getDomain(),
                i.getDescription(),
                i.getInternRole(),
                i.getStartDate(),
                i.getEndDate(),
                progressService.calculate(i.getId()),
                i.getStatus(),
                toRef(i.getIntern()),
                toRef(i.getSupervisor()),
                i.getCreatedAt(),
                coSups
        );
    }

    private CoSupervisorSummaryDto toCoSupDto(CoSupervisorAssignment a) {
        User s = a.getSupervisor();
        return new CoSupervisorSummaryDto(
                s.getId(), s.getName(), s.getEmail(), s.getPhotoUrl(), s.getAvatarColor(), a.getStatus());
    }

    private UserRef toRef(User u) {
        return new UserRef(u.getId(), u.getName(), u.getPhotoUrl(), u.getAvatarColor());
    }
}
