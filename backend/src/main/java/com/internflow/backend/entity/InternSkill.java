package com.internflow.backend.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "intern_skills", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "skill"}))
public class InternSkill {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 100)
    private String skill;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public String getSkill() { return skill; }
    public void setSkill(String skill) { this.skill = skill; }
}
