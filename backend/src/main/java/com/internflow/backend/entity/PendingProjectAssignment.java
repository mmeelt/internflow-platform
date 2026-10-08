package com.internflow.backend.entity;

import jakarta.persistence.*;
import java.time.Instant;
import com.internflow.backend.entity.enums.UserRole;

@Entity
@Table(name = "pending_project_assignments", uniqueConstraints =
        @UniqueConstraint(name = "uq_pending_project_assignment_role", columnNames = { "project_id", "assignment_role" }))
public class PendingProjectAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private EnterpriseProject project;

    @Column(nullable = false)
    private String email;

    @Column(name = "display_name")
    private String displayName;

    @Enumerated(EnumType.STRING)
    @Column(name = "assignment_role", nullable = false)
    private UserRole role;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public EnterpriseProject getProject() { return project; }
    public void setProject(EnterpriseProject project) { this.project = project; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public UserRole getRole() { return role; }
    public void setRole(UserRole role) { this.role = role; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
}
