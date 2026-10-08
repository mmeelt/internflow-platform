package com.internflow.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.internflow.backend.entity.enums.UserRole;
import com.internflow.backend.exception.ApiException;
import com.internflow.backend.repository.EnterpriseProjectRepository;
import com.internflow.backend.repository.ProjectAccessRequestRepository;
import com.internflow.backend.repository.UserRepository;

/**
 * Mandatory gate for future project-report RAG. Retrieval must call this before
 * it reads a file, queries Qdrant, or sends a chunk to any AI provider.
 */
@Service
public class ProjectAiAccessGuard {
    private final EnterpriseProjectRepository projects;
    private final ProjectAccessRequestRepository accessRequests;
    private final UserRepository users;

    public ProjectAiAccessGuard(EnterpriseProjectRepository projects,
                                ProjectAccessRequestRepository accessRequests,
                                UserRepository users) {
        this.projects = projects;
        this.accessRequests = accessRequests;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public void requireReportAccess(Long projectId, Long requesterId) {
        var project = projects.findById(projectId)
                .orElseThrow(() -> ApiException.notFound("Project not found"));
        var requester = users.findById(requesterId)
                .orElseThrow(() -> ApiException.unauthorized("Invalid user"));
        boolean owner = requester.getRole() == UserRole.supervisor
                && project.getSupervisor() != null
                && requesterId.equals(project.getSupervisor().getId());
        boolean approved = accessRequests.findByProjectIdAndRequesterIdAndAssetType(projectId, requesterId, "report")
                .map(request -> "approved".equals(request.getStatus()))
                .orElse(false);
        if (requester.getRole() != UserRole.admin && !owner && !approved) {
            throw ApiException.forbidden("Supervisor approval is required before AI can use this project report");
        }
    }
}
