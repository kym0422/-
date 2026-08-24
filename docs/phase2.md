# Phase 2 계획

MVP 핵심 데이터·권한 흐름 이후 도입할 항목이다. 현재 데이터 모델은 확장을 막지 않지만, 미완성 기능을 화면에 활성 버튼으로 노출하지 않는다.

## 1. 알림 센터

- 공지, 과제 배정, 평가 읽음, 건의 읽음 이벤트 기반 알림
- 사용자별 읽음/보관 상태와 알림 설정
- Supabase Realtime 또는 서버 이벤트 후 비동기 fan-out
- 상단 종 아이콘의 unread count와 알림 목록

권장 추가 테이블: `notifications`, `notification_recipients`, `notification_preferences`.

## 2. 최근 활동

- 역할별로 허용된 활동만 대시보드에 노출
- 누가 무엇을 했는지 필요한 범위만 보존
- 익명 건의 이벤트에는 owner ID나 추론 가능한 metadata를 절대 기록하지 않음

권장 추가 테이블: append-only `activity_events`. RLS와 보존 기간을 먼저 확정한다.

## 3. 팀 프로젝트 실시간 일지 공유

- 문자열 `profiles.project_group`을 정규화한 `project_groups`, `project_group_members`
- 팀 보고와 개인 보고의 명확한 소유권 분리
- 동시 편집 충돌 처리, presence, 변경 이력
- 팀원 열람 범위와 멘토/ADMIN 권한의 통합 테스트

## 4. 국제화 완성

- 현재 KO 기본 구조를 message catalog 기반으로 전환
- 날짜·숫자·Excel 헤더·서버 오류까지 KO/EN 제공

## 5. 고도화 항목

- 감사 로그와 보안 이벤트 모니터링
- 파일 악성코드 검사 및 quarantine 처리
- 이메일/Slack 알림 연동
- 대량 사용자 등록과 기수 복제
- 평가/보고 통계, 추세 분석, 접근성 자동 검사

## 진입 조건

Phase 2 전에 역할별 E2E, RLS 통합 테스트, 익명성 payload 검사, 백업/복구 절차를 완료한다. 각 기능은 feature flag 뒤에서 개발하고 권한 테스트 없이 운영에 노출하지 않는다.

