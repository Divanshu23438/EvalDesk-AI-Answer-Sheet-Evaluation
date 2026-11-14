import scienceSheetImg from '../assets/images/handwritten_sheet_science_p1_1794626969647.jpg';
import mathsSheetImg from '../assets/images/handwritten_sheet_maths_p1_1794626970674.jpg';
import englishSheetImg from '../assets/images/handwritten_sheet_english_p1_1794626970104.jpg';
import blurSheetImg from '../assets/images/handwritten_sheet_blur_sample_1794626971229.jpg';
import type {
  AuditEntry,
  ClassSection,
  Exam,
  NotificationItem,
  OcrAuditRecord,
  Paper,
  ProblemReport,
  Question,
  Sheet,
  StudentRequest,
  Subject,
  SystemSettings,
  TeacherPreferences,
  User,
} from '../types/eval';

export interface EvalStoreState {
  users: User[];
  subjects: Subject[];
  classes: ClassSection[];
  exams: Exam[];
  papers: Paper[];
  questions: Question[];
  sheets: Sheet[];
  requests: StudentRequest[];
  notifications: NotificationItem[];
  auditLogs: AuditEntry[];
  ocrAuditLogs: OcrAuditRecord[];
  problemReports: ProblemReport[];
  settings: SystemSettings;
  teacherPreferences: Record<string, TeacherPreferences>;
}

export const SHEET_IMAGE_ASSETS = {
  science: scienceSheetImg,
  maths: mathsSheetImg,
  english: englishSheetImg,
  blur: blurSheetImg,
};

export function createStarterAcademicCatalog(
  adminName: string,
  academicYear: string
): Pick<EvalStoreState, 'subjects' | 'classes' | 'exams' | 'papers' | 'questions'> {
  const now = new Date().toISOString();
  const subjects: Subject[] = [
    { id: 'subj-phys', name: 'General Physics & Science', code: 'PHYS 101', department: 'Natural Sciences' },
    { id: 'subj-math', name: 'Applied Calculus & Algebra', code: 'MATH 201', department: 'Mathematics' },
    { id: 'subj-engl', name: 'English Literature & Composition', code: 'ENGL 101', department: 'Humanities' },
  ];

  const classes: ClassSection[] = [
    { id: 'cls-bsc1', name: 'B.Sc. Computer Science — Year 1', sections: ['A', 'B'], academicYear },
  ];

  const exams: Exam[] = [
    {
      id: 'exam-mid-2026',
      name: `Mid-term Examination (${academicYear})`,
      startDate: '2026-11-04',
      endDate: '2026-11-18',
      status: 'active',
    },
  ];

  const papers: Paper[] = [
    {
      id: 'paper-phys-101',
      examId: 'exam-mid-2026',
      subjectId: 'subj-phys',
      classId: 'cls-bsc1',
      date: '2026-11-06',
      totalMarks: 15,
      passingMarks: 6,
      mode: 'lenient',
      anonymousEvaluation: true,
      spotCheckPct: 25,
      status: 'ready',
      dueDate: '2026-11-25',
      rubricLocked: true,
      rubricVersion: 1,
      rubricHistory: [
        { version: 1, updatedAt: now, updatedBy: adminName, reason: 'Initial answer key & rubric configured.' },
      ],
      sourceKeyText:
        'Q1 (5m): Define Newton Second Law (F=ma) and compute force for m=1200kg, a=2.5m/s^2 (3000 N).\nQ2 (5m): Explain photosynthesis light-to-chemical energy conversion and balanced equation 6CO2 + 6H2O -> C6H12O6 + 6O2.\nQ3 (5m): Calculate KE = 1/2 mv^2 for 0.5 kg at 10 m/s (25 J) and state PE = mgh.',
      questionPaperNotes: 'Attempt all three questions. Show units clearly. Spelling errors are ignored under Lenient mode.',
      requestWindowEnd: '2026-12-15',
    },
    {
      id: 'paper-math-201',
      examId: 'exam-mid-2026',
      subjectId: 'subj-math',
      classId: 'cls-bsc1',
      date: '2026-11-08',
      totalMarks: 15,
      passingMarks: 6,
      mode: 'maths',
      anonymousEvaluation: false,
      spotCheckPct: 20,
      status: 'ready',
      dueDate: '2026-11-26',
      rubricLocked: true,
      rubricVersion: 1,
      rubricHistory: [
        { version: 1, updatedAt: now, updatedBy: adminName, reason: 'Step-marking rubric configured.' },
      ],
      sourceKeyText:
        'Q1 (5m): Solve 3(x-4)+2x = 7(x+1)-5 => x = -7.\nQ2 (5m): Find roots of 2x^2+5x-3=0 => x = 1/2, -3.\nQ3 (5m): Evaluate definite integral from 1 to 3 of (x^2+4x-1)dx = 68/3 (22.67).',
      questionPaperNotes: 'Step marks are awarded even if final arithmetic slips, provided substitution is shown.',
      requestWindowEnd: '2026-12-15',
    },
  ];

  const questions: Question[] = [
    {
      id: 'q-phys-1',
      paperId: 'paper-phys-101',
      number: 1,
      label: 'Q1',
      text: "State Newton's Second Law of Motion and calculate the net force for a 1200 kg car accelerating at 2.5 m/s².",
      type: 'short',
      marks: 5,
      modelAnswer:
        'Acceleration is directly proportional to net force and inversely proportional to mass (F_net = m * a). With m = 1200 kg and a = 2.5 m/s², F = 3000 N.',
      markingNotes: '2 marks for law statement & F=ma, 3 marks for correct substitution and 3000 N with units.',
      commonWrongAnswers: ['force equals mass divided by acceleration'],
      keyPoints: [
        {
          id: 'kp-p1-1',
          text: 'acceleration directly proportional net force inversely proportional mass',
          marks: 2,
          alternativeWordings: ['F = m * a', 'Fnet = m a', 'rate of change of momentum'],
        },
        {
          id: 'kp-p1-2',
          text: '1200 kg 2.5 m/s^2 3000 N',
          marks: 3,
          alternativeWordings: ['force is 3000 N', '3000 newtons'],
        },
      ],
    },
    {
      id: 'q-phys-2',
      paperId: 'paper-phys-101',
      number: 2,
      label: 'Q2',
      text: 'Define photosynthesis and state the overall balanced chemical equation.',
      type: 'short',
      marks: 5,
      modelAnswer:
        'Plants convert light energy into chemical energy. 6CO2 + 6H2O -> C6H12O6 + 6O2 in the presence of sunlight and chlorophyll.',
      markingNotes: '2 marks for energy conversion, 3 marks for reactants & products (glucose + oxygen).',
      commonWrongAnswers: ['plants convert oxygen into carbon dioxide'],
      keyPoints: [
        {
          id: 'kp-p2-1',
          text: 'convert light energy into chemical energy',
          marks: 2,
          alternativeWordings: ['light energy transformed', 'sunlight chemical energy'],
        },
        {
          id: 'kp-p2-2',
          text: '6CO2 + 6H2O C6H12O6 + 6O2 carbon dioxide water glucose oxygen',
          marks: 3,
          alternativeWordings: ['carbon dioxide and water transformed into glucose and oxygen'],
        },
      ],
    },
    {
      id: 'q-phys-3',
      paperId: 'paper-phys-101',
      number: 3,
      label: 'Q3',
      text: 'Compute the kinetic energy of a 0.5 kg ball moving at 10 m/s, and state the potential energy formula.',
      type: 'maths',
      marks: 5,
      modeOverride: 'maths',
      modelAnswer: 'KE = 1/2 mv² = 0.5 * 0.5 * 100 = 25 J. Potential Energy PE = mgh.',
      markingNotes: 'Override Maths mode: 3 marks for KE calculation steps (25 J), 2 marks for PE = mgh.',
      commonWrongAnswers: ['KE = mv^2', '50 Joules'],
      keyPoints: [
        {
          id: 'kp-p3-1',
          text: 'KE = 1/2 mv^2 25 J Joules',
          marks: 3,
          alternativeWordings: ['kinetic energy is 25 Joules', '1/2 (0.5)(100) = 25'],
        },
        {
          id: 'kp-p3-2',
          text: 'PE = mgh potential energy',
          marks: 2,
          alternativeWordings: ['potential energy mgh'],
        },
      ],
    },
    {
      id: 'q-math-1',
      paperId: 'paper-math-201',
      number: 1,
      label: 'Q1',
      text: 'Solve for x: 3(x - 4) + 2x = 7(x + 1) - 5',
      type: 'maths',
      marks: 5,
      modelAnswer: '3x - 12 + 2x = 7x + 7 - 5 => 5x - 12 = 7x + 2 => -2x = 14 => x = -7.',
      markingNotes: 'Award 2 marks for expansion, 1.5 for grouping terms, 1.5 for x = -7.',
      commonWrongAnswers: ['x = 7', 'x = -5'],
      keyPoints: [
        {
          id: 'kp-m1-1',
          text: '5x - 12 = 7x + 2',
          marks: 2,
          alternativeWordings: ['3x - 12 + 2x = 7x + 7 - 5'],
        },
        {
          id: 'kp-m1-2',
          text: '-2x = 14',
          marks: 1.5,
          alternativeWordings: ['5x - 7x = 2 + 12'],
        },
        {
          id: 'kp-m1-3',
          text: 'x = -7',
          marks: 1.5,
          alternativeWordings: ['x=-7'],
        },
      ],
    },
    {
      id: 'q-math-2',
      paperId: 'paper-math-201',
      number: 2,
      label: 'Q2',
      text: 'Find the roots of 2x² + 5x - 3 = 0 using the quadratic formula.',
      type: 'maths',
      marks: 5,
      modelAnswer: 'a=2, b=5, c=-3. Discriminant = 49. x = (-5 ± 7)/4 => x = 1/2, -3.',
      markingNotes: '2 marks for formula & discriminant 49, 3 marks for both roots 1/2 and -3.',
      commonWrongAnswers: ['x = -1/2, 3'],
      keyPoints: [
        {
          id: 'kp-m2-1',
          text: 'sqrt(49) (-5 +- 7)/4',
          marks: 2,
          alternativeWordings: ['b^2 - 4ac', '49', 'a=2, b=5, c=-3'],
        },
        {
          id: 'kp-m2-2',
          text: 'x = 1/2, -3',
          marks: 3,
          alternativeWordings: ['x1 = 1/2', 'x2 = -3', '0.5 and -3'],
        },
      ],
    },
    {
      id: 'q-math-3',
      paperId: 'paper-math-201',
      number: 3,
      label: 'Q3',
      text: 'Evaluate the definite integral ∫₁³ (x² + 4x - 1) dx.',
      type: 'maths',
      marks: 5,
      modelAnswer: 'Antiderivative F(x) = x³/3 + 2x² - x. F(3) - F(1) = 24 - 4/3 = 68/3 (22.67).',
      markingNotes: '2 marks for antiderivative, 1.5 for limits substitution, 1.5 for 68/3.',
      commonWrongAnswers: ['final answer 24', '72/3'],
      keyPoints: [
        {
          id: 'kp-m3-1',
          text: '1/3 x^3 + 2x^2 - x',
          marks: 2,
          alternativeWordings: ['x^3/3 + 4x^2/2 - x'],
        },
        {
          id: 'kp-m3-2',
          text: '24 - 4/3 = 68/3',
          marks: 3,
          alternativeWordings: ['68/3', '22.67'],
        },
      ],
    },
  ];

  return { subjects, classes, exams, papers, questions };
}

export function createInitialState(): EvalStoreState {
  const settings: SystemSettings = {
    institutionName: '',
    academicYear: '2026–27',
    strictProfileNote: 'Content (70%), Grammar (15%), Spelling (15%). Spelling deviations reduce marks and trigger spelling flags.',
    lenientProfileNote: 'Semantic meaning prioritized; spelling errors are ignored unless key scientific terms are ambiguous.',
    mathsProfileNote: 'Intermediate substitution and algebraic transformation steps receive partial credit independently.',
    highConfidenceThreshold: 85,
    mediumConfidenceThreshold: 65,
    defaultSpotCheckPct: 25,
    scanRetentionDays: 90,
    defaultRequestViewDays: 7,
    sessionTimeoutMinutes: 30,
    allowTrainingDataConsent: true,
    showClassAverageToStudents: true,
    showQuestionFeedbackToStudents: true,
  };

  return {
    users: [],
    subjects: [],
    classes: [],
    exams: [],
    papers: [],
    questions: [],
    sheets: [],
    requests: [],
    notifications: [],
    auditLogs: [],
    ocrAuditLogs: [],
    problemReports: [],
    settings,
    teacherPreferences: {},
  };
}
