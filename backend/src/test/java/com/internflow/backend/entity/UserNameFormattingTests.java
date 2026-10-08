package com.internflow.backend.entity;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class UserNameFormattingTests {

    @Test
    void formatsFirstAndLastNamesForStorageAndDisplay() {
        User user = new User();
        user.setName("  bassem   MLIK  ");

        assertEquals("Bassem Mlik", user.getName());
    }

    @Test
    void preservesHyphenatedAndApostropheSeparatedNameParts() {
        User user = new User();
        user.setName("marie-claude o'connor");

        assertEquals("Marie-Claude O'Connor", user.getName());
    }
}
