package com.internflow.backend.entity;

import jakarta.persistence.*;
import com.internflow.backend.entity.enums.TaskPriority;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "personal_calendar_tasks")
public class PersonalCalendarTask {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @Column(nullable = false) private String title;
    private String description;
    @Column(name = "start_date", nullable = false) private LocalDate startDate;
    @Column(name = "due_date") private LocalDate dueDate;
    private String category;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private TaskPriority priority = TaskPriority.medium;
    @Column(nullable = false) private String status = "todo";
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public User getStudent() { return student; }
    public void setStudent(User student) { this.student = student; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public TaskPriority getPriority() { return priority; }
    public void setPriority(TaskPriority priority) { this.priority = priority; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
}
