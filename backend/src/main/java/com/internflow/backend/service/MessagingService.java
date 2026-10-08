package com.internflow.backend.service;

import com.internflow.backend.dto.ConversationDto;
import com.internflow.backend.dto.MessageDto;
import com.internflow.backend.entity.*;
import com.internflow.backend.entity.enums.NotificationType;
import com.internflow.backend.exception.ApiException;
import com.internflow.backend.repository.*;
import com.internflow.backend.security.UserPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class MessagingService {
    private final ConversationRepository conversations; private final MessageRepository messages;
    private final UserRepository users; private final InternshipRepository internships; private final NotificationService notifications;
    private final SecurityRateLimiter rateLimiter;
    public MessagingService(ConversationRepository conversations, MessageRepository messages, UserRepository users, InternshipRepository internships, NotificationService notifications, SecurityRateLimiter rateLimiter) {
        this.conversations = conversations; this.messages = messages; this.users = users; this.internships = internships; this.notifications = notifications; this.rateLimiter = rateLimiter;
    }
    @Transactional(readOnly = true)
    public List<ConversationDto> list(UserPrincipal principal) { return conversations.findByParticipant(principal.getId()).stream().map(c -> toConversation(c, principal.getId())).toList(); }
    @Transactional(readOnly = true)
    public List<MessageDto> listMessages(Long conversationId, UserPrincipal principal) { Conversation c = getConversation(conversationId, principal); return messages.findByConversationIdOrderByCreatedAtAsc(c.getId()).stream().map(this::toMessage).toList(); }
    @Transactional
    public ConversationDto start(Long recipientId, UserPrincipal principal) { User recipient = users.findById(recipientId).orElseThrow(() -> ApiException.notFound("Recipient not found")); validatePair(principal.getId(), recipientId); Conversation c = conversations.findBetween(principal.getId(), recipientId).orElseGet(() -> { Conversation created = new Conversation(); created.setParticipantOne(users.findById(principal.getId()).orElseThrow()); created.setParticipantTwo(recipient); return conversations.save(created); }); return toConversation(c, principal.getId()); }
    @Transactional
    public MessageDto send(Long conversationId, String content, UserPrincipal principal) { Conversation c = getConversation(conversationId, principal); if (content == null || content.isBlank()) throw ApiException.badRequest("Message cannot be empty"); if (content.trim().length() > 4000) throw ApiException.badRequest("Message must be 4000 characters or fewer"); rateLimiter.require("message-user", principal.getId().toString(), 30, 60); User recipient = c.getParticipantOne().getId().equals(principal.getId()) ? c.getParticipantTwo() : c.getParticipantOne(); Message message = new Message(); message.setConversation(c); message.setSender(users.findById(principal.getId()).orElseThrow()); message.setContent(content.trim()); Message saved = messages.save(message); notifications.send(recipient.getId(), NotificationType.message, "New message from " + saved.getSender().getName(), "You received a new private message."); return toMessage(saved); }
    private Conversation getConversation(Long id, UserPrincipal principal) { Conversation c = conversations.findById(id).orElseThrow(() -> ApiException.notFound("Conversation not found")); if (!c.getParticipantOne().getId().equals(principal.getId()) && !c.getParticipantTwo().getId().equals(principal.getId())) throw ApiException.forbidden("You do not have access to this conversation"); return c; }
    private void validatePair(Long senderId, Long recipientId) {
        List<Internship> senderInternships = internships.findReadableByUserId(senderId);
        boolean linked = false;
        for (Internship i : senderInternships) {
            if (i.getIntern().getId().equals(recipientId)) {
                linked = true;
                break;
            }
            if (i.getSupervisor().getId().equals(recipientId)) {
                linked = true;
                break;
            }
            if (internships.existsAcceptedCoSupervisor(i.getId(), recipientId)) {
                linked = true;
                break;
            }
        }
        if (!linked) throw ApiException.forbidden("Students may message only their supervisors or co-supervisors, and supervisors only their assigned students");
    }
    private ConversationDto toConversation(Conversation c, Long me) { User other = c.getParticipantOne().getId().equals(me) ? c.getParticipantTwo() : c.getParticipantOne(); return new ConversationDto(c.getId(), new ConversationDto.UserRef(other.getId(), other.getName(), other.getPhotoUrl(), other.getAvatarColor()), c.getCreatedAt()); }
    private MessageDto toMessage(Message m) { return new MessageDto(m.getId(), m.getConversation().getId(), m.getSender().getId(), m.getSender().getName(), m.getContent(), m.getCreatedAt()); }
}
