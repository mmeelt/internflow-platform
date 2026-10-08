package com.internflow.backend.dto;

import java.time.LocalDate;
import java.util.List;

/** Full student-registration record. Returned only to an admin or an assigned supervisor. */
public record StudentRecordDto(
        Long studentId, String name, String email, String phone, String photoUrl, String bio,
        String university, String department, String year, String previousInternships,
        String enterprise, String subjectOfInternship, List<String> skills,
        String projectTitle, String projectDomain, LocalDate startDate, LocalDate endDate,
        String identityCardName, String internshipAgreementName, String signedInternshipAgreementName
) {}
