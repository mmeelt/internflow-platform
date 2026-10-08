package com.internflow.backend.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.math.BigDecimal;

@Entity
@Table(name = "project_ratings",
        uniqueConstraints = @UniqueConstraint(columnNames = {"project_id", "user_id"}))
public class ProjectRating {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private EnterpriseProject project;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, precision = 3, scale = 1)
    private BigDecimal rating;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public Long getId() { return id; }
    public EnterpriseProject getProject() { return project; }
    public void setProject(EnterpriseProject project) { this.project = project; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public BigDecimal getRating() { return rating; }
    public void setRating(double rating) { this.rating = BigDecimal.valueOf(rating); }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
