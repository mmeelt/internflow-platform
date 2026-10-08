"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { AiChat } from "./AiChat";

const RESPONSES: Array<{ keywords: string[]; answer: string; sources?: string[] }> = [
  {
    keywords: ["format", "presentation", "slide", "slides"],
    answer:
      "**Final Presentation Format**\n\nYour presentation should follow this structure:\n\n1. **Title slide** — project name, your name, division, date\n2. **Executive summary** — 2–3 key outcomes\n3. **Problem statement** — what challenge did you tackle?\n4. **Methodology** — tools, frameworks, approach\n5. **Results & findings** — charts or demos\n6. **Conclusion & next steps**\n\nDuration: 15–20 min + 5 min Q&A",
    sources: ["Internship Guidelines §4.2", "Presentation Template.pptx"],
  },
  {
    keywords: ["deadline", "due", "when", "date", "submit"],
    answer:
      "**Upcoming Deadlines**\n\n• Week 4 Check-in — June 30, 2026\n• Midterm Report — July 15, 2026\n• Final Presentation Draft — August 1, 2026\n• Final Report Submission — August 15, 2026\n• Exit Interview — August 18–22, 2026",
    sources: ["Academic Calendar 2025-2026"],
  },
  {
    keywords: ["report", "write", "writing", "structure", "document"],
    answer:
      "**Report Writing Guidelines**\n\nRequired sections: Abstract, Introduction, Methodology, Results, Challenges, Conclusion, References (IEEE format).\n\nFormatting: Times New Roman 12pt, 1.5 spacing, 2.5cm margins. Minimum 2,500 words for midterm; 5,000 for final.",
    sources: ["Document Standards Guide v3.1"],
  },
  {
    keywords: ["feedback", "review", "supervisor", "grade", "evaluation"],
    answer:
      "**Feedback & Evaluation**\n\n| Criteria | Weight |\n|---|---|\n| Technical deliverables | 40% |\n| Professional conduct | 20% |\n| Report quality | 20% |\n| Presentation | 20% |\n\nSupervisors respond within **2 business days**.",
    sources: ["Evaluation Rubric 2026"],
  },
  {
    keywords: ["task", "todo", "milestone", "project", "assignment"],
    answer:
      "**Managing Your Tasks**\n\nGo to **My Project & Tasks** to add tasks, set progress, upload files, and track status (Todo → In Progress → Done → Reviewed).",
    sources: ["Task Management Guide"],
  },
  {
    keywords: ["upload", "file", "attach", "document", "pdf"],
    answer:
      "**File Upload Guidelines**\n\nAccepted: PDF, DOCX, PPTX, ZIP, MP4 (max 100MB).\n\nUpload via your dashboard → drag & drop on any task.",
    sources: ["Upload Policy 2026"],
  },
  {
    keywords: ["contact", "supervisor", "reach", "email", "message"],
    answer:
      "**Contacting Your Supervisor**\n\n1. **In-app messaging** → Messages in sidebar\n2. **Weekly check-in** — every Friday at 10:00 AM\n3. Email visible on supervisor profile card",
    sources: ["Communication Policy"],
  },
  {
    keywords: ["progress", "percent", "completion", "score"],
    answer:
      "**Progress Score**\n\nCalculated from: Tasks completed (50%), Documents submitted (30%), Check-in attendance (20%). Aim for **≥70%** by midterm.",
    sources: ["Progress Scoring Guide"],
  },
];

const DEFAULT_RESPONSE =
  "I can help with deadlines, document formats, tasks, supervisor contact, certificates, and tools.\n\nWhat would you like to know?";

function getResponse(input: string): string {
  const lower = input.toLowerCase();
  for (const item of RESPONSES) {
    if (item.keywords.some((kw) => lower.includes(kw))) return item.answer;
  }
  return DEFAULT_RESPONSE;
}

function getSources(input: string): string[] {
  const lower = input.toLowerCase();
  for (const item of RESPONSES) {
    if (item.keywords.some((kw) => lower.includes(kw))) return item.sources ?? [];
  }
  return ["Intern Portal Knowledge Base"];
}

interface ChatbotButtonProps {
  userName?: string;
}

export function ChatbotButton({ userName = "there" }: ChatbotButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-14 px-5 rounded-2xl shadow-float z-50 flex items-center gap-2.5 bg-charcoal text-white hover:bg-charcoal-soft transition-all duration-200 hover:scale-[1.02] group"
          aria-label="Open AI assistant"
        >
          <Sparkles className="h-5 w-5 group-hover:rotate-12 transition-transform duration-200" />
          <span className="text-sm font-medium">Ask AI</span>
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-4 md:inset-auto md:bottom-6 md:right-6 md:w-[480px] z-50 md:rounded-3xl overflow-hidden shadow-float"
          style={{ height: "min(680px, calc(100vh - 48px))" }}
        >
          <AiChat
            variant="panel"
            userName={userName}
            getResponse={getResponse}
            getSources={getSources}
            onClose={() => setIsOpen(false)}
          />
        </div>
      )}
    </>
  );
}

// Export helpers for messaging page reuse
export { getResponse as getAiResponse, getSources as getAiSources, RESPONSES };
