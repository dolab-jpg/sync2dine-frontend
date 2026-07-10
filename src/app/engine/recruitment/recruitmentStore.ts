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
  source: 'job-board' | 'referral' | 'website' | 'linkedin' | 'indeed' | 'direct' | 'phone';
  resumeUrl?: string;
  createdAt: string;
  rating: number;
  notes?: string;
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
}

export interface RecruitmentStoreData {
  jobs: RecruitmentJob[];
  candidates: RecruitmentCandidate[];
  interviews: RecruitmentInterview[];
  updatedAt: string;
}

const DEFAULT_JOBS: RecruitmentJob[] = [
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
    updatedAt: new Date().toISOString(),
  };
}

export function loadRecruitmentStore(): RecruitmentStoreData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultStore();
    const parsed = JSON.parse(raw) as Partial<RecruitmentStoreData>;
    return {
      jobs: Array.isArray(parsed.jobs) && parsed.jobs.length ? parsed.jobs : DEFAULT_JOBS,
      candidates: Array.isArray(parsed.candidates) ? parsed.candidates : [],
      interviews: Array.isArray(parsed.interviews) ? parsed.interviews : [],
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recruitmentJobs: data.jobs,
        recruitmentCandidates: data.candidates,
        recruitmentInterviews: data.interviews,
      }),
    });
  } catch {
    // sync optional in dev
  }
}
