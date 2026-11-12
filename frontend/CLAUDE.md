@AGENTS.md

# Frontend 규칙

이 폴더(frontend/)의 코드를 만들거나 고칠 때 아래 규칙을 따른다.

## 1. 폴더 구조

```
frontend/
├── src/
│   ├── app/                    # App Router 기반 라우팅 및 페이지
│   │   ├── _components/        # 비공개 폴더 (밑줄로 시작하면 라우팅 제외). 레이아웃 전용 조각
│   │   ├── 기능/_components/    # 그 페이지에서만 쓰는 조각
│   │   ├── layout.tsx          # 루트 레이아웃 (공통 헤더 등)
│   │   ├── page.tsx            # 홈 페이지 (/)
│   │   └── globals.css         # 글로벌 스타일
│   ├── components/
│   │   ├── ui/                 # shadcn 기본 컴포넌트 (Button, Card, Table 등)
│   │   ├── common/             # 기능과 무관한 공용 조각 (Section, PageTitle 등)
│   │   └── 기능이름/            # 여러 페이지에서 쓰는 업무 조각 (approval, work, supply …)
│   ├── hooks/                  # 커스텀 훅 (useApi, useAction 등)
│   ├── lib/                    # 유틸리티 함수, API 호출, 화면 표시용 라벨
│   └── types/                  # TypeScript 타입 정의 (기능별 파일)
├── .env.local                  # 환경 변수 (git 에 올리지 않음)
├── next.config.ts
├── package.json
└── tsconfig.json
```

- **지금 쓰는 폴더만 둔다. 빈 폴더나 자리만 잡는 파일(`.gitkeep`)은 만들지 않는다.** 아래 폴더는 실제로 필요해질 때 만든다.
  - `public/`: 이미지·폰트 같은 정적 파일이 생길 때
  - `src/store/`: 여러 화면이 함께 쓰는 상태 관리(Zustand 등)가 필요할 때
  - `src/app/(그룹이름)/`: 레이아웃이 다른 페이지 묶음(예: 로그인 화면)이 생길 때
- **`app/api/` 는 만들지 않는다.** 이 앱은 정적 내보내기(`output: "export"`)라 Route Handler 를 쓸 수 없고, API 는 모두 `backend/`(FastAPI)가 맡는다.
- 한 페이지에서만 쓰는 컴포넌트는 그 페이지 옆 `_components/` 에 둔다. 두 페이지 이상에서 쓰게 되면 `src/components/기능이름/` 으로 옮긴다.
- 페이지 파일(`page.tsx`)은 데이터 불러오기와 화면 배치만 맡고, 길어지는 조각은 `_components/` 로 뺀다.

## 2. 재사용 규칙

- **같은 코드(마크업·로직·스타일 묶음)가 4번 이상 반복되면 재사용 코드로 만든다.**
  - 화면 조각 → `components/common/` 또는 `components/기능이름/`
  - 상태·데이터 로직 → `hooks/`
  - 순수 함수(형식 변환 등) → `lib/`
- 3번 이하 반복은 그대로 둬도 된다. 억지로 추상화하지 않는다.
- 새로 만들기 전에 `components/common/`, `hooks/`, `lib/` 에 이미 있는지 먼저 찾는다.

## 3. 이름 규칙

- **파일·폴더 이름은 직관적이고 단순하게, kebab-case** 로 쓴다. 예: `approval-card.tsx`, `use-action.ts`
- **약어를 쓰지 않고 풀어서 쓴다.**
  - `Src` → `SourceBadge`, `qty` → `formatQuantity`, `Po` → `PurchaseOrder`, `btn` → `button`
  - 예외: 널리 쓰이는 표준 약어(`api`, `id`, `url`, `ui`, `sku`, `ai`)와 백엔드 응답 필드 이름(`amount_krw`, `eta` 등 API 와 맞춰야 하는 것)
- 컴포넌트는 PascalCase, 함수·변수는 camelCase, 상수는 UPPER_SNAKE_CASE.
- 화면 라벨 상수는 `…_LABEL` 로 끝낸다. 예: `CASE_STATUS_LABEL`
- 훅 파일은 `use-` 로 시작한다.

## 4. 글자 크기

- **글자 크기는 최소 16px(`text-base`) 이다.** `text-xs`, `text-sm`, `text-[…px]` 처럼 16px 보다 작은 크기는 쓰지 않는다. shadcn 컴포넌트를 새로 추가할 때도 바꿔서 넣는다.
- 높이가 고정된 요소(버튼·배지·입력칸)는 16px 글자가 잘리지 않는 높이로 둔다(배지 `h-6`, 버튼·입력칸 `h-8` 이상).

## 5. 폴더는 기능별로

- 종류(atoms, molecules …)가 아니라 **업무 기능**으로 나눈다. 예: `approval/`, `work/`, `supply/`, `event/`, `condition-change/`
- 타입도 기능별 파일로 나눈다. 예: `types/case.ts`, `types/supply.ts`, `types/cash.ts`
