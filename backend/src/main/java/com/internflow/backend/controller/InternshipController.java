package com.internflow.backend.controller;

import com.internflow.backend.dto.InternshipDto;
import com.internflow.backend.dto.StudentRecordDto;
import com.internflow.backend.security.UserPrincipal;
import com.internflow.backend.service.InternshipService;
import com.internflow.backend.service.StudentRecordService;
import com.internflow.backend.service.InternshipService.CreateRequest;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/internships")
public class InternshipController {

    private final InternshipService internshipService;
    private final StudentRecordService studentRecordService;

    public InternshipController(InternshipService internshipService, StudentRecordService studentRecordService) {
        this.internshipService = internshipService;
        this.studentRecordService = studentRecordService;
    }

    /** GET /api/internships — returns internships visible to the current user */
    @GetMapping
    public ResponseEntity<List<InternshipDto>> list(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(internshipService.listForPrincipal(principal));
    }

    /** GET /api/internships/{id} */
    @GetMapping("/{id}")
    public ResponseEntity<InternshipDto> getOne(@PathVariable Long id,
                                                @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(internshipService.findById(id, principal));
    }

    @GetMapping("/{id}/student-record")
    public ResponseEntity<StudentRecordDto> studentRecord(@PathVariable Long id,
                                                           @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(studentRecordService.get(id, principal));
    }

    @GetMapping("/{id}/student-record/{documentType}/download")
    public ResponseEntity<byte[]> downloadStudentRecordDocument(@PathVariable Long id, @PathVariable String documentType,
                                                                 @AuthenticationPrincipal UserPrincipal principal) {
        StudentRecordService.DownloadFile file = studentRecordService.download(id, documentType, principal);
        MediaType type;
        try { type = file.contentType() == null ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(file.contentType()); }
        catch (IllegalArgumentException ignored) { type = MediaType.APPLICATION_OCTET_STREAM; }
        return ResponseEntity.ok()
                .contentType(type)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file.filename().replace("\"", "") + "\"")
                .body(file.bytes());
    }

    @PostMapping(path = "/{id}/student-record/signed-agreement", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<StudentRecordDto> uploadSignedAgreement(@PathVariable Long id, @RequestParam("file") MultipartFile file,
                                                                    @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(studentRecordService.uploadSignedAgreement(id, file, principal));
    }

    /** POST /api/internships — supervisor or admin creates an internship */
    @PostMapping
    public ResponseEntity<InternshipDto> create(@Valid @RequestBody CreateBody body,
                                                @AuthenticationPrincipal UserPrincipal principal) {
        CreateRequest req = new CreateRequest(
                body.internId(), body.supervisorId(), body.title(), body.domain(),
                body.description(), body.internRole(), body.startDate(), body.endDate()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(internshipService.create(req, principal));
    }

    /** PATCH /api/internships/{id}/progress */
    @PatchMapping("/{id}/progress")
    public ResponseEntity<InternshipDto> updateProgress(@PathVariable Long id,
                                                        @RequestBody ProgressBody body,
                                                        @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(internshipService.updateProgress(id, body.progress(), principal));
    }

    // ── Request bodies ────────────────────────────────────────────────────────

    public record CreateBody(
            @NotNull Long internId,
            Long supervisorId,       // optional — only used when caller is admin
            @NotBlank String title,
            String domain,
            String description,
            String internRole,
            LocalDate startDate,
            LocalDate endDate
    ) {}

    public record ProgressBody(int progress) {}
}
