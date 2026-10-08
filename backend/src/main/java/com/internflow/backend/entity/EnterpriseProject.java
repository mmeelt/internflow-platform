package com.internflow.backend.entity;

import jakarta.persistence.*;
import com.internflow.backend.entity.enums.ImpactLevel;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "enterprise_projects")
public class EnterpriseProject {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    private String description;
    private String domain;
    private String year;

    @Column(name = "intern_name")
    private String internName;

    @Column(name = "supervisor_name")
    private String supervisorName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supervisor_id", foreignKey = @ForeignKey(name = "fk_enterprise_project_supervisor"))
    private User supervisor;

    @Enumerated(EnumType.STRING)
    private ImpactLevel impact = ImpactLevel.Medium;

    @Column(name = "completion_rate")
    private int completionRate = 0;

    private String methodology;
    private String results;

    @Column(name = "has_code", nullable = false)
    private boolean hasCode = false;

    @Column(name = "has_report", nullable = false)
    private boolean hasReport = false;

    @Column(name = "has_video", nullable = false)
    private boolean hasVideo = false;

    @ElementCollection
    @CollectionTable(name = "enterprise_project_tech", joinColumns = @JoinColumn(name = "enterprise_project_id"))
    @Column(name = "tech")
    private List<String> tech = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "enterprise_project_key_findings", joinColumns = @JoinColumn(name = "enterprise_project_id"))
    @Column(name = "finding")
    @OrderColumn(name = "order_index")
    private List<String> keyFindings = new ArrayList<>();

    @Column(name = "supervisor_rating", columnDefinition = "numeric(3,1)")
    private Double supervisorRating;

    @Column(name = "visible_in_library", nullable = false)
    private boolean visibleInLibrary = false;

    @Column(name = "available_for_student_selection", nullable = false)
    private boolean availableForStudentSelection = false;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getDomain() { return domain; }
    public void setDomain(String domain) { this.domain = domain; }
    public String getYear() { return year; }
    public void setYear(String year) { this.year = year; }
    public String getInternName() { return internName; }
    public void setInternName(String internName) { this.internName = internName; }
    public String getSupervisorName() { return supervisorName; }
    public void setSupervisorName(String supervisorName) { this.supervisorName = supervisorName; }
    public User getSupervisor() { return supervisor; }
    public void setSupervisor(User supervisor) { this.supervisor = supervisor; }
    public ImpactLevel getImpact() { return impact; }
    public void setImpact(ImpactLevel impact) { this.impact = impact; }
    public int getCompletionRate() { return completionRate; }
    public void setCompletionRate(int completionRate) { this.completionRate = completionRate; }
    public String getMethodology() { return methodology; }
    public void setMethodology(String methodology) { this.methodology = methodology; }
    public String getResults() { return results; }
    public void setResults(String results) { this.results = results; }
    public boolean isHasCode() { return hasCode; }
    public void setHasCode(boolean hasCode) { this.hasCode = hasCode; }
    public boolean isHasReport() { return hasReport; }
    public void setHasReport(boolean hasReport) { this.hasReport = hasReport; }
    public boolean isHasVideo() { return hasVideo; }
    public void setHasVideo(boolean hasVideo) { this.hasVideo = hasVideo; }
    public List<String> getTech() { return tech; }
    public void setTech(List<String> tech) { this.tech = tech; }
    public List<String> getKeyFindings() { return keyFindings; }
    public void setKeyFindings(List<String> keyFindings) { this.keyFindings = keyFindings; }
    public Double getSupervisorRating() { return supervisorRating; }
    public void setSupervisorRating(Double supervisorRating) { this.supervisorRating = supervisorRating; }
    public boolean isVisibleInLibrary() { return visibleInLibrary; }
    public void setVisibleInLibrary(boolean visibleInLibrary) { this.visibleInLibrary = visibleInLibrary; }
    public boolean isAvailableForStudentSelection() { return availableForStudentSelection; }
    public void setAvailableForStudentSelection(boolean availableForStudentSelection) { this.availableForStudentSelection = availableForStudentSelection; }
}
