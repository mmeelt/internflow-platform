package com.internflow.backend.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.internflow.backend.dto.DocumentDto;
import com.internflow.backend.security.UserPrincipal;
import com.internflow.backend.service.DocumentService;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {
    private final DocumentService documents;
    public DocumentController(DocumentService documents) { this.documents = documents; }

    @GetMapping
    public ResponseEntity<List<DocumentDto>> list(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(documents.list(principal));
    }
}
