# Genoray 현장실습 프로그램 통합 관리 웹앱

현장실습 운영자, 멘토, 실습생이 공지·일정·주간 업무·과제·평가·익명 건의와 구성원 정보를 한곳에서 확인하는 Next.js 웹앱입니다. 역할은 `ADMIN`, `MENTOR`, `INTERN` 세 가지이며, 화면과 데이터 접근 범위를 역할별로 구분합니다.

## 먼저 알아두세요: 현재 실행 모드

현재 화면은 별도 데이터베이스 없이 바로 확인할 수 있는 **브라우저 데모 모드**로 동작합니다.

- 로그인과 업무 데이터는 브라우저 `localStorage`에 저장됩니다.
- 새로고침해도 같은 브라우저에서는 입력 내용과 로그인 상태가 유지됩니다.
- 다른 PC나 다른 브라우저와 데이터가 공유되지는 않습니다.
- 아래 Supabase 마이그레이션은 테이블, RLS 정책, 비공개 파일의 메타데이터 구조 등 운영용 데이터 구조를 준비합니다.
- 다만 현재 UI의 로그인/저장 코드는 아직 Supabase 저장소 어댑터로 전환되지 않았습니다. 환경변수와 마이그레이션만 적용해도 화면 데이터가 Supabase에 저장되지는 않습니다.

따라서 지금 상태는 기능 검토와 사용자 흐름 시연에 적합합니다. 실제 개인정보를 넣어 회사에서 공동 사용하기 전에는 Supabase Auth 및 데이터 저장 어댑터 연결, 권한 통합 테스트가 필요합니다.

## 빠르게 실행하기

### 1. 필요한 프로그램 설치

- [Node.js](https://nodejs.org/) 20.9 이상(LTS 권장)
- npm(Node.js 설치 시 함께 설치됨)

Supabase 데이터 구조까지 적용하려면 추가로 다음이 필요합니다.

- [Supabase](https://supabase.com/) 계정과 프로젝트
- Supabase CLI(아래 명령에서 `npx`로 실행하므로 전역 설치는 필요 없음)

설치 여부는 터미널에서 확인할 수 있습니다.

```bash
node --version
npm --version
```

### 2. 프로젝트 설치 및 실행

터미널에서 이 README가 있는 폴더로 이동한 뒤 실행합니다.

```bash
npm install
npm run dev
```

## Supabase Auth and role access

This project now uses Supabase Auth cookie sessions for login and server-side
role checks. Follow [the Supabase Auth and RBAC setup guide](docs/auth-rbac.md)
before running a production-like environment.

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다. 개발 서버가 정상인지 JSON으로 확인하려면 [http://localhost:3000/api/health](http://localhost:3000/api/health)에 접속합니다.

데모 모드만 확인할 때는 Supabase 계정이나 환경변수가 없어도 됩니다.

## 데모 계정

모든 계정의 개발용 비밀번호는 `Demo1234!`입니다.

| 역할 | 이메일 | 확인 범위 |
|---|---|---|
| 관리자 | `hr.admin@example.com` | 전체 운영 화면 |
| 멘토 | `mentor.one@example.com` | 담당 실습생 관리 |
| 멘토 | `mentor.two@example.com` | 담당 실습생 관리 |
| 실습생 | `intern.one@example.com` | 본인 업무·과제·건의 |
| 실습생 | `intern.two@example.com` | 본인 업무·과제·건의 |
| 실습생 | `intern.three@example.com` | 본인 업무·과제·건의 |

이 계정과 비밀번호는 브라우저 데모 전용입니다. 운영 환경에서 그대로 사용하지 마세요. 또한 이 계정들은 Supabase Auth에 자동 생성되는 계정이 아닙니다.

## 데모 데이터 초기화

샘플 기수, 사용자, 공지, 일정, 과제, 주간보고, 평가, 건의와 자료가 앱에 내장되어 있으며 첫 실행 시 자동으로 표시됩니다. 화면의 **데모 데이터 초기화** 기능을 사용하면 수정한 내용을 처음 상태로 되돌릴 수 있습니다.

화면에 접근할 수 없는 경우 브라우저 개발자 도구의 Console에서 아래 두 줄을 각각 실행한 뒤 새로고침해도 됩니다.

```js
localStorage.removeItem("genoray-intern-app-data-v1")
localStorage.removeItem("genoray-intern-app-session-v1")
```

현재 저장소에는 원격 Supabase용 `seed.sql`이나 별도 seed 명령이 없습니다. `supabase db push`는 데이터 구조만 만들며 위 데모 계정을 원격 DB에 만들지 않습니다.

## 환경변수 설정

데모 모드에서는 이 단계를 건너뛸 수 있습니다. Supabase 프로젝트 정보를 준비하려면 프로젝트 루트의 `.env.example`을 `.env.local`로 복사합니다.

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

macOS/Linux:

```bash
cp .env.example .env.local
```

`.env.local`을 열어 다음 값을 입력합니다.

| 변수 | 어디에서 찾나요? | 설명 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트의 **Connect** 또는 **Settings → API** | 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 같은 화면의 Publishable/anon key | 브라우저에서 사용할 공개 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | 같은 화면의 Secret/service role key | 서버 전용 관리자 키, 필요한 경우에만 설정 |
| `NEXT_PUBLIC_APP_URL` | 로컬은 `http://localhost:3000` | 앱의 기본 주소 |

예시는 다음과 같습니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-secret-or-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

주의 사항:

- `SUPABASE_SERVICE_ROLE_KEY` 앞에는 절대로 `NEXT_PUBLIC_`을 붙이지 마세요. 이 키는 RLS를 우회할 수 있으므로 브라우저에 노출되면 안 됩니다.
- `.env.local`은 저장소에 커밋하거나 다른 사람에게 전달하지 마세요.
- 환경변수를 바꿨다면 개발 서버를 종료한 뒤 `npm run dev`로 다시 시작하세요.

## Supabase 데이터베이스 만들기

스키마 원본은 `supabase/migrations/0001_initial_schema.sql`입니다. 두 방법 중 하나만 선택하면 됩니다.

### 방법 A: CLI로 적용하기(권장)

1. Supabase Dashboard에서 새 프로젝트를 만듭니다.
2. 프로젝트 주소의 참조 ID를 확인합니다. 예를 들어 URL이 `https://supabase.com/dashboard/project/abcdefghijkl`이라면 참조 ID는 `abcdefghijkl`입니다.
3. 프로젝트 루트에서 다음 명령을 순서대로 실행합니다.

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

명령 중 데이터베이스 비밀번호를 요청하면 Supabase 프로젝트 생성 시 설정한 비밀번호를 입력합니다. 적용 후 Dashboard의 **Table Editor**, 각 테이블의 RLS 정책, **Storage**에서 생성 결과를 확인합니다.

### 방법 B: Dashboard에서 직접 적용하기

CLI 사용이 어렵다면 다음 순서로 진행합니다.

1. `supabase/migrations/0001_initial_schema.sql` 파일 전체를 엽니다.
2. Supabase Dashboard에서 **SQL Editor → New query**를 선택합니다.
3. SQL 전체를 붙여 넣고 **Run**을 누릅니다.
4. 오류 없이 완료됐는지 확인합니다.

이미 일부 테이블을 직접 만들었다면 이름 충돌이 날 수 있습니다. 운영 데이터가 있는 프로젝트에서 테이블을 삭제하거나 초기화하지 말고, 먼저 새 테스트 프로젝트에서 적용하세요.

마이그레이션은 `notice-attachments`, `weekly-report-attachments`, `board-resources`라는 **private** Storage 버킷과 역할별 `storage.objects` 정책도 생성합니다. 파일 연동 코드는 먼저 첨부파일 메타데이터를 DB에 등록한 뒤 `<auth-user-id>/<entity-id>/<uuid>-<safe-file-name>` 형식의 정확한 경로로 업로드해야 정책을 통과합니다.

## 현재 제공되는 데모 범위

데모 앱은 역할별 로그인과 세션 유지, 역할에 맞춘 내비게이션 및 접근 차단, 대시보드, 공지와 댓글, 캘린더/개인 To-do, 자료 목록, 과제, 주간보고, 멘토 평가, 익명 건의, 기수·멘토 배정·회원 및 구성원 화면을 확인하는 용도로 구성되어 있습니다. 입력·수정 동작은 현재 브라우저에 저장됩니다.

다음 항목은 운영용으로 완성되었다고 간주하면 안 됩니다.

- Supabase Auth 기반 실제 로그인과 서버 세션
- UI의 CRUD 동작을 Supabase 테이블에 저장하는 저장소 어댑터
- 실제 파일을 Supabase Storage에 업로드하고 권한에 따라 내려받는 처리
- 운영 데이터 기반 Excel 파일 생성 및 다운로드의 전체 흐름
- 서버/API와 RLS를 함께 검증하는 통합/E2E 테스트
- 알림 센터, 최근 활동, 팀 프로젝트 실시간 공유(Phase 2)

## 사용 가능한 명령

| 명령 | 용도 |
|---|---|
| `npm run dev` | 개발 서버 실행 |
| `npm run lint` | 코드 규칙 검사 |
| `npm test` | 권한·익명성·실습 주차 핵심 로직 테스트 |
| `npx tsc --noEmit` | TypeScript 타입 검사 |
| `npm run build` | 운영용 빌드 생성 |
| `npm run start` | 빌드된 운영 서버 실행 |

운영 빌드를 로컬에서 확인하려면 다음처럼 실행합니다.

```bash
npm run lint
npm test
npx tsc --noEmit --incremental false
npm run build
npm run start
```

## 주요 폴더

```text
src/app/                 페이지, 레이아웃, API Route
src/components/          화면 컴포넌트와 브라우저 데모 저장소
src/lib/                 타입, 권한 규칙, 주차 계산, 익명 건의 변환 로직
supabase/migrations/     Supabase 테이블·RLS·Storage 정의
docs/                    요구사항, 권한, DB, 가정, Phase 2 문서
```

## 배포하기

### Vercel에 데모 배포

1. 프로젝트를 본인의 Git 저장소에 올립니다. `.env.local`은 올리지 않습니다.
2. [Vercel](https://vercel.com/)에서 **Add New → Project**를 눌러 저장소를 연결합니다.
3. Framework Preset이 **Next.js**인지 확인합니다.
4. 필요한 경우 **Settings → Environment Variables**에 `.env.local`과 같은 변수 이름과 값을 등록합니다.
5. **Deploy**를 누릅니다.
6. 배포 뒤 `https://배포주소/api/health`에서 상태 응답을 확인합니다.

현재 상태로 배포하면 데모 데이터는 방문자 각자의 브라우저에만 저장됩니다. 여러 사용자가 같은 데이터를 공유하는 운영 서비스로 배포하려면 먼저 Supabase 저장소 어댑터 연결을 완료해야 합니다.

### 일반 Node.js 서버에 배포

Node.js 20.9 이상이 설치된 서버에서 환경변수를 설정하고 다음 명령을 사용합니다.

```bash
npm install
npm run build
npm run start
```

기본 포트는 `3000`입니다. 외부 공개 시에는 HTTPS, 접근 로그, 백업과 비밀 키 관리 정책도 함께 마련해야 합니다.

## 자주 생기는 문제

### `npm install` 또는 `npm run dev`가 실행되지 않아요

`node --version`이 20.9 이상인지 확인하고 프로젝트 루트에서 명령을 실행했는지 확인하세요. Windows PowerShell 실행 정책 때문에 `npm.ps1`이 차단되면 같은 터미널에서 `npm.cmd install`, `npm.cmd run dev`를 사용할 수 있습니다.

### 3000번 포트가 이미 사용 중이라고 나와요

다른 개발 서버를 종료하거나 다음과 같이 다른 포트를 사용합니다.

```bash
npm run dev -- --port 3001
```

그다음 [http://localhost:3001](http://localhost:3001)로 접속합니다.

### 데모 로그인에 실패해요

이메일의 앞뒤 공백을 제거하고 비밀번호의 대소문자와 느낌표를 포함해 `Demo1234!`인지 확인하세요. 계속 실패하면 위의 **데모 데이터 초기화** 절차를 수행합니다.

### 수정한 데모 데이터가 다른 브라우저에서 보이지 않아요

정상입니다. 현재 데모 데이터는 브라우저별 `localStorage`에 저장됩니다. Supabase 연동이 완료되기 전에는 사용자 간 공유되지 않습니다.

### 환경변수를 입력했는데 화면이 Supabase 데이터를 사용하지 않아요

현재 구현에서는 정상적인 상태입니다. 환경변수와 DB 마이그레이션은 운영 백엔드를 준비하지만, UI 저장소는 아직 브라우저 데모 모드를 사용합니다. Supabase Auth/CRUD 어댑터 연결 작업이 추가로 필요합니다.

### `supabase db push`가 프로젝트 연결 오류를 보여요

`npx supabase login`을 다시 실행하고, Dashboard URL의 프로젝트 참조 ID로 `npx supabase link --project-ref YOUR_PROJECT_REF`를 다시 실행하세요. 데이터베이스 비밀번호가 맞는지도 확인합니다.

### 원격 Supabase에서 데모 계정으로 로그인할 수 없어요

데모 계정은 브라우저 데모 저장소에만 내장되어 있습니다. 현재 원격 seed가 없으므로 Supabase Auth에는 자동 생성되지 않습니다.

### `/403` 화면이 보여요

현재 계정 역할에 허용되지 않은 주소입니다. 대시보드로 돌아가 역할에 표시되는 메뉴를 이용하거나, 다른 데모 계정으로 로그인하세요.

## 운영 전 필수 확인

실제 회사 데이터로 전환하기 전에 최소한 다음 작업을 완료하세요.

1. UI 저장소를 Supabase Auth와 DB CRUD에 연결합니다.
2. 관리자용 작업에서만 서버 전용 키를 사용하고, 모든 일반 요청은 사용자 세션과 RLS를 통과시킵니다.
3. 비공개 파일의 업로드·다운로드 권한과 25MB 제한을 서버에서 검증합니다.
4. ADMIN, MENTOR, INTERN 권한 및 익명 건의의 작성자 비노출을 통합 테스트합니다.
5. 별도의 테스트 프로젝트에서 백업·복구와 배포 절차를 검증한 뒤 운영 데이터를 입력합니다.
