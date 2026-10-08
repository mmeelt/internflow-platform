package com.internflow.backend.controller;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import com.internflow.backend.dto.CoSupervisorSummaryDto;
import com.internflow.backend.entity.CoSupervisorAssignment;
import com.internflow.backend.entity.Internship;
import com.internflow.backend.entity.User;
import com.internflow.backend.entity.enums.UserRole;
import com.internflow.backend.exception.ApiException;
import com.internflow.backend.repository.CoSupervisorAssignmentRepository;
import com.internflow.backend.repository.InternshipRepository;
import com.internflow.backend.repository.UserRepository;
import com.internflow.backend.security.UserPrincipal;
import com.internflow.backend.service.CoSupervisorService;

@RestController
@RequestMapping("/api/internships/{internshipId}/co-supervisors")
public class CoSupervisorController {

    private final CoSupervisorService service;
    private final CoSupervisorAssignmentRepository assignments;
    private final InternshipRepository internships;

    public CoSupervisorController(CoSupervisorService s,
                                   CoSupervisorAssignmentRepository a,
                                   InternshipRepository i) {
        service = s;
        assignments = a;
        internships = i;
    }

    /** GET — list all co-supervisor assignments for an internship.
     *  Accessible to the primary supervisor and admin only. */
    @GetMapping
    public ResponseEntity<List<CoSupervisorSummaryDto>> list(
            @PathVariable Long internshipId,
            @AuthenticationPrincipal UserPrincipal p) {

        Internship internship = internships.findById(internshipId)
                .orElseThrow(() -> ApiException.notFound("Internship not found"));

        // Only primary supervisor or admin may see the full invite list
        boolean isAdmin = p.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        if (!isAdmin && !internship.getSupervisor().getId().equals(p.getId())) {
            throw ApiException.forbidden("Only the primary supervisor may view co-supervisor assignments");
        }

        List<CoSupervisorSummaryDto> result = assignments.findByInternshipId(internshipId)
                .stream()
                .map(a -> {
                    User s = a.getSupervisor();
                    return new CoSupervisorSummaryDto(
                            s.getId(), s.getName(), s.getEmail(), s.getPhotoUrl(), s.getAvatarColor(), a.getStatus());
                })
                .toList();

        return ResponseEntity.ok(result);
    }

    /** POST /{supervisorId} — invite a co-supervisor (primary supervisor only). */
    @PostMapping("/{supervisorId}")
    public ResponseEntity<Void> invite(@PathVariable Long internshipId,
                                       @PathVariable Long supervisorId,
                                       @AuthenticationPrincipal UserPrincipal p) {
        service.invite(internshipId, supervisorId, p);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    /** PATCH /me — accept or decline an invitation (invited supervisor only). */
    @PatchMapping("/me")
    public ResponseEntity<Void> respond(@PathVariable Long internshipId,
                                        @RequestBody ResponseBody b,
                                        @AuthenticationPrincipal UserPrincipal p) {
        service.respond(internshipId, b.accept(), p);
        return ResponseEntity.noContent().build();
    }

    /** DELETE /{supervisorId} — remove a co-supervisor (primary supervisor only). */
    @DeleteMapping("/{supervisorId}")
    public ResponseEntity<Void> remove(@PathVariable Long internshipId,
                                       @PathVariable Long supervisorId,
                                       @AuthenticationPrincipal UserPrincipal p) {
        service.remove(internshipId, supervisorId, p);
        return ResponseEntity.noContent().build();
    }

    public record ResponseBody(boolean accept) {}
}
