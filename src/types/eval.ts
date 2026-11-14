export type UserRole = 'admin' | 'teacher' | 'student';
export type UserStatus = 'active' | 'inactive';

export type PaperMode = 'strict' | 'lenient' | 'maths';
export type QuestionType = 'mcq' | 'one_word' | 'short' | 'long' | 'maths';

export type PaperStatus = 'draft' | 'ready' | 'open_for_evaluation' | 'closed' | 'published';

export type SheetStatus =
  | 'uploaded'
  | 'processing'
  | 'ready_for_review'
  | 'in_review'
  | 'evaluated'
  | 'published'
  | 'reopened'
  | 'failed';

export type RequestStatus =
  | 'requested'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'released'
  | 'expired';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type ReviewFlagReason =
  | 'low_ocr_confidence'
  | 'checks_disagree'
  | 'doubtful_crop'
  | 'spelling_doubt';

export type KeyPointVerdict = 'found' | 'partly' | 'not_found';

export interface User {
  id: string;
  name: string;
  email: string;
  rollNumber?: string;
  rollCode?: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  subjects?: string[]; // subject IDs for teachers
  classId?: string;
  section?: string;
  phone?: string;
  createdAt: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  department: string;
}

export interface ClassSection {
  id: string;
  name: string;
  sections: string[];
  academicYear: string;
}

export interface Exam {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'upcoming' | 'active' | 'completed';
}

export interface KeyPoint {
  id: string;
  text: string;
  marks: number;
  alternativeWordings: string[];
}

export interface Question {
  id: string;
  paperId: string;
  number: number;
  label: string; // e.g., "Q1"
  text: string;
  type: QuestionType;
  marks: number;
  modeOverride?: PaperMode;
  modelAnswer: string;
  markingNotes: string;
  commonWrongAnswers: string[];
  keyPoints: KeyPoint[];
}

export interface RubricVersion {
  version: number;
  updatedAt: string;
  updatedBy: string;
  reason: string;
}

export interface Paper {
  id: string;
  examId: string;
  subjectId: string;
  classId: string;
  date: string;
  totalMarks: number;
  passingMarks: number;
  mode: PaperMode;
  anonymousEvaluation: boolean;
  spotCheckPct: number;
  status: PaperStatus;
  dueDate: string;
  rubricLocked: boolean;
  rubricVersion: number;
  rubricHistory: RubricVersion[];
  sourceKeyText: string;
  questionPaperNotes: string;
  requestWindowEnd: string;
}

export interface BoundingBox {
  pageIndex: number;
  topPct: number;
  leftPct: number;
  widthPct: number;
  heightPct: number;
}

export interface LineCrop {
  id: string;
  pageIndex: number;
  topPct: number;
  heightPct: number;
  ocrGuess: string;
  editedText: string;
  lowConfidenceWords: string[];
  lineConfidence: number; // 0-100
  addedToTrainingSet?: boolean;
}

export interface KeyPointEvaluation {
  keyPointId: string;
  verdict: KeyPointVerdict;
  marksAwarded: number;
  evidenceSentence: string;
  reason: string;
}

export interface EvaluationChecks {
  aiJudge: 'agree' | 'partial' | 'disagree';
  contradictionCheck: 'no_contradiction' | 'contradiction_detected' | 'uncertain';
  votes: string; // e.g. "3/3 agree"
}

export interface MarkChangeHistory {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: UserRole;
  previousMarks: number;
  newMarks: number;
  reason?: string;
  note: string;
}

export interface StrictModeBreakdown {
  content: number;
  grammar: number;
  spelling: number;
}

export interface AnswerEvaluation {
  questionId: string;
  ocrText: string;
  originalOcrText: string;
  lowConfidenceWords: string[];
  boundingBox: BoundingBox;
  lineCrops: LineCrop[];
  confidence: ConfidenceLevel;
  confidenceScore: number; // 0-100
  reviewReasons: ReviewFlagReason[];
  flagResolved: boolean;
  flaggedForAdmin?: boolean;
  adminFlagNote?: string;
  keyPointResults: KeyPointEvaluation[];
  checks: EvaluationChecks;
  suggestedMarks: number;
  finalMarks: number;
  source: 'ai' | 'teacher';
  teacherOverride: boolean;
  overrideReason?: string;
  feedback: string;
  aiDraftFeedback: string;
  strictBreakdown?: StrictModeBreakdown;
  skippedForLater?: boolean;
  acceptedByTeacher: boolean;
  changedBy?: string;
  changedAt?: string;
  history: MarkChangeHistory[];
}

export interface SheetQualityCheck {
  blurOk: boolean;
  tiltDegrees: number;
  missingPages: boolean;
  notes: string;
}

export interface Sheet {
  id: string;
  paperId: string;
  studentId: string;
  assignedTeacherId?: string;
  pages: string[]; // local image URLs
  status: SheetStatus;
  quality: SheetQualityCheck;
  processingError?: string;
  spotCheckCompleted: boolean;
  timeSpentSeconds: number;
  lastQuestionIndex: number;
  answers: AnswerEvaluation[];
  submittedAt?: string;
  publishedAt?: string;
  reopenReason?: string;
}

export interface StudentRequest {
  id: string;
  studentId: string;
  paperId: string;
  sheetId: string;
  reasonCategory: string;
  note: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  decisionBy?: string;
  decisionAt?: string;
  rejectionReason?: string;
  viewDurationDays: number;
  allowDownload: boolean;
  expiryDate?: string;
  forwardedToTeacherId?: string;
  reevalCompleted?: boolean;
  reevalSummary?: string;
}

export interface NotificationItem {
  id: string;
  userId: string; // specific userId or role key ('role:admin')
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  createdAt: string;
  read: boolean;
  linkView?: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  target: string;
  oldValue?: string;
  newValue?: string;
}

export interface ProblemReport {
  id: string;
  sheetId: string;
  paperId: string;
  teacherId: string;
  category: 'bad_scan' | 'wrong_student' | 'missing_page' | 'other';
  description: string;
  createdAt: string;
  resolved: boolean;
}

export interface SystemSettings {
  institutionName: string;
  academicYear: string;
  strictProfileNote: string;
  lenientProfileNote: string;
  mathsProfileNote: string;
  highConfidenceThreshold: number;
  mediumConfidenceThreshold: number;
  defaultSpotCheckPct: number;
  scanRetentionDays: number;
  defaultRequestViewDays: number;
  sessionTimeoutMinutes: number;
  allowTrainingDataConsent: boolean;
  showClassAverageToStudents: boolean;
  showQuestionFeedbackToStudents: boolean;
}

export interface TeacherPreferences {
  defaultZoomPct: number;
  enableKeyboardShortcuts: boolean;
  notifyOnAssignment: boolean;
  notifyOnReopen: boolean;
  notifyOnReeval: boolean;
}
