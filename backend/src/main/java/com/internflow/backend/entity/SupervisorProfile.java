package com.internflow.backend.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "supervisor_profiles")
public class SupervisorProfile {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "user_id")
    private User user;

    private String organization;
    private String department;
    private String post;
    private String specialization;

    @Column(name = "other_encadrant_info")
    private String otherEncadrantInfo;

    @Column(name = "years_experience")
    private Integer yearsExperience = 0;

    @Column(name = "total_interns")
    private Integer totalInterns = 0;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public String getOrganization() { return organization; }
    public void setOrganization(String organization) { this.organization = organization; }
    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
    public String getPost() { return post; }
    public void setPost(String post) { this.post = post; }
    public String getSpecialization() { return specialization; }
    public void setSpecialization(String specialization) { this.specialization = specialization; }
    public String getOtherEncadrantInfo() { return otherEncadrantInfo; }
    public void setOtherEncadrantInfo(String otherEncadrantInfo) { this.otherEncadrantInfo = otherEncadrantInfo; }
    public Integer getYearsExperience() { return yearsExperience; }
    public void setYearsExperience(Integer yearsExperience) { this.yearsExperience = yearsExperience; }
    public Integer getTotalInterns() { return totalInterns; }
    public void setTotalInterns(Integer totalInterns) { this.totalInterns = totalInterns; }
}
