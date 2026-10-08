package com.internflow.backend.entity.enums;

public enum UserStatus {
    Active,
    Need_Review,
    Revoked;

    public static UserStatus fromFrontend(String value) {
        if ("Need Review".equals(value)) return Need_Review;
        return valueOf(value);
    }

    public String toFrontend() {
        return this == Need_Review ? "Need Review" : name();
    }
}
