package com.internflow.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Private Qdrant collection. Every query includes a project-id filter as a second authorization boundary. */
@Component
public class QdrantReportStore {
    private static final String COLLECTION = "protected_project_reports";
    private static final int DIMENSIONS = 768;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final String baseUrl;
    private volatile boolean collectionReady;

    public QdrantReportStore(@Value("${ai.rag.qdrant-url:http://qdrant:6333}") String baseUrl) {
        this.baseUrl = baseUrl == null ? "" : baseUrl.replaceAll("/+$", "");
    }

    public boolean isConfigured() { return !baseUrl.isBlank(); }

    public boolean hasProjectChunks(Long projectId) throws AiProviderException {
        ensureCollection();
        ObjectNode request = mapper.createObjectNode();
        request.set("filter", projectFilter(projectId));
        JsonNode result = request("POST", "/collections/" + COLLECTION + "/points/count", request);
        return result.path("result").path("count").asInt(0) > 0;
    }

    public void replaceProjectChunks(Long projectId, List<Chunk> chunks) throws AiProviderException {
        ensureCollection();
        ObjectNode delete = mapper.createObjectNode();
        delete.set("filter", projectFilter(projectId));
        request("POST", "/collections/" + COLLECTION + "/points/delete?wait=true", delete);
        if (chunks.isEmpty()) return;
        ObjectNode body = mapper.createObjectNode();
        ArrayNode points = body.putArray("points");
        for (Chunk chunk : chunks) {
            ObjectNode point = points.addObject();
            point.put("id", UUID.nameUUIDFromBytes((projectId + ":" + chunk.position()).getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString());
            ArrayNode vector = point.putArray("vector");
            chunk.vector().forEach(vector::add);
            ObjectNode payload = point.putObject("payload");
            payload.put("projectId", projectId);
            payload.put("position", chunk.position());
            payload.put("text", chunk.text());
        }
        request("PUT", "/collections/" + COLLECTION + "/points?wait=true", body);
    }

    public List<String> search(Long projectId, List<Double> vector, int limit) throws AiProviderException {
        ensureCollection();
        ObjectNode body = mapper.createObjectNode();
        ArrayNode query = body.putArray("vector");
        vector.forEach(query::add);
        body.set("filter", projectFilter(projectId));
        body.put("limit", limit);
        body.put("with_payload", true);
        JsonNode results = request("POST", "/collections/" + COLLECTION + "/points/search", body).path("result");
        List<String> chunks = new ArrayList<>();
        for (JsonNode result : results) {
            String text = result.path("payload").path("text").asText();
            if (!text.isBlank()) chunks.add(text);
        }
        return chunks;
    }

    private synchronized void ensureCollection() throws AiProviderException {
        if (collectionReady) return;
        ObjectNode body = mapper.createObjectNode();
        ObjectNode vectors = body.putObject("vectors");
        vectors.put("size", DIMENSIONS);
        vectors.put("distance", "Cosine");
        request("PUT", "/collections/" + COLLECTION, body);
        collectionReady = true;
    }

    private ObjectNode projectFilter(Long projectId) {
        ObjectNode filter = mapper.createObjectNode();
        ArrayNode must = filter.putArray("must");
        must.addObject().put("key", "projectId").putObject("match").put("value", projectId);
        return filter;
    }

    private JsonNode request(String method, String path, JsonNode body) throws AiProviderException {
        if (!isConfigured()) throw new AiProviderException("Qdrant is not configured");
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl + path)).timeout(Duration.ofSeconds(20))
                    .header("Content-Type", "application/json")
                    .method(method, HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body))).build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new AiProviderException("Qdrant returned HTTP " + response.statusCode());
            }
            return mapper.readTree(response.body());
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new AiProviderException("Qdrant request failed", exception);
        }
    }

    public record Chunk(int position, String text, List<Double> vector) { }
}
