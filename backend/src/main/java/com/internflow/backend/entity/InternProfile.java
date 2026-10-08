package com.internflow.backend.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "intern_profiles")
public class InternProfile {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    private String university;
    private String department;
    private String year;

    @Column(name = "previous_internships")
    private String previousInternships;

    private String enterprise;

    private String specialization;

    @Column(name = "subject_of_internship")
    private String subjectOfInternship;

    @Column(nullable = false)
    private int progress = 0;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public String getUniversity() { return university; }
    public void setUniversity(String university) { this.university = university; }
    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
    public String getYear() { return year; }
    public void setYear(String year) { this.year = year; }
    public String getPreviousInternships() { return previousInternships; }
    public void setPreviousInternships(String previousInternships) { this.previousInternships = previousInternships; }
    public String getEnterprise() { return enterprise; }
    public void setEnterprise(String enterprise) { this.enterprise = enterprise; }
    public String getSpecialization() { return specialization; }
    public void setSpecialization(String specialization) { this.specialization = specialization; }
    public String getSubjectOfInternship() { return subjectOfInternship; }
    public void setSubjectOfInternship(String subjectOfInternship) { this.subjectOfInternship = subjectOfInternship; }
    public int getProgress() { return progress; }
    public void setProgress(int progress) { this.progress = progress; }
}
