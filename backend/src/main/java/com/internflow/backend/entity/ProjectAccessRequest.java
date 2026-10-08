package com.internflow.backend.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "project_access_requests",
       uniqueConstraints = @UniqueConstraint(columnNames = {"enterprise_project_id", "requester_id", "asset_type"}))
public class ProjectAccessRequest {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "enterprise_project_id", nullable = false)
    private EnterpriseProject project;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requester_id", nullable = false)
    private User requester;
    @Column(name = "asset_type", nullable = false, length = 20)
    private String assetType;
    @Column(length = 1000)
    private String message;
    @Column(nullable = false, length = 20)
    private String status = "pending";
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public EnterpriseProject getProject() { return project; }
    public void setProject(EnterpriseProject project) { this.project = project; }
    public User getRequester() { return requester; }
    public void setRequester(User requester) { this.requester = requester; }
    public String getAssetType() { return assetType; }
    public void setAssetType(String assetType) { this.assetType = assetType; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
}
