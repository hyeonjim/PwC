# Backend 규칙

이 폴더(backend/)의 코드를 만들거나 고칠 때 아래 규칙을 따른다.

## 1. 폴더 구조

```
backend/
├── app/
│   ├── main.py                      # FastAPI 애플리케이션 시작점
│   ├── api/                         # API 라우터
│   │   └── v1/
│   │       ├── router.py            # 엔드포인트 묶기 (/api/v1)
│   │       ├── endpoint_helpers.py  # 엔드포인트 공용 처리 (404, 저장·롤백)
│   │       └── endpoints/           # 기능별 API 파일 (cases.py, supply.py …)
│   ├── schemas/                     # 요청·응답 데이터 형식 (Pydantic)
│   ├── models/                      # DB 테이블 모델 (SQLAlchemy)
│   ├── services/                    # 비즈니스 로직 (계산, 업무 흐름, AI 판단)
│   ├── repositories/                # 데이터 접근 (DB CRUD, 원본 CSV 읽기)
│   ├── core/                        # 공통 설정·공용 도구 (config, AI 클라이언트, 영업일 계산)
│   ├── db/                          # 데이터베이스 연결 (base, session)
│   └── prompts/                     # AI 프롬프트 (.md)
├── alembic/                         # DB 마이그레이션
├── tests/                           # 테스트 코드 (test_기능.py)
├── .env                             # 환경변수 (git 에 올리지 않음)
├── requirements.txt                 # 패키지 의존성
└── CLAUDE.md                        # 이 규칙
```

| 폴더 | 역할 | 주요 기술 |
|---|---|---|
| `api/` | HTTP 요청 및 API 엔드포인트 처리 | FastAPI Router |
| `schemas/` | 요청·응답 데이터 검증 | Pydantic |
| `models/` | DB 테이블 및 ORM 모델 정의 | SQLAlchemy |
| `services/` | 핵심 비즈니스 로직 처리 | Python |
| `repositories/` | 데이터베이스 CRUD 처리, 원본 데이터 읽기 | SQLAlchemy, pandas |
| `core/` | 환경설정, 외부 클라이언트, 공용 도구 | Pydantic Settings |
| `db/` | DB 연결 및 세션 관리 | SQLAlchemy |

- **지금 쓰는 폴더·파일만 둔다. 빈 폴더나 빈 자리표시 파일은 만들지 않는다.**- **인증(`auth.py`, `core/security.py`)은 필요해질 때 만든다.** 지금은 로그인 기능이 없다.
- API 주소는 `/api/v1/...` 이다. 버전을 올릴 때는 `api/v2/` 를 새로 만든다.
- 상태 확인용 `/healthz` 는 AXHub 가 부르므로 `main.py` 에 그대로 둔다.

## 2. 계층 규칙 (호출 방향)

```
api (endpoints) → services → repositories → models / db
        ↘ schemas (요청·응답 형식)
```

- **endpoints**: 요청을 받아 schema 로 검증하고, service 를 부르고, 응답을 돌려준다. 업무 판단이나 DB 쿼리(`select()` 등)를 직접 쓰지 않는다. 가공 없는 단순 목록 조회는 repository 함수를 바로 불러도 된다.
- **services**: 업무 규칙과 계산. DB 는 repository 를 통해서만 다룬다(`select()`, `db.add()` 를 직접 쓰지 않는다).
- **repositories**: DB 조회·추가·삭제와 원본 CSV 읽기만 한다. 업무 판단을 넣지 않는다.
- **commit 은 endpoint 쪽(`endpoint_helpers.run_in_transaction`)에서 한 번만** 한다. service·repository 는 `flush` 까지만 한다.
- 원본 데이터(`01_참가자_배포용/`)는 읽기만 한다. 가정·합성 데이터는 `data/assumptions/` 에 둔다.

## 3. 재사용 규칙

- **같은 코드가 4번 이상 반복되면 함수나 모듈로 뺀다.**
  - 여러 엔드포인트의 공통 처리 → `api/v1/endpoint_helpers.py`
  - DB 쿼리 → `repositories/`
  - 공용 계산·도구 → `core/` 또는 해당 `services/` 모듈
- 3번 이하 반복은 그대로 둬도 된다. 억지로 추상화하지 않는다.
- 새로 만들기 전에 `repositories/`, `services/`, `core/` 에 이미 있는지 먼저 찾는다.

## 4. 이름 규칙

- **파일·폴더 이름은 직관적이고 단순하게, snake_case** 로 쓴다.
- 파일 이름 끝에 계층을 붙인다: `*_service.py`, `*_repository.py`. endpoints·schemas·models 는 기능 이름만 쓴다(`cases.py`, `task.py`).
- **약어를 쓰지 않고 풀어서 쓴다.**
  - `bizcal` → `business_calendar`, `ops` → 기능별 파일, `po` → `purchase_order`, `sim` → `simulation`
  - 예외: 널리 쓰이는 표준 약어(`api`, `id`, `url`, `db`, `ai`, `sku`)와 원본 데이터·API 응답의 필드 이름(`amount_krw`, `eta`, `source_pos` 등 프론트엔드와 맞춰야 하는 것)
- 요청 schema 는 `…Request`, 응답 schema 는 `…Response` 로 끝낸다.
- 함수·변수는 snake_case, 클래스는 PascalCase, 상수는 UPPER_SNAKE_CASE.

## 5. 폴더 안은 기능별로

- endpoints·schemas·services 는 업무 기능별 파일로 나눈다. 예: `cases`, `approvals`, `work`, `supply`, `cash`, `changes`
- 테스트도 기능별 파일로 쓴다. 예: `tests/test_cash.py`, `tests/test_workflow.py`
