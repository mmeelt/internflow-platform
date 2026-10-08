package com.internflow.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Minimal server-side OpenAI Responses API client. Keys never enter browser code. */
@Component
public class OpenAiProvider implements AiProvider {
    private static final URI RESPONSES_URI = URI.create("https://api.openai.com/v1/responses");
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;

    public OpenAiProvider(
            @Value("${ai.openai.api-key:}") String apiKey,
            @Value("${ai.openai.model:gpt-5-mini}") String model
    ) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    @Override public String name() { return "openai"; }
    @Override public boolean isConfigured() { return !apiKey.isBlank(); }

    @Override
    public String generate(String instructions, String userMessage) throws AiProviderException {
        if (!isConfigured()) throw new AiProviderException("OpenAI is not configured");
        try {
            ObjectNode payload = mapper.createObjectNode();
            payload.put("model", model);
            payload.put("store", false);
            payload.put("instructions", instructions);
            payload.put("input", userMessage);

            HttpRequest request = HttpRequest.newBuilder(RESPONSES_URI)
                    .timeout(Duration.ofSeconds(25))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload)))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new AiProviderException("OpenAI returned HTTP " + response.statusCode());
            }
            String answer = outputText(mapper.readTree(response.body()));
            if (answer.isBlank()) throw new AiProviderException("OpenAI returned no text answer");
            return answer.trim();
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new AiProviderException("OpenAI request failed", exception);
        }
    }

    private String outputText(JsonNode response) {
        StringBuilder text = new StringBuilder();
        for (JsonNode output : response.path("output")) {
            for (JsonNode content : output.path("content")) {
                if ("output_text".equals(content.path("type").asText())) {
                    String part = content.path("text").asText();
                    if (!part.isBlank()) {
                        if (!text.isEmpty()) text.append("\n");
                        text.append(part);
                    }
                }
            }
        }
        return text.toString();
    }
}
