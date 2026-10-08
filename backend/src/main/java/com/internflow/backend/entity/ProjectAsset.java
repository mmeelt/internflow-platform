package com.internflow.backend.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "enterprise_project_assets")
public class ProjectAsset {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "enterprise_project_id", nullable = false)
    private EnterpriseProject project;

    @Column(name = "asset_type", nullable = false, length = 20)
    private String assetType;

    @Column(name = "original_name", nullable = false)
    private String originalName;

    @Column(name = "stored_name", nullable = false, unique = true)
    private String storedName;

    @Column(name = "content_type")
    private String contentType;

    @Column(name = "file_size", nullable = false)
    private long fileSize;

    @Column(name = "uploaded_at", nullable = false, updatable = false)
    private Instant uploadedAt = Instant.now();

    public Long getId() { return id; }
    public EnterpriseProject getProject() { return project; }
    public void setProject(EnterpriseProject project) { this.project = project; }
    public String getAssetType() { return assetType; }
    public void setAssetType(String assetType) { this.assetType = assetType; }
    public String getOriginalName() { return originalName; }
    public void setOriginalName(String originalName) { this.originalName = originalName; }
    public String getStoredName() { return storedName; }
    public void setStoredName(String storedName) { this.storedName = storedName; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public long getFileSize() { return fileSize; }
    public void setFileSize(long fileSize) { this.fileSize = fileSize; }
    public Instant getUploadedAt() { return uploadedAt; }
}
