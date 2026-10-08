package com.internflow.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Server-only embeddings used for the private report RAG index. */
@Component
public class GeminiEmbeddingProvider {
    private static final int DIMENSIONS = 768;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final String apiKey;
    private final String model;

    public GeminiEmbeddingProvider(@Value("${ai.gemini.api-key:}") String apiKey,
                                   @Value("${ai.rag.embedding-model:gemini-embedding-001}") String model) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model == null ? "gemini-embedding-001" : model.trim();
    }

    public boolean isConfigured() { return !apiKey.isBlank(); }

    public List<Double> documentEmbedding(String text) throws AiProviderException { return embed(text, "RETRIEVAL_DOCUMENT"); }
    public List<Double> queryEmbedding(String text) throws AiProviderException { return embed(text, "RETRIEVAL_QUERY"); }

    private List<Double> embed(String text, String taskType) throws AiProviderException {
        if (!isConfigured()) throw new AiProviderException("Gemini embeddings are not configured");
        try {
            ObjectNode payload = mapper.createObjectNode();
            ObjectNode content = payload.putObject("content");
            ArrayNode parts = content.putArray("parts");
            parts.addObject().put("text", text);
            payload.put("taskType", taskType);
            payload.put("outputDimensionality", DIMENSIONS);
            URI endpoint = URI.create("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":embedContent");
            HttpRequest request = HttpRequest.newBuilder(endpoint).timeout(Duration.ofSeconds(30))
                    .header("Content-Type", "application/json").header("x-goog-api-key", apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload))).build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new AiProviderException("Gemini embeddings returned HTTP " + response.statusCode());
            }
            var values = mapper.readTree(response.body()).path("embedding").path("values");
            if (!values.isArray() || values.size() != DIMENSIONS) throw new AiProviderException("Gemini returned an invalid embedding");
            java.util.ArrayList<Double> vector = new java.util.ArrayList<>(DIMENSIONS);
            values.forEach(value -> vector.add(value.asDouble()));
            return vector;
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new AiProviderException("Gemini embedding request failed", exception);
        }
    }
}
