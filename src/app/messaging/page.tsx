"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import RoleGuard from "@/components/RoleGuard";
import { PageTransition } from "@/components/PageTransition";
import { AiChat } from "@/components/AiChat";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Paperclip, Sparkles, MoreHorizontal, Phone, Video, Inbox } from "lucide-react";
import { getLoggedInUser } from "@/lib/auth";
import { ApiError, api } from "@/lib/api";
import { askAiAssistant } from "@/lib/ai";

interface ConversationDto {
  id: number;
  otherParticipant: { id: number; name: string; photoUrl: string | null; avatarColor: string | null };
}
interface ApiMessage { id: number; senderId: number; senderName: string; content: string; createdAt: string; }
interface Contact { recipientId: number; conversationId?: number; name: string; role: string; color: string; }
interface SupervisorIntern { id: number; name: string; internRole: string; avatarColor: string | null; }
interface Internship { supervisor: { id: number; name: string; avatarColor: string | null } | null; }

const studentQuickPrompts = ["Presentation Format", "Upcoming Deadlines", "How to add a task?", "Report structure tips"];
const supervisorQuickPrompts = ["How to give feedback?", "Intern deadlines", "Progress summary", "Review workflow"];

function initials(name: string) { return name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase(); }
function timeLabel(value: string) { return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value)); }

function Avatar({ name, color = "#111827", size = "md", className = "" }: { name: string; color?: string; size?: "sm" | "md"; className?: string }) {
  const dim = size === "sm" ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-xs";
  return <div className={`${dim} rounded-full flex items-center justify-center font-semibold text-white shrink-0 ${className}`} style={{ background: color }}>{initials(name)}</div>;
}

function ContactRow({ contact, active, lastMessage, onClick }: { contact: Contact; active: boolean; lastMessage?: string; onClick: () => void }) {
  return <button onClick={onClick} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${active ? "bg-[#E5E7EB]" : "hover:bg-[#F3F4F6]"}`}>
    <Avatar name={contact.name} color={contact.color} />
    <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-[#111827] truncate">{contact.name}</p><p className="text-xs text-[#6B7280] truncate">{lastMessage || contact.role}</p></div>
  </button>;
}

function MessagingContent() {
  const session = getLoggedInUser();
  const role = session?.role === "supervisor" ? "supervisor" : "student";
  const searchParams = useSearchParams();
  const recipientParam = searchParams.get("recipientId");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeRecipientId, setActiveRecipientId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [showAI, setShowAI] = useState(false);
  const [inputText, setInputText] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeContact = contacts.find((contact) => contact.recipientId === activeRecipientId) ?? null;

  // Handle URL recipient parameter
  useEffect(() => {
    if (recipientParam) {
      const rId = parseInt(recipientParam);
      if (!isNaN(rId)) {
        setActiveRecipientId(rId);
        setShowAI(false);
      }
    }
  }, [recipientParam]);

  useEffect(() => {
    let cancelled = false;
    async function loadContacts() {
      setLoadingContacts(true); setError(null);
      try {
        const byRecipient = new Map<number, Contact>();
        if (role === "supervisor") {
          const interns = await api.get<SupervisorIntern[]>("/api/supervisors/interns");
          interns.forEach((intern) => byRecipient.set(intern.id, { recipientId: intern.id, name: intern.name, role: intern.internRole || "Your intern", color: intern.avatarColor || "#111827" }));
        } else {
          const internships = await api.get<Internship[]>("/api/internships");
          const supervisor = internships[0]?.supervisor;
          if (supervisor) byRecipient.set(supervisor.id, { recipientId: supervisor.id, name: supervisor.name, role: "Primary supervisor", color: supervisor.avatarColor || "#111827" });
          
          const coSups = (internships[0] as any)?.coSupervisors;
          if (Array.isArray(coSups)) {
            coSups.forEach((cs: any) => {
              if (cs.status === "accepted") {
                byRecipient.set(cs.id, { recipientId: cs.id, name: cs.name, role: "Co-supervisor", color: cs.avatarColor || "#7C3AED" });
              }
            });
          }
        }
        try {
          const conversations = await api.get<ConversationDto[]>("/api/messages/conversations");
          conversations.forEach((conversation) => {
            const existing = byRecipient.get(conversation.otherParticipant.id);
            byRecipient.set(conversation.otherParticipant.id, {
              recipientId: conversation.otherParticipant.id, conversationId: conversation.id,
              name: existing?.name || conversation.otherParticipant.name,
              role: existing?.role || (role === "supervisor" ? "Your intern" : "Supervisor"),
              color: existing?.color || conversation.otherParticipant.avatarColor || "#111827",
            });
          });
        } catch (cause) {
          if (!cancelled) setError(cause instanceof ApiError ? `Messages are temporarily unavailable: ${cause.message}` : "Messages are temporarily unavailable.");
        }
        const next = Array.from(byRecipient.values()).sort((a, b) => a.name.localeCompare(b.name));
        if (!cancelled) {
          setContacts(next);
          const targetId = recipientParam ? parseInt(recipientParam) : null;
          setActiveRecipientId((current) => {
            if (targetId && next.some((c) => c.recipientId === targetId)) {
              return targetId;
            }
            return current && next.some((c) => c.recipientId === current) ? current : (next[0]?.recipientId ?? null);
          });
        }
      } catch (cause) { if (!cancelled) setError(cause instanceof ApiError ? cause.message : "Could not load conversations."); }
      finally { if (!cancelled) setLoadingContacts(false); }
    }
    loadContacts(); return () => { cancelled = true; };
  }, [role, recipientParam]);

  useEffect(() => {
    let cancelled = false;
    async function loadMessages() {
      if (!activeContact?.conversationId) { setMessages([]); return; }
      setLoadingMessages(true); setError(null);
      try { const data = await api.get<ApiMessage[]>(`/api/messages/conversations/${activeContact.conversationId}`); if (!cancelled) setMessages(data); }
      catch (cause) { if (!cancelled) setError(cause instanceof ApiError ? cause.message : "Could not load messages."); }
      finally { if (!cancelled) setLoadingMessages(false); }
    }
    loadMessages(); return () => { cancelled = true; };
  }, [activeContact?.conversationId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, showAI]);

  async function sendMessage() {
    const content = inputText.trim();
    if (!content || !activeContact || sending) return;
    setSending(true); setError(null);
    try {
      let conversationId = activeContact.conversationId;
      if (!conversationId) {
        const conversation = await api.post<ConversationDto>("/api/messages/conversations", { recipientId: activeContact.recipientId });
        conversationId = conversation.id;
        setContacts((current) => current.map((contact) => contact.recipientId === activeContact.recipientId ? { ...contact, conversationId } : contact));
      }
      const saved = await api.post<ApiMessage>(`/api/messages/conversations/${conversationId}`, { content });
      setMessages((current) => [...current, saved]); setInputText("");
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : "Message could not be sent."); }
    finally { setSending(false); }
  }

  const myName = session?.name || "";
  const getAI = (input: string) => askAiAssistant(input);
  const suggestions = role === "supervisor" ? supervisorQuickPrompts : studentQuickPrompts;
  return <PageTransition><div className="flex flex-col h-[calc(100dvh-60px)] md:h-screen min-h-0">
    <div className="page-header flex items-center justify-between"><div><h1 className="text-xl font-semibold text-[#111827]">Messages</h1><p className="text-sm text-[#6B7280] mt-0.5">{role === "supervisor" ? "Message your assigned interns directly" : "Contact your supervisor and co-supervisors, or ask the AI assistant"}</p></div><button onClick={() => setShowAI(!showAI)} className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm transition-colors ${showAI ? "bg-[#111827] text-white" : "border border-[#D1D5DB] bg-white text-[#374151] hover:bg-[#F3F4F6]"}`}><Sparkles className="w-4 h-4" /> AI Assistant</button></div>
    <div className="flex flex-1 overflow-hidden"><div className="w-72 border-r border-border bg-cream flex flex-col shrink-0"><div className="p-4 pb-2"><p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1">{role === "supervisor" ? "Your Interns" : "Your Supervisors"}</p></div><div className="px-2 space-y-0.5"><button onClick={() => setShowAI(true)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${showAI ? "bg-[#E5E7EB]" : "hover:bg-[#F3F4F6]"}`}><div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-white bg-gradient-to-br from-[#111827] to-[#4f46e5]">✦</div><div><p className="text-sm font-semibold text-[#111827]">AI Assistant</p><p className="text-xs text-[#6B7280]">Always available</p></div></button><div className="my-1 mx-3 border-t border-[#E5E7EB]" /><ScrollArea className="h-[calc(100vh-200px)]"><div className="space-y-0.5 pr-1">{loadingContacts ? <p className="px-3 py-4 text-xs text-muted">Loading conversations…</p> : contacts.map((contact) => <ContactRow key={contact.recipientId} contact={contact} active={!showAI && contact.recipientId === activeRecipientId} lastMessage={contact.recipientId === activeRecipientId ? messages.at(-1)?.content : undefined} onClick={() => { setActiveRecipientId(contact.recipientId); setShowAI(false); }} />)}</div></ScrollArea></div></div>
    {showAI ? <div className="flex-1 flex flex-col overflow-hidden"><AiChat variant="embedded" userName={myName} suggestions={suggestions} getResponse={getAI} welcomeSubtitle="Ask about deadlines, formats, tasks, reviews, and project guidelines…" initialMessage={`Hello ${myName || "there"}! How can I help?`} /></div> : <div className="flex-1 flex flex-col overflow-hidden bg-cream">{error && <div role="alert" className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}{activeContact ? <><div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0"><div className="flex items-center gap-3"><Avatar name={activeContact.name} color={activeContact.color} /><div><p className="text-sm font-semibold text-charcoal">{activeContact.name}</p><p className="text-xs text-muted">{activeContact.role}</p></div></div><div className="flex items-center gap-1"><button aria-label="Phone call" className="p-2 rounded-xl text-muted hover:bg-cream-dark"><Phone className="w-4 h-4" /></button><button aria-label="Video call" className="p-2 rounded-xl text-muted hover:bg-cream-dark"><Video className="w-4 h-4" /></button><button aria-label="More options" className="p-2 rounded-xl text-muted hover:bg-cream-dark"><MoreHorizontal className="w-4 h-4" /></button></div></div><div className="flex-1 overflow-y-auto px-6 py-5"><div className="max-w-2xl mx-auto space-y-4">{loadingMessages ? <p className="text-sm text-muted text-center py-8">Loading messages…</p> : messages.length === 0 ? <div className="flex flex-col items-center justify-center h-72 text-center"><div className="w-16 h-16 rounded-2xl bg-cream-dark flex items-center justify-center mb-4"><Inbox className="w-8 h-8 text-charcoal" /></div><h3 className="text-sm font-semibold text-charcoal-soft mb-1">No messages yet</h3><p className="text-xs text-muted-light max-w-[240px] leading-relaxed">Start the conversation by typing a message below.</p></div> : messages.map((message) => { const own = message.senderId === session?.id; return <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>{!own && <Avatar name={activeContact.name} color={activeContact.color} size="sm" className="mr-2 mt-1" />}<div className="max-w-[72%]"><div className={own ? "ai-bubble-assistant" : "ai-bubble-user"}><p className="text-sm whitespace-pre-line leading-relaxed">{message.content}</p></div><p className={`text-xs mt-1 text-muted-light ${own ? "text-right" : ""}`}>{timeLabel(message.createdAt)}</p></div></div>; })}<div ref={bottomRef} /></div></div><div className="border-t border-border px-6 py-4 shrink-0 bg-cream"><div className="flex items-end gap-2 max-w-2xl mx-auto ai-input-bar"><button aria-label="Attach file" className="w-8 h-8 rounded-full border border-border bg-cream-dark text-muted hover:text-charcoal flex items-center justify-center shrink-0"><Paperclip className="w-4 h-4" /></button><textarea value={inputText} disabled={sending} onChange={(event) => setInputText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder={`Message ${activeContact.name}…`} rows={1} className="flex-1 bg-transparent text-sm placeholder:text-muted-light outline-none resize-none disabled:opacity-60" /><button onClick={sendMessage} disabled={sending || !inputText.trim()} aria-label="Send message" className="w-10 h-10 rounded-full bg-charcoal text-white flex items-center justify-center hover:bg-charcoal-soft shrink-0 disabled:opacity-50"><Send className="w-4 h-4" /></button></div></div></> : <div className="flex-1 flex items-center justify-center text-center px-6"><div><Inbox className="w-10 h-10 text-muted mx-auto mb-3" /><p className="text-sm font-medium text-charcoal">No assigned contact yet</p><p className="text-xs text-muted mt-1">A conversation will be available once an internship assignment is set up.</p></div></div>}</div>}
  </div></div></PageTransition>;
}

export default function Messaging() { return <RoleGuard allowedRoles={["student", "supervisor"]}><Suspense fallback={<div>Loading...</div>}><MessagingContent /></Suspense></RoleGuard>; }
