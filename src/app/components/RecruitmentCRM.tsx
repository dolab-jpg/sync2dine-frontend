'use client';

import { useState, useContext, useEffect } from 'react';
import { AppContext, canAccessRecruitment } from '../App';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import {
  Briefcase, Users, TrendingUp, Calendar, MapPin, Phone, Mail,
  FileText, Plus, Search, Filter, Clock, CheckCircle2, XCircle,
  AlertCircle, User, Building, Wrench, UserPlus, Edit2, Trash2,
  Star, MessageSquare, Video, Send, Download, Upload, Award,
  BarChart3, Target, Timer, DollarSign, ChevronRight, Eye,
  ClipboardList, CheckSquare, GraduationCap, Home
} from 'lucide-react';
import { toast } from 'sonner';
import {
  loadRecruitmentStore,
  saveRecruitmentStore,
  syncRecruitmentToServer,
} from '../engine/recruitment/recruitmentStore';

// Types
interface JobPosting {
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

interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  location: string;
  currentEmploymentStatus: 'employed' | 'unemployed' | 'student' | 'self-employed';
  desiredRole: string;
  skills: string[];
  certifications: string[];
  experience: string;
  willingToRelocate: boolean;
  preferredLocations: string[];
  availability: string;
  source: 'job-board' | 'referral' | 'website' | 'linkedin' | 'indeed' | 'direct';
  resumeUrl?: string;
  createdAt: string;
  rating: number;
}

interface Application {
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

interface Interview {
  id: string;
  applicationId: string;
  candidateId: string;
  jobId: string;
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

interface OnboardingTask {
  id: string;
  candidateId: string;
  task: string;
  category: 'documentation' | 'training' | 'equipment' | 'access' | 'orientation';
  status: 'pending' | 'in-progress' | 'completed';
  dueDate?: string;
  assignedTo?: string;
  notes?: string;
}

interface CommunicationLog {
  id: string;
  candidateId: string;
  type: 'email' | 'call' | 'interview' | 'offer';
  subject: string;
  message: string;
  date: string;
  sentBy: string;
}

export default function RecruitmentCRM() {
  const context = useContext(AppContext);
  if (!context) return null;

  const { user, recruitmentAccess } = context;

  // Role-based access control (super admin, recruitment role, or staff/managers
  // who have been granted recruitment access by a super admin).
  if (!canAccessRecruitment(user.role, recruitmentAccess)) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertCircle className="w-16 h-16 text-amber-500 mx-auto" />
              <h2 className="text-2xl font-bold text-slate-900">Access Restricted</h2>
              <p className="text-slate-600">
                You need recruitment or super admin privileges to access this module.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState('jobs');
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isAddJobOpen, setIsAddJobOpen] = useState(false);
  const [isAddCandidateOpen, setIsAddCandidateOpen] = useState(false);
  const [isScheduleInterviewOpen, setIsScheduleInterviewOpen] = useState(false);
  const [persistReady, setPersistReady] = useState(false);

  // Sample Data
  const [jobs, setJobs] = useState<JobPosting[]>([
    {
      id: 'J001',
      title: 'Senior Sales Representative',
      department: 'sales',
      description: 'Experienced sales professional for luxury bathroom installations. Must have proven track record in high-end residential sales.',
      location: 'London, UK',
      salaryRange: '£35,000 - £45,000 + Commission',
      employmentType: 'full-time',
      requiredSkills: ['Sales', 'Customer Relations', 'Negotiation', 'Product Knowledge'],
      qualifications: ['5+ years sales experience', 'UK Driving License', 'CRM proficiency'],
      status: 'open',
      createdAt: '2026-03-15',
      positions: 2,
      applicantCount: 12
    },
    {
      id: 'J002',
      title: 'Microcement Installation Specialist',
      department: 'construction',
      description: 'Skilled tradesperson specializing in microcement application for bathrooms and wet rooms. Training provided for specific techniques.',
      location: 'Manchester, UK',
      salaryRange: '£32,000 - £42,000',
      employmentType: 'full-time',
      requiredSkills: ['Microcement', 'Plastering', 'Tiling', 'Quality Control'],
      qualifications: ['NVQ Level 2/3 in Plastering', '3+ years experience', 'Own tools'],
      status: 'open',
      createdAt: '2026-03-20',
      positions: 3,
      applicantCount: 8
    },
    {
      id: 'J003',
      title: 'Office Administrator',
      department: 'office',
      description: 'Organized administrator to manage scheduling, customer communications, and support operations team.',
      location: 'Birmingham, UK',
      salaryRange: '£24,000 - £28,000',
      employmentType: 'full-time',
      requiredSkills: ['Admin', 'MS Office', 'Customer Service', 'Organization'],
      qualifications: ['2+ years office experience', 'Excellent communication'],
      status: 'open',
      createdAt: '2026-04-01',
      positions: 1,
      applicantCount: 15
    },
    {
      id: 'J004',
      title: 'Bathroom Fitter',
      department: 'construction',
      description: 'Multi-skilled bathroom fitter for complete installations including plumbing, tiling, and finishing.',
      location: 'Leeds, UK',
      salaryRange: '£30,000 - £38,000',
      employmentType: 'full-time',
      requiredSkills: ['Plumbing', 'Tiling', 'Carpentry', 'Electrical basics'],
      qualifications: ['City & Guilds or equivalent', '5+ years experience', 'Public liability insurance'],
      status: 'open',
      createdAt: '2026-04-10',
      positions: 2,
      applicantCount: 6
    },
    {
      id: 'J005',
      title: 'Junior Sales Assistant',
      department: 'sales',
      description: 'Entry-level position for motivated individual to learn luxury bathroom sales. Full training provided.',
      location: 'London, UK',
      salaryRange: '£22,000 - £26,000 + Commission',
      employmentType: 'full-time',
      requiredSkills: ['Customer Service', 'Communication', 'Enthusiasm'],
      qualifications: ['A-Levels or equivalent', 'UK Driving License preferred'],
      status: 'on-hold',
      createdAt: '2026-02-28',
      positions: 1,
      applicantCount: 20
    }
  ]);

  const [candidates, setCandidates] = useState<Candidate[]>([
    {
      id: 'C001',
      name: 'Sarah Mitchell',
      email: 'sarah.mitchell@email.com',
      phone: '07712 345678',
      address: '45 Park Avenue, London, SW1A 2AA',
      location: 'London, UK',
      currentEmploymentStatus: 'employed',
      desiredRole: 'Senior Sales Representative',
      skills: ['B2B Sales', 'CRM Systems', 'Client Relations', 'Negotiation', 'Presentation'],
      certifications: ['Sales Professional Certificate', 'Advanced Negotiation'],
      experience: '7 years in high-end residential sales',
      willingToRelocate: false,
      preferredLocations: ['London', 'Surrey'],
      availability: 'Notice period: 4 weeks',
      source: 'linkedin',
      createdAt: '2026-04-15',
      rating: 5
    },
    {
      id: 'C002',
      name: 'James Cooper',
      email: 'j.cooper@email.com',
      phone: '07823 456789',
      address: '12 Oak Street, Manchester, M1 3HG',
      location: 'Manchester, UK',
      currentEmploymentStatus: 'employed',
      desiredRole: 'Microcement Specialist',
      skills: ['Microcement Application', 'Plastering', 'Surface Preparation', 'Waterproofing'],
      certifications: ['NVQ Level 3 Plastering', 'CSCS Card', 'First Aid'],
      experience: '5 years plastering, 2 years microcement',
      willingToRelocate: true,
      preferredLocations: ['Manchester', 'Leeds', 'Liverpool'],
      availability: 'Immediate',
      source: 'indeed',
      createdAt: '2026-04-18',
      rating: 4
    },
    {
      id: 'C003',
      name: 'Emily Watson',
      email: 'emily.watson@email.com',
      phone: '07934 567890',
      address: '78 High Road, Birmingham, B2 4LP',
      location: 'Birmingham, UK',
      currentEmploymentStatus: 'unemployed',
      desiredRole: 'Office Administrator',
      skills: ['MS Office Suite', 'Customer Service', 'Scheduling', 'Data Entry', 'Phone Systems'],
      certifications: ['Business Admin NVQ Level 3'],
      experience: '4 years office administration',
      willingToRelocate: false,
      preferredLocations: ['Birmingham', 'Solihull'],
      availability: 'Immediate',
      source: 'job-board',
      createdAt: '2026-04-20',
      rating: 4
    },
    {
      id: 'C004',
      name: 'Michael Brown',
      email: 'm.brown@email.com',
      phone: '07845 678901',
      address: '34 Station Road, Leeds, LS1 5DL',
      location: 'Leeds, UK',
      currentEmploymentStatus: 'self-employed',
      desiredRole: 'Bathroom Fitter',
      skills: ['Plumbing', 'Tiling', 'Carpentry', 'Project Management', 'Customer Service'],
      certifications: ['City & Guilds Plumbing', 'Gas Safe', 'CSCS Card'],
      experience: '8 years as bathroom fitter',
      willingToRelocate: false,
      preferredLocations: ['Leeds', 'York', 'Bradford'],
      availability: '2 weeks notice',
      source: 'referral',
      createdAt: '2026-04-22',
      rating: 5
    },
    {
      id: 'C005',
      name: 'Jessica Turner',
      email: 'jess.turner@email.com',
      phone: '07756 789012',
      address: '91 Green Lane, London, N16 9BS',
      location: 'London, UK',
      currentEmploymentStatus: 'student',
      desiredRole: 'Junior Sales Assistant',
      skills: ['Customer Service', 'Social Media', 'Communication', 'Retail Experience'],
      certifications: ['A-Levels: Business, English, Maths'],
      experience: '2 years part-time retail',
      willingToRelocate: false,
      preferredLocations: ['London'],
      availability: 'After June 2026',
      source: 'website',
      createdAt: '2026-04-25',
      rating: 3
    }
  ]);

  const [applications, setApplications] = useState<Application[]>([
    {
      id: 'A001',
      candidateId: 'C001',
      jobId: 'J001',
      stage: 'interview',
      appliedDate: '2026-04-15',
      stageDate: '2026-04-20',
      notes: ['Strong sales background', 'Excellent communication in phone screen', 'Scheduled for final interview'],
      feedback: 'Very impressive candidate with luxury brand experience',
      rating: 5
    },
    {
      id: 'A002',
      candidateId: 'C002',
      jobId: 'J002',
      stage: 'offer',
      appliedDate: '2026-04-18',
      stageDate: '2026-04-25',
      notes: ['Portfolio shows excellent work quality', 'References checked - all positive', 'Offer prepared'],
      feedback: 'Top candidate for microcement role',
      rating: 5
    },
    {
      id: 'A003',
      candidateId: 'C003',
      jobId: 'J003',
      stage: 'screening',
      appliedDate: '2026-04-20',
      stageDate: '2026-04-21',
      notes: ['CV looks good', 'Awaiting phone screening'],
      feedback: '',
      rating: 4
    },
    {
      id: 'A004',
      candidateId: 'C004',
      jobId: 'J004',
      stage: 'interview',
      appliedDate: '2026-04-22',
      stageDate: '2026-04-24',
      notes: ['Self-employed with own business', 'Excellent technical skills', 'Trial day scheduled'],
      feedback: 'Very experienced, checking availability',
      rating: 5
    },
    {
      id: 'A005',
      candidateId: 'C005',
      jobId: 'J005',
      stage: 'applied',
      appliedDate: '2026-04-25',
      stageDate: '2026-04-25',
      notes: ['Fresh application', 'Student finishing studies'],
      feedback: '',
      rating: 3
    }
  ]);

  const [interviews, setInterviews] = useState<Interview[]>([
    {
      id: 'I001',
      applicationId: 'A001',
      candidateId: 'C001',
      jobId: 'J001',
      scheduledDate: '2026-04-30',
      scheduledTime: '10:00',
      duration: 60,
      type: 'in-person',
      location: 'London Office, 123 Business Park, London, W1A 1AA',
      interviewers: ['John Smith - Sales Director', 'Emma Jones - HR Manager'],
      status: 'scheduled',
      notes: 'Final interview - discuss commission structure and territory'
    },
    {
      id: 'I002',
      applicationId: 'A002',
      candidateId: 'C002',
      jobId: 'J002',
      scheduledDate: '2026-04-23',
      scheduledTime: '14:00',
      duration: 45,
      type: 'in-person',
      location: 'Manchester Workshop, M2 5DB',
      interviewers: ['David Wilson - Operations Manager'],
      status: 'completed',
      feedback: 'Excellent technical skills demonstrated. Portfolio impressive. References all positive.',
      rating: 5,
      notes: 'Showed samples of previous microcement work - very high quality'
    },
    {
      id: 'I003',
      applicationId: 'A004',
      candidateId: 'C004',
      jobId: 'J004',
      scheduledDate: '2026-04-29',
      scheduledTime: '09:00',
      duration: 240,
      type: 'in-person',
      location: 'Leeds Project Site',
      interviewers: ['Tom Richards - Head Fitter'],
      status: 'scheduled',
      notes: 'Trial day - working on actual bathroom installation'
    }
  ]);

  useEffect(() => {
    const store = loadRecruitmentStore();
    if (store.jobs.length > 0) setJobs(store.jobs as JobPosting[]);
    if (store.candidates.length > 0) setCandidates(store.candidates as Candidate[]);
    if (store.interviews.length > 0) setInterviews(store.interviews as Interview[]);
    setPersistReady(true);
  }, []);

  useEffect(() => {
    if (!persistReady) return;
    const data = {
      jobs,
      candidates,
      interviews,
      updatedAt: new Date().toISOString(),
    };
    saveRecruitmentStore(data);
    void syncRecruitmentToServer(data);
  }, [jobs, candidates, interviews, persistReady]);

  const [onboardingTasks, setOnboardingTasks] = useState<OnboardingTask[]>([
    {
      id: 'OB001',
      candidateId: 'C002',
      task: 'Complete right to work documentation',
      category: 'documentation',
      status: 'completed',
      dueDate: '2026-04-28',
      assignedTo: 'HR Team'
    },
    {
      id: 'OB002',
      candidateId: 'C002',
      task: 'Provide bank details for payroll',
      category: 'documentation',
      status: 'completed',
      dueDate: '2026-04-28',
      assignedTo: 'HR Team'
    },
    {
      id: 'OB003',
      candidateId: 'C002',
      task: 'Complete health & safety induction',
      category: 'training',
      status: 'in-progress',
      dueDate: '2026-05-01',
      assignedTo: 'H&S Officer'
    },
    {
      id: 'OB004',
      candidateId: 'C002',
      task: 'Issue company van and equipment',
      category: 'equipment',
      status: 'pending',
      dueDate: '2026-05-01',
      assignedTo: 'Operations'
    },
    {
      id: 'OB005',
      candidateId: 'C002',
      task: 'Set up email and system access',
      category: 'access',
      status: 'pending',
      dueDate: '2026-04-30',
      assignedTo: 'IT Team'
    },
    {
      id: 'OB006',
      candidateId: 'C002',
      task: 'First day orientation with team',
      category: 'orientation',
      status: 'pending',
      dueDate: '2026-05-03',
      assignedTo: 'Line Manager'
    }
  ]);

  const [communications, setCommunications] = useState<CommunicationLog[]>([
    {
      id: 'COM001',
      candidateId: 'C001',
      type: 'email',
      subject: 'Application Received',
      message: 'Thank you for your application for Senior Sales Representative. We will review and be in touch soon.',
      date: '2026-04-15',
      sentBy: 'Recruitment System'
    },
    {
      id: 'COM002',
      candidateId: 'C001',
      type: 'call',
      subject: 'Initial Phone Screen',
      message: '15 min call to discuss experience and role expectations. Very positive conversation.',
      date: '2026-04-17',
      sentBy: 'Emma Jones'
    },
    {
      id: 'COM003',
      candidateId: 'C001',
      type: 'email',
      subject: 'Interview Invitation',
      message: 'We would like to invite you for a final interview on April 30th at 10am at our London office.',
      date: '2026-04-20',
      sentBy: 'Emma Jones'
    },
    {
      id: 'COM004',
      candidateId: 'C002',
      type: 'interview',
      subject: 'Technical Interview',
      message: 'In-person interview and portfolio review. Discussed previous projects and techniques.',
      date: '2026-04-23',
      sentBy: 'David Wilson'
    },
    {
      id: 'COM005',
      candidateId: 'C002',
      type: 'offer',
      subject: 'Job Offer - Microcement Specialist',
      message: 'Formal offer letter sent for Microcement Installation Specialist position. Salary: £38,000. Start date: May 3rd 2026.',
      date: '2026-04-25',
      sentBy: 'HR Team'
    }
  ]);

  // Helper functions
  const getCandidateById = (id: string) => candidates.find(c => c.id === id);
  const getJobById = (id: string) => jobs.find(j => j.id === id);
  const getApplicationsForJob = (jobId: string) => applications.filter(a => a.jobId === jobId);
  const getApplicationsForCandidate = (candidateId: string) => applications.filter(a => a.candidateId === candidateId);
  const getInterviewsForCandidate = (candidateId: string) => interviews.filter(i => i.candidateId === candidateId);
  const getCommunicationsForCandidate = (candidateId: string) => communications.filter(c => c.candidateId === candidateId);
  const getOnboardingTasksForCandidate = (candidateId: string) => onboardingTasks.filter(t => t.candidateId === candidateId);

  // Analytics calculations
  const analytics = {
    totalJobs: jobs.length,
    openJobs: jobs.filter(j => j.status === 'open').length,
    totalCandidates: candidates.length,
    totalApplications: applications.length,
    applicationsThisMonth: applications.filter(a => new Date(a.appliedDate).getMonth() === 3).length,
    inInterview: applications.filter(a => a.stage === 'interview').length,
    offersOut: applications.filter(a => a.stage === 'offer').length,
    hiredThisMonth: applications.filter(a => a.stage === 'hired' && new Date(a.stageDate).getMonth() === 3).length,
    avgTimeToHire: 18, // days
    topSource: 'LinkedIn',
    conversionRate: 25, // %
    upcomingInterviews: interviews.filter(i => i.status === 'scheduled').length
  };

  // Render Job Posting Card
  const renderJobCard = (job: JobPosting) => (
    <Card key={job.id} className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {job.department === 'sales' && <Briefcase className="w-5 h-5 text-amber-500" />}
              {job.department === 'construction' && <Wrench className="w-5 h-5 text-amber-500" />}
              {job.department === 'office' && <Building className="w-5 h-5 text-amber-500" />}
              {job.title}
            </CardTitle>
            <CardDescription className="mt-2 space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4" />
                {job.location}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="w-4 h-4" />
                {job.salaryRange}
              </div>
            </CardDescription>
          </div>
          <Badge variant={job.status === 'open' ? 'default' : job.status === 'closed' ? 'secondary' : 'outline'}>
            {job.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600 line-clamp-2">{job.description}</p>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{job.employmentType}</Badge>
          <Badge variant="outline">{job.positions} positions</Badge>
          <Badge variant="secondary">{job.applicantCount || 0} applicants</Badge>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => setSelectedJob(job)}
            className="flex-1"
          >
            <Eye className="w-4 h-4 mr-2" />
            View Details
          </Button>
          <Button size="sm" variant="outline">
            <Edit2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Render Candidate Card
  const renderCandidateCard = (candidate: Candidate) => {
    const candidateApplications = getApplicationsForCandidate(candidate.id);
    const latestApplication = candidateApplications[0];

    return (
      <Card key={candidate.id} className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-amber-500" />
                {candidate.name}
              </CardTitle>
              <CardDescription className="mt-2 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4" />
                  {candidate.email}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4" />
                  {candidate.phone}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4" />
                  {candidate.location}
                </div>
              </CardDescription>
            </div>
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`w-4 h-4 ${i < candidate.rating ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}`} />
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-700">Desired Role:</p>
            <p className="text-sm text-slate-600">{candidate.desiredRole}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Skills:</p>
            <div className="flex flex-wrap gap-1">
              {candidate.skills.slice(0, 4).map((skill, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">{skill}</Badge>
              ))}
              {candidate.skills.length > 4 && (
                <Badge variant="outline" className="text-xs">+{candidate.skills.length - 4}</Badge>
              )}
            </div>
          </div>

          {latestApplication && (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary">{latestApplication.stage}</Badge>
              <span className="text-slate-600">for {getJobById(latestApplication.jobId)?.title}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => setSelectedCandidate(candidate)}
              className="flex-1"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Profile
            </Button>
            <Button size="sm" variant="outline">
              <Edit2 className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Render Pipeline View
  const renderPipeline = () => {
    const stages = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'];
    const stageNames = {
      applied: 'Applied',
      screening: 'Screening',
      interview: 'Interview',
      offer: 'Offer',
      hired: 'Hired',
      rejected: 'Rejected'
    };
    const stageColors = {
      applied: 'bg-slate-100 border-slate-300',
      screening: 'bg-blue-50 border-blue-300',
      interview: 'bg-amber-50 border-amber-300',
      offer: 'bg-green-50 border-green-300',
      hired: 'bg-emerald-100 border-emerald-500',
      rejected: 'bg-red-50 border-red-300'
    };

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stages.map(stage => {
          const stageApplications = applications.filter(a => a.stage === stage);

          return (
            <div key={stage} className="space-y-3">
              <div className={`${stageColors[stage as keyof typeof stageColors]} p-3 rounded-lg border-2`}>
                <h3 className="font-semibold text-slate-900 mb-1">
                  {stageNames[stage as keyof typeof stageNames]}
                </h3>
                <p className="text-sm text-slate-600">{stageApplications.length} candidates</p>
              </div>

              <div className="space-y-2">
                {stageApplications.map(app => {
                  const candidate = getCandidateById(app.candidateId);
                  const job = getJobById(app.jobId);

                  if (!candidate || !job) return null;

                  return (
                    <Card
                      key={app.id}
                      className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedApplication(app)}
                    >
                      <div className="space-y-2">
                        <p className="font-medium text-sm text-slate-900">{candidate.name}</p>
                        <p className="text-xs text-slate-600 line-clamp-1">{job.title}</p>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">{app.rating}/5</Badge>
                          <span className="text-xs text-slate-500">
                            {new Date(app.stageDate).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render Analytics Tab
  const renderAnalytics = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Open Positions</p>
                <p className="text-3xl font-bold text-slate-900">{analytics.openJobs}</p>
                <p className="text-xs text-slate-500 mt-1">of {analytics.totalJobs} total</p>
              </div>
              <Briefcase className="w-12 h-12 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Candidates</p>
                <p className="text-3xl font-bold text-slate-900">{analytics.totalCandidates}</p>
                <p className="text-xs text-slate-500 mt-1">in database</p>
              </div>
              <Users className="w-12 h-12 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Applications</p>
                <p className="text-3xl font-bold text-slate-900">{analytics.applicationsThisMonth}</p>
                <p className="text-xs text-slate-500 mt-1">this month</p>
              </div>
              <FileText className="w-12 h-12 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Time to Hire</p>
                <p className="text-3xl font-bold text-slate-900">{analytics.avgTimeToHire}</p>
                <p className="text-xs text-slate-500 mt-1">days average</p>
              </div>
              <Timer className="w-12 h-12 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-amber-500" />
              Pipeline Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">In Screening</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: '30%' }}></div>
                  </div>
                  <span className="text-sm font-medium">{applications.filter(a => a.stage === 'screening').length}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">In Interview</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500" style={{ width: '50%' }}></div>
                  </div>
                  <span className="text-sm font-medium">{analytics.inInterview}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Offers Out</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500" style={{ width: '20%' }}></div>
                  </div>
                  <span className="text-sm font-medium">{analytics.offersOut}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Hired This Month</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: '10%' }}></div>
                  </div>
                  <span className="text-sm font-medium">{analytics.hiredThisMonth}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-500" />
              Source Effectiveness
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {['linkedin', 'indeed', 'job-board', 'referral', 'website'].map((source) => {
                const sourceCount = candidates.filter(c => c.source === source).length;
                const percentage = Math.round((sourceCount / candidates.length) * 100);

                return (
                  <div key={source} className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 capitalize">{source}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500" style={{ width: `${percentage}%` }}></div>
                      </div>
                      <span className="text-sm font-medium w-12 text-right">{sourceCount} ({percentage}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-500" />
            Upcoming Interviews
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {interviews.filter(i => i.status === 'scheduled').map(interview => {
              const candidate = getCandidateById(interview.candidateId);
              const job = getJobById(interview.jobId);

              if (!candidate || !job) return null;

              return (
                <div key={interview.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{candidate.name}</p>
                    <p className="text-sm text-slate-600">{job.title}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-900">
                      {new Date(interview.scheduledDate).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-sm text-slate-600">{interview.scheduledTime}</p>
                  </div>
                  <div className="ml-4">
                    {interview.type === 'phone' && <Phone className="w-5 h-5 text-amber-500" />}
                    {interview.type === 'video' && <Video className="w-5 h-5 text-amber-500" />}
                    {interview.type === 'in-person' && <MapPin className="w-5 h-5 text-amber-500" />}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Render Onboarding Tab
  const renderOnboarding = () => {
    const hiredCandidates = applications
      .filter(a => a.stage === 'hired' || a.stage === 'offer')
      .map(a => getCandidateById(a.candidateId))
      .filter(c => c !== undefined) as Candidate[];

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-900">New Hire Onboarding</h2>
          <Badge variant="secondary">{hiredCandidates.length} active onboarding</Badge>
        </div>

        {hiredCandidates.map(candidate => {
          const tasks = getOnboardingTasksForCandidate(candidate.id);
          const completedTasks = tasks.filter(t => t.status === 'completed').length;
          const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

          return (
            <Card key={candidate.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-amber-500" />
                      {candidate.name}
                    </CardTitle>
                    <CardDescription>{candidate.desiredRole}</CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-900">{progress}%</p>
                    <p className="text-sm text-slate-600">Complete</p>
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mt-4">
                  <div className="h-full bg-amber-500" style={{ width: `${progress}%` }}></div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tasks.map(task => (
                    <div key={task.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                      <div className="mt-1">
                        {task.status === 'completed' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : task.status === 'in-progress' ? (
                          <Clock className="w-5 h-5 text-amber-500" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${task.status === 'completed' ? 'text-slate-600 line-through' : 'text-slate-900'}`}>
                          {task.task}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-sm text-slate-600">
                          <span className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">{task.category}</Badge>
                          </span>
                          {task.assignedTo && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {task.assignedTo}
                            </span>
                          )}
                          {task.dueDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(task.dueDate).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button size="sm" variant="ghost">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button className="w-full mt-4" variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Onboarding Task
                </Button>
              </CardContent>
            </Card>
          );
        })}

        {hiredCandidates.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <ClipboardList className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">No active onboarding processes</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Users className="w-8 h-8 text-amber-500" />
            Recruitment CRM
          </h1>
          <p className="text-slate-600 mt-2">Manage hiring for office staff and construction teams</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsAddCandidateOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add Candidate
          </Button>
          <Button onClick={() => setIsAddJobOpen(true)} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Post Job
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Briefcase className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-slate-900">{analytics.openJobs}</p>
            <p className="text-sm text-slate-600">Open Jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-slate-900">{analytics.totalCandidates}</p>
            <p className="text-sm text-slate-600">Candidates</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Calendar className="w-8 h-8 text-purple-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-slate-900">{analytics.upcomingInterviews}</p>
            <p className="text-sm text-slate-600">Interviews</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-slate-900">{analytics.offersOut}</p>
            <p className="text-sm text-slate-600">Offers Out</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Timer className="w-8 h-8 text-orange-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-slate-900">{analytics.avgTimeToHire}</p>
            <p className="text-sm text-slate-600">Days to Hire</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full overflow-x-auto">
          <TabsTrigger value="jobs" className="shrink-0 sm:flex-1">
            <Briefcase className="w-4 h-4 mr-2" />
            Jobs
          </TabsTrigger>
          <TabsTrigger value="candidates" className="shrink-0 sm:flex-1">
            <Users className="w-4 h-4 mr-2" />
            Candidates
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="shrink-0 sm:flex-1">
            <Target className="w-4 h-4 mr-2" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="analytics" className="shrink-0 sm:flex-1">
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="shrink-0 sm:flex-1">
            <ClipboardList className="w-4 h-4 mr-2" />
            Onboarding
          </TabsTrigger>
        </TabsList>

        {/* Jobs Tab */}
        <TabsContent value="jobs" className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="on-hold">On Hold</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs
              .filter(j => filterStatus === 'all' || j.status === filterStatus)
              .filter(j => searchTerm === '' || j.title.toLowerCase().includes(searchTerm.toLowerCase()))
              .map(job => renderJobCard(job))}
          </div>
        </TabsContent>

        {/* Candidates Tab */}
        <TabsContent value="candidates" className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search candidates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {candidates
              .filter(c => searchTerm === '' ||
                c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.desiredRole.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map(candidate => renderCandidateCard(candidate))}
          </div>
        </TabsContent>

        {/* Pipeline Tab */}
        <TabsContent value="pipeline" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-900">Application Pipeline</h2>
            <div className="flex gap-2">
              <Select defaultValue="all">
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Jobs</SelectItem>
                  {jobs.map(job => (
                    <SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {renderPipeline()}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          {renderAnalytics()}
        </TabsContent>

        {/* Onboarding Tab */}
        <TabsContent value="onboarding" className="space-y-4">
          {renderOnboarding()}
        </TabsContent>
      </Tabs>

      {/* Job Details Dialog */}
      {selectedJob && (
        <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl">
                {selectedJob.department === 'sales' && <Briefcase className="w-6 h-6 text-amber-500" />}
                {selectedJob.department === 'construction' && <Wrench className="w-6 h-6 text-amber-500" />}
                {selectedJob.department === 'office' && <Building className="w-6 h-6 text-amber-500" />}
                {selectedJob.title}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Location</Label>
                  <p className="font-medium">{selectedJob.location}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Salary Range</Label>
                  <p className="font-medium">{selectedJob.salaryRange}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Employment Type</Label>
                  <p className="font-medium capitalize">{selectedJob.employmentType}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Positions</Label>
                  <p className="font-medium">{selectedJob.positions}</p>
                </div>
              </div>

              <div>
                <Label className="text-slate-600 mb-2 block">Description</Label>
                <p className="text-slate-900">{selectedJob.description}</p>
              </div>

              <div>
                <Label className="text-slate-600 mb-2 block">Required Skills</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedJob.requiredSkills.map((skill, idx) => (
                    <Badge key={idx} variant="secondary">{skill}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-slate-600 mb-2 block">Qualifications</Label>
                <ul className="list-disc list-inside space-y-1">
                  {selectedJob.qualifications.map((qual, idx) => (
                    <li key={idx} className="text-slate-900">{qual}</li>
                  ))}
                </ul>
              </div>

              <div>
                <Label className="text-slate-600 mb-2 block">Applicants ({getApplicationsForJob(selectedJob.id).length})</Label>
                <div className="space-y-2">
                  {getApplicationsForJob(selectedJob.id).map(app => {
                    const candidate = getCandidateById(app.candidateId);
                    if (!candidate) return null;

                    return (
                      <div key={app.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{candidate.name}</p>
                          <p className="text-sm text-slate-600">{candidate.email}</p>
                        </div>
                        <Badge>{app.stage}</Badge>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1">
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit Job
                </Button>
                <Button variant="outline" className="flex-1">
                  <Send className="w-4 h-4 mr-2" />
                  Share Job
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Application pipeline detail */}
      {selectedApplication && (
        <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Application {selectedApplication.id}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              <p><strong>Candidate ID:</strong> {selectedApplication.candidateId}</p>
              <p><strong>Job ID:</strong> {selectedApplication.jobId}</p>
              <p><strong>Stage:</strong> {selectedApplication.stage}</p>
              <p><strong>Applied:</strong> {new Date(selectedApplication.appliedDate).toLocaleDateString()}</p>
              {selectedApplication.notes?.length > 0 && (
                <p className="text-slate-600">{selectedApplication.notes.join('; ')}</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Candidate Details Dialog */}
      {selectedCandidate && (
        <Dialog open={!!selectedCandidate} onOpenChange={() => setSelectedCandidate(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-2xl">
                  <User className="w-6 h-6 text-amber-500" />
                  {selectedCandidate.name}
                </span>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-5 h-5 ${i < selectedCandidate.rating ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}`} />
                  ))}
                </div>
              </DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="profile" className="mt-4">
              <TabsList className="flex w-full overflow-x-auto">
                <TabsTrigger value="profile" className="shrink-0 sm:flex-1">Profile</TabsTrigger>
                <TabsTrigger value="applications" className="shrink-0 sm:flex-1">Applications</TabsTrigger>
                <TabsTrigger value="interviews" className="shrink-0 sm:flex-1">Interviews</TabsTrigger>
                <TabsTrigger value="communications" className="shrink-0 sm:flex-1">Communications</TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="space-y-6 mt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-600">Email</Label>
                    <p className="font-medium flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400" />
                      {selectedCandidate.email}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-600">Phone</Label>
                    <p className="font-medium flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400" />
                      {selectedCandidate.phone}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-600">Location</Label>
                    <p className="font-medium flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      {selectedCandidate.location}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-600">Employment Status</Label>
                    <p className="font-medium capitalize">{selectedCandidate.currentEmploymentStatus}</p>
                  </div>
                  <div>
                    <Label className="text-slate-600">Availability</Label>
                    <p className="font-medium">{selectedCandidate.availability}</p>
                  </div>
                  <div>
                    <Label className="text-slate-600">Source</Label>
                    <p className="font-medium capitalize">{selectedCandidate.source}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-slate-600 mb-2 block">Desired Role</Label>
                  <p className="font-medium text-slate-900">{selectedCandidate.desiredRole}</p>
                </div>

                <div>
                  <Label className="text-slate-600 mb-2 block">Experience</Label>
                  <p className="text-slate-900">{selectedCandidate.experience}</p>
                </div>

                <div>
                  <Label className="text-slate-600 mb-2 block">Skills</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedCandidate.skills.map((skill, idx) => (
                      <Badge key={idx} variant="secondary">{skill}</Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-slate-600 mb-2 block">Certifications</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedCandidate.certifications.map((cert, idx) => (
                      <Badge key={idx} variant="outline" className="flex items-center gap-1">
                        <Award className="w-3 h-3" />
                        {cert}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-slate-600 mb-2 block">Location Preferences</Label>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">Willing to relocate:</span>{' '}
                      {selectedCandidate.willingToRelocate ? 'Yes' : 'No'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedCandidate.preferredLocations.map((loc, idx) => (
                        <Badge key={idx} variant="outline">
                          <MapPin className="w-3 h-3 mr-1" />
                          {loc}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Send Message
                  </Button>
                  <Button variant="outline">
                    <Calendar className="w-4 h-4 mr-2" />
                    Schedule Interview
                  </Button>
                  <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Download CV
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="applications" className="space-y-4 mt-6">
                {getApplicationsForCandidate(selectedCandidate.id).map(app => {
                  const job = getJobById(app.jobId);
                  if (!job) return null;

                  return (
                    <Card key={app.id}>
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-lg">{job.title}</h3>
                              <p className="text-sm text-slate-600">{job.location}</p>
                            </div>
                            <Badge>{app.stage}</Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <Label className="text-slate-600">Applied</Label>
                              <p>{new Date(app.appliedDate).toLocaleDateString('en-GB')}</p>
                            </div>
                            <div>
                              <Label className="text-slate-600">Rating</Label>
                              <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                  <Star key={i} className={`w-4 h-4 ${i < app.rating ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}`} />
                                ))}
                              </div>
                            </div>
                          </div>

                          {app.feedback && (
                            <div>
                              <Label className="text-slate-600">Feedback</Label>
                              <p className="text-sm mt-1">{app.feedback}</p>
                            </div>
                          )}

                          {app.notes.length > 0 && (
                            <div>
                              <Label className="text-slate-600 mb-2 block">Notes</Label>
                              <ul className="list-disc list-inside space-y-1 text-sm">
                                {app.notes.map((note, idx) => (
                                  <li key={idx}>{note}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </TabsContent>

              <TabsContent value="interviews" className="space-y-4 mt-6">
                {getInterviewsForCandidate(selectedCandidate.id).map(interview => {
                  const job = getJobById(interview.jobId);
                  if (!job) return null;

                  return (
                    <Card key={interview.id}>
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-lg">{job.title}</h3>
                              <p className="text-sm text-slate-600 capitalize">{interview.type} Interview</p>
                            </div>
                            <Badge variant={interview.status === 'completed' ? 'secondary' : 'default'}>
                              {interview.status}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <Label className="text-slate-600">Date & Time</Label>
                              <p className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                {new Date(interview.scheduledDate).toLocaleDateString('en-GB')} at {interview.scheduledTime}
                              </p>
                            </div>
                            <div>
                              <Label className="text-slate-600">Duration</Label>
                              <p className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-slate-400" />
                                {interview.duration} minutes
                              </p>
                            </div>
                          </div>

                          {interview.location && (
                            <div>
                              <Label className="text-slate-600">Location</Label>
                              <p className="text-sm flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-slate-400" />
                                {interview.location}
                              </p>
                            </div>
                          )}

                          <div>
                            <Label className="text-slate-600 mb-2 block">Interviewers</Label>
                            <div className="space-y-1">
                              {interview.interviewers.map((interviewer, idx) => (
                                <p key={idx} className="text-sm flex items-center gap-2">
                                  <User className="w-3 h-3 text-slate-400" />
                                  {interviewer}
                                </p>
                              ))}
                            </div>
                          </div>

                          {interview.feedback && (
                            <div>
                              <Label className="text-slate-600">Feedback</Label>
                              <p className="text-sm mt-1">{interview.feedback}</p>
                              {interview.rating && (
                                <div className="flex items-center gap-1 mt-2">
                                  {[...Array(5)].map((_, i) => (
                                    <Star key={i} className={`w-4 h-4 ${i < interview.rating! ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}`} />
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {interview.notes && (
                            <div>
                              <Label className="text-slate-600">Notes</Label>
                              <p className="text-sm mt-1">{interview.notes}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </TabsContent>

              <TabsContent value="communications" className="space-y-4 mt-6">
                {getCommunicationsForCandidate(selectedCandidate.id).map(comm => (
                  <Card key={comm.id}>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            {comm.type === 'email' && <Mail className="w-5 h-5 text-blue-500" />}
                            {comm.type === 'call' && <Phone className="w-5 h-5 text-green-500" />}
                            {comm.type === 'interview' && <Video className="w-5 h-5 text-purple-500" />}
                            {comm.type === 'offer' && <FileText className="w-5 h-5 text-amber-500" />}
                            <div>
                              <p className="font-semibold">{comm.subject}</p>
                              <p className="text-sm text-slate-600">by {comm.sentBy}</p>
                            </div>
                          </div>
                          <p className="text-sm text-slate-500">
                            {new Date(comm.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        <p className="text-sm text-slate-700">{comm.message}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
