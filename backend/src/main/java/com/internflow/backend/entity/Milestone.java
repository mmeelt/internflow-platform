package com.internflow.backend.entity;

import jakarta.persistence.*;

import java.time.LocalDate;

@Entity
@Table(name = "milestones")
public class Milestone {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "internship_id", nullable = false)
    private Internship internship;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String status = "pending";

    private LocalDate date;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Internship getInternship() { return internship; }
    public void setInternship(Internship internship) { this.internship = internship; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }
}
