"use client";

import Link from "next/link";
import { useState } from "react";
import { ClipboardCheck, FileBarChart, MessageSquareText } from "lucide-react";
import { roleLabels } from "@/components/app-data";
import { useAppStore } from "@/components/app-store";
import { Avatar, Badge, Card, PageHeader, SectionTitle } from "@/components/ui";

export default function MembersPage() {
  const { currentUser, data } = useAppStore();
  const [selectedCohortId, setSelectedCohortId] = useState<string>("ALL");
  if (!currentUser) return null;
  const profiles = data.profiles.filter((profile) => profile.isActive && (selectedCohortId === "ALL" || profile.role !== "INTERN" || profile.cohortId === selectedCohortId));
  const roleOrder = ["ADMIN", "MENTOR", "INTERN"] as const;
  const destinations = currentUser.role === "ADMIN" ? { reports: "/admin/weekly-reports", tasks: "/admin/tasks", evaluations: "/admin/evaluations" } : { reports: "/mentor/weekly-reports", tasks: "/mentor/tasks", evaluations: "/mentor/evaluations" };
  return <>
    <PageHeader eyebrow="MEMBERS" title="구성원" description="기수별 운영자, 멘토와 인턴의 소속 및 배정 현황을 확인합니다." />
    <div className="member-filter"><button className={selectedCohortId === "ALL" ? "active" : ""} onClick={() => setSelectedCohortId("ALL")}>전체 보기</button>{data.cohorts.map((cohort) => <button className={selectedCohortId === cohort.id ? "active" : ""} onClick={() => setSelectedCohortId(cohort.id)} key={cohort.id}>{cohort.name}</button>)}</div>
    {roleOrder.map((role) => <Card key={role}><SectionTitle title={role === "ADMIN" ? "관리자" : role === "MENTOR" ? "멘토" : "인턴"} description={`${profiles.filter((profile) => profile.role === role).length}명`} /><div className="member-grid">{profiles.filter((profile) => profile.role === role).map((profile) => { const assignment = data.mentorAssignments.find((item) => item.internId === profile.id); const mentor = data.profiles.find((item) => item.id === assignment?.primaryMentorId); return <article className="member-card" key={profile.id}><div><Avatar name={profile.name} size="large" /><span><h2>{profile.name}</h2><p>{profile.department}</p><Badge tone={role === "ADMIN" ? "purple" : role === "MENTOR" ? "blue" : "green"}>{roleLabels[role]}</Badge></span></div>{role === "INTERN" ? <dl><dt>기수</dt><dd>{data.cohorts.find((cohort) => cohort.id === profile.cohortId)?.name}</dd><dt>프로젝트 조</dt><dd>{profile.projectGroup}</dd><dt>담당 멘토</dt><dd>{mentor?.name ?? "미배정"}</dd></dl> : <p className="member-email">{profile.email}</p>}{role === "INTERN" ? <footer><Link href={destinations.tasks}><ClipboardCheck size={15} /> 과제</Link><Link href={destinations.reports}><FileBarChart size={15} /> 보고서</Link><Link href={destinations.evaluations}><MessageSquareText size={15} /> 평가</Link></footer> : null}</article>; })}</div></Card>)}
  </>;
}
