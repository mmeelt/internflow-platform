import { api } from "./api";

export interface AiChatResult {
  answer: string;
  provider: "openai" | "gemini";
  sources: string[];
}

/** Calls the authenticated backend; API-provider keys never reach the browser. */
export function askAiAssistant(message: string): Promise<AiChatResult> {
  return api.post<AiChatResult>("/api/ai/chat", { message });
}

export function reviewDocumentWithAi(submissionId: number): Promise<AiChatResult> {
  return api.post<AiChatResult>(`/api/ai/documents/${encodeURIComponent(submissionId)}/review`, {});
}

export function askProjectReportAi(projectId: string | number, message: string): Promise<AiChatResult> {
  return api.post<AiChatResult>(`/api/ai/projects/${encodeURIComponent(projectId)}/chat`, { message });
}

export function draftStudentFeedbackWithAi(internshipId: string | number, taskId: string | number): Promise<AiChatResult> {
  return api.post<AiChatResult>(`/api/ai/internships/${encodeURIComponent(internshipId)}/tasks/${encodeURIComponent(taskId)}/feedback-draft`, {});
}
