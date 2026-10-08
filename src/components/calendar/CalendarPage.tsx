"use client";

import { useState, useMemo, useEffect, type ReactNode } from "react";
import { PageTransition } from "@/components/PageTransition";
import { Calendar as MiniCalendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type Task,
  type TaskCategory,
  type TaskPriority,
  type TaskStatus,
  type InternProfile,
} from "@/lib/store";
import { api } from "@/lib/api";
import {
  getStudentCalendarEvents,
  getSupervisorCalendarEvents,
  getStudentFilters,
  getSupervisorFilters,
  filterEvents,
  getMonthDays,
  getEventsForDay,
  getDeadlineUrgencyColor,
  getStudentFilterHint,
  findTaskForEvent,
  getSupervisorStudentColor,
  TASK_CATEGORIES,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  type CalendarEvent,
  type CalendarFilter,
} from "@/lib/calendar-utils";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  Clock,
  Check,
  Circle,
  Search,
  X,
  ArrowLeft,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MAX_EVENTS_PER_CELL = 3;

const TYPE_LABELS: Record<string, string> = {
  task: "Task",
  "supervisor-task": "Supervisor Task",
  milestone: "Milestone",
  "project-start": "Start",
  "project-end": "Deadline",
};

interface CalendarPageProps {
  role: "student" | "supervisor";
}

interface BackendIntern {
  id: number;
  name: string;
  avatarColor: string | null;
  internshipId: number;
  title: string;
  endDate?: string | null;
}

interface BackendTaskDto {
  id: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: string;
  status: string;
  progress: number;
}

interface BackendInternship {
  id: number;
  title: string;
  startDate: string | null;
  endDate: string | null;
  progress: number;
  intern: { id: number; name: string; avatarColor: string | null };
}

interface PersonalCalendarTaskDto {
  id: number;
  title: string;
  description: string | null;
  startDate: string;
  dueDate: string | null;
  category: TaskCategory | null;
  priority: TaskPriority;
  status: "todo" | "done";
}

function mapBackendTask(dto: BackendTaskDto): Task {
  return {
    id: String(dto.id),
    title: dto.title,
    description: dto.description ?? "",
    dueDate: dto.dueDate ?? undefined,
    priority: dto.priority as TaskPriority,
    status: dto.status as Task["status"],
    progress: dto.progress,
    submissions: [],
    supervisorAssigned: true,
  };
}

function toCalendarIntern(internship: BackendInternship, tasks: Task[]): InternProfile {
  return {
    id: String(internship.intern.id),
    name: internship.intern.name,
    initials: internship.intern.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    email: "",
    phone: "",
    university: "",
    department: "",
    year: "",
    bio: "",
    skills: [],
    project: internship.title,
    role: "Intern",
    status: "Active",
    progress: internship.progress,
    startDate: internship.startDate ?? "",
    endDate: internship.endDate ?? "",
    avatarColor: internship.intern.avatarColor ?? "#111827",
    tasks,
  };
}

export function CalendarPage({ role }: CalendarPageProps) {

  const [backendInterns, setBackendInterns] = useState<BackendIntern[]>([]);
  const [backendTasksByInternship, setBackendTasksByInternship] = useState<Record<number, Task[]>>({});
  const [calendarInternProfiles, setCalendarInternProfiles] = useState<InternProfile[]>([]);
  const [personalCalendarTasks, setPersonalCalendarTasks] = useState<PersonalCalendarTaskDto[]>([]);
  const [studentInternshipId, setStudentInternshipId] = useState<number | null>(null);

  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [showCreate, setShowCreate] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);

  const profile = role === "student" ? (calendarInternProfiles[0] ?? null) : null;
  const interns = backendInterns.map((i) => ({
        id: String(i.id),
        name: i.name,
        avatarColor: i.avatarColor ?? "#111827",
        internshipId: i.internshipId,
      }));

  const [filters, setFilters] = useState<CalendarFilter[]>(() =>
    role === "student" ? getStudentFilters() : getSupervisorFilters(interns)
  );

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: "",
    hasEndDate: false,
    category: (role === "supervisor" ? "meetings" : "project-work") as TaskCategory,
    priority: "medium" as TaskPriority,
    targetInternId: "",
    isImportant: false,
  });

  const taskCategoryFilters = filters.filter((f) => f.kind === "task-category");
  const systemFilters = filters.filter((f) => f.kind !== "task-category");

  const openEventDetail = (event: CalendarEvent) => {
    setSelectedEvent(event);
  };

  const closeEventDetail = () => {
    setSelectedEvent(null);
  };

  const handleToggleEventStatus = async (event: CalendarEvent) => {
    // Only students can mark tasks as done — supervisors have read-only access
    if (role === "supervisor") {
      toast.error("Only the student can mark tasks as done");
      return;
    }
    if (!event.taskId || event.status === "reviewed") return;
    const nextStatus = event.status === "done" ? "todo" : "done";
    const nextProgress = nextStatus === "done" ? 100 : 0;
    try {
      if (event.id.startsWith("personal-calendar-task-")) {
        const updated = await api.patch<PersonalCalendarTaskDto>(`/api/calendar/personal-tasks/${event.taskId}`, { status: nextStatus });
        setPersonalCalendarTasks((tasks) => tasks.map((task) => task.id === updated.id ? updated : task));
      } else if (studentInternshipId) {
        if (!Number.isNaN(Number(event.taskId))) {
          await api.patch(`/api/internships/${studentInternshipId}/tasks/${event.taskId}`, {
            status: nextStatus,
            progress: nextProgress
          });
          // Update local state to prevent immediate UI revert
          setBackendTasksByInternship((prev) => {
            const tasks = prev[studentInternshipId] || [];
            return {
              ...prev,
              [studentInternshipId]: tasks.map((t) => String(t.id) === event.taskId ? { ...t, status: nextStatus as TaskStatus, progress: nextProgress } : t)
            };
          });
          setCalendarInternProfiles((prev) => prev.map((p) => {
            return {
              ...p,
              tasks: p.tasks.map((t) => String(t.id) === event.taskId ? { ...t, status: nextStatus as TaskStatus, progress: nextProgress } : t)
            };
          }));
        } else return;
      } else {
        return;
      }
      event.status = nextStatus;
      setRefreshKey((key) => key + 1);
      toast.success(nextStatus === "done" ? "Task marked as done" : "Task marked as to do");
    } catch (error) {
      console.error("Failed to update calendar task", error);
      toast.error("Could not update this task");
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent || !selectedEvent.taskId) return;
    const taskId = selectedEvent.taskId;

    if (role === "student" && selectedEvent.id.startsWith("personal-calendar-task-")) {
      try {
        await api.delete(`/api/calendar/personal-tasks/${taskId}`);
        setPersonalCalendarTasks((tasks) => tasks.filter((task) => String(task.id) !== taskId));
        toast.success("Personal calendar task deleted");
        closeEventDetail();
      } catch (error) {
        console.error("Failed to delete personal calendar task", error);
        toast.error("Could not delete this calendar task");
      }
      return;
    }

    // Real supervisor tasks are deleted through the same API used by the
    // Tasks & Submissions page, keeping both calendars in sync.
    if (role === "supervisor" && selectedEvent.internId) {
      const targetIntern = backendInterns.find((intern) => String(intern.id) === selectedEvent.internId);
      if (targetIntern) {
        try {
          await api.delete(`/api/internships/${targetIntern.internshipId}/tasks/${taskId}`);
          toast.success("Task deleted");
          setRefreshKey((key) => key + 1);
          closeEventDetail();
        } catch (error) {
          console.error("Failed to delete calendar task", error);
          toast.error("Could not delete this task");
        }
        return;
      }
    }

    toast.error("This task cannot be deleted from the calendar");
  };

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1279px)");
    const update = () => setIsNarrowScreen(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Calendar events come from the same task records used by the student and
  // supervisor workspaces, so newly assigned tasks appear for both roles.
  useEffect(() => {
    const loadCalendarTasks = async () => {
      try {
        if (role === "supervisor") {
          const assignedInterns = await api.get<BackendIntern[]>("/api/supervisors/interns");
          const coloredInterns = [...assignedInterns]
            .sort((a, b) => a.id - b.id)
            .map((intern, index) => ({
              ...intern,
              avatarColor: getSupervisorStudentColor(index),
            }));
          const taskEntries = await Promise.all(
            coloredInterns.map(async (intern) => [
              intern.internshipId,
              (await api.get<BackendTaskDto[]>(`/api/internships/${intern.internshipId}/tasks`)).map(mapBackendTask),
            ] as const)
          );
          const tasksByInternship = Object.fromEntries(taskEntries);
          setBackendInterns(coloredInterns);
          setBackendTasksByInternship(tasksByInternship);
          setFilters(getSupervisorFilters(coloredInterns.map((intern) => ({
            id: String(intern.id),
            name: intern.name,
            avatarColor: intern.avatarColor,
          }))));
          setCalendarInternProfiles(coloredInterns.map((intern) =>
            toCalendarIntern({
              id: intern.internshipId,
              title: intern.title,
              startDate: null,
              endDate: intern.endDate ?? null,
              progress: 0,
              intern: { id: intern.id, name: intern.name, avatarColor: intern.avatarColor },
            }, tasksByInternship[intern.internshipId] ?? [])
          ));
        } else {
          const internships = await api.get<BackendInternship[]>("/api/internships");
          const current = internships[0];
          if (!current) return;
          const [taskDtos, personalTasks] = await Promise.all([
            api.get<BackendTaskDto[]>(`/api/internships/${current.id}/tasks`),
            api.get<PersonalCalendarTaskDto[]>("/api/calendar/personal-tasks"),
          ]);
          const tasks = taskDtos.map(mapBackendTask);
          setStudentInternshipId(current.id);
          setBackendTasksByInternship({ [current.id]: tasks });
          setPersonalCalendarTasks(personalTasks);
          setCalendarInternProfiles([toCalendarIntern(current, tasks)]);
        }
      } catch (error) {
        console.error("Failed to load calendar tasks", error);
      }
    };
    void loadCalendarTasks();
  }, [role, refreshKey]);

  const allEvents = useMemo(() => {
    void refreshKey;
    if (role === "student" && profile) {
      const internshipEvents = getStudentCalendarEvents(profile);
      const privateEvents: CalendarEvent[] = personalCalendarTasks.map((task) => ({
        id: `personal-calendar-task-${task.id}`,
        title: task.title,
        description: task.description ?? undefined,
        date: task.dueDate ?? task.startDate,
        startDate: task.startDate,
        endDate: task.dueDate ?? undefined,
        type: "task",
        category: task.category ?? "personal",
        categoryLabel: "Personal calendar task",
        priority: task.priority,
        status: task.status,
        color: "#6B7280",
        taskId: String(task.id),
      }));
      return [...internshipEvents, ...privateEvents].sort((a, b) => a.date.localeCompare(b.date));
    }
    return getSupervisorCalendarEvents(calendarInternProfiles);
  }, [role, profile, refreshKey, calendarInternProfiles, personalCalendarTasks]);

  const filteredEvents = useMemo(() => {
    let events = filterEvents(allEvents, filters, role);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      events = events.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.internName?.toLowerCase().includes(q)
      );
    }
    return events;
  }, [allEvents, filters, role, searchQuery]);

  const monthDays = useMemo(() => getMonthDays(currentMonth), [currentMonth]);
  const selectedDayEvents = useMemo(
    () => getEventsForDay(filteredEvents, selectedDate),
    [filteredEvents, selectedDate]
  );

  const upcomingDeadlines = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return filteredEvents
      .filter((e) => e.date >= today && (e.type === "task" || e.type === "project-end"))
      .slice(0, 5);
  }, [filteredEvents]);

  const toggleFilter = (id: string) => {
    setFilters((prev) =>
      prev.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f))
    );
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  const prevMonth = () =>
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () =>
    setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  const handleCreateTask = async () => {
    if (isCreatingTask) return;
    if (!newTask.title.trim()) return;
    if (!newTask.startDate) {
      toast.error("Please pick a start date");
      return;
    }
    if (newTask.hasEndDate) {
      if (!newTask.endDate) {
        toast.error("Please pick an end date or turn off the deadline option");
        return;
      }
      if (newTask.endDate < newTask.startDate) {
        toast.error("End date must be on or after start date");
        return;
      }
    }

    setIsCreatingTask(true);

    if (role === "student" && profile) {
      try {
        const created = await api.post<PersonalCalendarTaskDto>("/api/calendar/personal-tasks", {
          title: newTask.title.trim(),
          description: newTask.description.trim() || null,
          startDate: newTask.startDate,
          dueDate: newTask.hasEndDate ? newTask.endDate : null,
          category: newTask.category,
          priority: newTask.priority,
        });
        setPersonalCalendarTasks((tasks) => [...tasks, created]);
        toast.success("Personal task added to your calendar", { description: newTask.title });
      } catch (error) {
        console.error("Failed to create personal calendar task", error);
        toast.error("Could not add this calendar task");
        setIsCreatingTask(false);
        return;
      }
    } else if (role === "supervisor") {
      if (!newTask.targetInternId) {
        toast.error("Please select an intern to assign this task");
        return;
      }
      const targetIntern = backendInterns.find((intern) => String(intern.id) === newTask.targetInternId);
      if (!targetIntern) {
        toast.error("The selected intern is not available. Refresh the calendar and try again.");
        return;
      }
      try {
        await api.post(`/api/internships/${targetIntern.internshipId}/tasks`, {
          title: newTask.title.trim(),
          description: newTask.description.trim() || null,
          dueDate: newTask.hasEndDate ? newTask.endDate : newTask.startDate,
          priority: newTask.priority,
        });
        toast.success("Task assigned to intern", { description: `Assigned to ${targetIntern.name}` });
      } catch (error) {
        console.error("Failed to assign calendar task", error);
        toast.error("Could not assign this task");
        setIsCreatingTask(false);
        return;
      }
    }

    setRefreshKey((k) => k + 1);
    const focusDate = newTask.hasEndDate ? newTask.endDate : newTask.startDate;
    setSelectedDate(new Date(focusDate + "T12:00:00"));
    setCurrentMonth(new Date(focusDate + "T12:00:00"));

    const today = format(new Date(), "yyyy-MM-dd");
    setNewTask({
      title: "",
      description: "",
      startDate: today,
      endDate: "",
      hasEndDate: false,
      category: role === "supervisor" ? "meetings" : "project-work",
      priority: "medium",
      targetInternId: "",
      isImportant: false,
    });
    setIsCreatingTask(false);
    setShowCreate(false);
  };

  useEffect(() => {
    if (showCreate) {
      const day = format(selectedDate, "yyyy-MM-dd");
      setNewTask((t) => ({
        ...t,
        startDate: day,
        endDate: t.hasEndDate ? t.endDate || day : "",
        hasEndDate: t.hasEndDate,
      }));
    }
  }, [showCreate, selectedDate]);

  return (
    <PageTransition>
      <div className="flex flex-col h-full min-h-0">
        {/* Header */}
        <div className="page-header flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-charcoal tracking-tight">Calendar</h1>
            <p className="text-sm text-muted mt-0.5">
              {role === "student"
                ? "Organize your tasks and track project deadlines"
                : "View all intern task deadlines and project milestones"}
            </p>
          </div>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-light" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-9 pr-8 w-full sm:w-56"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-light hover:text-charcoal"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-[260px] shrink-0 border-r border-border bg-white flex flex-col overflow-y-auto hidden lg:flex">
            <div className="p-4 border-b border-border">
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-charcoal text-charcoal text-sm font-semibold hover:bg-charcoal hover:text-white transition-colors"
              >
                <Plus className="w-4 h-4" />
                {role === "supervisor" ? "Assign Task" : "Create Task"}
              </button>
            </div>

            <div className="p-4 border-b border-border">
              <MiniCalendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && (setSelectedDate(d), setCurrentMonth(d))}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                className="p-0"
                classNames={{
                  day_selected: "bg-charcoal text-white hover:bg-charcoal hover:text-white",
                  day_today: "bg-grey-200 text-charcoal font-semibold",
                }}
              />
            </div>

            <div className="p-4 flex-1">
              <p className="text-[10px] font-semibold text-muted-light uppercase tracking-widest mb-1">
                {role === "student" ? "Categories" : "My Interns"}
              </p>
              {role === "student" && (
                <p className="text-[10px] text-muted mb-3 leading-relaxed">
                  Pick a category when creating a task · toggle to show or hide
                </p>
              )}

              {role === "student" && taskCategoryFilters.length > 0 && (
                <>
                  <p className="text-[10px] font-medium text-muted-light mb-2 px-2">Task categories</p>
                  <div className="space-y-1 mb-4">
                    {taskCategoryFilters.map((f) => (
                      <FilterRow
                        key={f.id}
                        filter={f}
                        hint={getStudentFilterHint(f.id, f.kind)}
                        onToggle={() => toggleFilter(f.id)}
                      />
                    ))}
                  </div>
                </>
              )}

              {role === "student" && systemFilters.length > 0 && (
                <>
                  <p className="text-[10px] font-medium text-muted-light mb-2 px-2">Project timeline</p>
                  <div className="space-y-1">
                    {systemFilters.map((f) => (
                      <FilterRow
                        key={f.id}
                        filter={f}
                        hint={getStudentFilterHint(f.id, f.kind)}
                        onToggle={() => toggleFilter(f.id)}
                      />
                    ))}
                  </div>
                </>
              )}

              {role === "supervisor" && (
                <div className="space-y-1">
                  {filters.map((f) => (
                    <FilterRow key={f.id} filter={f} onToggle={() => toggleFilter(f.id)} />
                  ))}
                </div>
              )}

              <div className="mt-5 pt-4 border-t border-border">
                <p className="text-[10px] font-semibold text-muted-light uppercase tracking-widest mb-2">
                  Deadline urgency
                </p>
                <div className="space-y-2 text-[10px] text-muted">
                  <DeadlineLegend color="#16A34A" label="7 or more days" />
                  <DeadlineLegend color="#D97706" label="2–6 days" />
                  <DeadlineLegend color="#DC2626" label="Less than 2 days or overdue" />
                </div>
              </div>
            </div>

            {upcomingDeadlines.length > 0 && (
              <div className="p-4 border-t border-border">
                <p className="text-[10px] font-semibold text-muted-light uppercase tracking-widest mb-3">
                  Upcoming Deadlines
                </p>
                <div className="space-y-2">
                  {upcomingDeadlines.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => {
                        const d = new Date(e.date + "T12:00:00");
                        setSelectedDate(d);
                        setCurrentMonth(d);
                        openEventDetail(e);
                      }}
                      className="w-full text-left p-2.5 rounded-xl bg-grey-100 hover:bg-grey-200 transition-colors"
                    >
                      <p className="text-xs font-medium text-charcoal truncate">{e.title}</p>
                      <p className="text-[10px] text-muted mt-0.5">
                        {format(new Date(e.date + "T12:00:00"), "MMM d, yyyy")}
                        {e.internName && ` · ${e.internName}`}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* Main calendar grid */}
          <div className="flex-1 flex flex-col min-w-0 overflow-x-auto bg-white">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={prevMonth}
                  className="p-2 rounded-xl border border-border hover:bg-grey-100 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-charcoal" />
                </button>
                <h2 className="text-lg font-semibold text-charcoal min-w-[160px] text-center">
                  {format(currentMonth, "MMMM yyyy")}
                </h2>
                <button
                  onClick={nextMonth}
                  className="p-2 rounded-xl border border-border hover:bg-grey-100 transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-charcoal" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm text-charcoal-soft">
                  <CalendarDays className="w-4 h-4 text-muted" />
                  Month
                </div>
                <button
                  onClick={goToToday}
                  className="btn-secondary py-2 px-3 text-xs"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Today
                </button>
                <button
                  onClick={() => setShowCreate(true)}
                  className="btn-primary py-2 px-3 text-xs lg:hidden"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {role === "supervisor" ? "Assign" : "Create"}
                </button>
              </div>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-border shrink-0">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="py-2.5 text-center text-[10px] font-semibold text-muted-light uppercase tracking-wider"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Month grid */}
            <div className="flex-1 overflow-auto">
              <div className="grid grid-cols-7 min-h-full">
                {monthDays.map((day) => {
                  const dayEvents = getEventsForDay(filteredEvents, day);
                  const inMonth = isSameMonth(day, currentMonth);
                  const selected = isSameDay(day, selectedDate);
                  const today = isToday(day);

                  return (
                    <div
                      key={day.toISOString()}
                      onClick={() => {
                        setSelectedDate(day);
                        closeEventDetail();
                      }}
                      className={`min-h-[100px] md:min-h-[120px] border-r border-b border-border p-1.5 text-left transition-colors hover:bg-grey-50 cursor-pointer ${
                        !inMonth ? "bg-grey-50/50" : "bg-white"
                      } ${selected ? "ring-2 ring-inset ring-charcoal/20 bg-grey-50" : ""}`}
                    >
                      <div className="flex justify-end mb-1">
                        <span
                          className={`w-7 h-7 flex items-center justify-center text-xs font-medium rounded-full ${
                            today
                              ? "bg-charcoal text-white"
                              : inMonth
                              ? "text-charcoal"
                              : "text-muted-light"
                          }`}
                        >
                          {format(day, "d")}
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        {dayEvents.slice(0, MAX_EVENTS_PER_CELL).map((event) => (
                          <button
                            key={event.id + format(day, "yyyy-MM-dd")}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDate(day);
                              openEventDetail(event);
                            }}
                            className={`w-full text-left rounded-md transition-opacity ${
                              selectedEvent?.id === event.id ? "ring-1 ring-charcoal/40" : ""
                            }`}
                          >
                            <EventChip event={event} day={day} compact />
                          </button>
                        ))}
                        {dayEvents.length > MAX_EVENTS_PER_CELL && (
                          <p className="text-[10px] text-muted px-1">
                            +{dayEvents.length - MAX_EVENTS_PER_CELL} more
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Selected day / event detail panel */}
          <aside className="w-[300px] shrink-0 border-l border-border bg-grey-50 overflow-y-auto hidden xl:flex flex-col">
            {selectedEvent ? (
              <EventDetailPanel
                event={selectedEvent}
                onBack={closeEventDetail}
                onUpdate={() => setRefreshKey((k) => k + 1)}
                onToggleStatus={handleToggleEventStatus}
                onDelete={handleDeleteEvent}
                role={role}
              />
            ) : (
              <>
                <div className="p-5 border-b border-border bg-white">
                  <p className="text-[10px] font-semibold text-muted-light uppercase tracking-widest">
                    Selected Day
                  </p>
                  <h3 className="text-lg font-bold text-charcoal mt-1">
                    {format(selectedDate, "EEEE, MMM d")}
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    {selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="p-4 space-y-2 flex-1">
                  {selectedDayEvents.length === 0 ? (
                    <div className="text-center py-8">
                      <CalendarDays className="w-10 h-10 text-muted-light mx-auto mb-2" />
                      <p className="text-sm text-muted">No events on this day</p>
                      <button
                        onClick={() => setShowCreate(true)}
                        className="mt-3 text-xs text-charcoal font-medium hover:underline"
                      >
                        + Add a task
                      </button>
                    </div>
                  ) : (
                    selectedDayEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onClick={() => openEventDetail(event)}
                        active={false}
                      />
                    ))
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      </div>

      {/* Mobile event detail dialog */}
      <Dialog open={!!selectedEvent && isNarrowScreen} onOpenChange={(open) => !open && closeEventDetail()}>
        <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden bg-[#F3F4F6] border-[#E5E7EB] shadow-xl rounded-2xl xl:hidden max-h-[85vh] overflow-y-auto">
          {selectedEvent && (
            <EventDetailPanel
              event={selectedEvent}
              onBack={closeEventDetail}
              onUpdate={() => setRefreshKey((k) => k + 1)}
              onToggleStatus={handleToggleEventStatus}
              onDelete={handleDeleteEvent}
              role={role}
              embedded
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create task dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden bg-[#F3F4F6] border-[#E5E7EB] shadow-xl rounded-2xl flex flex-col max-h-[85vh]">
          <div className="bg-white px-6 pt-5 pb-4 border-b border-[#E5E7EB] shrink-0">
            <DialogHeader>
              <DialogTitle className="text-charcoal text-base font-bold">
                {role === "supervisor" ? "Assign Task" : "Create Task"}
              </DialogTitle>
              <p className="text-xs text-muted mt-1">Pick a start date — add an end date only if you want a deadline</p>
            </DialogHeader>
          </div>
          <div className="px-6 py-4 space-y-4 overflow-y-auto min-h-0">
            <div>
              <label className="text-xs font-semibold text-charcoal-soft uppercase tracking-wide">Title</label>
              <input
                className="input-field mt-1.5 bg-white border-[#E5E7EB]"
                placeholder="Task title..."
                value={newTask.title}
                onChange={(e) => setNewTask((t) => ({ ...t, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-charcoal-soft uppercase tracking-wide">Description</label>
              <textarea
                className="input-field mt-1.5 min-h-[80px] resize-none bg-white border-[#E5E7EB]"
                placeholder="Optional description..."
                value={newTask.description}
                onChange={(e) => setNewTask((t) => ({ ...t, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-charcoal-soft uppercase tracking-wide">Start Date</label>
              <input
                type="date"
                className="input-field mt-1.5 bg-white border-[#E5E7EB]"
                value={newTask.startDate}
                onChange={(e) =>
                  setNewTask((t) => ({
                    ...t,
                    startDate: e.target.value,
                    endDate: t.hasEndDate && t.endDate && t.endDate < e.target.value ? e.target.value : t.endDate,
                  }))
                }
              />
            </div>

            <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-[#E5E7EB] cursor-pointer hover:border-[#D1D5DB] transition-colors">
              <input
                type="checkbox"
                checked={newTask.hasEndDate}
                onChange={(e) =>
                  setNewTask((t) => ({
                    ...t,
                    hasEndDate: e.target.checked,
                    endDate: e.target.checked ? t.endDate || t.startDate : "",
                  }))
                }
                className="w-4 h-4 rounded border-[#D1D5DB] text-charcoal focus:ring-charcoal/20"
              />
              <span className="flex-1">
                <span className="block text-sm font-medium text-charcoal">Set an end date (deadline)</span>
                <span className="block text-[11px] text-muted mt-0.5">
                  {newTask.hasEndDate
                    ? "Task will show from start until the deadline"
                    : "Task will appear only on the start date — no deadline"}
                </span>
              </span>
            </label>

            {newTask.hasEndDate && (
              <div>
                <label className="text-xs font-semibold text-charcoal-soft uppercase tracking-wide">End Date</label>
                <input
                  type="date"
                  className="input-field mt-1.5 bg-white border-[#E5E7EB]"
                  value={newTask.endDate}
                  min={newTask.startDate}
                  onChange={(e) => setNewTask((t) => ({ ...t, endDate: e.target.value }))}
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-charcoal-soft uppercase tracking-wide">Category</label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {TASK_CATEGORIES
                  .filter((cat) => role === "student" || ["meetings", "deliverables", "training"].includes(cat.id))
                  .map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setNewTask((t) => ({ ...t, category: cat.id }))}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-sm transition-all ${
                      newTask.category === cat.id
                        ? "border-charcoal bg-white shadow-sm font-medium text-charcoal"
                        : "border-[#E5E7EB] bg-white text-charcoal-soft hover:border-[#D1D5DB]"
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="truncate">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-charcoal-soft uppercase tracking-wide">Priority</label>
              <select
                className="input-field mt-1.5 bg-white border-[#E5E7EB]"
                value={newTask.priority}
                onChange={(e) => setNewTask((t) => ({ ...t, priority: e.target.value as TaskPriority }))}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            {role === "supervisor" && (
              <>
                <div className="pt-2 border-t border-[#E5E7EB]">
                  <label className="text-xs font-semibold text-charcoal-soft uppercase tracking-wide">Assign To</label>
                  <select
                    className="input-field mt-1.5 bg-white border-[#E5E7EB]"
                    value={newTask.targetInternId}
                    onChange={(e) => setNewTask((t) => ({ ...t, targetInternId: e.target.value }))}
                  >
                    <option value="" disabled>Select an intern...</option>
                    {interns.map((i) => (
                      <option key={i.id} value={i.id}>{i.name}</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-3 p-3 rounded-xl bg-white border border-[#E5E7EB] cursor-pointer hover:border-[#D1D5DB] transition-colors mt-2">
                  <input
                    type="checkbox"
                    checked={newTask.isImportant}
                    onChange={(e) => setNewTask((t) => ({ ...t, isImportant: e.target.checked }))}
                    className="w-4 h-4 rounded border-[#D1D5DB] text-charcoal focus:ring-charcoal/20"
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-charcoal">Mark as Important</span>
                    <span className="block text-[11px] text-muted mt-0.5">Will be highlighted on the intern's calendar</span>
                  </span>
                </label>
              </>
            )}
          </div>
          <div className="flex gap-2 px-6 py-4 bg-white border-t border-[#E5E7EB] shrink-0">
            <button disabled={isCreatingTask} onClick={() => setShowCreate(false)} className="btn-secondary flex-1 bg-[#F3F4F6] border-[#E5E7EB] disabled:opacity-60">
              Cancel
            </button>
            <button disabled={isCreatingTask} onClick={handleCreateTask} className="btn-primary flex-1 disabled:opacity-60">
              {isCreatingTask ? "Saving..." : role === "supervisor" ? "Assign to Intern" : "Add to Calendar"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}

function FilterRow({
  filter,
  hint,
  onToggle,
}: {
  filter: CalendarFilter;
  hint?: string;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-start gap-3 px-2 py-2 rounded-xl text-sm text-charcoal-soft hover:bg-grey-100 transition-colors"
    >
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{
          backgroundColor: filter.enabled ? filter.color + "22" : "transparent",
          border: `2px solid ${filter.color}`,
        }}
      >
        {filter.enabled ? (
          <Check className="w-3 h-3" style={{ color: filter.color }} />
        ) : (
          <Circle className="w-3 h-3" style={{ color: filter.color }} />
        )}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className={`block truncate ${!filter.enabled ? "text-muted-light" : ""}`}>
          {filter.label}
        </span>
        {hint && (
          <span className="block text-[10px] text-muted-light mt-0.5 leading-snug">{hint}</span>
        )}
      </span>
    </button>
  );
}

function DeadlineLegend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}

function EventChip({ event, day, compact }: { event: CalendarEvent; day?: Date; compact?: boolean }) {
  const urgencyColor = getDeadlineUrgencyColor(event);
  const deadlineDate = event.endDate ?? event.date;
  const isDeadline = day
    ? urgencyColor !== null && format(day, "yyyy-MM-dd") === deadlineDate
    : urgencyColor !== null;
  const displayColor = isDeadline ? urgencyColor ?? event.color : event.color;
  return (
    <div
      className={`flex items-center gap-1 px-1 py-0.5 rounded-md truncate ${
        compact ? "text-[10px]" : "text-xs"
      }`}
      style={{ backgroundColor: displayColor + (isDeadline ? "28" : "14") }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: displayColor }}
      />
      <span className={`truncate font-medium ${isDeadline ? "text-charcoal" : "text-charcoal-soft"}`}>
        {isDeadline && event.type === "task" && "⏰ "}
        {event.title}
      </span>
    </div>
  );
}

function EventCard({
  event,
  onClick,
  active,
}: {
  event: CalendarEvent;
  onClick?: () => void;
  active?: boolean;
}) {
  const Wrapper = onClick ? "button" : "div";
  const displayColor = getDeadlineUrgencyColor(event) ?? event.color;
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`w-full text-left bg-white rounded-2xl border p-3 space-y-2 transition-all ${
        active ? "border-charcoal shadow-sm" : "border-[#E5E7EB] shadow-card hover:border-[#D1D5DB]"
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
          style={{ backgroundColor: displayColor }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-charcoal">{event.title}</p>
          {event.internName && (
            <p className="text-xs text-muted mt-0.5">{event.internName}</p>
          )}
          {event.categoryLabel && (
            <p className="text-[10px] text-muted mt-0.5 flex items-center gap-1">
              <Tag className="w-3 h-3" />
              {event.categoryLabel}
            </p>
          )}
          {event.startDate && event.endDate && event.startDate !== event.endDate && (
            <p className="text-[10px] text-muted mt-1">
              {format(new Date(event.startDate + "T12:00:00"), "MMM d")} → {format(new Date(event.endDate + "T12:00:00"), "MMM d, yyyy")}
            </p>
          )}
          {event.startDate && !event.endDate && (
            <p className="text-[10px] text-muted mt-1">Starts {format(new Date(event.startDate + "T12:00:00"), "MMM d, yyyy")} · No deadline</p>
          )}
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-grey-100 text-muted uppercase">
          {TYPE_LABELS[event.type] ?? event.type}
        </span>
      </div>
      {event.description && (
        <p className="text-xs text-muted line-clamp-2 pl-4">{event.description}</p>
      )}
      {event.priority && (
        <span
          className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${
            event.priority === "high"
              ? "bg-red-50 text-red-700"
              : event.priority === "medium"
              ? "bg-amber-50 text-amber-700"
              : "bg-grey-100 text-muted"
          }`}
        >
          {event.priority} priority
        </span>
      )}
      {event.status && (
        <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-grey-100 text-muted ml-1 capitalize">
          {event.status.replace("-", " ")}
        </span>
      )}
    </Wrapper>
  );
}

function EventDetailPanel({
  event,
  onBack,
  onUpdate,
  onToggleStatus,
  onDelete,
  role,
  embedded,
}: {
  event: CalendarEvent;
  onBack: () => void;
  onUpdate: () => void;
  onToggleStatus: (event: CalendarEvent) => void;
  onDelete: () => void;
  role: "student" | "supervisor";
  embedded?: boolean;
}) {
  const linkedTask = findTaskForEvent(event);
  const description = event.description || linkedTask?.description;

  return (
    <div className={`flex flex-col h-full ${embedded ? "" : "min-h-0"}`}>
      <div className={`bg-white border-b border-[#E5E7EB] ${embedded ? "px-6 pt-6 pb-4" : "p-5"}`}>
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-charcoal transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          {/* Students can delete their own tasks (personal or self-created); NOT supervisor-assigned tasks. Supervisors are read-only. */}
          {role === "student" &&
            (event.type === "task" || event.type === "supervisor-task") &&
            !event.isSupervisorAssigned ? (
            <button
              onClick={() => {
                if (confirm("Are you sure you want to delete this task?")) {
                  onDelete();
                }
              }}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          ) : null}
        </div>
        <div className="flex items-start gap-3">
          <span
            className="w-3 h-3 rounded-full mt-1.5 shrink-0"
            style={{ backgroundColor: event.color }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-muted-light uppercase tracking-widest">
              {TYPE_LABELS[event.type] ?? event.type}
            </p>
            <h3 className="text-lg font-bold text-charcoal mt-0.5 leading-snug">{event.title}</h3>
          </div>
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto space-y-4 ${embedded ? "px-6 py-5" : "p-5"}`}>
        {event.categoryLabel && (
          <DetailRow label="Category">
            <span
              className="inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-full"
              style={{ backgroundColor: event.color + "18", color: event.color }}
            >
              <Tag className="w-3.5 h-3.5" />
              {event.categoryLabel}
            </span>
          </DetailRow>
        )}

        {event.internName && (
          <DetailRow label="Intern">
            <p className="text-sm text-charcoal">{event.internName}</p>
          </DetailRow>
        )}

        <DetailRow label="Dates">
          {event.startDate && event.endDate && event.startDate !== event.endDate ? (
            <p className="text-sm text-charcoal">
              {format(new Date(event.startDate + "T12:00:00"), "MMM d, yyyy")}
              {" → "}
              {format(new Date(event.endDate + "T12:00:00"), "MMM d, yyyy")}
            </p>
          ) : event.startDate ? (
            <p className="text-sm text-charcoal">
              {format(new Date(event.startDate + "T12:00:00"), "MMM d, yyyy")}
              {!event.endDate && <span className="text-muted"> · No deadline</span>}
            </p>
          ) : (
            <p className="text-sm text-charcoal">
              {format(new Date(event.date + "T12:00:00"), "MMM d, yyyy")}
            </p>
          )}
        </DetailRow>

        {event.priority && (
          <DetailRow label="Priority">
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
                event.priority === "high"
                  ? "bg-red-50 text-red-700"
                  : event.priority === "medium"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-grey-100 text-muted"
              }`}
            >
              {event.priority}
            </span>
          </DetailRow>
        )}

        {event.status && (
          <DetailRow label="Status">
            <span className={`inline-flex items-center self-start text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
              event.status === "done" ? "bg-green-100 text-green-700"
              : event.status === "reviewed" ? "bg-blue-100 text-blue-700"
              : "bg-grey-100 text-charcoal"
            }`}>
              {event.status.replace("-", " ")}
            </span>
          </DetailRow>
        )}

        {event.taskId && event.status !== "reviewed" && role === "student" && (
          <button
            onClick={() => onToggleStatus(event)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-charcoal text-charcoal text-xs font-semibold hover:bg-charcoal hover:text-white transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            {event.status === "done" ? "Mark as To Do" : "Mark as Done"}
          </button>
        )}

        {event.taskId && event.status !== "reviewed" && role === "supervisor" && (
          <p className="text-[10px] text-muted italic">
            The student can mark this task as done.
          </p>
        )}

        <DetailRow label="Description">
          {description ? (
            <p className="text-sm text-charcoal-soft leading-relaxed whitespace-pre-wrap bg-white rounded-xl border border-[#E5E7EB] p-3">
              {description}
            </p>
          ) : (
            <p className="text-sm text-muted italic">No description provided.</p>
          )}
        </DetailRow>

        {linkedTask?.feedback && (
          <DetailRow label="Supervisor feedback">
            <p className="text-sm text-charcoal-soft leading-relaxed bg-[#FDF4FF] rounded-xl border border-[#EDE9FE] p-3">
              {linkedTask.feedback}
            </p>
          </DetailRow>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-muted-light uppercase tracking-widest mb-1.5">{label}</p>
      {children}
    </div>
  );
}
