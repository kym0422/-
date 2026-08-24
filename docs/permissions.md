# 권한 설계

모든 권한은 UI 노출 여부와 별개로 서버와 PostgreSQL RLS에서 다시 확인한다. `is_active = false`인 사용자는 로그인 세션이 남아 있어도 업무 데이터에 접근할 수 없다. 서비스 역할 키는 사용자 요청을 그대로 대행하는 용도로 사용하지 않는다.

## 역할별 CRUD 매트릭스

표기: `C` 생성, `R` 조회, `U` 수정, `D` 삭제, `취소` soft cancel.

| 기능 | ADMIN | MENTOR | INTERN |
|---|---|---|---|
| 본인 프로필 | R/U(이름·표시 이름) | R/U(이름·표시 이름) | R/U(이름·표시 이름) |
| 사용자 계정/프로필 | C/R/U/비활성화 | 본인·담당 인턴 R | 본인·배정 멘토 R |
| 기수 | C/R/U/D¹ | 배정 기수 R | 본인 기수 R |
| 멘토 배정 | C/R/U/D | 본인 배정 R | 본인 배정 R |
| 공지 | C/R/U/D | 대상 공지 R | 대상 공지 R |
| 공지 댓글 | R/C, 전체 D | 대상 공지 R/C, 본인 D | 대상 공지 R/C, 본인 D |
| 공지 첨부 | R/C/D | 열람 가능 공지 R, 본인 댓글 C/D | 열람 가능 공지 R, 본인 댓글 C/D |
| 캘린더 일정 | 본인 C/R/U/D, 공개 일정 R | 본인 C/R/U/D, 허용 일정 R | 본인 C/R/U/D, 허용 일정 R |
| 개인 To-do | 본인 C/R/U/D | 본인 C/R/U/D | 본인 C/R/U/D |
| 게시판 자료 | 전체 R/C, 본인·전체 D | 전체 R/C, 본인 U/D | 전체 R/C, 본인 U/D |
| 과제 | 전체 C/R/U/D | 담당 인턴 C/R/U/D | 본인 R |
| 주간보고 | 전체 R | 담당 인턴 R | 본인 C/R/U/D |
| 주간보고 첨부 | 권한 보고 R | 담당 보고 R | 본인 C/R/D |
| 상시평가 | 전체 R, 읽음 U | 담당 인턴 C, 본인 작성분 R/취소 | X |
| 익명건의 | 익명 전체 R, 읽음 U | X | C, 본인 R/취소 |
| 구성원 | R | R² | X |

¹ 실제 운영 UI에서는 참조 데이터 보존을 위해 삭제보다 `COMPLETED` 전환을 우선한다. DB 삭제도 참조가 있으면 외래키가 거부한다.  
² INTERN 개인정보 전체가 아니라 업무상 필요한 이름·부서·역할·기수·프로젝트조·배정 관계만 반환하는 서버 DTO를 사용한다.

구성원 화면은 `list_members_directory(target_cohort_id)` RPC를 사용한다. 이 함수는 ADMIN/MENTOR에게만 결과를 반환하며 이메일, Auth ID, 개인 실습 기간, 활성 상태 등 관리용 필드를 구조적으로 제외한다.

## 핵심 권한 규칙

- `ADMIN`도 다른 사용자의 `PRIVATE` 일정/To-do는 볼 수 없다.
- `ADMIN`과 `MENTOR`는 인턴 주간보고를 읽을 수 있지만 DB상 INSERT/UPDATE/DELETE 권한은 없다.
- `MENTOR`의 과제·평가 권한은 현재 `mentor_assignments`에서 담당 또는 서브 멘토로 연결된 인턴에 한한다.
- 멘토는 다른 멘토가 작성한 평가 row를 조회할 수 없다. ADMIN은 전체 평가를 읽고 `read_at`만 갱신한다.
- INTERN은 평가 테이블에 SELECT 권한이 없다.
- 공지 대상이 `COHORT`이면 해당 기수의 인턴과 그 기수에 실제 배정된 멘토만 조회한다.
- 캘린더 `TODO`는 DB 제약으로 `PRIVATE`만 허용한다.

## 익명 건의 경계

```text
INTERN -> submit_suggestion RPC
       -> public.suggestions (제목/내용/상태/시각만)
       -> private.suggestion_owner_mapping (소유자 ID, API 비공개)

ADMIN  -> public.suggestions만 조회
INTERN -> RLS 내부 helper가 매핑을 확인한 뒤 본인 row만 반환
MENTOR -> 두 객체 모두 접근 불가
```

`private.suggestion_owner_mapping`에는 `anon`/`authenticated` grant가 없고 강제 RLS가 적용된다. ADMIN의 SQL/RPC 응답에는 매핑 컬럼이 존재하지 않는다. 다만 Supabase 프로젝트 소유자, DB 슈퍼유저, service-role을 가진 서버 운영자는 기술적으로 DB 전체에 접근할 수 있으므로 해당 키와 감사 로그는 엄격하게 관리해야 한다.

## 서버 계층 규칙

- 모든 server action/API는 세션을 확인하고 기대 역할을 재검증한다.
- 사용자가 전달한 `created_by`, `assigned_by`, `intern_id`, `uploaded_by`를 신뢰하지 않고 세션의 profile ID와 비교한다.
- service-role 키는 관리자 계정 생성처럼 Auth Admin API가 꼭 필요한 서버 코드에서만 사용한다.
- 구성원·Excel DTO는 각 역할에 허용된 컬럼만 명시적으로 선택하며 `select('*')`를 피한다.
- signed URL은 RLS가 허용한 파일 메타데이터를 먼저 조회한 경우에만 짧은 만료 시간으로 발급한다.
