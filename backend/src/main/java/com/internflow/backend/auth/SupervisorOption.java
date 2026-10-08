package com.internflow.backend.auth;

/** Minimal public data required for a student to choose a supervisor at signup. */
public record SupervisorOption(Long id, String name, String post, String axis) {}
