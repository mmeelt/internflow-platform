package com.internflow.backend.auth;

import java.util.List;

/** Provider identity is returned for operational transparency; no API details are exposed. */
public record AiChatResponse(String answer, String provider, List<String> sources) {}
