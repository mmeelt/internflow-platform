import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  parse,
  differenceInCalendarDays,
  startOfDay,
} from "date-fns";
import type { InternProfile, Task, TaskCategory, TaskPriority, TaskStatus } from "./store";

const internProfiles: Record<string, InternProfile> = {};
const supervisorAssignedTasks: Array<Task & { targetInternId: string; internName: string }> = [];

export type CalendarEventType = "task" | "milestone" | "project-start" | "project-end" | "supervisor-task";
export type CalendarFilterKind = "task-category" | "milestone" | "project";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  startDate?: string;
  endDate?: string;
  type: CalendarEventType;
  category?: TaskCategory;
  categoryLabel?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  internName?: string;
  internId?: string;
  color: string;
  taskId?: string;
  /** true if this task was assigned by the supervisor — shown on both calendars */
  isSupervisorAssigned?: boolean;
  /** true if supervisor marked this as important */
  isImportant?: boolean;
}

export interface CalendarFilter {
  id: string;
  label: string;
  color: string;
  enabled: boolean;
  kind: CalendarFilterKind;
}

export const TASK_CATEGORIES: { id: TaskCategory; label: string; color: string }[] = [
  { id: "project-work", label: "My Project", color: "#D97706" },
  { id: "research", label: "Research", color: "#6366F1" },
  { id: "meetings", label: "Meetings", color: "#EC4899" },
  { id: "deliverables", label: "Deliverables", color: "#10B981" },
  { id: "training", label: "Training", color: "#EAB308" },
  { id: "personal", label: "Personal", color: "#6B7280" },
];

export const SUPERVISOR_STUDENT_COLORS = [
  "#2563EB",
  "#DB2777",
  "#059669",
  "#7C3AED",
  "#EA580C",
  "#0891B2",
  "#4F46E5",
  "#BE123C",
  "#65A30D",
  "#C026D3",
];

export function getSupervisorStudentColor(index: number): string {
  return SUPERVISOR_STUDENT_COLORS[index % SUPERVISOR_STUDENT_COLORS.length];
}

export function getCategoryMeta(category?: TaskCategory) {
  return TASK_CATEGORIES.find((c) => c.id === category) ?? TASK_CATEGORIES[0];
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  high: "#DC2626",
  medium: "#D97706",
  low: "#6B7280",
};

function parseFlexibleDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return parseISO(dateStr);
  }
  const parsed = parse(dateStr, "MMM d, yyyy", new Date());
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function toIsoDate(dateStr: string): string {
  const d = parseFlexibleDate(dateStr);
  return d ? format(d, "yyyy-MM-dd") : dateStr;
}

export function taskToEvent(task: Task, intern?: InternProfile): CalendarEvent {
  const start = task.startDate
    ? toIsoDate(task.startDate)
    : task.dueDate
    ? toIsoDate(task.dueDate)
    : undefined;
  const end = task.dueDate ? toIsoDate(task.dueDate) : undefined;
  const primaryDate = end ?? start ?? "";
  const categoryMeta = getCategoryMeta(task.category);

  return {
    id: `task-${intern?.id ?? "self"}-${task.id}`,
    title: task.title,
    description: task.description,
    date: primaryDate,
    startDate: start,
    endDate: end,
    type: "task",
    category: task.category ?? "project-work",
    categoryLabel: categoryMeta.label,
    priority: task.priority,
    status: task.status,
    internName: intern?.name,
    internId: intern?.id,
    color: categoryMeta.color,
    taskId: task.id,
  };
}

export function getStudentCalendarEvents(profile: InternProfile): CalendarEvent[] {
  const events: CalendarEvent[] = profile.tasks.map((t) => taskToEvent(t, profile));

  const start = parseFlexibleDate(profile.startDate);
  const end = parseFlexibleDate(profile.endDate);
  if (start) {
    events.push({
      id: "project-start",
      title: "Internship Start",
      date: format(start, "yyyy-MM-dd"),
      type: "project-start",
      color: "#111827",
    });
  }
  if (end) {
    events.push({
      id: "project-end",
      title: "Project Deadline",
      date: format(end, "yyyy-MM-dd"),
      type: "project-end",
      color: "#DC2626",
    });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

export function getSupervisorCalendarEvents(internsToShow: InternProfile[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const visibleInternIds = new Set(internsToShow.map((intern) => intern.id));
  const includedTaskIds = new Set<string>();

  internsToShow.forEach((intern) => {
    intern.tasks.forEach((task) => {
      includedTaskIds.add(`${intern.id}-${task.id}`);
      events.push({
        ...taskToEvent(task, intern),
        color: intern.avatarColor,
        type: task.supervisorAssigned ? "supervisor-task" : "task",
        categoryLabel: task.supervisorAssigned ? "Supervisor Task" : getCategoryMeta(task.category).label,
        isSupervisorAssigned: task.supervisorAssigned,
        isImportant: task.isImportant,
      });
    });

    const end = parseFlexibleDate(intern.endDate);
    if (end) {
      events.push({
        id: `project-end-${intern.id}`,
        title: `${intern.project} — Deadline`,
        date: format(end, "yyyy-MM-dd"),
        type: "project-end",
        internName: intern.name,
        internId: intern.id,
        color: intern.avatarColor,
      });
    }
  });

  // Add all supervisor-assigned tasks to the supervisor view
  supervisorAssignedTasks
    .filter((task) =>
      visibleInternIds.has(task.targetInternId) &&
      !includedTaskIds.has(`${task.targetInternId}-${task.id}`)
    )
    .forEach((t) => {
    const start = t.startDate ?? t.dueDate ?? "";
    const end   = t.dueDate ?? start;
    const intern = internsToShow.find((item) => item.id === t.targetInternId);
    events.push({
      id: `sv-task-${t.id}`,
      title: `📌 ${t.title}`,
      description: t.description,
      date: end || start,
      startDate: start,
      endDate: end !== start ? end : undefined,
      type: "supervisor-task",
      category: t.category,
      categoryLabel: "Supervisor Task",
      priority: t.priority,
      status: t.status,
      internName: t.internName,
      internId: t.targetInternId,
      color: intern?.avatarColor ?? "#111827",
      taskId: t.id,
      isSupervisorAssigned: true,
      isImportant: t.isImportant,
    });
    });

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

const STUDENT_FILTER_HINTS: Record<string, string> = {
  milestones: "Key internship checkpoints",
  project: "Internship start & final deadline",
};

export function getStudentFilterHint(id: string, kind: CalendarFilterKind): string {
  if (kind === "task-category") {
    return "Tasks you create in this category";
  }
  return STUDENT_FILTER_HINTS[id] ?? "";
}

export function getStudentFilters(): CalendarFilter[] {
  const taskFilters: CalendarFilter[] = TASK_CATEGORIES.map((c) => ({
    id: c.id,
    label: c.label,
    color: c.color,
    enabled: true,
    kind: "task-category" as const,
  }));

  const systemFilters: CalendarFilter[] = [
    { id: "milestones", label: "Milestones", color: "#10B981", enabled: true, kind: "milestone" },
    { id: "project", label: "Project Deadlines", color: "#DC2626", enabled: true, kind: "project" },
  ];

  return [...taskFilters, ...systemFilters];
}

/**
 * The supervisor calendar only needs these display fields. Keeping this
 * intentionally small lets the calendar use the API's intern summary rather
 * than requiring the client-side mock InternProfile shape.
 */
export function getSupervisorFilters(
  interns: Array<Pick<InternProfile, "id" | "name" | "avatarColor">>
): CalendarFilter[] {
  return interns.map((i) => ({
    id: i.id,
    label: i.name,
    color: i.avatarColor,
    enabled: true,
    kind: "task-category" as CalendarFilterKind,
  }));
}

export function filterEvents(
  events: CalendarEvent[],
  filters: CalendarFilter[],
  role: "student" | "supervisor"
): CalendarEvent[] {
  const enabled = new Set(filters.filter((f) => f.enabled).map((f) => f.id));

  return events.filter((e) => {
    if (role === "student") {
      if (e.type === "task") return enabled.has(e.category ?? "project-work");
      if (e.type === "milestone") return enabled.has("milestones");
      if (e.type === "project-start" || e.type === "project-end") return enabled.has("project");
      return true;
    }
    if (e.internId) return enabled.has(e.internId);
    return true;
  });
}

export function getMonthDays(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  return eachDayOfInterval({ start, end });
}

export function getEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const key = format(day, "yyyy-MM-dd");
  return events.filter((e) => {
    if (e.startDate && e.endDate) return key >= e.startDate && key <= e.endDate;
    if (e.startDate && !e.endDate) return key === e.startDate;
    return e.date === key;
  });
}

export function isEventDeadlineDay(event: CalendarEvent, day: Date): boolean {
  const key = format(day, "yyyy-MM-dd");
  return !!event.endDate && event.endDate === key;
}

export function getDeadlineUrgencyColor(event: CalendarEvent, today = new Date()): string | null {
  const deadline = event.endDate ?? (
    event.type === "project-end" || event.isSupervisorAssigned
      ? event.date
      : undefined
  );
  if (!deadline) return null;

  const parsedDeadline = parseFlexibleDate(deadline);
  if (!parsedDeadline) return null;

  const daysRemaining = differenceInCalendarDays(
    startOfDay(parsedDeadline),
    startOfDay(today)
  );

  if (daysRemaining < 2) return "#DC2626";
  if (daysRemaining < 7) return "#D97706";
  return "#16A34A";
}

export function findTaskForEvent(event: CalendarEvent): Task | undefined {
  if (!event.taskId) return undefined;
  
  // 1. Check supervisorAssignedTasks
  const svTask = supervisorAssignedTasks.find((t) => t.id === event.taskId);
  if (svTask) return svTask;

  // 2. Check specific intern's tasks
  if (event.internId) {
    const found = internProfiles[event.internId]?.tasks.find((t) => t.id === event.taskId);
    if (found) return found;
  }
  
  // 3. Search all interns as a fallback
  for (const intern of Object.values(internProfiles)) {
    const found = intern.tasks.find((t) => t.id === event.taskId);
    if (found) return found;
  }
  return undefined;
}

export { isSameMonth, isSameDay, isToday, format, PRIORITY_COLORS };
