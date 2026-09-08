const STORAGE_KEY = 'recruitmentData';

export interface RecruitmentJob {
  id: string;
  title: string;
  department: 'sales' | 'construction' | 'office';
  description: string;
  location: string;
  salaryRange: string;
  employmentType: 'full-time' | 'part-time' | 'contract';
  requiredSkills: string[];
  qualifications: string[];
  status: 'open' | 'closed' | 'on-hold';
  createdAt: string;
  positions: number;
  applicantCount?: number;
}

export type HireRecommendation = 'hire' | 'maybe' | 'no';

export interface HireScorecard {
  hunger?: number;
  salesProof?: number;
  restaurantFit?: number;
  outboundComfort?: number;
  cvHonesty?: number;
}

export type RecruitmentMessageChannel = 'indeed' | 'sms' | 'email' | 'phone';

export interface RecruitmentMessage {
  id: string;
  candidateId: string;
  direction: 'in' | 'out';
  channel: RecruitmentMessageChannel;
  body: string;
  at: string;
  externalId?: string;
  fromLabel?: string;
}

export interface RecruitmentCandidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  location: string;
  currentEmploymentStatus: 'employed' | 'unemployed' | 'student' | 'self-employed' | 'unknown';
  desiredRole: string;
  skills: string[];
  certifications: string[];
  experience: string;
  willingToRelocate: boolean;
  preferredLocations: string[];
  availability: string;
  source: 'job-board' | 'referral' | 'website' | 'linkedin' | 'indeed' | 'direct' | 'phone' | 'cv_upload' | 'recruitment_interview';
  resumeUrl?: string;
  createdAt: string;
  rating: number;
  notes?: string;
  hireScore?: number;
  hireRecommendation?: HireRecommendation;
  hireScorecard?: HireScorecard;
  lastInterviewCallId?: string;
  callId?: string;
  messages?: RecruitmentMessage[];
  cvFilename?: string;
  cvUploadedAt?: string;
  cvText?: string;
  cvSummary?: string;
  needsPhone?: boolean;
  fieldComfort?: string;
  outboundExperience?: string;
  rightToWork?: string;
  notice?: string;
  salaryExpectation?: string;
  travelOk?: string;
  drivingLicence?: string;
  hireDoNotCall?: boolean;
  faceToFaceBooked?: boolean;
  faceToFaceArrangeQueued?: boolean;
  faceToFace?: { date?: string; time?: string; type?: string; location?: string };
}

export interface RecruitmentInterview {
  id: string;
  applicationId?: string;
  candidateId: string;
  jobId?: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  type: 'phone' | 'video' | 'in-person';
  location?: string;
  meetingLink?: string;
  interviewers: string[];
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  feedback?: string;
  rating?: number;
  notes?: string;
  hireScore?: number;
  hireRecommendation?: HireRecommendation;
  hireScorecard?: HireScorecard;
  lastInterviewCallId?: string;
  callId?: string;
}

export interface RecruitmentApplication {
  id: string;
  candidateId: string;
  jobId: string;
  stage: 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';
  appliedDate: string;
  stageDate: string;
  notes: string[];
  feedback: string;
  rating: number;
}

export interface RecruitmentOnboardingTask {
  id: string;
  candidateId: string;
  task: string;
  category: 'documentation' | 'training' | 'equipment' | 'access' | 'orientation';
  status: 'pending' | 'in-progress' | 'completed';
  dueDate?: string;
  assignedTo?: string;
  notes?: string;
}

export interface RecruitmentStoreData {
  jobs: RecruitmentJob[];
  candidates: RecruitmentCandidate[];
  interviews: RecruitmentInterview[];
  applications: RecruitmentApplication[];
  onboardingTasks: RecruitmentOnboardingTask[];
  updatedAt: string;
}

export const RESTAURANT_SALES_JOB: RecruitmentJob = {
  id: 'J-S2D-SALES',
  title: 'Restaurant sales — Sync2Dine',
  department: 'sales',
  description: 'Outbound restaurant sales for Sync2Dine, covering venues in Woking / Surrey and London.',
  location: 'Woking / Surrey and London',
  salaryRange: '£30,000 - £45,000 + Commission',
  employmentType: 'full-time',
  requiredSkills: ['Sales', 'Outbound calling', 'Restaurant trade'],
  qualifications: ['Sales experience', 'UK Driving License'],
  status: 'open',
  createdAt: '2026-09-01',
  positions: 2,
  applicantCount: 0,
};

export function ensureRestaurantSalesJob(jobs: RecruitmentJob[]): RecruitmentJob[] {
  if (jobs.some((j) => j.id === RESTAURANT_SALES_JOB.id || j.title === RESTAURANT_SALES_JOB.title)) {
    return jobs;
  }
  return [RESTAURANT_SALES_JOB, ...jobs];
}

const DEFAULT_JOBS: RecruitmentJob[] = [
  RESTAURANT_SALES_JOB,
  {
    id: 'J001',
    title: 'Senior Sales Representative',
    department: 'sales',
    description: 'Experienced sales professional for luxury bathroom installations.',
    location: 'London, UK',
    salaryRange: '£35,000 - £45,000 + Commission',
    employmentType: 'full-time',
    requiredSkills: ['Sales', 'Customer Relations', 'Negotiation'],
    qualifications: ['5+ years sales experience', 'UK Driving License'],
    status: 'open',
    createdAt: '2026-03-15',
    positions: 2,
    applicantCount: 12,
  },
  {
    id: 'J002',
    title: 'Microcement Installation Specialist',
    department: 'construction',
    description: 'Skilled tradesperson specializing in microcement application.',
    location: 'Manchester, UK',
    salaryRange: '£32,000 - £42,000',
    employmentType: 'full-time',
    requiredSkills: ['Microcement', 'Plastering', 'Tiling'],
    qualifications: ['NVQ Level 2/3', '3+ years experience'],
    status: 'open',
    createdAt: '2026-03-20',
    positions: 3,
    applicantCount: 8,
  },
  {
    id: 'J003',
    title: 'Office Administrator',
    department: 'office',
    description: 'Organized administrator to manage scheduling and customer communications.',
    location: 'Birmingham, UK',
    salaryRange: '£24,000 - £28,000',
    employmentType: 'full-time',
    requiredSkills: ['Admin', 'MS Office', 'Customer Service'],
    qualifications: ['2+ years office experience'],
    status: 'open',
    createdAt: '2026-04-01',
    positions: 1,
    applicantCount: 15,
  },
];

function createDefaultStore(): RecruitmentStoreData {
  return {
    jobs: DEFAULT_JOBS,
    candidates: [],
    interviews: [],
    applications: [],
    onboardingTasks: [],
    updatedAt: new Date().toISOString(),
  };
}

export function loadRecruitmentStore(): RecruitmentStoreData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultStore();
    const parsed = JSON.parse(raw) as Partial<RecruitmentStoreData>;
    return {
      jobs: ensureRestaurantSalesJob(Array.isArray(parsed.jobs) && parsed.jobs.length ? parsed.jobs : DEFAULT_JOBS),
      candidates: Array.isArray(parsed.candidates) ? parsed.candidates.map(normalizeCandidate) : [],
      interviews: Array.isArray(parsed.interviews) ? parsed.interviews : [],
      applications: Array.isArray(parsed.applications) ? parsed.applications : [],
      onboardingTasks: Array.isArray(parsed.onboardingTasks) ? parsed.onboardingTasks : [],
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return createDefaultStore();
  }
}

export function saveRecruitmentStore(data: RecruitmentStoreData): void {
  data.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export async function syncRecruitmentToServer(data: RecruitmentStoreData): Promise<void> {
  try {
    await fetch('/api/data/sync', {
      method: 'POST',
      headers: recruitmentHeaders(),
      body: JSON.stringify({
        recruitmentJobs: data.jobs,
        recruitmentCandidates: data.candidates,
        recruitmentInterviews: data.interviews,
        recruitmentApplications: data.applications,
        recruitmentOnboardingTasks: data.onboardingTasks,
      }),
    });
  } catch {
    // sync optional in dev
  }
}

/**
 * Candidates written by Sally's phone tools or CV upload only carry the fields she learned,
 * so fill the list/profile arrays the UI iterates over.
 */
export function normalizeCandidate(candidate: RecruitmentCandidate): RecruitmentCandidate {
  const list = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);
  return {
    ...candidate,
    name: String(candidate.name ?? 'Candidate'),
    phone: String(candidate.phone ?? ''),
    email: String(candidate.email ?? ''),
    address: String(candidate.address ?? ''),
    location: String(candidate.location ?? ''),
    desiredRole: String(candidate.desiredRole ?? ''),
    experience: String(candidate.experience ?? ''),
    availability: String(candidate.availability ?? ''),
    currentEmploymentStatus: candidate.currentEmploymentStatus ?? 'unknown',
    skills: list(candidate.skills),
    certifications: list(candidate.certifications),
    preferredLocations: list(candidate.preferredLocations),
    rating: Number.isFinite(Number(candidate.rating)) ? Number(candidate.rating) : 0,
  };
}

export async function loadRecruitmentFromApi(): Promise<RecruitmentStoreData | null> {
  try {
    const res = await fetch('/api/recruitment', { headers: recruitmentHeaders() });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const jobs = Array.isArray(data.jobs) ? data.jobs as RecruitmentJob[] : [];
    return {
      jobs: jobs.length ? ensureRestaurantSalesJob(jobs) : jobs,
      candidates: Array.isArray(data.candidates)
        ? (data.candidates as RecruitmentCandidate[]).map(normalizeCandidate)
        : [],
      interviews: Array.isArray(data.interviews) ? data.interviews as RecruitmentInterview[] : [],
      applications: Array.isArray(data.applications) ? data.applications as RecruitmentApplication[] : [],
      onboardingTasks: Array.isArray(data.onboardingTasks) ? data.onboardingTasks as RecruitmentOnboardingTask[] : [],
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function patchOnboardingTask(task: { id: string; status: string }): Promise<boolean> {
  try {
    const res = await fetch('/api/recruitment/onboarding', {
      method: 'PATCH',
      headers: recruitmentHeaders(),
      body: JSON.stringify(task),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function postRecruitmentJob(job: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch('/api/recruitment/jobs', {
      method: 'POST',
      headers: recruitmentHeaders(),
      body: JSON.stringify(job),
    });
    if (!res.ok) return null;
    const data = await res.json() as { job?: Record<string, unknown> };
    return data.job ?? null;
  } catch {
    return null;
  }
}

export async function postRecruitmentCandidate(candidate: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch('/api/recruitment/candidates', {
      method: 'POST',
      headers: recruitmentHeaders(),
      body: JSON.stringify(candidate),
    });
    if (!res.ok) return null;
    const data = await res.json() as { candidate?: Record<string, unknown> };
    return data.candidate ?? null;
  } catch {
    return null;
  }
}

export async function postRecruitmentApplication(app: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch('/api/recruitment/applications', {
      method: 'POST',
      headers: recruitmentHeaders(),
      body: JSON.stringify(app),
    });
    if (!res.ok) return null;
    const data = await res.json() as { application?: Record<string, unknown> };
    return data.application ?? null;
  } catch {
    return null;
  }
}

export async function patchRecruitmentApplication(id: string, patch: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`/api/recruitment/applications/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: recruitmentHeaders(),
      body: JSON.stringify(patch),
    });
    if (!res.ok) return null;
    const data = await res.json() as { application?: Record<string, unknown> };
    return data.application ?? null;
  } catch {
    return null;
  }
}

export type RecruitmentActionResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; status: number; error: string };

async function postRecruitmentAction(path: string): Promise<RecruitmentActionResult> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: recruitmentHeaders(),
    });
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) {
      const error = typeof data.error === 'string'
        ? data.error
        : typeof data.message === 'string'
          ? data.message
          : res.status === 404
            ? 'This action is not available yet'
            : `Request failed (${res.status})`;
      return { ok: false, status: res.status, error };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, error: 'Request failed' };
  }
}

export function postRecruitmentSeedIndeed(): Promise<RecruitmentActionResult> {
  return postRecruitmentAction('/api/recruitment/seed-indeed');
}

export function postRecruitmentQueueInterviews(): Promise<RecruitmentActionResult> {
  return postRecruitmentAction('/api/recruitment/queue-interviews');
}

export type CvUploadOutcome = {
  filename: string;
  ok: boolean;
  candidateId?: string;
  name?: string;
  phone?: string;
  queued: boolean;
  needsPhone: boolean;
  reason?: string;
};

export type CvUploadResult =
  | { ok: true; created: number; queued: number; needsPhone: number; results: CvUploadOutcome[] }
  | { ok: false; status: number; error: string };

/** Upload one or many CVs — each becomes a candidate profile, and Sally screens the ones with a mobile. */
export async function postRecruitmentCvs(files: File[]): Promise<CvUploadResult> {
  if (!files.length) return { ok: false, status: 0, error: 'Choose at least one CV' };
  const form = new FormData();
  for (const file of files) form.append('cvs', file, file.name);
  const headers: Record<string, string> = {};
  try {
    const token = localStorage.getItem('authToken');
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* ignore */
  }
  try {
    const res = await fetch('/api/recruitment/cvs', { method: 'POST', headers, body: form });
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) {
      const error = typeof data.error === 'string'
        ? data.error
        : res.status === 404
          ? 'CV upload is not available on this API yet'
          : `Upload failed (${res.status})`;
      return { ok: false, status: res.status, error };
    }
    return {
      ok: true,
      created: Number(data.created ?? 0),
      queued: Number(data.queued ?? 0),
      needsPhone: Number(data.needsPhone ?? 0),
      results: Array.isArray(data.results) ? (data.results as CvUploadOutcome[]) : [],
    };
  } catch {
    return { ok: false, status: 0, error: 'Upload failed' };
  }
}

function recruitmentHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = localStorage.getItem('authToken');
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* ignore */
  }
  return headers;
}

export async function postRecruitmentMessage(input: {
  candidateId?: string;
  name?: string;
  phone?: string;
  direction: 'in' | 'out';
  channel: RecruitmentMessageChannel;
  body: string;
  fromLabel?: string;
  externalId?: string;
  at?: string;
}): Promise<RecruitmentActionResult & { message?: RecruitmentMessage }> {
  try {
    const res = await fetch('/api/recruitment/messages', {
      method: 'POST',
      headers: recruitmentHeaders(),
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    if (!res.ok) {
      const error = typeof data.error === 'string' ? data.error : `Request failed (${res.status})`;
      return { ok: false, status: res.status, error };
    }
    return {
      ok: true,
      data,
      message: data.message as RecruitmentMessage | undefined,
    };
  } catch {
    return { ok: false, status: 0, error: 'Request failed' };
  }
}
