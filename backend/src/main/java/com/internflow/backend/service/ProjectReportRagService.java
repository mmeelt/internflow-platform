package com.internflow.backend.service;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Private, project-scoped RAG. Its callers must perform user authorization
 * before calling this service; Qdrant filtering adds a second project boundary.
 */
@Service
public class ProjectReportRagService {
    private static final Logger log = LoggerFactory.getLogger(ProjectReportRagService.class);
    private static final int CHUNK_SIZE = 1_600;
    private static final int CHUNK_OVERLAP = 220;
    private final boolean enabled;
    private final GeminiEmbeddingProvider embeddings;
    private final QdrantReportStore store;
    private final DocumentTextExtractor extractor;

    public ProjectReportRagService(@Value("${ai.rag.enabled:true}") boolean enabled,
                                   GeminiEmbeddingProvider embeddings, QdrantReportStore store,
                                   DocumentTextExtractor extractor) {
        this.enabled = enabled;
        this.embeddings = embeddings;
        this.store = store;
        this.extractor = extractor;
    }

    public String retrieve(Long projectId, Path report, String reportName, String question) {
        if (!enabled || !embeddings.isConfigured() || !store.isConfigured()) return null;
        try {
            if (!store.hasProjectChunks(projectId)) index(projectId, report, reportName);
            List<String> matches = store.search(projectId, embeddings.queryEmbedding(question), 6);
            return matches.isEmpty() ? null : String.join("\n\n--- Retrieved report section ---\n", matches);
        } catch (AiProviderException exception) {
            log.warn("Private report retrieval unavailable: {}", exception.getMessage());
            return null;
        }
    }

    /** Called after a report upload and lazily for pre-existing protected reports. */
    public void index(Long projectId, Path report, String reportName) {
        if (!enabled || !embeddings.isConfigured() || !store.isConfigured()) return;
        try {
            String text = extractor.extract(report, reportName);
            List<QdrantReportStore.Chunk> chunks = new ArrayList<>();
            int position = 0;
            for (String chunk : split(text)) {
                chunks.add(new QdrantReportStore.Chunk(position++, chunk, embeddings.documentEmbedding(chunk)));
            }
            store.replaceProjectChunks(projectId, chunks);
        } catch (Exception exception) {
            // Uploads stay usable if an optional provider/vector index is offline.
            log.warn("Private report indexing unavailable: {}", exception.getMessage());
        }
    }

    /** Remove report embeddings when the source project is deleted. */
    public void remove(Long projectId) {
        if (!enabled || !store.isConfigured()) return;
        try {
            store.replaceProjectChunks(projectId, List.of());
        } catch (AiProviderException exception) {
            log.warn("Private report cleanup unavailable: {}", exception.getMessage());
        }
    }

    private List<String> split(String text) {
        List<String> chunks = new ArrayList<>();
        String normalized = text == null ? "" : text.trim();
        for (int start = 0; start < normalized.length(); start += CHUNK_SIZE - CHUNK_OVERLAP) {
            int end = Math.min(normalized.length(), start + CHUNK_SIZE);
            int boundary = normalized.lastIndexOf(' ', end);
            if (boundary > start + CHUNK_SIZE / 2) end = boundary;
            String chunk = normalized.substring(start, end).trim();
            if (!chunk.isBlank()) chunks.add(chunk);
            if (end >= normalized.length()) break;
        }
        return chunks;
    }
}
