package com.internflow.backend.dto;
import java.util.List;
public record ProfileDto(Long id, String name, String email, String role, String status, String phone, String photoUrl, String bio,
 String university, String department, String year, String previousInternships, String enterprise, String subjectOfInternship, List<String> skills,
 String organization, String post, String specialization, String otherEncadrantInfo, Integer yearsExperience, Integer totalInterns) {}
