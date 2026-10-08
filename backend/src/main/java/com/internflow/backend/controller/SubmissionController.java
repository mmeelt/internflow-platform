package com.internflow.backend.controller;

import com.internflow.backend.dto.SubmissionDto;
import com.internflow.backend.security.UserPrincipal;
import com.internflow.backend.service.SubmissionService;
import com.internflow.backend.service.SecurityRateLimiter;

import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/internships/{internshipId}/tasks/{taskId}/submissions")
public class SubmissionController {

    private final SubmissionService submissionService;
    private final SecurityRateLimiter rateLimiter;

    public SubmissionController(SubmissionService submissionService, SecurityRateLimiter rateLimiter) {
        this.submissionService = submissionService;
        this.rateLimiter = rateLimiter;
    }

    /** POST /api/internships/{internshipId}/tasks/{taskId}/submissions */
    @PostMapping
    public ResponseEntity<SubmissionDto> upload(@PathVariable Long internshipId,
                                                @PathVariable Long taskId,
                                                @RequestParam("file") MultipartFile file,
                                                @AuthenticationPrincipal UserPrincipal principal) {
        rateLimiter.require("submission-user", principal.getId().toString(), 10, 300);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(submissionService.uploadSubmission(internshipId, taskId, file, principal));
    }

    /** GET /api/internships/{internshipId}/tasks/{taskId}/submissions/{subId}/download */
    @GetMapping("/{subId}/download")
    public ResponseEntity<byte[]> download(@PathVariable Long internshipId,
                                           @PathVariable Long taskId,
                                           @PathVariable Long subId,
                                           @AuthenticationPrincipal UserPrincipal principal) {
        SubmissionService.DownloadFile file = submissionService.downloadSubmission(internshipId, taskId, subId, principal);
        MediaType contentType;
        try {
            contentType = file.contentType() == null ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(file.contentType());
        } catch (IllegalArgumentException ex) {
            contentType = MediaType.APPLICATION_OCTET_STREAM;
        }
        return ResponseEntity.ok()
                .contentType(contentType)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file.filename().replace("\"", "") + "\"")
                .body(file.content());
    }

    /** DELETE /api/internships/{internshipId}/tasks/{taskId}/submissions/{subId} */
    @DeleteMapping("/{subId}")
    public ResponseEntity<Void> delete(@PathVariable Long internshipId,
                                       @PathVariable Long taskId,
                                       @PathVariable Long subId,
                                       @AuthenticationPrincipal UserPrincipal principal) {
        submissionService.deleteSubmission(internshipId, taskId, subId, principal);
        return ResponseEntity.noContent().build();
    }
}
