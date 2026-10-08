package com.internflow.backend.service;

/** Deliberately contains no upstream response body, prompt, or secret. */
public class AiProviderException extends Exception {
    public AiProviderException(String message) { super(message); }
    public AiProviderException(String message, Throwable cause) { super(message, cause); }
}
