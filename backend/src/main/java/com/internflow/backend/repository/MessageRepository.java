package com.internflow.backend.repository;

import com.internflow.backend.entity.Message;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {
    Page<Message> findByConversationIdOrderByCreatedAtDesc(Long conversationId, Pageable pageable);
    List<Message> findByConversationIdOrderByCreatedAtAsc(Long conversationId);
}
