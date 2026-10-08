package com.internflow.backend.service;

/** Provider-neutral interface so an outage never requires changing controllers or UI code. */
public interface AiProvider {
    String name();
    boolean isConfigured();
    String generate(String instructions, String userMessage) throws AiProviderException;
}
