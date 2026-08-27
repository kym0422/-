"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, FileBarChart, MessageSquareText } from "lucide-react";
import { type Role, roleLabels } from "@/components/app-data";
import { useAppStore } from "@/components/app-store";
import { Avatar, Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type MemberRow = {
  id: string;
  name: string;
  display_name: string;
  role: Role;
  department: string | null;
  cohort_id: string | null;
  cohort_name: string | null;
  project_group: string | null;
  primary_mentor_name: string | null;
};
type CohortRow = { id: string; name: string };

const roleOrder: Role[] = ["ADMIN", "MENTOR", "INTERN"];
const roleTitles: Record<Role, string> = { ADMIN: "관리자", MENTOR: "멘토", INTERN: "인턴" };

export default function MembersPage() {
  const { currentUser, notify } = useAppStore();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const loadMembers = useCallback(async () => {
    const supabase = createClient();
    const [{ data: memberData, error: memberError }, { data: cohortData, error: cohortError }] = await Promise.all([
      supabase.rpc("list_members_directory"),
      supabase.from("cohorts").select("id,name").order("start_date", { ascending: false }),
    ]);

    if (memberError) {
      notify("구성원 정보를 불러오지 못했습니다. 권한을 확인해 주세요.", "error");
    } else {
      setMembers((memberData ?? []) as MemberRow[]);
    }
    if (!cohortError) setCohorts((cohortData ?? []) as CohortRow[]);
    setLoading(false);
  }, [notify]);

  useEffect(() => {
    if (!currentUser) return;
    const timer = window.setTimeout(() => void loadMembers(), 0);
    return () => window.clearTimeout(timer);
  }, [currentUser, loadMembers]);

  if (!currentUser) return null;
  const profiles = members.filter((member) => selectedCohortId === "ALL" || member.role !== "INTERN" || member.cohort_id === selectedCohortId);
  const destinations = currentUser.role === "ADMIN"
    ? { reports: "/admin/weekly-reports", tasks: "/admin/tasks", evaluations: "/admin/evaluations" }
    : { reports: "/mentor/weekly-reports", tasks: "/mentor/tasks", evaluations: "/mentor/evaluations" };

  return <>
    <PageHeader eyebrow="MEMBERS" title="구성원" description="기수별 인턴과 멘토의 소속 및 배정 현황을 확인합니다." />
    <div className="member-filter">
      <button className={selectedCohortId === "ALL" ? "active" : ""} onClick={() => setSelectedCohortId("ALL")}>전체 보기</button>
      {cohorts.map((cohort) => <button className={selectedCohortId === cohort.id ? "active" : ""} onClick={() => setSelectedCohortId(cohort.id)} key={cohort.id}>{cohort.name}</button>)}
    </div>
    {roleOrder.map((role) => {
      const roleMembers = profiles.filter((member) => member.role === role);
      return <Card key={role}>
        <SectionTitle title={roleTitles[role]} description={loading ? "불러오는 중..." : `${roleMembers.length}명`} />
        {loading ? <p className="text-sm text-slate-500">구성원 정보를 불러오는 중입니다.</p> : roleMembers.length === 0 ? <EmptyState title={`등록된 ${roleTitles[role]}가 없습니다.`} description="Supabase에서 활성화된 계정만 표시됩니다." /> : <div className="member-grid">
          {roleMembers.map((member) => <article className="member-card" key={member.id}>
            <div><Avatar name={member.display_name || member.name} size="large" /><span><h2>{member.display_name || member.name}</h2><p>{member.department || "소속 미지정"}</p><Badge tone={role === "ADMIN" ? "purple" : role === "MENTOR" ? "blue" : "green"}>{roleLabels[role]}</Badge></span></div>
            {role === "INTERN" ? <dl><dt>기수</dt><dd>{member.cohort_name || "미지정"}</dd><dt>프로젝트 조</dt><dd>{member.project_group || "미지정"}</dd><dt>담당 멘토</dt><dd>{member.primary_mentor_name || "미배정"}</dd></dl> : <p className="member-email">연락처는 관리자 설정에서 관리합니다.</p>}
            {role === "INTERN" && <footer><Link href={destinations.tasks}><ClipboardCheck size={15} /> 과제</Link><Link href={destinations.reports}><FileBarChart size={15} /> 보고서</Link><Link href={destinations.evaluations}><MessageSquareText size={15} /> 평가</Link></footer>}
          </article>)}
        </div>}
      </Card>;
    })}
  </>;
}
