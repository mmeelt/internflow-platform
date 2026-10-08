package com.internflow.backend.dto;

import java.util.List;

public record EnterpriseProjectDto(
        Long id,
        String title,
        String description,
        String domain,
        String year,
        String internName,
        String supervisorName,
        Long supervisorId,
        String supervisorAxis,
        String impact,
        int completionRate,
        String methodology,
        String results,
        boolean hasCode,
        boolean hasReport,
        boolean hasVideo,
        List<String> tech,
        List<String> keyFindings,
        Double supervisorRating,
        long ratingCount,
        List<ProjectAssetDto> assets,
        boolean visibleInLibrary,
        boolean availableForStudentSelection,
        Long studentId,
        String studentName,
        Double studentRating
) {}
