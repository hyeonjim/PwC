# 개발 가이드

Next.js(화면) + FastAPI(백엔드)를 컨테이너 하나로 묶습니다. 대회 기간에는 AXHub 앱 `aurora-hyeonji` 로 배포했습니다(지금은 연결 해제).

## 폴더

| 폴더 | 내용 |
|---|---|
| `01_참가자_배포용/` | 대회 원본 자료. **읽기만 하고 수정하지 않음** |
| `data/assumptions/` | 내가 만든 가정·매핑·합성 데이터·모의 회신 |
| `backend/` | FastAPI. `app/api/v1`(엔드포인트) · `app/schemas`(요청·응답 형식) · `app/services`(계산·업무 흐름·AI 판단) · `app/repositories`(DB·원본 CSV 읽기) · `app/models`(테이블). 규칙은 `backend/CLAUDE.md` |
| `frontend/` | Next.js 정적 내보내기. 데이터는 모두 `/api/v1` 에서 받음. 규칙은 `frontend/CLAUDE.md` |

## 처음 한 번

```powershell
# 백엔드
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env      # ANTHROPIC_API_KEY 를 직접 채우기
.\.venv\Scripts\python.exe -m alembic upgrade head

# 프론트엔드
cd ..\frontend
pnpm install
```

## 개발할 때 (터미널 두 개)

```powershell
# 터미널 1 — 백엔드 http://localhost:8000 (API 문서: /docs)
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

# 터미널 2 — 화면 http://localhost:3000
cd frontend
pnpm dev
```

## 확인

```powershell
cd backend;  .\.venv\Scripts\python.exe -m pytest -q
cd frontend; pnpm lint; pnpm build
docker build -t aurora-local .; docker run --rm -p 8080:8080 aurora-local   # 배포 이미지 그대로 실행
```

## 배포

- 작업은 `dev` 브랜치에서 합니다.
- 코드는 GitHub(`hyeonjim/PwC`)의 `main` 브랜치에 올립니다. 자동 배포는 없습니다.
- 컨테이너로 띄울 때는 `ANTHROPIC_API_KEY`·`DATABASE_URL`·`PORT` 를 환경변수로 넣습니다.
