package com.internflow.backend.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "internships")
public class Internship {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "intern_id", nullable = false)
    private User intern;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "supervisor_id", nullable = false)
    private User supervisor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "enterprise_project_id")
    private EnterpriseProject enterpriseProject;

    @Column(nullable = false)
    private String title;

    private String domain;
    private String description;

    @Column(name = "role")
    private String internRole;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(nullable = false)
    private int progress = 0;

    @Column(nullable = false)
    private String status = "Active";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getIntern() { return intern; }
    public void setIntern(User intern) { this.intern = intern; }
    public User getSupervisor() { return supervisor; }
    public void setSupervisor(User supervisor) { this.supervisor = supervisor; }
    public EnterpriseProject getEnterpriseProject() { return enterpriseProject; }
    public void setEnterpriseProject(EnterpriseProject enterpriseProject) { this.enterpriseProject = enterpriseProject; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDomain() { return domain; }
    public void setDomain(String domain) { this.domain = domain; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getInternRole() { return internRole; }
    public void setInternRole(String internRole) { this.internRole = internRole; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public int getProgress() { return progress; }
    public void setProgress(int progress) { this.progress = progress; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
