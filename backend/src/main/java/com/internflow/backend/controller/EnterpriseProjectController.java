package com.internflow.backend.controller;

import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import com.internflow.backend.dto.EnterpriseProjectDto;
import com.internflow.backend.service.EnterpriseProjectService;
import com.internflow.backend.dto.ProjectAssetDto;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.internflow.backend.security.UserPrincipal;
import com.internflow.backend.dto.ProjectAccessRequestDto;

@RestController
@RequestMapping("/api/projects")
public class EnterpriseProjectController {
    private final EnterpriseProjectService service;

    public EnterpriseProjectController(EnterpriseProjectService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<EnterpriseProjectDto>> list(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(service.list(principal));
    }

    @GetMapping("/selectable")
    public ResponseEntity<List<EnterpriseProjectDto>> selectableForStudents(
            @RequestParam(required = false) String axis) {
        return ResponseEntity.ok(service.selectableForStudents(axis));
    }

    @GetMapping("/assignees/students")
    @PreAuthorize("hasAnyRole('SUPERVISOR','ADMIN')")
    public ResponseEntity<List<EnterpriseProjectService.AssignmentUserDto>> assignmentStudents() {
        return ResponseEntity.ok(service.assignmentStudents());
    }

    @GetMapping("/{id}")
    public ResponseEntity<EnterpriseProjectDto> get(@PathVariable("id") Long id,
                                                     @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(service.get(id, principal));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPERVISOR','ADMIN')")
    public ResponseEntity<EnterpriseProjectDto> create(@RequestBody EnterpriseProjectService.CreateRequest body,
                                                         @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(body, principal));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable("id") Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/visibility")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<EnterpriseProjectDto> updateVisibility(@PathVariable Long id, @RequestBody VisibilityBody body) {
        return ResponseEntity.ok(service.updateVisibility(id, body.visibleInLibrary(), body.availableForStudentSelection()));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<EnterpriseProjectDto> approve(@PathVariable Long id) {
        return ResponseEntity.ok(service.approve(id));
    }

    @PostMapping(path = "/{id}/assets", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProjectAssetDto> uploadAsset(
            @PathVariable("id") Long id,
            @RequestParam("type") String type,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.uploadAsset(id, type, file));
    }

    @GetMapping("/{id}/assets/{assetId}")
    public ResponseEntity<FileSystemResource> downloadAsset(
            @PathVariable("id") Long id, @PathVariable("assetId") Long assetId,
            @AuthenticationPrincipal UserPrincipal principal) {
        EnterpriseProjectService.DownloadAsset asset = service.downloadAsset(id, assetId, principal.getId());
        MediaType mediaType;
        try {
            mediaType = asset.contentType() == null ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(asset.contentType());
        } catch (Exception ignored) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }
        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + asset.filename().replace("\"", "") + "\"")
                .body(new FileSystemResource(asset.path()));
    }

    @PatchMapping("/{id}/rating")
    @PreAuthorize("hasAnyRole('SUPERVISOR','ADMIN')")
    public ResponseEntity<EnterpriseProjectDto> rate(
            @PathVariable("id") Long id,
            @RequestBody RatingBody body,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(service.rate(id, principal.getId(), body.rating()));
    }

    @GetMapping("/{id}/access-requests/mine")
    public ResponseEntity<List<ProjectAccessRequestDto>> accessRequests(
            @PathVariable("id") Long id, @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(service.accessRequests(id, principal.getId()));
    }

    @PostMapping("/{id}/access-requests")
    public ResponseEntity<ProjectAccessRequestDto> requestAccess(
            @PathVariable("id") Long id, @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody AccessRequestBody body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.requestAccess(id, principal.getId(), body.assetType(), body.message()));
    }

    @GetMapping("/access-requests/supervisor")
    @PreAuthorize("hasRole('SUPERVISOR')")
    public ResponseEntity<List<ProjectAccessRequestDto>> supervisorAccessRequests(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(service.supervisorAccessRequests(principal.getId()));
    }

    @PatchMapping("/access-requests/{requestId}")
    @PreAuthorize("hasRole('SUPERVISOR')")
    public ResponseEntity<ProjectAccessRequestDto> decideAccessRequest(
            @PathVariable("requestId") Long requestId, @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody AccessDecisionBody body) {
        return ResponseEntity.ok(service.decideAccessRequest(requestId, principal.getId(), body.status()));
    }

    public record RatingBody(double rating) {}
    public record AccessRequestBody(String assetType, String message) {}
    public record AccessDecisionBody(String status) {}
    public record VisibilityBody(boolean visibleInLibrary, boolean availableForStudentSelection) {}
}
