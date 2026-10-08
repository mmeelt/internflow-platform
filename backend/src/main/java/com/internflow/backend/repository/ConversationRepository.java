package com.internflow.backend.repository;

import com.internflow.backend.entity.Conversation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    @Query("SELECT c FROM Conversation c WHERE c.participantOne.id = :userId OR c.participantTwo.id = :userId")
    List<Conversation> findByParticipant(Long userId);

    @Query("SELECT c FROM Conversation c WHERE " +
           "(c.participantOne.id = :userA AND c.participantTwo.id = :userB) OR " +
           "(c.participantOne.id = :userB AND c.participantTwo.id = :userA)")
    Optional<Conversation> findBetween(Long userA, Long userB);
}
