# 1단계: 화면(Next.js) 빌드 → 정적 파일(out/)
FROM node:22-alpine AS frontend
WORKDIR /build
RUN npm install -g pnpm@10.32.1
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build

# 2단계: 실행(FastAPI). 화면 파일·원본 데이터·가정 데이터를 함께 담는다.
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /srv

COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt

COPY backend/ backend/
COPY ["01_참가자_배포용/04_원본데이터", "01_참가자_배포용/04_원본데이터"]
COPY data/ data/
COPY --from=frontend /build/out frontend/out

WORKDIR /srv/backend
EXPOSE 8080
# DB 테이블을 맞춘 뒤 서버를 띄운다. PORT 환경변수를 쓴다(기본 8080).
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --proxy-headers --forwarded-allow-ips=*"]
