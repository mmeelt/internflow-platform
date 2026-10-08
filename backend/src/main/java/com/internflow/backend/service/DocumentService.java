package com.internflow.backend.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.internflow.backend.dto.DocumentDto;
import com.internflow.backend.entity.Submission;
import com.internflow.backend.repository.SubmissionRepository;
import com.internflow.backend.security.UserPrincipal;

@Service
public class DocumentService {
    private final SubmissionRepository submissions;

    public DocumentService(SubmissionRepository submissions) { this.submissions = submissions; }

    /** Lists submissions visible only to the intern, primary supervisor, or accepted co-supervisor. */
    @Transactional(readOnly = true)
    public List<DocumentDto> list(UserPrincipal principal) {
        List<Submission> result = submissions.findVisibleToUser(principal.getId());
        return result.stream().map(this::toDto).toList();
    }

    private DocumentDto toDto(Submission submission) {
        var task = submission.getTask();
        var internship = task.getInternship();
        var intern = internship.getIntern();
        return new DocumentDto(submission.getId(), internship.getId(), task.getId(), task.getTitle(), task.getStatus(),
                intern.getId(), intern.getName(), intern.getAvatarColor(), submission.getName(), submission.getSize(),
                submission.getType().name(), submission.getUploadedAt());
    }
}
