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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Groq-hosted GPT-OSS backup. The key stays on the server and is never sent to browsers. */
@Component
public class GroqProvider implements AiProvider {
    private static final URI CHAT_COMPLETIONS_URI = URI.create("https://api.groq.com/openai/v1/chat/completions");
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;

    public GroqProvider(
            @Value("${ai.groq.api-key:}") String apiKey,
            @Value("${ai.groq.model:openai/gpt-oss-20b}") String model
    ) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model == null ? "openai/gpt-oss-20b" : model.trim();
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    @Override public String name() { return "groq"; }
    @Override public boolean isConfigured() { return !apiKey.isBlank(); }

    @Override
    public String generate(String instructions, String userMessage) throws AiProviderException {
        if (!isConfigured()) throw new AiProviderException("Groq is not configured");
        try {
            ObjectNode payload = mapper.createObjectNode();
            payload.put("model", model);
            payload.put("temperature", 0.2);
            ArrayNode messages = mapper.createArrayNode();
            messages.add(message("system", instructions));
            messages.add(message("user", userMessage));
            payload.set("messages", messages);

            HttpRequest request = HttpRequest.newBuilder(CHAT_COMPLETIONS_URI)
                    .timeout(Duration.ofSeconds(25))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload)))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new AiProviderException("Groq returned HTTP " + response.statusCode());
            }
            String answer = mapper.readTree(response.body()).path("choices").path(0)
                    .path("message").path("content").asText();
            if (answer.isBlank()) throw new AiProviderException("Groq returned no text answer");
            return answer.trim();
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new AiProviderException("Groq request failed", exception);
        }
    }

    private ObjectNode message(String role, String content) {
        return mapper.createObjectNode().put("role", role).put("content", content);
    }
}
