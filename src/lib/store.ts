"use client";

// Shared in-memory store so supervisor feedback is visible on student side

export type TaskStatus = "todo" | "in-progress" | "done" | "reviewed";
export type TaskPriority = "low" | "medium" | "high";
export type TaskCategory =
  | "project-work"
  | "research"
  | "meetings"
  | "deliverables"
  | "training"
  | "personal";

export interface Submission {
  id: string;
  name: string;
  size: string;
  type: string;
  uploadedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  startDate?: string;
  dueDate?: string;
  category?: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  progress: number;
  submissions: Submission[];
  feedback?: string;
  reviewedAt?: string;
  /** true = assigned by supervisor, visible on BOTH calendars */
  supervisorAssigned?: boolean;
  /** supervisor marked this as important — highlighted on both calendars */
  isImportant?: boolean;
  /** which intern this shared task targets (intern id) */
  targetInternId?: string;
  feedbacks?: Array<{
    id: string;
    taskId: string;
    authorId: number;
    authorName: string;
    content: string;
    createdAt: string;
  }>;
}

export interface InternProfile {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  university: string;
  department: string;
  year: string;
  bio: string;
  skills: string[];
  project: string;
  role: string;
  previousInternships?: string;
  enterprise?: string;
  subjectOfInternship?: string;
  status: "Active" | "Need Review" | "Revoked";
  accountStatus?: "pending" | "active" | "rejected";
  supervisorId?: string;
  coSupervisorIds?: string[];
  progress: number;
  startDate: string;
  endDate: string;
  tasks: Task[];
  avatarColor: string;
}


export const internProfiles: Record<string, InternProfile> = {
  "1": {
    id: "1",
    name: "Lina Haddad",
    initials: "LH",
    email: "lina.haddad@university.edu",
    phone: "+1 (555) 234-5678",
    university: "MIT",
    department: "Computer Science",
    year: "Master's 2nd Year",
    bio: "Passionate about machine learning and data-driven solutions. Working on customer segmentation using clustering algorithms.",
    skills: ["Python", "scikit-learn", "Pandas", "SQL", "Tableau"],
    project: "Machine Learning Model for Customer Segmentation",
    role: "Data Science",
    status: "Active",
    accountStatus: "active",
    supervisorId: "s1",
    coSupervisorIds: ["s2"],
    progress: 65,
    startDate: "Jan 6, 2026",
    endDate: "May 15, 2026",
    avatarColor: "#111827",
    tasks: [
      {
        id: "t1", title: "Literature Review",
        description: "Survey at least 15 papers on customer segmentation ML techniques. Summarize findings.",
        dueDate: "2026-04-01", priority: "high", status: "reviewed", progress: 100,
        submissions: [{ id: "s1", name: "literature_review.pdf", size: "1.2 MB", type: "pdf", uploadedAt: "Mar 30, 2026" }],
        feedback: "Excellent literature survey. Your analysis of K-means vs DBSCAN trade-offs is particularly insightful. The bibliography is comprehensive and well-cited. Consider adding a section on recent transformer-based approaches in future work.",
        reviewedAt: "Apr 2, 2026",
      },
      {
        id: "t2", title: "Data Preprocessing Pipeline",
        description: "Clean dataset, handle missing values, normalize features, apply PCA for dimensionality reduction.",
        dueDate: "2026-04-20", priority: "high", status: "reviewed", progress: 100,
        submissions: [
          { id: "s2", name: "preprocessing.ipynb", size: "4.5 MB", type: "code", uploadedAt: "Apr 18, 2026" },
          { id: "s3", name: "cleaned_dataset.csv", size: "18 MB", type: "file", uploadedAt: "Apr 18, 2026" },
        ],
        feedback: "Clean and well-documented notebook. The PCA variance explained plot is a great touch. Next time, add inline comments explaining non-obvious transformations.",
        reviewedAt: "Apr 21, 2026",
      },
      {
        id: "t3", title: "Model Training & Evaluation",
        description: "Train K-means and hierarchical clustering models. Compare silhouette scores and produce visualizations.",
        dueDate: "2026-05-10", priority: "high", status: "in-progress", progress: 60,
        submissions: [{ id: "s4", name: "model_v1.py", size: "12 KB", type: "code", uploadedAt: "May 2, 2026" }],
      },
      {
        id: "t4", title: "Final Report Draft",
        description: "Write the complete internship report including introduction, methodology, results, and conclusion.",
        dueDate: "2026-05-15", priority: "medium", status: "todo", progress: 0,
        submissions: [],
      },
    ],
  },
  "2": {
    id: "2",
    name: "Emma Wilson",
    initials: "EW",
    email: "emma.wilson@university.edu",
    phone: "+1 (555) 345-6789",
    university: "Stanford",
    department: "Software Engineering",
    year: "Bachelor's 4th Year",
    bio: "Mobile-first developer with a focus on healthcare accessibility. Building patient-centred apps that make a real difference.",
    skills: ["Flutter", "Dart", "Firebase", "Figma", "REST APIs"],
    project: "Mobile App Development for Healthcare",
    role: "Mobile Dev",
    status: "Need Review",
    accountStatus: "active",
    supervisorId: "s1",
    coSupervisorIds: [],
    progress: 80,
    startDate: "Jan 6, 2026",
    endDate: "May 15, 2026",
    avatarColor: "#7C3AED",
    tasks: [
      { id: "t1", title: "UI/UX Wireframes", description: "Design all app screens in Figma with user flows.", dueDate: "2026-03-01", priority: "high", status: "reviewed", progress: 100, submissions: [{ id: "s1", name: "wireframes_v2.fig", size: "8.3 MB", type: "image", uploadedAt: "Feb 28, 2026" }], feedback: "Impressive wireframes — clean navigation structure and good accessibility considerations. The onboarding flow could be simplified to reduce cognitive load for first-time users.", reviewedAt: "Mar 2, 2026" },
      { id: "t2", title: "Core Feature Implementation", description: "Build appointment booking, patient records, and notification modules.", dueDate: "2026-04-15", priority: "high", status: "in-progress", progress: 90, submissions: [{ id: "s2", name: "app_source.zip", size: "45 MB", type: "archive", uploadedAt: "Apr 14, 2026" }, { id: "s3", name: "demo_video.mp4", size: "120 MB", type: "video", uploadedAt: "Apr 14, 2026" }] },
      { id: "t3", title: "Testing & QA", description: "Write unit tests, perform UX testing, fix critical bugs.", dueDate: "2026-05-05", priority: "medium", status: "in-progress", progress: 50, submissions: [] },
      { id: "t4", title: "Final Presentation", description: "Prepare slides and demo for the final internship presentation.", dueDate: "2026-05-12", priority: "high", status: "todo", progress: 0, submissions: [] },
    ],
  },
  "3": {
    id: "3",
    name: "Michael Chen",
    initials: "MC",
    email: "michael.chen@university.edu",
    phone: "+1 (555) 456-7890",
    university: "Berkeley",
    department: "Information Systems",
    year: "Master's 1st Year",
    bio: "Blockchain enthusiast focusing on supply chain transparency and decentralized trust systems.",
    skills: ["Solidity", "Ethereum", "React", "ethers.js", "Node.js"],
    project: "Blockchain-based Supply Chain System",
    role: "Blockchain",
    status: "Active",
    accountStatus: "active",
    supervisorId: "s2",
    coSupervisorIds: [],
    progress: 45,
    startDate: "Jan 6, 2026",
    endDate: "May 15, 2026",
    avatarColor: "#059669",
    tasks: [
      { id: "t1", title: "Smart Contract Design", description: "Design Solidity contracts for product tracking and ownership transfer.", dueDate: "2026-03-20", priority: "high", status: "reviewed", progress: 100, submissions: [{ id: "s1", name: "contracts_v1.sol", size: "32 KB", type: "code", uploadedAt: "Mar 18, 2026" }], feedback: "Solid contract architecture. The access control pattern is well implemented. Make sure to add reentrancy guards before the next iteration.", reviewedAt: "Mar 22, 2026" },
      { id: "t2", title: "Backend API Development", description: "Build Node.js REST API to interact with blockchain contracts.", dueDate: "2026-04-25", priority: "high", status: "in-progress", progress: 50, submissions: [{ id: "s2", name: "api_prototype.js", size: "8 KB", type: "code", uploadedAt: "Apr 20, 2026" }] },
      { id: "t3", title: "Frontend Dashboard", description: "React dashboard for supply chain visualization and auditing.", dueDate: "2026-05-10", priority: "medium", status: "todo", progress: 0, submissions: [] },
    ],
  },
  "4": {
    id: "4",
    name: "Sarah Johnson",
    initials: "SJ",
    email: "sarah.johnson@university.edu",
    phone: "+1 (555) 567-8901",
    university: "Carnegie Mellon",
    department: "IT Management",
    year: "Master's 2nd Year",
    bio: "Cloud infrastructure specialist passionate about cost optimization and sustainable engineering practices.",
    skills: ["AWS", "Terraform", "Python", "Grafana", "Docker"],
    project: "Cloud Infrastructure Optimization",
    role: "DevOps",
    status: "Active",
    accountStatus: "active",
    supervisorId: "s2",
    coSupervisorIds: [],
    progress: 72,
    startDate: "Jan 6, 2026",
    endDate: "May 15, 2026",
    avatarColor: "#D97706",
    tasks: [
      { id: "t1", title: "Infrastructure Audit", description: "Scan and document all AWS resources for idle/over-provisioned assets.", dueDate: "2026-03-15", priority: "high", status: "reviewed", progress: 100, submissions: [{ id: "s1", name: "audit_report.pdf", size: "3.4 MB", type: "pdf", uploadedAt: "Mar 13, 2026" }], feedback: "Very thorough audit. The savings projection table is actionable and clear. Good job tagging resources by team ownership.", reviewedAt: "Mar 16, 2026" },
      { id: "t2", title: "Terraform Scripts", description: "Write IaC scripts for auto-scaling and rightsizing recommendations.", dueDate: "2026-04-30", priority: "high", status: "in-progress", progress: 70, submissions: [{ id: "s2", name: "terraform_modules.zip", size: "22 KB", type: "archive", uploadedAt: "Apr 25, 2026" }] },
      { id: "t3", title: "Cost Dashboard", description: "Grafana dashboard showing real-time cost trends and saving projections.", dueDate: "2026-05-10", priority: "medium", status: "todo", progress: 0, submissions: [] },
    ],
  },
  "5": {
    id: "5",
    name: "David Lee",
    initials: "DL",
    email: "david.lee@university.edu",
    phone: "+1 (555) 678-9012",
    university: "Georgia Tech",
    department: "Computer Science",
    year: "PhD 2nd Year",
    bio: "NLP researcher applying large language models to practical customer service automation challenges.",
    skills: ["Python", "PyTorch", "BERT", "FastAPI", "Docker", "Redis"],
    project: "AI-Powered Chatbot for Customer Service",
    role: "AI / NLP",
    status: "Need Review",
    accountStatus: "active",
    supervisorId: "s1",
    coSupervisorIds: [],
    progress: 90,
    startDate: "Jan 6, 2026",
    endDate: "May 15, 2026",
    avatarColor: "#DC2626",
    tasks: [
      { id: "t1", title: "NLP Model Fine-tuning", description: "Fine-tune BERT on customer support ticket dataset.", dueDate: "2026-03-10", priority: "high", status: "reviewed", progress: 100, submissions: [{ id: "s1", name: "bert_finetuned.pt", size: "430 MB", type: "archive", uploadedAt: "Mar 8, 2026" }], feedback: "Exceptional fine-tuning work. 91% F1 on intent classification is impressive. The confusion matrix analysis shows mature understanding of model limitations.", reviewedAt: "Mar 11, 2026" },
      { id: "t2", title: "API Integration", description: "Build FastAPI endpoints and integrate with the customer portal.", dueDate: "2026-04-15", priority: "high", status: "reviewed", progress: 100, submissions: [{ id: "s2", name: "api_service.py", size: "18 KB", type: "code", uploadedAt: "Apr 12, 2026" }], feedback: "Clean API design with proper error handling. The rate limiting and caching implementation is production-ready.", reviewedAt: "Apr 16, 2026" },
      { id: "t3", title: "Final Report & Demo", description: "Write technical report and record demo video of the chatbot.", dueDate: "2026-05-10", priority: "high", status: "in-progress", progress: 80, submissions: [{ id: "s3", name: "final_report_draft.pdf", size: "4.2 MB", type: "pdf", uploadedAt: "May 8, 2026" }, { id: "s4", name: "chatbot_demo.mp4", size: "85 MB", type: "video", uploadedAt: "May 9, 2026" }] },
    ],
  },
  "6": {
    id: "6",
    name: "Ahmed Hassan",
    initials: "AH",
    email: "ahmed.hassan@university.edu",
    phone: "+1 (555) 789-0123",
    university: "HEC Paris",
    department: "Data Analytics",
    year: "Master's 1st Year",
    bio: "Signed up via the platform — awaiting supervisor account confirmation.",
    skills: ["Python", "SQL", "Power BI"],
    project: "Sales Forecasting Dashboard",
    role: "Data Science",
    status: "Active",
    accountStatus: "pending",
    supervisorId: "s1",
    coSupervisorIds: [],
    progress: 0,
    startDate: "Jun 1, 2026",
    endDate: "Aug 31, 2026",
    avatarColor: "#6366F1",
    tasks: [],
  },
};

export const enterpriseProjects = [
  { id: "p1", title: "Customer Churn Prediction System", intern: "Amira Benali", supervisorName: "Dr. Sarah Mitchell", year: "2025", tech: ["Python", "XGBoost", "Pandas", "Streamlit"], description: "Built a machine learning pipeline to predict customer churn 30 days in advance using behavioral and demographic data. Achieved 89% AUC-ROC on holdout set.", domain: "Machine Learning", hasCode: true, hasReport: true, hasVideo: true, impact: "High", completionRate: 98, keyFindings: ["89% AUC-ROC score", "SMOTE for class imbalance", "5 behavioral feature clusters", "Deployed to production Q3 2025"], methodology: "Used XGBoost with SMOTE oversampling on 120k customer records. Features included recency, frequency, monetary value, tenure, and product usage patterns. Hyperparameters tuned via Bayesian optimization.", results: "The model identified 74% of churners 30 days in advance, allowing proactive retention campaigns. Revenue saved: ~$340k/quarter." },
  { id: "p2", title: "Real-Time Inventory Dashboard", intern: "Karim Mansouri", supervisorName: "Dr. James Okafor", year: "2025", tech: ["React", "Node.js", "PostgreSQL", "WebSocket"], description: "Developed a live inventory tracking dashboard with WebSocket-powered updates, low-stock alerts, and supplier management interface.", domain: "Full-Stack", hasCode: true, hasReport: true, hasVideo: false, impact: "Medium", completionRate: 100, keyFindings: ["< 200ms update latency", "40% reduction in stockout events", "Supplier portal integration", "Mobile responsive"], methodology: "Event-driven architecture with Node.js WebSocket server. PostgreSQL with LISTEN/NOTIFY for real-time updates. React frontend with optimistic UI.", results: "Reduced manual inventory checks by 8 hours/week per warehouse. Stockout events dropped by 40% in 3 months." },
  { id: "p3", title: "NLP Ticket Classification", intern: "Sofia Tran", supervisorName: "Dr. Sarah Mitchell", year: "2024", tech: ["Python", "BERT", "FastAPI", "Docker"], description: "Fine-tuned a BERT model on internal support tickets to auto-classify and route to the correct team. Reduced manual triage time by 70%.", domain: "NLP / AI", hasCode: true, hasReport: true, hasVideo: false, impact: "High", completionRate: 100, keyFindings: ["93% classification accuracy", "70% reduction in triage time", "12 ticket categories", "Docker deployment"], methodology: "Fine-tuned BERT-base-uncased on 45k labelled tickets across 12 categories. Deployed as FastAPI microservice with Redis caching.", results: "Average triage time reduced from 4.2 min to 1.3 min. 93% accuracy maintained over 3-month production window." },
  { id: "p4", title: "Mobile Expense Tracker", intern: "Lucas Durand", supervisorName: "Dr. Marie Petit", year: "2024", tech: ["Flutter", "Firebase", "Dart"], description: "Cross-platform mobile app for employee expense submission with OCR receipt scanning and manager approval workflow.", domain: "Mobile", hasCode: true, hasReport: false, hasVideo: true, impact: "Medium", completionRate: 95, keyFindings: ["OCR scanning accuracy 94%", "Cross-platform iOS + Android", "Manager approval workflow", "Export to CSV/PDF"], methodology: "Flutter for cross-platform UI, Firebase Firestore for real-time sync, Google Vision API for OCR receipt scanning.", results: "Adopted by 200 employees in the first month. Average expense submission time reduced from 8 min to 90 sec." },
  { id: "p5", title: "Cloud Cost Optimisation Tool", intern: "Nour El Houda", supervisorName: "Dr. James Okafor", year: "2023", tech: ["Python", "AWS SDK", "Terraform", "Grafana"], description: "Automated AWS resource scanning to flag idle instances and over-provisioned services. Saved ~18% monthly cloud spend.", domain: "DevOps / Cloud", hasCode: true, hasReport: true, hasVideo: false, impact: "High", completionRate: 100, keyFindings: ["18% monthly cost reduction", "240+ resources scanned", "Auto-tagging framework", "Grafana alerting"], methodology: "AWS Cost Explorer API + Boto3 for resource inventory. Custom scoring algorithm to rank optimization opportunities by ROI.", results: "First month savings: $28k. Identified 47 idle EC2 instances and 12 over-provisioned RDS clusters." },
  { id: "p6", title: "Blockchain Supply Chain Tracker", intern: "Yassine Hamdi", supervisorName: "Dr. Marie Petit", year: "2023", tech: ["Solidity", "Ethereum", "React", "ethers.js"], description: "Smart contract–based system for tracking product provenance from manufacturer to end customer, with a React frontend for real-time auditing.", domain: "Blockchain", hasCode: true, hasReport: true, hasVideo: true, impact: "Medium", completionRate: 92, keyFindings: ["Immutable audit trail", "5 supply chain stages tracked", "Gas optimization -35%", "IPFS for document storage"], methodology: "ERC-721 NFT-based product tracking. Solidity contracts audited for reentrancy and overflow. React + ethers.js frontend.", results: "Full product provenance from manufacturer to retail tracked on-chain. Audit time reduced from days to seconds." },
];

Object.values(internProfiles).forEach(intern => {
  intern.tasks.forEach(task => {
    task.supervisorAssigned = true;
  });
});

// Profiles (mutable via UI)
export const supervisorProfile = {
  name: "Sarah Mitchell",
  email: "sarah.mitchell@techcorp.com",
  phone: "+1 (555) 123-4567",
  organization: "TechCorp Industries",
  department: "R&D / Data Science",
  post: "Senior Research Scientist",
  otherEncadrantInfo: "Dr. James Okafor (Co-supervisor)",
  specialization: "Machine Learning, NLP",
  bio: "Senior Research Scientist with 12 years of industry experience. Passionate about mentoring the next generation of data scientists and engineers.",
  avatarColor: "#111827",
  initials: "SM",
  yearsExperience: 12,
  totalInterns: 24,
};

export const adminProfile = {
  name: "Alex Moreau",
  email: "admin@test.com",
  phone: "+1 (555) 000-1234",
  organization: "TechCorp Industries",
  department: "HR & Academic Partnerships",
  title: "Internship Program Director",
  bio: "Oversees all internship relations between the enterprise and partner universities. Manages 80+ active internships per year.",
};

// Helper lookup functions for dynamic sessions
export function getInternByEmail(email: string): InternProfile {
  const profile = Object.values(internProfiles).find(
    (p) => p.email.toLowerCase() === email.toLowerCase()
  );
  if (profile) return profile;
  
  // Return a generic fallback if not found (e.g. for newly signed up accounts in this mock)
  const fallback = { ...internProfiles["1"] };
  fallback.email = email;
  fallback.name = email.split("@")[0].replace(".", " ").replace(/\b\w/g, l => l.toUpperCase());
  return fallback;
}

export function getSupervisorByEmail(email: string) {
  const fallback = { ...supervisorProfile };
  if (email.toLowerCase() !== fallback.email.toLowerCase()) {
    fallback.email = email;
    fallback.name = email.split("@")[0].replace(".", " ").replace(/\b\w/g, l => l.toUpperCase());
  }
  return fallback;
}

export function getAdminByEmail(email: string) {
  const fallback = { ...adminProfile };
  if (email.toLowerCase() !== fallback.email.toLowerCase()) {
    fallback.email = email;
    fallback.name = email.split("@")[0].replace(".", " ").replace(/\b\w/g, l => l.toUpperCase());
  }
  return fallback;
}

// ─── Shared supervisor-assigned tasks store ───────────────────────────────────
// Tasks added by supervisor that are pushed to a specific intern's calendar.
// They are visible on both the supervisor calendar AND the student calendar.
// The student can see but NOT delete supervisor-assigned tasks.

export interface SupervisorTask extends Task {
  supervisorAssigned: true;
  targetInternId: string;   // intern who receives this task
  internName: string;       // display label
}

// Mutable in-memory list — survives as long as the page session
export const supervisorAssignedTasks: SupervisorTask[] = [
  {
    id: "sv-t1",
    title: "Weekly Progress Report",
    description: "Submit a brief progress update every Friday before 17:00.",
    startDate: "2026-06-30",
    dueDate: "2026-07-04",
    category: "deliverables",
    priority: "high",
    status: "todo",
    progress: 0,
    submissions: [],
    supervisorAssigned: true,
    isImportant: true,
    targetInternId: "1",
    internName: "Lina Haddad",
  },
  {
    id: "sv-t2",
    title: "Mid-Stage Review Meeting",
    description: "Prepare a 10-minute presentation of your current progress.",
    startDate: "2026-07-10",
    dueDate: "2026-07-10",
    category: "meetings",
    priority: "high",
    status: "todo",
    progress: 0,
    submissions: [],
    supervisorAssigned: true,
    isImportant: true,
    targetInternId: "2",
    internName: "Emma Wilson",
  },
];

// ─── Project ratings store ────────────────────────────────────────────────────
// Stores the supervisor's rating (note /10) for each project, keyed by project id.

export interface ProjectRating {
  supervisorRating?: number;
}

export const projectRatings: Record<string, ProjectRating> = {
  p1: { supervisorRating: 9.0 },
  p2: { supervisorRating: 7.5 },
  p3: { supervisorRating: 9.5 },
  p4: { supervisorRating: 7.0 },
  p5: { supervisorRating: 8.5 },
  p6: { supervisorRating: 7.0 },
};

export function getAverageRating(projectId: string): number | null {
  return projectRatings[projectId]?.supervisorRating ?? null;
}

export function setSupervisorProjectRating(projectId: string, rating: number, role?: string): boolean {
  if (role !== "supervisor" || !Number.isFinite(rating) || rating < 0 || rating > 10) {
    return false;
  }
  projectRatings[projectId] = { supervisorRating: rating };
  return true;
}

// ─── Supervisors registry ─────────────────────────────────────────────────────

export type AccountStatus = "pending" | "active" | "rejected";

export interface SupervisorRecord {
  id: string;
  name: string;
  email: string;
  department: string;
  post: string;
  organization: string;
  avatarColor: string;
  initials: string;
  accountStatus: AccountStatus;
}

export const supervisorRecords: SupervisorRecord[] = [
  {
    id: "s1",
    name: "Sarah Mitchell",
    email: "sarah.mitchell@techcorp.com",
    department: "R&D / Data Science",
    post: "Senior Research Scientist",
    organization: "TechCorp Industries",
    avatarColor: "#111827",
    initials: "SM",
    accountStatus: "active",
  },
  {
    id: "s2",
    name: "Dr. James Okafor",
    email: "j.okafor@enterprise.com",
    department: "Engineering",
    post: "Lead Engineer",
    organization: "TechCorp Industries",
    avatarColor: "#059669",
    initials: "JO",
    accountStatus: "active",
  },
  {
    id: "s3",
    name: "Dr. Marie Petit",
    email: "m.petit@enterprise.com",
    department: "Product & Innovation",
    post: "Product Director",
    organization: "TechCorp Industries",
    avatarColor: "#D97706",
    initials: "MP",
    accountStatus: "active",
  },
  {
    id: "s4",
    name: "Dr. Luc Bernard",
    email: "l.bernard@enterprise.com",
    department: "AI Research",
    post: "Research Scientist",
    organization: "TechCorp Industries",
    avatarColor: "#7C3AED",
    initials: "LB",
    accountStatus: "pending",
  },
];

export function getSupervisorRecordByEmail(email: string): SupervisorRecord | undefined {
  return supervisorRecords.find((s) => s.email.toLowerCase() === email.toLowerCase());
}

export function getSupervisorRecordById(id: string): SupervisorRecord | undefined {
  return supervisorRecords.find((s) => s.id === id);
}

export function getInternsForSupervisor(supervisorEmail: string): InternProfile[] {
  const record = getSupervisorRecordByEmail(supervisorEmail);
  if (!record) return Object.values(internProfiles);
  return Object.values(internProfiles).filter(
    (i) =>
      i.supervisorId === record.id ||
      i.coSupervisorIds?.includes(record.id)
  );
}

export function getSupervisorEmailByName(name: string): string {
  const match = supervisorRecords.find((s) => s.name === name);
  return match?.email ?? supervisorProfile.email;
}

// ─── Project library access requests ─────────────────────────────────────────

export type AccessResourceType = "code" | "demo" | "report";
export type AccessRequestStatus = "pending" | "approved" | "denied";

export interface ProjectAccessRequest {
  id: string;
  projectId: string;
  projectTitle: string;
  resourceType: AccessResourceType;
  requesterEmail: string;
  requesterName: string;
  requesterRole: "student" | "supervisor";
  ownerSupervisorEmail: string;
  message?: string;
  status: AccessRequestStatus;
  requestedAt: string;
}

export const projectAccessRequests: ProjectAccessRequest[] = [
  {
    id: "ar1",
    projectId: "p1",
    projectTitle: "Customer Churn Prediction System",
    resourceType: "code",
    requesterEmail: "lina.haddad@university.edu",
    requesterName: "Lina Haddad",
    requesterRole: "student",
    ownerSupervisorEmail: "sarah.mitchell@techcorp.com",
    message: "Need the repo to compare preprocessing approaches for my segmentation project.",
    status: "pending",
    requestedAt: "Jun 20, 2026",
  },
];

export function getAccessRequestsForSupervisor(email: string): ProjectAccessRequest[] {
  return projectAccessRequests.filter(
    (r) => r.ownerSupervisorEmail.toLowerCase() === email.toLowerCase()
  );
}

export function getPendingSupervisors(): SupervisorRecord[] {
  return supervisorRecords.filter((s) => s.accountStatus === "pending");
}

export function getPendingStudentsForSupervisor(supervisorEmail: string): InternProfile[] {
  const record = getSupervisorRecordByEmail(supervisorEmail);
  if (!record) return [];
  return Object.values(internProfiles).filter(
    (i) => i.supervisorId === record.id && i.accountStatus === "pending"
  );
}

// --- Co-supervisor invites ----------------------------------------------------

export type CoSupervisorInviteStatus = "pending" | "accepted" | "declined";

export interface CoSupervisorInvite {
  id: string;
  internId: string;
  internName: string;
  inviterSupervisorId: string;
  inviterSupervisorName: string;
  inviteeSupervisorEmail: string;
  status: CoSupervisorInviteStatus;
  invitedAt: string;
}

export const coSupervisorInvites: CoSupervisorInvite[] = [];

export function getCoSupervisorInvitesForSupervisor(email: string): CoSupervisorInvite[] {
  return coSupervisorInvites.filter(
    (inv) => inv.inviteeSupervisorEmail.toLowerCase() === email.toLowerCase()
  );
}

// --- Simulated Gmail-style email / notification store -------------------------


export type EmailType =
  | "access-request"
  | "access-granted"
  | "access-denied"
  | "deliverable-submitted"
  | "supervisor-pending"
  | "supervisor-approved"
  | "supervisor-rejected"
  | "student-pending"
  | "student-approved"
  | "cosupervisor-invite"
  | "cosupervisor-accepted"
  | "confirmation-code";

export interface SimulatedEmail {
  id: string;
  type: EmailType;
  toEmail: string;
  toName: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  bodyHtml: string;
  receivedAt: string;
  read: boolean;
  meta?: {
    projectId?: string;
    projectTitle?: string;
    accessRequestId?: string;
    resourceType?: AccessResourceType;
    internId?: string;
    internName?: string;
    supervisorId?: string;
    inviteId?: string;
  };
}

export const simulatedEmails: SimulatedEmail[] = [
  {
    id: "em1",
    type: "supervisor-pending",
    toEmail: "admin@test.com",
    toName: "Alex Moreau",
    fromName: "Intern Portal System",
    fromEmail: "noreply@internportal.app",
    subject: "New Supervisor Registration  Action Required",
    bodyHtml: "<p>Hello <strong>Alex</strong>,</p><p>A new supervisor has registered and is awaiting confirmation:</p><ul><li><strong>Name:</strong> Dr. Luc Bernard</li><li><strong>Department:</strong> AI Research</li><li><strong>Post:</strong> Research Scientist</li><li><strong>Email:</strong> l.bernard@enterprise.com</li></ul><p>Please review from the Admin Dashboard.</p>",
    receivedAt: "Jun 29, 2026  09:14",
    read: false,
    meta: { supervisorId: "s4" },
  },
  {
    id: "em1b",
    type: "student-pending",
    toEmail: "sarah.mitchell@techcorp.com",
    toName: "Dr. Sarah Mitchell",
    fromName: "Intern Portal System",
    fromEmail: "noreply@internportal.app",
    subject: "New Intern Registration — Action Required",
    bodyHtml: "<p>Hello <strong>Dr. Mitchell</strong>,</p><p>A new student has registered and selected you as their supervisor:</p><ul><li><strong>Name:</strong> Youssef Ben Ali</li><li><strong>University:</strong> ESPRIT</li><li><strong>Email:</strong> youssef.benali@esprit.tn</li></ul><p>Please confirm or reject their account request below.</p>",
    receivedAt: "Jun 29, 2026 — 09:30",
    read: false,
    meta: { internId: "2" },
  },
  {
    id: "em2",
    type: "access-request",
    toEmail: "sarah.mitchell@techcorp.com",
    toName: "Dr. Sarah Mitchell",
    fromName: "Lina Haddad",
    fromEmail: "lina.haddad@university.edu",
    subject: "Access Request  Source Code  Customer Churn Prediction System",
    bodyHtml: "<p>Hello <strong>Dr. Mitchell</strong>,</p><p><strong>Lina Haddad</strong> has requested access to the <strong>Source Code</strong> of your project <em>Customer Churn Prediction System</em>.</p><p><strong>Message:</strong> Need the repo to compare preprocessing approaches for my segmentation project.</p>",
    receivedAt: "Jun 29, 2026  10:47",
    read: false,
    meta: { projectId: "p1", projectTitle: "Customer Churn Prediction System", accessRequestId: "ar1", resourceType: "code" },
  },
  {
    id: "em3",
    type: "deliverable-submitted",
    toEmail: "sarah.mitchell@techcorp.com",
    toName: "Dr. Sarah Mitchell",
    fromName: "Emma Wilson",
    fromEmail: "emma.wilson@university.edu",
    subject: "?? Deliverable Submitted � Core Feature Implementation",
    bodyHtml: "<p>Hello <strong>Dr. Mitchell</strong>,</p><p><strong>Emma Wilson</strong> has submitted: <strong>app_source.zip</strong> (45 MB) for task <em>Core Feature Implementation</em>.</p>",
    receivedAt: "Jun 29, 2026 � 14:01",
    read: true,
    meta: { internId: "2", internName: "Emma Wilson" },
  },
  {
    id: "em4",
    type: "confirmation-code",
    toEmail: "lina.haddad@university.edu",
    toName: "Lina Haddad",
    fromName: "Intern Portal System",
    fromEmail: "noreply@internportal.app",
    subject: "Your Intern Portal Confirmation Code",
    bodyHtml: "<p>Hello <strong>John</strong>,</p><p>A secure sign-in code was sent to your registered email address.</p><p>Valid for 10 minutes. Do not share it.</p>",
    receivedAt: "Jun 29, 2026 � 08:30",
    read: true,
  },
];

export function getEmailsForUser(email: string): SimulatedEmail[] {
  return [...simulatedEmails].filter(
    (e) => e.toEmail.toLowerCase() === email.toLowerCase()
  );
}

export function getUnreadCountForUser(email: string): number {
  return simulatedEmails.filter(
    (e) => e.toEmail.toLowerCase() === email.toLowerCase() && !e.read
  ).length;
}

export function markEmailRead(id: string) {
  const em = simulatedEmails.find((e) => e.id === id);
  if (em) em.read = true;
}

export function addSimulatedEmail(email: Omit<SimulatedEmail, "id">) {
  simulatedEmails.unshift({ ...email, id: "em" + Date.now() });
}
