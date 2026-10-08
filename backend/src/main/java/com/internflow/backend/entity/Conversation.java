package com.internflow.backend.entity;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "conversations", uniqueConstraints = @UniqueConstraint(columnNames = {"participant_one_id", "participant_two_id"}))
public class Conversation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "participant_one_id", nullable = false)
    private User participantOne;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "participant_two_id", nullable = false)
    private User participantTwo;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getParticipantOne() { return participantOne; }
    public void setParticipantOne(User participantOne) { this.participantOne = participantOne; }
    public User getParticipantTwo() { return participantTwo; }
    public void setParticipantTwo(User participantTwo) { this.participantTwo = participantTwo; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
