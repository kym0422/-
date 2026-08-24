# 요구사항 추적표

이 문서는 `codex_현장실습_통합웹앱_개발프롬프트.md`를 구현 단위로 정리한 기준 문서다. 상태는 현재 저장소 기준이며, 백엔드 설계 완료 여부와 전체 제품 구현 완료 여부를 구분한다.

## 기반 및 보안

- [x] 데모 이메일/비밀번호 로그인, 브라우저 세션 유지, 로그아웃
- [x] 데모 미인증 사용자의 `/login` 이동과 역할별 라우트 차단
- [ ] Supabase Auth 서버 세션 및 서버/API 기반 라우트 차단
- [x] `ADMIN`, `MENTOR`, `INTERN` DB enum
- [x] 중요 테이블 RLS와 역할별 최소 권한
- [x] 서버 전용 service-role 키를 분리한 `.env.example`
- [ ] 서버/클라이언트 Zod 검증(데모 UI에는 한국어 수동 검증 적용)
- [x] 로딩·빈 상태·오류 상태, 토스트, 위험 작업 확인창

## 사용자, 기수, 배정

- [x] 프로필, 기수, 담당/서브 멘토 데이터 모델
- [x] 한 기수당 인턴별 멘토 배정 1개, 두 멘토 중복 금지
- [x] 인턴·멘토 역할과 기수 일치 트리거 검증
- [x] 사용자 soft deactivation (`is_active`)
- [x] 데모 사용자 생성·수정·비활성화 UI
- [ ] Supabase Auth + Profile 원자적 사용자 생성 API
- [x] 기수 생성·상태 확인 UI
- [x] 멘토 배정·변경 UI
- [x] 프로필 이름 및 비밀번호 변경 흐름 UI
- [x] ADMIN/MENTOR 전용 구성원 페이지

## 대시보드와 공통 UI

- [x] 역할별 내비게이션, 프로필, 로그아웃, KO 기본 언어 구조
- [x] ADMIN 대시보드(현재 주차, To-do, 일정, 공지)
- [x] MENTOR 대시보드(담당 인턴 포함)
- [x] INTERN 대시보드(멘토, 프로젝트조 포함)
- [x] 실습 시작일 기준 현재 주차 계산
- [x] 데스크톱 우선 반응형 UI와 기본 접근성

## 공지사항

- [x] 역할/기수/전체 대상 공지 모델과 RLS
- [x] ADMIN 작성·수정·삭제, 대상 사용자 조회 정책
- [x] 댓글 작성/조회 및 본인/ADMIN 삭제 정책
- [x] 공지·댓글 첨부 메타데이터, private Storage, 25MB 제한
- [x] 공지와 캘린더 이벤트 관계 및 변경 동기화
- [x] 데모 목록·작성·상세/댓글·수정·삭제 UI
- [ ] Supabase CRUD API 연결
- [ ] 첨부파일 형식/크기 클라이언트 검증과 signed download

## 공유 캘린더

- [x] 일정/To-do, 공개 범위, 주요 일정, 완료 상태 모델
- [x] To-do는 `PRIVATE`만 허용하는 DB 제약
- [x] 공개 범위 및 작성자 전용 수정/삭제 RLS
- [x] 월간 달력, 상세/작성 modal
- [x] 다가오는 일정/To-do 카드
- [ ] 일정 수정 및 D-Day 고도화

## 게시판

- [x] 양식·자료 라이브러리 모델과 private Storage
- [x] 모든 활성 사용자의 조회/업로드, 업로더/ADMIN 관리 정책
- [x] 데모 자료 목록, 업로드 메타데이터, 다운로드, 삭제 UI
- [ ] Supabase Storage 실제 업로드/signed download API

## 주간보고

- [x] 인턴·기수·업무유형·주차 단위 보고와 작업 행 모델
- [x] 진행률 0~100, 주차/기수 관계, 정렬 순번 무결성
- [x] 인턴 본인만 작성·수정·삭제
- [x] ADMIN 전체 및 MENTOR 담당 인턴 읽기 전용 RLS
- [x] item 첨부 메타데이터와 private Storage
- [x] INTERN 편집 화면과 ADMIN/MENTOR 조회 화면
- [x] 전체 주차 Excel 다운로드
- [ ] Supabase 보고서/첨부 저장 연결

## 과제

- [x] 주차 범위, 1·2차 분류, 난이도, 기대 산출물 모델
- [x] 직접 입력 필드 조건 및 종료 주차 ≤ 기수 총 주차 검증
- [x] ADMIN 전체, MENTOR 담당 인턴 배정/수정/삭제 정책
- [x] INTERN 본인 과제 읽기 전용 정책
- [x] 배정/수정 폼과 타임라인
- [x] 과제 계획 Excel 다운로드
- [ ] Supabase 과제 CRUD 연결

## 상시평가

- [x] 활성/취소, 제출·읽음·취소 시각 모델
- [x] MENTOR 담당 인턴 작성 및 본인 작성분만 조회
- [x] ADMIN 전체 조회와 최초 읽음 처리
- [x] INTERN 완전 접근 차단
- [x] 내용 수정 없는 soft cancel 규칙
- [x] MENTOR 작성/이전 피드백 UI
- [x] ADMIN 조회/읽음 처리 및 Excel 다운로드
- [ ] Supabase 평가 CRUD/RPC 연결

## 익명 건의

- [x] 익명 데이터와 비공개 소유자 매핑의 스키마 분리
- [x] 원자적 제출 RPC와 본인 목록 RLS
- [x] ADMIN 익명 전체 조회, MENTOR 접근 차단
- [x] ADMIN 읽음 처리와 INTERN soft cancel RPC
- [x] INTERN 작성/내역 UI와 ADMIN 익명 목록 UI
- [x] 도메인 projection의 payload 익명성 단위 테스트
- [ ] 실제 RPC/RLS 익명성 통합 테스트

## 검증 및 인수 조건

- [x] 브라우저 가상 seed 데이터와 역할별 테스트 계정
- [x] 핵심 business logic 단위 테스트 24개
- [ ] RLS/익명성 통합 테스트
- [ ] 역할별 E2E 시나리오
- [x] `npm run lint`
- [x] `npm run test`
- [x] `npm run build`
- [ ] 실제 Supabase 프로젝트에 migration 적용 검증
