package com.internflow.backend.service;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.internflow.backend.entity.EnterpriseProject;
import com.internflow.backend.entity.Internship;
import com.internflow.backend.entity.PendingProjectAssignment;
import com.internflow.backend.entity.User;
import com.internflow.backend.entity.enums.UserRole;
import com.internflow.backend.repository.EnterpriseProjectRepository;
import com.internflow.backend.repository.InternshipRepository;
import com.internflow.backend.repository.PendingProjectAssignmentRepository;
import com.internflow.backend.repository.UserRepository;

/**
 * Holds project assignments for people who have not registered yet.  This
 * deliberately stores an email and a project reference, never a password or
 * a provisional user account.
 */
@Service
public class PendingProjectAssignmentService {
    private final PendingProjectAssignmentRepository assignments;
    private final EnterpriseProjectRepository projects;
    private final InternshipRepository internships;
    private final UserRepository users;

    public PendingProjectAssignmentService(PendingProjectAssignmentRepository assignments,
                                           EnterpriseProjectRepository projects,
                                           InternshipRepository internships,
                                           UserRepository users) {
        this.assignments = assignments;
        this.projects = projects;
        this.internships = internships;
        this.users = users;
    }

    @Transactional
    public void remember(EnterpriseProject project, String name, String email, UserRole role, User user) {
        if (email == null || email.isBlank()) return;
        PendingProjectAssignment assignment = assignments.findByProjectIdAndRole(project.getId(), role)
                .orElseGet(PendingProjectAssignment::new);
        assignment.setProject(project);
        assignment.setEmail(email.trim().toLowerCase());
        assignment.setDisplayName(name == null || name.isBlank() ? null : name.trim());
        assignment.setRole(role);
        assignment.setUser(user);
        assignments.save(assignment);
    }

    @Transactional(readOnly = true)
    public boolean hasStudentAssignment(String email) {
        return email != null && assignments.existsByEmailIgnoreCaseAndRole(email.trim(), UserRole.student);
    }

    @Transactional(readOnly = true)
    public boolean hasStudentAssignmentForProject(Long projectId) {
        return assignments.existsByProjectIdAndRole(projectId, UserRole.student);
    }

    /** Attach a newly registered account to every matching pending assignment. */
    @Transactional
    public boolean claimAndFinalize(User user) {
        List<PendingProjectAssignment> matches = assignments.findByEmailIgnoreCaseAndRole(user.getEmail(), user.getRole());
        for (PendingProjectAssignment assignment : matches) {
            assignment.setUser(user);
            assignments.save(assignment);
            finalizeProject(assignment.getProject().getId());
        }
        return !matches.isEmpty();
    }

    /** Re-check assignments after an internship was created during registration. */
    @Transactional
    public void finalizeReadyAssignments() {
        // Reconcile from the verified account email as well as the stored
        // user_id. This covers either registration order and also repairs an
        // interrupted registration without ever creating a placeholder user.
        assignments.findAll().forEach(assignment -> {
            if (assignment.getUser() != null) return;
            users.findByEmail(assignment.getEmail())
                    .filter(user -> user.getRole() == assignment.getRole())
                    .ifPresent(user -> {
                        assignment.setUser(user);
                        assignments.save(assignment);
                    });
        });
        assignments.flush();
        assignments.findAll().stream()
                .map(assignment -> assignment.getProject().getId())
                .distinct()
                .forEach(this::finalizeProject);
    }

    private void finalizeProject(Long projectId) {
        EnterpriseProject project = projects.findById(projectId).orElse(null);
        if (project == null) return;
        var studentAssignment = assignments.findByProjectIdAndRole(projectId, UserRole.student).orElse(null);
        var supervisorAssignment = assignments.findByProjectIdAndRole(projectId, UserRole.supervisor).orElse(null);

        User student = studentAssignment == null ? null : studentAssignment.getUser();
        User supervisor = supervisorAssignment != null && supervisorAssignment.getUser() != null
                ? supervisorAssignment.getUser() : project.getSupervisor();

        if (supervisor != null) {
            project.setSupervisor(supervisor);
            project.setSupervisorName(supervisor.getName());
            projects.save(project);
        }
        if (studentAssignment == null && supervisorAssignment != null && supervisorAssignment.getUser() != null) {
            assignments.delete(supervisorAssignment);
            return;
        }
        if (student == null || supervisor == null) return;

        Internship internship = internships.findByInternId(student.getId()).stream()
                .findFirst().orElseGet(Internship::new);
        if (internship.getId() == null) {
            internship.setIntern(student);
            internship.setInternRole("Intern");
        }
        internship.setSupervisor(supervisor);
        internship.setEnterpriseProject(project);
        internship.setTitle(project.getTitle());
        internship.setDomain(project.getDomain());
        internship.setDescription(project.getDescription());
        internships.save(internship);

        if (studentAssignment != null) assignments.delete(studentAssignment);
        if (supervisorAssignment != null) assignments.delete(supervisorAssignment);
    }
}
