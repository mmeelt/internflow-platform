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
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Independent fallback provider. It is called only when the primary provider fails. */
@Component
public class GeminiProvider implements AiProvider {
    private static final long MAX_INLINE_PDF_BYTES = 15L * 1024 * 1024;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;

    public GeminiProvider(
            @Value("${ai.gemini.api-key:}") String apiKey,
            @Value("${ai.gemini.model:gemini-3.5-flash}") String model
    ) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model == null ? "gemini-2.5-flash" : model.trim();
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    @Override public String name() { return "gemini"; }
    @Override public boolean isConfigured() { return !apiKey.isBlank(); }

    @Override
    public String generate(String instructions, String userMessage) throws AiProviderException {
        if (!isConfigured()) throw new AiProviderException("Gemini is not configured");
        try {
            URI endpoint = URI.create("https://generativelanguage.googleapis.com/v1beta/models/"
                    + model + ":generateContent");
            ObjectNode payload = mapper.createObjectNode();
            payload.set("systemInstruction", parts(instructions));
            ArrayNode contents = mapper.createArrayNode();
            ObjectNode user = mapper.createObjectNode();
            user.put("role", "user");
            user.set("parts", parts(userMessage).path("parts"));
            contents.add(user);
            payload.set("contents", contents);

            HttpRequest request = HttpRequest.newBuilder(endpoint)
                    .timeout(Duration.ofSeconds(25))
                    .header("Content-Type", "application/json")
                    .header("x-goog-api-key", apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload)))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new AiProviderException("Gemini returned HTTP " + response.statusCode());
            }
            String answer = mapper.readTree(response.body()).path("candidates").path(0)
                    .path("content").path("parts").path(0).path("text").asText();
            if (answer.isBlank()) throw new AiProviderException("Gemini returned no text answer");
            return answer.trim();
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new AiProviderException("Gemini request failed", exception);
        }
    }

    /** Sends an authorised scanned PDF directly to Gemini when text extraction is impossible. */
    public String generateWithPdf(String instructions, String userMessage, Path file) throws AiProviderException {
        if (!isConfigured()) throw new AiProviderException("Gemini is not configured");
        try {
            long size = Files.size(file);
            if (size > MAX_INLINE_PDF_BYTES) {
                throw new AiProviderException("The scanned PDF is too large for secure inline analysis");
            }
            ObjectNode payload = mapper.createObjectNode();
            payload.set("systemInstruction", parts(instructions));
            ArrayNode contents = mapper.createArrayNode();
            ObjectNode user = mapper.createObjectNode();
            user.put("role", "user");
            ArrayNode userParts = mapper.createArrayNode();
            userParts.add(mapper.createObjectNode().put("text", userMessage));
            ObjectNode inlineData = mapper.createObjectNode();
            inlineData.put("mimeType", "application/pdf");
            inlineData.put("data", Base64.getEncoder().encodeToString(Files.readAllBytes(file)));
            userParts.add(mapper.createObjectNode().set("inlineData", inlineData));
            user.set("parts", userParts);
            contents.add(user);
            payload.set("contents", contents);

            URI endpoint = URI.create("https://generativelanguage.googleapis.com/v1beta/models/"
                    + model + ":generateContent");
            HttpRequest request = HttpRequest.newBuilder(endpoint)
                    .timeout(Duration.ofSeconds(60))
                    .header("Content-Type", "application/json")
                    .header("x-goog-api-key", apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload)))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new AiProviderException("Gemini returned HTTP " + response.statusCode());
            }
            String answer = mapper.readTree(response.body()).path("candidates").path(0)
                    .path("content").path("parts").path(0).path("text").asText();
            if (answer.isBlank()) throw new AiProviderException("Gemini returned no text answer");
            return answer.trim();
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new AiProviderException("Gemini PDF request failed", exception);
        }
    }

    private ObjectNode parts(String text) {
        ObjectNode container = mapper.createObjectNode();
        ArrayNode parts = mapper.createArrayNode();
        parts.add(mapper.createObjectNode().put("text", text));
        container.set("parts", parts);
        return container;
    }
}
