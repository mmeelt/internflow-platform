package com.internflow.backend.repository;

import com.internflow.backend.entity.Milestone;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MilestoneRepository extends JpaRepository<Milestone, Long> {
    List<Milestone> findByInternshipId(Long internshipId);
}
