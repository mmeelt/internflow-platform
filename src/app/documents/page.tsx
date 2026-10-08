"use client";

import { Fragment, Suspense, useState, useEffect, useMemo } from "react";
import RoleGuard from "@/components/RoleGuard";
import { useRouter, useSearchParams } from "next/navigation";
import { PageTransition } from "@/components/PageTransition";
import { getLoggedInUser } from "@/lib/auth";
import { ApiError, api } from "@/lib/api";
import { draftStudentFeedbackWithAi, reviewDocumentWithAi } from "@/lib/ai";
import {
  internProfiles,
  getSupervisorByEmail,
  getInternByEmail,
  getInternsForSupervisor,
  type Submission,
  type Task,
  type InternProfile,
} from "@/lib/store";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText, Download, CheckCircle, Sparkles, Calendar,
  User, File, AlertCircle, Search, BarChart2, Clock,
  Code2, Film, Image, Archive, Tag, Filter,
  LayoutGrid, List, Upload, X, ChevronRight,
  FolderOpen, Eye, Maximize, PlayCircle, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Types Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

interface DocumentItem {
  id: string;
  submissionId: number;
  internshipId: number;
  name: string;
  size: string;
  type: string; // file extension category: pdf, code, image, video, archive, file
  uploadedAt: string;
  internName: string;
  internInitials: string;
  internColor: string;
  internId: string;
  taskTitle: string;
  taskId: string;
  taskStatus: string;  // done | in-progress | reviewed | todo
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Status config Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

const statusConfig: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  reviewed:      { bg: "#D1FAE5", text: "#065F46", label: "Validated",     dot: "#10B981" },
  done:          { bg: "#E5E7EB", text: "#3730a3", label: "Submitted",     dot: "#6366F1" },
  "in-progress": { bg: "#FEF3C7", text: "#92400E", label: "Under Review",  dot: "#F59E0B" },
  todo:          { bg: "#F3F4F6", text: "#374151", label: "Draft",         dot: "#9CA3AF" },
  disapproved:   { bg: "#FEE2E2", text: "#B91C1C", label: "Disapproved",   dot: "#EF4444" },
};

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ File type helpers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

const FILE_TYPE_MAP: Record<string, string> = {
  pdf: "pdf", docx: "pdf", pptx: "pptx",
  ipynb: "code", py: "code", js: "code", ts: "code", sol: "code", zip: "archive",
  fig: "image", png: "image", jpg: "image", svg: "image",
  mp4: "video", mov: "video",
  csv: "file", txt: "file", pt: "archive",
};

const FILE_TYPE_LABELS: Record<string, string> = {
  pdf: "PDF / Docs", pptx: "Presentations", code: "Code", image: "Images",
  video: "Video", archive: "Archives", file: "Other",
};

const FILE_ICON: Record<string, React.ElementType> = {
  pdf: FileText, pptx: FileText, code: Code2,
  image: Image, video: Film, archive: Archive, file: File,
};

const FILE_COLOR: Record<string, string> = {
  pdf: "text-slate-700 bg-slate-100", pptx: "text-slate-700 bg-slate-100",
  code: "text-slate-700 bg-slate-100", image: "text-slate-700 bg-slate-100",
  video: "text-slate-700 bg-slate-100", archive: "text-slate-700 bg-slate-100",
  file: "text-slate-700 bg-slate-100",
};

function getExt(name: string) {
  return (name.split(".").pop() || "").toLowerCase();
}

function fileCategory(name: string): string {
  const ext = getExt(name);
  return FILE_TYPE_MAP[ext] || "file";
}

function FileIcon({ name, size = "sm" }: { name: string; size?: "sm" | "lg" }) {
  const cat = fileCategory(name);
  const Icon = FILE_ICON[cat] || File;
  const colors = FILE_COLOR[cat] || FILE_COLOR.file;
  const sz = size === "lg" ? "w-7 h-7" : "w-4 h-4";
  const pad = size === "lg" ? "w-14 h-14 rounded-xl" : "w-9 h-9 rounded-lg";
  return (
    <div className={`${pad} flex items-center justify-center shrink-0 ${colors}`}>
      <Icon className={sz} />
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Build document list from store Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function buildDocuments(interns: InternProfile[]): DocumentItem[] {
  const docs: DocumentItem[] = [];
  for (const intern of interns) {
    for (const task of intern.tasks) {
      for (const sub of task.submissions) {
        docs.push({
          id: `${intern.id}-${task.id}-${sub.id}`,
          submissionId: Number(sub.id) || 0,
          internshipId: 0,
          name: sub.name,
          size: sub.size,
          type: fileCategory(sub.name),
          uploadedAt: sub.uploadedAt,
          internName: intern.name,
          internInitials: intern.initials,
          internColor: intern.avatarColor,
          internId: intern.id,
          taskTitle: task.title,
          taskId: task.id,
          taskStatus: task.status,
        });
      }
    }
  }
  // Sort newest first
  return docs.sort((a, b) => (a.uploadedAt > b.uploadedAt ? -1 : 1));
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ AI Insights (per-document mock) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

const AI_SCORES_MAP: Record<string, Array<{ label: string; value: number; color: string }>> = {
  pdf:     [{ label: "Completeness", value: 92, color: "#10B981" }, { label: "Technical Depth", value: 85, color: "#10B981" }, { label: "Clarity", value: 78, color: "#F59E0B" }, { label: "Structure", value: 90, color: "#10B981" }],
  code:    [{ label: "Code Quality",  value: 88, color: "#10B981" }, { label: "Documentation",  value: 75, color: "#F59E0B" }, { label: "Efficiency", value: 82, color: "#10B981" }, { label: "Test Coverage", value: 60, color: "#F59E0B" }],
  video:   [{ label: "Clarity",       value: 90, color: "#10B981" }, { label: "Content Depth",  value: 83, color: "#10B981" }, { label: "Presentation", value: 87, color: "#10B981" }, { label: "Duration", value: 95, color: "#10B981" }],
  image:   [{ label: "Resolution",    value: 95, color: "#10B981" }, { label: "Annotation",     value: 72, color: "#F59E0B" }, { label: "Relevance", value: 88, color: "#10B981" }, { label: "Naming", value: 80, color: "#10B981" }],
  archive: [{ label: "Organization",  value: 86, color: "#10B981" }, { label: "Completeness",   value: 91, color: "#10B981" }, { label: "README",  value: 70, color: "#F59E0B" }, { label: "Version", value: 84, color: "#10B981" }],
  default: [{ label: "Completeness",  value: 80, color: "#10B981" }, { label: "Quality",        value: 77, color: "#F59E0B" }, { label: "Clarity", value: 82, color: "#10B981" }, { label: "Relevance", value: 75, color: "#F59E0B" }],
};

const AI_SUGGESTIONS_MAP: Record<string, string[]> = {
  pdf:     ["Add an executive summary with key quantitative results upfront.", "Include a comparison section between alternative approaches.", "Strengthen citations with more recent (2024Ã¢â‚¬â€œ2025) references."],
  code:    ["Add inline comments for non-obvious logic sections.", "Increase unit test coverage to at least 80%.", "Consider extracting repeated logic into utility functions."],
  video:   ["Add chapter markers for easier navigation.", "Include a text summary / transcript for accessibility.", "Reduce background noise in the audio track."],
  image:   ["Add descriptive alt-text or figure captions.", "Ensure consistent naming convention (e.g. fig01_description.png).", "Use SVG format for diagrams to maintain quality at all resolutions."],
  archive: ["Include a top-level README.md with setup instructions.", "Add a requirements.txt or package.json with pinned versions.", "Remove build artifacts and cache files before packaging."],
  default: ["Ensure the file follows the naming convention: Firstname_Lastname_Type_Date.", "Add a brief description comment at the top of the document.", "Double-check the submission deadline and version number."],
};

function getAI(doc: DocumentItem) {
  const scores = AI_SCORES_MAP[doc.type] || AI_SCORES_MAP.default;
  const suggestions = AI_SUGGESTIONS_MAP[doc.type] || AI_SUGGESTIONS_MAP.default;
  const avg = Math.round(scores.reduce((a, s) => a + s.value, 0) / scores.length);
  return { scores, suggestions, avg };
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Stat card Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] px-5 py-4 flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[#6B7280] mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-[#111827]">{value}</p>
        <p className="text-xs text-[#9CA3AF] mt-0.5">{sub}</p>
      </div>
      <div className="w-2 h-10 rounded-full shrink-0" style={{ backgroundColor: color }} />
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Document card (grid view) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function DocCard({
  doc, selected, onSelect, validated,
}: {
  doc: DocumentItem; selected: boolean; onSelect: () => void; validated: Set<string>;
}) {
  const s = statusConfig[doc.taskStatus] || statusConfig.todo;
  const isVal = doc.taskStatus === "reviewed" || validated.has(doc.id);
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-xl border p-4 transition-all duration-200 group ${
        selected
          ? "bg-[#E5E7EB] border-[#c7d2fe] shadow-sm"
          : "bg-white border-[#E5E7EB] hover:border-[#c7d2fe] hover:shadow-sm hover:-translate-y-0.5"
      }`}
    >
      <div className="flex items-start gap-3 mb-3">
        <FileIcon name={doc.name} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#111827] line-clamp-2 leading-snug mb-1">{doc.name}</p>
          <div className="flex items-center gap-1.5">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
              style={{ backgroundColor: doc.internColor }}
            >
              {doc.internInitials}
            </div>
            <span className="text-xs text-[#6B7280] truncate">{doc.internName}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
          style={{ backgroundColor: s.bg, color: s.text }}
        >
          {isVal ? "Validated" : s.label}
        </span>
        <span className="text-[10px] text-[#9CA3AF]">{doc.uploadedAt}</span>
      </div>

      <div className="mt-2 pt-2 border-t border-[#E5E7EB]">
        <p className="text-[10px] text-[#9CA3AF] truncate">{doc.taskTitle}</p>
      </div>
    </button>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Document row (list view) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function DocRow({
  doc, selected, onSelect, validated,
}: {
  doc: DocumentItem; selected: boolean; onSelect: () => void; validated: Set<string>;
}) {
  const s = statusConfig[doc.taskStatus] || statusConfig.todo;
  const isVal = doc.taskStatus === "reviewed" || validated.has(doc.id);
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-150 ${
        selected
          ? "bg-[#E5E7EB] border-[#c7d2fe]"
          : "bg-white border-[#E5E7EB] hover:bg-[#F3F4F6]"
      }`}
    >
      <FileIcon name={doc.name} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#111827] truncate">{doc.name}</p>
        <p className="text-xs text-[#6B7280]">{doc.taskTitle}</p>
      </div>
      <div className="hidden md:flex items-center gap-1.5 shrink-0">
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
          style={{ backgroundColor: doc.internColor }}
        >
          {doc.internInitials}
        </div>
        <span className="text-xs text-[#6B7280]">{doc.internName}</span>
      </div>
      <span
        className="px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
        style={{ backgroundColor: s.bg, color: s.text }}
      >
        {isVal ? "Validated" : s.label}
      </span>
      <span className="text-xs text-[#9CA3AF] shrink-0 hidden lg:block">{doc.size}</span>
      <span className="text-xs text-[#9CA3AF] shrink-0 hidden lg:block">{doc.uploadedAt}</span>
      <ChevronRight className="w-3.5 h-3.5 text-[#D1D5DB] shrink-0" />
    </button>
  );
}

// â€”â€”â€” Main page â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”

export default function DocumentsPage() {
  return (
    <RoleGuard allowedRoles={["student", "supervisor", "admin"]}>
      <Suspense fallback={<div className="flex-1 p-8 text-sm text-[#6B7280]">Loading documentsâ€¦</div>}>
        <DocumentsPageContent />
      </Suspense>
    </RoleGuard>
  );
}

export function DocumentsPageContent({
  fixedStudentId,
  embedded = false,
}: {
  /** Locks the workspace to one student when rendered from My Interns. */
  fixedStudentId?: string;
  /** Removes the standalone page transition when this is part of another page. */
  embedded?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = getLoggedInUser();
  const role = session?.role ?? "student";
  const email = session?.email ?? "";
  const isSupervisor = role === "supervisor" || role === "admin";
  const supervisor = isSupervisor ? getSupervisorByEmail(email) : null;
  const student = !isSupervisor ? getInternByEmail(email) : null;

  const [interns, setInterns] = useState<InternProfile[]>([]);
  const supervisorInterns = interns;
  const requestedStudentId = fixedStudentId ?? searchParams.get("student");
  const documentParam = searchParams.get("document");
  const [selectedInternId, setSelectedInternId] = useState<string | null>(
    isSupervisor ? requestedStudentId : null
  );
  const [remoteDocs, setRemoteDocs] = useState<DocumentItem[]>([]);

  useEffect(() => {
    if (isSupervisor && requestedStudentId) setSelectedInternId(requestedStudentId);
  }, [isSupervisor, requestedStudentId]);

  const activeInterns = useMemo(() => {
    if (!isSupervisor) return student ? [student] : [internProfiles["1"]];
    if (selectedInternId) {
      const one = interns.find(i => i.id === selectedInternId);
      return one ? [one] : supervisorInterns;
    }
    return supervisorInterns;
  }, [isSupervisor, student, selectedInternId, supervisorInterns, interns]);

  const allDocs = useMemo(() => selectedInternId
    ? remoteDocs.filter((document) => document.internId === selectedInternId)
    : remoteDocs, [remoteDocs, selectedInternId]);

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [internFilter, setInternFilter] = useState<string>("all");

  // UI state
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedId, setSelectedId] = useState<string>(allDocs[0]?.id ?? "");
  const [validated, setValidated] = useState<Set<string>>(new Set());
  const [documentAnalyses, setDocumentAnalyses] = useState<Record<string, string>>({});
  const [analysingDocument, setAnalysingDocument] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [draftingFeedback, setDraftingFeedback] = useState(false);
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewingDoc, setViewingDoc] = useState(false);

  useEffect(() => {
    if (documentParam) setSelectedId(documentParam);
  }, [documentParam]);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      try {
        const [documents, internsData] = await Promise.all([
          api.get<Array<{ id: number; internshipId: number; taskId: number; taskTitle: string; taskStatus: string; internId: number; internName: string; internAvatarColor: string | null; name: string; size: string; type: string; uploadedAt: string }>>("/api/documents"),
          isSupervisor ? api.get<any[]>("/api/supervisors/interns") : Promise.resolve([])
        ]);
        if (!cancelled) {
          setRemoteDocs(documents.map((document) => ({
            id: String(document.id), submissionId: document.id, internshipId: document.internshipId,
            name: document.name, size: document.size, type: document.type || fileCategory(document.name),
            uploadedAt: new Date(document.uploadedAt).toLocaleString(), internName: document.internName,
            internInitials: document.internName.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase(),
            internColor: document.internAvatarColor || "#111827", internId: String(document.internId),
            taskTitle: document.taskTitle, taskId: String(document.taskId), taskStatus: document.taskStatus,
          })));

          if (isSupervisor) {
            setInterns(internsData.map((intern) => ({
              id: String(intern.id),
              name: intern.name,
              initials: intern.name.split(/\s+/).map((part: string) => part[0]).slice(0, 2).join("").toUpperCase(),
              email: intern.email,
              phone: "",
              university: "",
              department: "",
              year: "",
              bio: "",
              skills: [],
              project: intern.title,
              role: intern.internRole || "Intern",
              status: intern.userStatus === "Active" ? "Active" : intern.userStatus === "Need Review" ? "Need Review" : "Revoked",
              accountStatus: "active",
              progress: intern.progress,
              avatarColor: intern.avatarColor || "#111827",
              tasks: [],
              startDate: "",
              endDate: "",
            })));
          }
        }
      } catch (error) {
        if (!cancelled) toast.error(error instanceof ApiError ? error.message : "Could not load documents");
      } finally { if (!cancelled) setLoading(false); }
    }
    void loadData();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupervisor]);

  useEffect(() => { if (!selectedId && allDocs[0]) setSelectedId(allDocs[0].id); }, [allDocs, selectedId]);
  useEffect(() => { setFeedbackDraft(""); }, [selectedId]);

  // Unique interns for filter
  const internOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string; initials: string }>();
    allDocs.forEach((d) => map.set(d.internId, { id: d.internId, name: d.internName, color: d.internColor, initials: d.internInitials }));
    return Array.from(map.values());
  }, [allDocs]);

  // Available file types
  const typeOptions = useMemo(() => {
    const types = new Set(allDocs.map((d) => d.type));
    return Array.from(types);
  }, [allDocs]);

  // Apply filters
  const filtered = useMemo(() => {
    return allDocs.filter((d) => {
      const matchSearch =
        !search ||
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.internName.toLowerCase().includes(search.toLowerCase()) ||
        d.taskTitle.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "all" || d.type === typeFilter;
      const matchStatus = statusFilter === "all" || d.taskStatus === statusFilter;
      const matchIntern = internFilter === "all" || d.internId === internFilter;
      return matchSearch && matchType && matchStatus && matchIntern;
    });
  }, [allDocs, search, typeFilter, statusFilter, internFilter]);

  const openInternDocs = (internId: string) => {
    setSelectedInternId(internId);
    setSelectedId("");
    router.push(`/documents?student=${internId}`);
  };

  const backToInternList = () => {
    setSelectedInternId(null);
    setSelectedId("");
    router.push("/documents");
  };

  const selectedDoc = allDocs.find((d) => d.id === selectedId);
  const documentAnalysis = selectedDoc ? documentAnalyses[selectedDoc.id] : undefined;
  const isValidated = selectedDoc ? selectedDoc.taskStatus === "reviewed" || validated.has(selectedDoc.id) : false;

  // Stats
  const stats = useMemo(() => ({
    total: allDocs.length,
    reviewed: allDocs.filter((d) => d.taskStatus === "reviewed").length,
    pending: allDocs.filter((d) => d.taskStatus === "in-progress" || d.taskStatus === "done").length,
    validated: validated.size,
  }), [allDocs, validated]);

  const [validating, setValidating] = useState(false);

  const handleValidate = async () => {
    if (!selectedDoc || validating) return;
    setValidating(true);
    try {
      await api.patch(
        `/api/internships/${selectedDoc.internshipId}/tasks/${selectedDoc.taskId}`,
        { status: "reviewed" }
      );
      // Update the status in the local document list so the badge changes immediately
      setRemoteDocs((prev) =>
        prev.map((d) =>
          d.taskId === selectedDoc.taskId ? { ...d, taskStatus: "reviewed" } : d
        )
      );
      setValidated((prev) => new Set([...prev, selectedDoc.id]));
      toast.success("Document validated", {
        description: `"${selectedDoc.name}" has been marked as Validated.`,
      });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not approve document");
    } finally {
      setValidating(false);
    }
  };

  const handleDisapprove = async () => {
    if (!selectedDoc || validating) return;
    setValidating(true);
    try {
      await api.patch(
        `/api/internships/${selectedDoc.internshipId}/tasks/${selectedDoc.taskId}`,
        { status: "done" }
      );
      setRemoteDocs((prev) =>
        prev.map((d) =>
          d.taskId === selectedDoc.taskId ? { ...d, taskStatus: "disapproved" } : d
        )
      );
      setValidated((prev) => {
        const next = new Set(prev);
        next.delete(selectedDoc.id);
        return next;
      });
      toast.success("Approval removed", {
        description: `"${selectedDoc.name}" has been marked as Submitted.`,
      });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not remove approval");
    } finally {
      setValidating(false);
    }
  };

  const sendFeedback = async () => {
    if (!selectedDoc || !feedbackDraft.trim() || sendingFeedback) return;
    setSendingFeedback(true);
    try {
      await api.post(`/api/internships/${selectedDoc.internshipId}/tasks/${selectedDoc.taskId}/feedbacks`, {
        content: feedbackDraft.trim(),
      });
      setRemoteDocs((prev) => prev.map((doc) =>
        doc.taskId === selectedDoc.taskId ? { ...doc, taskStatus: "reviewed" } : doc
      ));
      setValidated((prev) => new Set([...prev, selectedDoc.id]));
      setFeedbackDraft("");
      toast.success("Feedback sent and document marked as reviewed");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not send feedback");
    } finally {
      setSendingFeedback(false);
    }
  };

  const draftFeedbackWithAi = async () => {
    if (!selectedDoc || draftingFeedback) return;
    setDraftingFeedback(true);
    try {
      const result = await draftStudentFeedbackWithAi(selectedDoc.internshipId, selectedDoc.taskId);
      setFeedbackDraft(result.answer);
      toast.success("AI feedback draft is ready. Review and edit it before sending.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not create an AI feedback draft");
    } finally {
      setDraftingFeedback(false);
    }
  };

  const analyseDocument = async () => {
    if (!selectedDoc || analysingDocument) return;
    setAnalysingDocument(true);
    try {
      const result = await reviewDocumentWithAi(selectedDoc.submissionId);
      setDocumentAnalyses((analyses) => ({ ...analyses, [selectedDoc.id]: result.answer }));
      toast.success("AI document analysis is ready", { description: "Use it as review support; the approval decision remains yours." });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not analyse this document");
    } finally {
      setAnalysingDocument(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    setInternFilter("all");
  };

  const hasActiveFilters = search || typeFilter !== "all" || statusFilter !== "all" || internFilter !== "all";

  const selectedIntern = selectedInternId ? (interns.find(i => i.id === selectedInternId) || internProfiles[selectedInternId]) : null;
  const showInternPicker = isSupervisor && !selectedInternId && !fixedStudentId;
  const ContentShell = embedded ? Fragment : PageTransition;

  const downloadDocument = async (item: DocumentItem) => {
    try {
      const file = await api.download(`/api/internships/${item.internshipId}/tasks/${item.taskId}/submissions/${item.submissionId}/download`);
      const url = URL.createObjectURL(file.blob); const anchor = window.document.createElement("a");
      anchor.href = url; anchor.download = file.filename || item.name; anchor.click(); URL.revokeObjectURL(url);
    } catch (error) { toast.error(error instanceof ApiError ? error.message : "Could not download document"); }
  };

  if (loading) {
    return (
      <ContentShell>
          <div className="flex-1 overflow-auto p-8 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1,2,3,4].map((n) => (
                <div key={n} className="h-20 bg-[#E5E7EB] rounded-xl animate-pulse" />
              ))}
            </div>
            <div className="h-12 bg-[#E5E7EB] rounded-xl animate-pulse" />
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1,2,3,4,5,6,7,8].map((n) => (
                <div key={n} className="h-40 bg-[#E5E7EB] rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
      </ContentShell>
    );
  }

  return (
    <ContentShell>
        {/* â”€â”€ Page Header â”€â”€ */}
        <div className="bg-white border-b border-[#E5E7EB] px-8 py-5 shrink-0">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold text-[#111827]">
                {isSupervisor
                  ? selectedIntern
                    ? `${selectedIntern.name}'s Documents`
                    : "Document Center"
                  : "My Documents"}
              </h1>
              <p className="text-sm text-[#6B7280] mt-0.5">
                {isSupervisor
                  ? selectedIntern
                    ? "All files submitted by this intern across their tasks"
                    : "Select a student to browse their submitted documents"
                  : "All files you have submitted across your tasks"}
              </p>
            </div>
            {isSupervisor && selectedIntern && !fixedStudentId && (
              <button
                onClick={backToInternList}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F3F4F6]"
              >
                <ArrowLeft className="w-4 h-4" />
                All students
              </button>
            )}
            {!isSupervisor && (
              <button
                onClick={() => router.push("/student")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 hover:shadow-md shrink-0"
                style={{ background: "linear-gradient(135deg, #111827 0%, #111827 100%)" }}
              >
                <Upload className="w-4 h-4" />
                Upload Files
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col bg-[#F3F4F6]">
          {showInternPicker ? (
            <div className="flex-1 overflow-auto p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {supervisorInterns.map((intern) => {
                  const docCount = remoteDocs.filter((d) => d.internId === intern.id).length;
                  return (
                    <button
                      key={intern.id}
                      onClick={() => openInternDocs(intern.id)}
                      className="text-left bg-white rounded-xl border border-[#E5E7EB] p-5 hover:border-[#111827]/40 hover:shadow-md hover:-translate-y-0.5 transition-all group"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="w-11 h-11 rounded-full text-white text-sm font-bold flex items-center justify-center"
                          style={{ backgroundColor: intern.avatarColor }}
                        >
                          {intern.initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#111827] truncate">{intern.name}</p>
                          <p className="text-xs text-[#6B7280] truncate">{intern.project}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-[#6B7280]">
                        <span>{docCount} document{docCount !== 1 ? "s" : ""}</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                      {intern.accountStatus === "pending" && (
                        <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FEF3C7] text-[#92400E]">
                          Pending approval
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
          <>
          {/* Ã¢â€â‚¬Ã¢â€â‚¬ Stats row Ã¢â€â‚¬Ã¢â€â‚¬ */}
          <div className="px-8 py-5 grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
            <StatCard label="Total Documents"  value={stats.total}     sub="across all tasks"    color="#111827" />
            <StatCard label="Validated"        value={stats.reviewed}  sub="by supervisor"       color="#10B981" />
            <StatCard label="Under Review"     value={stats.pending}   sub="awaiting feedback"   color="#F59E0B" />
            <StatCard label="Validated"        value={stats.validated} sub="confirmed this session" color="#7C3AED" />
          </div>

          {/* Ã¢â€â‚¬Ã¢â€â‚¬ Filter / search bar Ã¢â€â‚¬Ã¢â€â‚¬ */}
          <div className="px-8 pb-4 shrink-0">
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-3 flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, task, or internÃ¢â‚¬Â¦"
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-[#E5E7EB] outline-none focus:border-[#111827] focus:ring-2 focus:ring-[#111827]/10 transition-all"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-4 h-4 text-[#9CA3AF]" />

                {/* File type filter */}
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 outline-none focus:border-[#111827] text-[#374151] bg-white cursor-pointer"
                >
                  <option value="all">All Types</option>
                  {typeOptions.map((t) => (
                    <option key={t} value={t}>{FILE_TYPE_LABELS[t] ?? t}</option>
                  ))}
                </select>

                {/* Status filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 outline-none focus:border-[#111827] text-[#374151] bg-white cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="reviewed">Validated</option>
                  <option value="in-progress">Under Review</option>
                  <option value="done">Submitted</option>
                  <option value="todo">Draft</option>
                </select>

                {/* Intern filter (supervisor only) */}
                {isSupervisor && (
                  <select
                    value={internFilter}
                    onChange={(e) => setInternFilter(e.target.value)}
                    className="text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 outline-none focus:border-[#111827] text-[#374151] bg-white cursor-pointer"
                  >
                    <option value="all">All Interns</option>
                    {internOptions.map((i) => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                )}

                {/* Clear filters */}
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 px-2.5 py-2 text-xs rounded-lg border border-[#fca5a5] bg-[#fff1f2] text-[#b91c1c] hover:bg-[#fee2e2] transition-colors"
                  >
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>

              {/* View toggle */}
              <div className="flex items-center gap-1 ml-auto bg-[#E5E7EB] rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-white shadow-sm text-[#111827]" : "text-[#6B7280] hover:text-[#374151]"}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-white shadow-sm text-[#111827]" : "text-[#6B7280] hover:text-[#374151]"}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="text-xs text-[#9CA3AF] mt-2 ml-1">
              {filtered.length} document{filtered.length !== 1 ? "s" : ""} found
              {hasActiveFilters ? " (filtered)" : ""}
            </p>
          </div>

          {/* Ã¢â€â‚¬Ã¢â€â‚¬ Main content: gallery + detail panel Ã¢â€â‚¬Ã¢â€â‚¬ */}
          <div className="flex flex-col xl:flex-row flex-1 overflow-auto xl:overflow-hidden px-8 pb-8 gap-6">

            {/* Gallery panel */}
            <div className="flex-1 overflow-hidden flex flex-col min-w-0">
              {filtered.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center bg-white rounded-xl border border-[#E5E7EB] px-8 py-16">
                  <div className="w-16 h-16 rounded-2xl bg-[#E5E7EB] flex items-center justify-center mb-4">
                    <FolderOpen className="w-8 h-8 text-[#9CA3AF]" />
                  </div>
                  <p className="text-sm font-semibold text-[#374151] mb-1">No documents found</p>
                  <p className="text-xs text-[#9CA3AF] max-w-xs">
                    {hasActiveFilters
                      ? "Try adjusting your filters or clearing the search."
                      : "No files have been uploaded yet. Go to your tasks and attach files to get started."}
                  </p>
                  {hasActiveFilters && (
                    <button onClick={clearFilters} className="mt-4 text-sm text-[#111827] hover:underline">
                      Clear all filters
                    </button>
                  )}
                </div>
              ) : (
                <ScrollArea className="flex-1">
                  {viewMode === "grid" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {filtered.map((doc) => (
                        <DocCard
                          key={doc.id}
                          doc={doc}
                          selected={doc.id === selectedId}
                          onSelect={() => setSelectedId(doc.id)}
                          validated={validated}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filtered.map((doc) => (
                        <DocRow
                          key={doc.id}
                          doc={doc}
                          selected={doc.id === selectedId}
                          onSelect={() => setSelectedId(doc.id)}
                          validated={validated}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              )}
            </div>

            {/* Detail + AI panel */}
            {selectedDoc && (
              <div className="w-full xl:w-80 shrink-0 flex flex-col gap-4 overflow-y-visible xl:overflow-y-auto">

                {/* Document info card */}
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <FileIcon name={selectedDoc.name} size="lg" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#111827] leading-snug mb-1">
                        {selectedDoc.name}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                          style={{ backgroundColor: selectedDoc.internColor }}
                        >
                          {selectedDoc.internInitials}
                        </div>
                        <span className="text-xs text-[#6B7280]">{selectedDoc.internName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Meta grid */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {[
                      { icon: Tag,      label: "Type",     value: getExt(selectedDoc.name).toUpperCase() || "—" },
                      { icon: File,     label: "Size",     value: selectedDoc.size },
                      { icon: Clock,    label: "Uploaded", value: selectedDoc.uploadedAt },
                      { icon: FileText, label: "Task",     value: selectedDoc.taskTitle },
                    ].map((m) => (
                      <div key={m.label} className="bg-[#F3F4F6] rounded-lg p-2.5">
                        <div className="flex items-center gap-1 mb-0.5">
                          <m.icon className="w-3 h-3 text-[#9CA3AF]" />
                          <span className="text-[10px] text-[#9CA3AF]">{m.label}</span>
                        </div>
                        <p className="text-xs font-semibold text-[#374151] truncate">{m.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs text-[#6B7280]">Status</span>
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5"
                      style={{
                        backgroundColor: (statusConfig[selectedDoc.taskStatus] || statusConfig.todo).bg,
                        color: (statusConfig[selectedDoc.taskStatus] || statusConfig.todo).text,
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: (statusConfig[selectedDoc.taskStatus] || statusConfig.todo).dot }}
                      />
                      {isValidated ? "Validated" : (statusConfig[selectedDoc.taskStatus] || statusConfig.todo).label}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setViewingDoc(true)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-[#111827] text-white text-sm font-medium hover:bg-[#1e3a8a]/90 transition-colors shadow-sm"
                    >
                      <Eye className="w-4 h-4" /> View Document
                    </button>
                    <div className="flex gap-2">
                      <button onClick={() => downloadDocument(selectedDoc)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-[#D1D5DB] text-sm text-[#374151] hover:bg-[#F3F4F6] transition-colors">
                        <Download className="w-3.5 h-3.5" /> Download
                      </button>
                      {isSupervisor && (
                        isValidated ? (
                          <button
                            onClick={handleDisapprove}
                            disabled={validating}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#D1FAE5] text-sm font-medium text-[#065F46] hover:bg-[#FEE2E2] hover:text-[#B91C1C] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {validating ? (
                              <>
                                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                </svg>
                                Removing...
                              </>
                            ) : (
                              <><X className="w-3.5 h-3.5" /> Disapprove</>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={handleValidate}
                            disabled={validating}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#10B981] text-white text-sm font-medium hover:bg-[#059669] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {validating ? (
                              <>
                                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                </svg>
                                Approving...
                              </>
                            ) : (
                              <><CheckCircle className="w-3.5 h-3.5" /> Approve</>
                            )}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {isSupervisor && (
                    <div className="mt-4 border-t border-[#E5E7EB] pt-4">
                      <label className="mb-1.5 block text-xs font-semibold text-[#374151]">Feedback for student</label>
                      <textarea
                        value={feedbackDraft}
                        onChange={(event) => setFeedbackDraft(event.target.value)}
                        placeholder="Write clear, constructive feedback…"
                        className="min-h-[88px] w-full resize-none rounded-lg border border-[#D1D5DB] px-3 py-2.5 text-sm text-[#374151] outline-none transition-colors focus:border-[#111827] focus:ring-2 focus:ring-[#111827]/15"
                      />
                      <p className="mt-1.5 text-[10px] leading-relaxed text-[#9CA3AF]">Sending feedback marks this task as reviewed and notifies the student.</p>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={draftFeedbackWithAi}
                          disabled={draftingFeedback}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-xs font-semibold text-[#374151] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          {draftingFeedback ? "Drafting…" : "Draft with AI"}
                        </button>
                        <button
                          onClick={sendFeedback}
                          disabled={sendingFeedback || !feedbackDraft.trim()}
                          className="flex-[1.45] rounded-lg bg-[#111827] px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#1F2937] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {sendingFeedback ? "Sending…" : "Send feedback & mark reviewed"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* AI Insights card */}
                <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E5E7EB] bg-gradient-to-r from-[#E5E7EB] to-white">
                    <div className="w-7 h-7 rounded-lg bg-[#E5E7EB] flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5 text-[#111827]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-[#111827]">AI Insights</p>
                      <p className="text-[10px] text-[#6B7280]">Supervisor decision support</p>
                    </div>
                  </div>
                  <div className="p-4">
                    {isSupervisor ? <>
                      {!documentAnalysis ? <>
                        <p className="text-xs leading-relaxed text-[#6B7280]">Analyse the readable document content for strengths, concerns, and review checks. AI never approves or rejects a submission.</p>
                        <button onClick={analyseDocument} disabled={analysingDocument} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#111827] px-3 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                          <Sparkles className="h-3.5 w-3.5" />{analysingDocument ? "Analysing document…" : "Analyse document"}
                        </button>
                      </> : <>
                        <p className="mb-3 whitespace-pre-line text-xs leading-relaxed text-[#374151]">{documentAnalysis}</p>
                        <p className="mb-3 rounded-lg bg-[#FFFBEB] p-2 text-[10px] leading-relaxed text-[#92400E]">AI is advisory only. Check the document yourself before approving it.</p>
                        <button onClick={analyseDocument} disabled={analysingDocument} className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#D1D5DB] px-3 py-2 text-xs font-medium text-[#374151] disabled:cursor-not-allowed disabled:opacity-60">
                          <Sparkles className="h-3.5 w-3.5" />{analysingDocument ? "Analysing document…" : "Run analysis again"}
                        </button>
                      </>}
                    </> : <p className="text-xs leading-relaxed text-[#6B7280]">AI document analysis is available to the assigned supervisor before they decide whether to approve a submission.</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
          </>
          )}
        </div>
      {/* Document Viewer Modal */}
      {viewingDoc && selectedDoc && (
        <DocumentViewerModal
          doc={selectedDoc}
          onClose={() => setViewingDoc(false)}
        />
      )}
    </ContentShell>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Document Viewer Modal Component Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function DocumentViewerModal({ doc, onClose }: { doc: DocumentItem; onClose: () => void }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(true);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    async function fetchFile() {
      setLoadingFile(true);
      setFetchError(null);
      try {
        const file = await api.download(
          `/api/internships/${doc.internshipId}/tasks/${doc.taskId}/submissions/${doc.submissionId}/download`
        );
        if (!cancelled) {
          objectUrl = URL.createObjectURL(file.blob);
          setBlobUrl(objectUrl);
        }
      } catch (err) {
        if (!cancelled)
          setFetchError(err instanceof ApiError ? err.message : "Could not load document");
      } finally {
        if (!cancelled) setLoadingFile(false);
      }
    }
    void fetchFile();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc.internshipId, doc.taskId, doc.submissionId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const downloadFile = () => {
    if (!blobUrl) return;
    const anchor = window.document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = doc.name;
    anchor.click();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-[#111827]/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl h-full max-h-[88vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-[#F3F4F6] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <FileIcon name={doc.name} size="sm" />
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-[#111827] leading-tight truncate">{doc.name}</h3>
              <p className="text-xs text-[#6B7280] mt-0.5">{doc.type.toUpperCase()} &bull; {doc.size} &bull; {doc.internName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <button
              onClick={downloadFile}
              disabled={!blobUrl}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-[#D1D5DB] text-sm text-[#374151] hover:bg-[#F3F4F6] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" /> Download
            </button>
            <button onClick={onClose} className="p-2 rounded-lg text-[#6B7280] hover:bg-[#fee2e2] hover:text-[#ef4444] transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewer area */}
        <div className="flex-1 overflow-hidden bg-[#E5E7EB] flex items-center justify-center">

          {loadingFile && (
            <div className="flex flex-col items-center gap-4 text-[#6B7280]">
              <svg className="w-10 h-10 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <p className="text-sm font-medium">Loading document&hellip;</p>
            </div>
          )}

          {!loadingFile && fetchError && (
            <div className="flex flex-col items-center gap-4 text-center p-8">
              <div className="w-16 h-16 rounded-full bg-[#fee2e2] flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-[#ef4444]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#111827] mb-1">Could not load document</p>
                <p className="text-xs text-[#6B7280] max-w-xs">{fetchError}</p>
              </div>
              <button onClick={onClose} className="px-4 py-2 rounded-lg bg-[#111827] text-white text-sm font-medium hover:opacity-90 transition-opacity">Close</button>
            </div>
          )}

          {!loadingFile && !fetchError && blobUrl && (doc.type === "pdf" || doc.type === "pptx") && (
            <iframe src={blobUrl} className="w-full h-full border-none" title={doc.name} />
          )}

          {!loadingFile && !fetchError && blobUrl && doc.type === "image" && (
            <div className="w-full h-full overflow-auto flex items-center justify-center p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={blobUrl} alt={doc.name} className="max-w-full max-h-full object-contain rounded-xl shadow-xl" />
            </div>
          )}

          {!loadingFile && !fetchError && blobUrl && doc.type === "video" && (
            <div className="w-full h-full flex items-center justify-center p-6">
              <video src={blobUrl} controls className="max-w-full max-h-full rounded-xl shadow-xl bg-black">
                Your browser does not support the video tag.
              </video>
            </div>
          )}

          {!loadingFile && !fetchError && blobUrl && doc.type === "code" && (
            <CodeTextViewer blobUrl={blobUrl} filename={doc.name} />
          )}

          {!loadingFile && !fetchError && blobUrl && (doc.type === "archive" || doc.type === "file") && (
            <div className="flex flex-col items-center gap-6 text-center p-8">
              <div className="w-24 h-24 bg-white rounded-2xl shadow-lg flex items-center justify-center">
                <FileIcon name={doc.name} size="lg" />
              </div>
              <div>
                <p className="text-lg font-bold text-[#111827] mb-1">{doc.name}</p>
                <p className="text-sm text-[#6B7280]">This file type cannot be previewed inline.</p>
              </div>
              <button onClick={downloadFile} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#111827] text-white font-medium hover:opacity-90 transition-opacity shadow-sm">
                <Download className="w-4 h-4" /> Download to view
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function CodeTextViewer({ blobUrl, filename }: { blobUrl: string; filename: string }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    fetch(blobUrl).then((r) => r.text()).then(setText).catch(() => setText("// Could not read file contents"));
  }, [blobUrl]);

  return (
    <div className="w-full h-full flex flex-col bg-[#1E1E1E] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-[#2D2D2D] border-b border-[#3D3D3D] shrink-0">
        <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
        <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
        <div className="w-3 h-3 rounded-full bg-[#28C840]" />
        <span className="ml-3 text-xs text-[#9CA3AF] font-mono">{filename}</span>
      </div>
      <ScrollArea className="flex-1">
        {text === null ? (
          <div className="flex items-center justify-center h-32 text-[#6B7280] text-sm">Reading file&hellip;</div>
        ) : (
          <pre className="text-sm text-[#D4D4D4] font-mono leading-relaxed p-6 whitespace-pre-wrap break-all">{text}</pre>
        )}
      </ScrollArea>
    </div>
  );
}
