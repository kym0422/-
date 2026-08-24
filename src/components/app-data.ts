export type Role = "ADMIN" | "MENTOR" | "INTERN";

export type Profile = {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  cohortId?: string;
  projectGroup?: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
};

export type NoticeComment = {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
};

export type Notice = {
  id: string;
  title: string;
  content: string;
  target: "ALL" | Role;
  createdBy: string;
  createdAt: string;
  startDate: string;
  endDate?: string;
  important: boolean;
  calendarLinked: boolean;
  comments: NoticeComment[];
};

export type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  eventType: "SCHEDULE" | "TODO";
  visibility: "ALL" | "PRIVATE" | "ADMIN" | "MENTOR" | "INTERN";
  isImportant: boolean;
  isCompleted: boolean;
  createdBy: string;
  noticeId?: string;
};

export type Resource = {
  id: string;
  category: "TEMPLATE" | "LIBRARY";
  title: string;
  description: string;
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
};

export type AssignedTask = {
  id: string;
  internId: string;
  assignedBy: string;
  title: string;
  summary: string;
  startWeek: number;
  endWeek: number;
  primaryCategory: string;
  secondaryCategory: string;
  difficulty: "기본" | "중급" | "고급";
  expectedOutput: string;
  createdAt: string;
};

export type WeeklyReportItem = {
  id: string;
  description: string;
  progress: number;
  weeklyFeedback: string;
  attachmentName?: string;
};

export type WeeklyReport = {
  id: string;
  internId: string;
  cohortId: string;
  projectType: "개인 프로젝트" | "팀 프로젝트";
  weekNumber: number;
  items: WeeklyReportItem[];
  updatedAt: string;
};

export type Evaluation = {
  id: string;
  internId: string;
  mentorId: string;
  title: string;
  content: string;
  status: "ACTIVE" | "CANCELED";
  submittedAt: string;
  readAt?: string;
};

export type Suggestion = {
  id: string;
  ownerToken: string;
  title: string;
  content: string;
  status: "ACTIVE" | "CANCELED";
  submittedAt: string;
  readAt?: string;
};

export type Cohort = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  totalWeeks: number;
  status: "UPCOMING" | "ACTIVE" | "COMPLETED";
};

export type MentorAssignment = {
  id: string;
  cohortId: string;
  internId: string;
  primaryMentorId: string;
  secondaryMentorId?: string;
};

export type AppData = {
  profiles: Profile[];
  cohorts: Cohort[];
  mentorAssignments: MentorAssignment[];
  notices: Notice[];
  events: CalendarEvent[];
  resources: Resource[];
  tasks: AssignedTask[];
  weeklyReports: WeeklyReport[];
  evaluations: Evaluation[];
  suggestions: Suggestion[];
};

export const DEMO_PASSWORD = "Demo1234!";

export const roleLabels: Record<Role, string> = {
  ADMIN: "관리자",
  MENTOR: "멘토",
  INTERN: "인턴",
};

export const demoAccounts = [
  { id: "admin-1", role: "ADMIN" as const, email: "hr.admin@example.com", name: "김하늘" },
  { id: "mentor-1", role: "MENTOR" as const, email: "mentor.one@example.com", name: "박민준" },
  { id: "intern-1", role: "INTERN" as const, email: "intern.one@example.com", name: "이서윤" },
];

/**
 * Resolve the role shortcuts shown on the login page from the editable profile
 * records. The stable demo IDs keep the shortcut attached to the same person
 * when more than one active account has the same role.
 */
export function getDemoLoginAccounts(profiles: Profile[]) {
  return demoAccounts.map((defaultAccount) =>
    profiles.find((profile) => profile.id === defaultAccount.id && profile.isActive)
      ?? profiles.find((profile) => profile.role === defaultAccount.role && profile.isActive)
      ?? defaultAccount,
  );
}

const today = "2026-08-13";

export const initialData: AppData = {
  profiles: [
    { id: "admin-1", name: "김하늘", email: "hr.admin@example.com", role: "ADMIN", department: "인사팀", isActive: true },
    { id: "mentor-1", name: "박민준", email: "mentor.one@example.com", role: "MENTOR", department: "제품개발팀", isActive: true },
    { id: "mentor-2", name: "최유진", email: "mentor.two@example.com", role: "MENTOR", department: "데이터전략팀", isActive: true },
    { id: "intern-1", name: "이서윤", email: "intern.one@example.com", role: "INTERN", department: "제품개발팀", cohortId: "cohort-2", projectGroup: "통합 프로젝트 A조", startDate: "2026-08-03", endDate: "2026-09-25", isActive: true },
    { id: "intern-2", name: "정도윤", email: "intern.two@example.com", role: "INTERN", department: "데이터전략팀", cohortId: "cohort-2", projectGroup: "통합 프로젝트 A조", startDate: "2026-08-03", endDate: "2026-09-25", isActive: true },
    { id: "intern-3", name: "한지우", email: "intern.three@example.com", role: "INTERN", department: "품질혁신팀", cohortId: "cohort-2", projectGroup: "통합 프로젝트 B조", startDate: "2026-08-03", endDate: "2026-09-25", isActive: true },
  ],
  cohorts: [
    { id: "cohort-2", name: "2026년 2기", startDate: "2026-08-03", endDate: "2026-09-25", totalWeeks: 8, status: "ACTIVE" },
    { id: "cohort-1", name: "2026년 1기", startDate: "2026-01-12", endDate: "2026-03-06", totalWeeks: 8, status: "COMPLETED" },
  ],
  mentorAssignments: [
    { id: "ma-1", cohortId: "cohort-2", internId: "intern-1", primaryMentorId: "mentor-1", secondaryMentorId: "mentor-2" },
    { id: "ma-2", cohortId: "cohort-2", internId: "intern-2", primaryMentorId: "mentor-2", secondaryMentorId: "mentor-1" },
    { id: "ma-3", cohortId: "cohort-2", internId: "intern-3", primaryMentorId: "mentor-1" },
  ],
  notices: [
    { id: "notice-1", title: "2기 오리엔테이션 안내", content: "현장실습 운영 규정과 보안 수칙을 안내합니다. 교육장 입실은 시작 10분 전까지 완료해 주세요.", target: "ALL", createdBy: "admin-1", createdAt: "2026-08-03", startDate: "2026-08-03", important: true, calendarLinked: true, comments: [{ id: "comment-1", authorId: "intern-1", authorName: "이서윤", content: "확인했습니다.", createdAt: "2026-08-04 09:12" }] },
    { id: "notice-2", title: "주간 업무보고 작성 기준", content: "매주 금요일 오후 5시까지 진행률과 피드백 메모를 함께 저장해 주세요.", target: "INTERN", createdBy: "admin-1", createdAt: "2026-08-07", startDate: "2026-08-07", endDate: "2026-09-25", important: false, calendarLinked: false, comments: [] },
    { id: "notice-3", title: "멘토 중간평가 일정", content: "3주차부터 인턴별 중간평가를 제출할 수 있습니다.", target: "MENTOR", createdBy: "admin-1", createdAt: "2026-08-10", startDate: "2026-08-17", important: false, calendarLinked: true, comments: [] },
  ],
  events: [
    { id: "event-1", title: "2기 오리엔테이션", description: "본관 3층 교육장", startDate: "2026-08-03", endDate: "2026-08-03", eventType: "SCHEDULE", visibility: "ALL", isImportant: true, isCompleted: false, createdBy: "admin-1", noticeId: "notice-1" },
    { id: "event-2", title: "1주차 업무보고 마감", description: "진행률과 주간 피드백 메모 입력", startDate: "2026-08-14", endDate: "2026-08-14", eventType: "SCHEDULE", visibility: "INTERN", isImportant: true, isCompleted: false, createdBy: "admin-1" },
    { id: "event-3", title: "멘토링 준비 자료 정리", description: "질문 목록과 진행 중 이슈 정리", startDate: today, endDate: today, eventType: "TODO", visibility: "PRIVATE", isImportant: false, isCompleted: false, createdBy: "intern-1" },
    { id: "event-4", title: "팀 프로젝트 중간 점검", description: "A/B조 진행 상황 공유", startDate: "2026-08-19", endDate: "2026-08-19", eventType: "SCHEDULE", visibility: "ALL", isImportant: true, isCompleted: false, createdBy: "admin-1" },
  ],
  resources: [
    { id: "res-1", category: "TEMPLATE", title: "개인 업무 현황 발표 템플릿", description: "주간 공유회용 PPT 작성 가이드", fileName: "개인업무_발표_템플릿.pptx", fileSize: 284000, uploadedBy: "admin-1", uploadedAt: "2026-08-03" },
    { id: "res-2", category: "TEMPLATE", title: "프로젝트 현황 발표 템플릿", description: "통합 프로젝트 중간 발표 양식", fileName: "프로젝트_현황_템플릿.pptx", fileSize: 412000, uploadedBy: "mentor-1", uploadedAt: "2026-08-05" },
    { id: "res-3", category: "LIBRARY", title: "1기 우수 프로젝트 사례", description: "이전 기수 결과물 및 회고 자료", fileName: "1기_우수사례.pdf", fileSize: 1180000, uploadedBy: "admin-1", uploadedAt: "2026-08-06" },
  ],
  tasks: [
    { id: "task-1", internId: "intern-1", assignedBy: "mentor-1", title: "고객 요청 관리 화면 개선", summary: "요청 목록의 탐색성과 상태 가시성을 개선하고 사용성 테스트 결과를 정리합니다.", startWeek: 1, endWeek: 3, primaryCategory: "프로젝트 수행", secondaryCategory: "문제 해결", difficulty: "중급", expectedOutput: "화면 시안 및 결과 보고서", createdAt: "2026-08-04" },
    { id: "task-2", internId: "intern-1", assignedBy: "admin-1", title: "개인 정보보호 교육", summary: "온라인 교육 수료 후 체크리스트를 제출합니다.", startWeek: 1, endWeek: 1, primaryCategory: "자율 학습", secondaryCategory: "업무 참여", difficulty: "기본", expectedOutput: "교육 수료증", createdAt: "2026-08-03" },
    { id: "task-3", internId: "intern-2", assignedBy: "mentor-2", title: "운영 지표 대시보드 설계", summary: "핵심 지표 정의와 데이터 흐름을 문서화합니다.", startWeek: 2, endWeek: 5, primaryCategory: "멘토 과제", secondaryCategory: "혁신/제안", difficulty: "고급", expectedOutput: "지표 정의서", createdAt: "2026-08-10" },
  ],
  weeklyReports: [
    { id: "report-1", internId: "intern-1", cohortId: "cohort-2", projectType: "개인 프로젝트", weekNumber: 1, updatedAt: "2026-08-07 16:42", items: [
      { id: "item-1", description: "현행 고객 요청 화면 및 사용자 동선 분석", progress: 100, weeklyFeedback: "핵심 문제를 우선순위별로 정리했습니다.", attachmentName: "현행분석.pdf" },
      { id: "item-2", description: "개선 화면 와이어프레임 작성", progress: 70, weeklyFeedback: "다음 주 멘토 피드백을 반영할 예정입니다." },
    ] },
    { id: "report-2", internId: "intern-2", cohortId: "cohort-2", projectType: "팀 프로젝트", weekNumber: 1, updatedAt: "2026-08-07 17:02", items: [{ id: "item-3", description: "운영 데이터 항목 조사", progress: 85, weeklyFeedback: "데이터 소유 부서 확인이 필요합니다." }] },
  ],
  evaluations: [
    { id: "eval-1", internId: "intern-1", mentorId: "mentor-1", title: "1주차 적응 및 업무 수행 평가", content: "업무 이해도가 높고 질문을 구체적으로 정리합니다. 다음 주에는 일정 추정 근거를 함께 기록해 주세요.", status: "ACTIVE", submittedAt: "2026-08-08 11:20", readAt: "2026-08-10 09:00" },
    { id: "eval-2", internId: "intern-3", mentorId: "mentor-1", title: "1주차 초기 피드백", content: "협업 태도가 좋으며 품질 기준을 빠르게 습득하고 있습니다.", status: "ACTIVE", submittedAt: "2026-08-09 15:05" },
  ],
  suggestions: [
    { id: "suggestion-1", ownerToken: "intern-1", title: "공용 회의실 예약 개선", content: "실습생도 빈 회의실을 확인할 수 있는 읽기 전용 화면이 있으면 좋겠습니다.", status: "ACTIVE", submittedAt: "2026-08-11 14:30" },
    { id: "suggestion-2", ownerToken: "intern-2", title: "점심 멘토링 시간 제안", content: "월 1회 자유롭게 질문할 수 있는 점심 멘토링 시간을 제안합니다.", status: "ACTIVE", submittedAt: "2026-08-12 10:15", readAt: "2026-08-13 09:10" },
  ],
};

export function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function getWeekNumber(startDate?: string, endDate?: string, reference = new Date("2026-08-13T00:00:00")) {
  if (!startDate) return 1;
  const start = new Date(`${startDate}T00:00:00`);
  if (endDate && reference > new Date(`${endDate}T23:59:59`)) return null;
  const difference = Math.floor((reference.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, Math.floor(difference / 7) + 1);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
