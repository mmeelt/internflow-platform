package com.internflow.backend.entity;

import jakarta.persistence.*;
import com.internflow.backend.entity.enums.SubmissionType;

import java.time.Instant;

@Entity
@Table(name = "submissions")
public class Submission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    @Column(nullable = false)
    private String name;

    private String size;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SubmissionType type = SubmissionType.file;

    @Column(name = "file_path")
    private String filePath;

    @Column(name = "uploaded_at", nullable = false, updatable = false)
    private Instant uploadedAt = Instant.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Task getTask() { return task; }
    public void setTask(Task task) { this.task = task; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getSize() { return size; }
    public void setSize(String size) { this.size = size; }
    public SubmissionType getType() { return type; }
    public void setType(SubmissionType type) { this.type = type; }
    public String getFilePath() { return filePath; }
    public void setFilePath(String filePath) { this.filePath = filePath; }
    public Instant getUploadedAt() { return uploadedAt; }
    public void setUploadedAt(Instant uploadedAt) { this.uploadedAt = uploadedAt; }
}
