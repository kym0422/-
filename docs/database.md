# 데이터베이스 설계

초기 스키마는 [0001_initial_schema.sql](../supabase/migrations/0001_initial_schema.sql)에 있다. Supabase Auth, PostgreSQL, RLS, private Storage를 함께 사용한다.

## 주요 관계

| 테이블 | 목적 | 핵심 관계/제약 |
|---|---|---|
| `profiles` | Auth 사용자 업무 프로필 | `auth.users` 1:1, 역할/기수/활성 상태 |
| `cohorts` | 현장실습 기수 | 날짜 순서, 1~104주, 활성 기수 최대 1개 |
| `mentor_assignments` | 담당/서브 멘토 이력 | 기수+인턴 unique, 두 멘토 중복 금지 |
| `notices` | 대상별 공지 | 역할/전체/기수 대상, 작성자 snapshot |
| `notice_comments` | 공지 댓글 | 공지 종속, 작성자 snapshot |
| `notice_attachments` | 공지/댓글 파일 메타데이터 | private bucket path, 25MB 제한 |
| `calendar_events` | 일정과 개인 To-do | 공개 범위, 공지 1:0..1, TODO=PRIVATE |
| `board_resources` | 양식/지난 자료 | private 파일, 업로더 snapshot, 50MB 제한 |
| `tasks` | 인턴 과제 | 기수/인턴/배정자, 주차/분류/난이도 |
| `weekly_reports` | 인턴·유형·주차 보고 | 같은 범위 unique, 기수 총 주차 검증 |
| `weekly_report_items` | 보고의 작업 행 | 정렬 순번 unique, 진행률 0~100 |
| `weekly_report_attachments` | 작업 행 첨부 | private 파일, 25MB 제한 |
| `evaluations` | 멘토의 비공개 상시평가 | ACTIVE/CANCELED, ADMIN read timestamp |
| `suggestions` | 식별정보 없는 건의 내용 | ACTIVE/CANCELED, ADMIN read timestamp |
| `private.suggestion_owner_mapping` | 건의 소유자 관계 | public API 비노출, 앱 역할 grant 없음 |

`profiles` 직접 조회는 ADMIN, 본인, 담당 인턴/배정 멘토 관계로 제한한다. MENTOR의 전체 구성원 화면은 개인정보 컬럼을 제외한 `list_members_directory(target_cohort_id)` RPC를 사용한다.

## enum

- 역할: `ADMIN`, `MENTOR`, `INTERN`
- 기수: `UPCOMING`, `ACTIVE`, `COMPLETED`
- 공지 대상: `ALL`, `ADMIN`, `MENTOR`, `INTERN`, `COHORT`
- 일정 유형: `SCHEDULE`, `TODO`
- 일정 공개: `ALL`, `PRIVATE`, `ADMIN`, `MENTOR`, `INTERN`, `COHORT`
- 자료: `TEMPLATE`, `LIBRARY`
- 업무 유형: `PERSONAL_PROJECT`, `TEAM_PROJECT`, `OTHER`
- 평가/건의 상태: `ACTIVE`, `CANCELED`
- 과제 분류·난이도·산출물은 요구사항의 선택지를 영문 enum으로 보존하며 `CUSTOM`일 때만 custom text를 허용한다.

## 불변 조건과 트리거

- `updated_at`은 변경 시 DB trigger가 기록한다.
- Auth 사용자가 생성되면 비활성 `INTERN` profile이 자동 생성된다. ADMIN 서버 흐름이 역할·기수 등을 설정한 뒤 활성화한다.
- 일반 사용자는 본인 profile의 이름과 표시 이름만 바꿀 수 있다. 역할, 이메일, 기수, 기간, 부서, 활성 상태는 ADMIN 영역이다.
- 멘토 배정, 과제, 주간보고, 평가는 profile 역할과 cohort 관계를 trigger에서 검증한다.
- 과제 종료 주차와 보고 주차는 cohort `total_weeks`를 넘을 수 없다.
- 제출된 평가는 본문 수정 없이 멘토가 취소만 할 수 있고, ADMIN은 읽음 상태만 갱신한다.
- 제출된 건의는 본문 수정 없이 소유 INTERN이 취소만 할 수 있고, ADMIN은 읽음 상태만 갱신한다.
- 공지 연결 캘린더 일정은 제목·본문·대상·날짜를 공지에서 정규화해 중복 불일치를 방지한다.

## 익명 건의 RPC

클라이언트는 `suggestions`에 직접 INSERT하지 않고 다음 RPC를 사용한다.

```ts
await supabase.rpc("submit_suggestion", {
  suggestion_title: title,
  suggestion_content: content,
});
```

취소는 `cancel_own_suggestion(target_suggestion_id)`, ADMIN 읽음 처리는 `mark_suggestion_read(target_suggestion_id)`를 호출한다. `public.suggestions`에는 user/profile 외래키가 전혀 없으므로 ADMIN 응답에 작성자 식별자가 섞이지 않는다.

## Storage

모든 bucket은 `public = false`다.

| Bucket | 최대 크기 | 접근 |
|---|---:|---|
| `notice-attachments` | 25MB | 공지를 볼 수 있는 사용자 |
| `weekly-report-attachments` | 25MB | 본인, ADMIN, 담당/서브 멘토 |
| `board-resources` | 50MB | 활성 사용자 |

업무 문서/PDF/일반 이미지/ZIP MIME만 허용한다. 경로는 다음 규칙을 사용한다.

```text
<auth-user-id>/<entity-id>/<random-uuid>-<sanitized-original-name>
```

Storage policy가 DB 메타데이터를 확인하므로 `attachment/resource` row를 먼저 INSERT한 뒤 동일 경로로 object를 업로드한다. 삭제 시에는 Storage object를 먼저 제거한 후 메타데이터 row를 삭제한다. DB에는 public URL이 아니라 bucket, path, 원본 파일명, MIME, 크기만 저장한다.

## Migration 적용

Supabase CLI가 설치되었다면 프로젝트 루트에서 다음 순서로 적용한다.

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
```

초기 migration은 새 프로젝트를 대상으로 한다. 운영 DB 변경 시에는 이 파일을 수정하지 말고 번호가 증가하는 새 migration을 추가한다.
