# AQUA TWIN 2.1 — GitHub + Render + Vercel

교육용 합성 데이터 기반 해저기지 센서 사고 진단 웹사이트.

## 아키텍처
- **GitHub**: 코드 저장
- **Render**: `backend/` FastAPI + scikit-learn Random Forest + OpenRouter 프록시
- **Vercel**: `frontend/` Vite 기반 HTML/CSS/JS 대시보드
- 브라우저는 `VITE_API_URL`로 Render의 `/api/run`, `/api/report` 호출
- OpenRouter 키는 **Render 서버 환경변수**에만 설정. 프론트엔드에 넣지 않기

## 새 Windows PC 로컬 실행
Python 3.11/3.12, Node.js LTS, Git 설치.
1. `backend/start.bat` 실행 (첫 설치 및 학습은 시간이 걸림)
2. 별도 창에서 `frontend/start.bat` 실행
3. http://localhost:5173 접속

## GitHub
새 **빈** GitHub 저장소 생성 후 프로젝트 루트에서:
```powershell
git init
git add .
git commit -m "AQUA TWIN sensor AI"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```
`USERNAME/REPO`는 실제 저장소 주소로 교체.

## Render 배포
1. Render → New → Blueprint → GitHub 저장소 연결 → 루트의 `render.yaml` 적용.
   또는 Web Service로 만들고 Root Directory=`backend`, Build=`pip install -r requirements.txt`,
   Start=`uvicorn app.main:app --host 0.0.0.0 --port $PORT` 설정.
2. Render 환경변수 `ALLOWED_ORIGINS`는 배포 후 **실제 Vercel 주소**로 설정
   (예: `https://YOUR-SITE.vercel.app`; 슬래시 없이).
3. `OPENROUTER_API_KEY`는 선택. 없으면 오프라인 보고서 사용.
4. `https://YOUR-RENDER.onrender.com/api/health`에서 `ok:true` 확인.

## Vercel 배포
1. Vercel → Add New Project → 동일한 GitHub 저장소 Import.
2. **Root Directory=`frontend`**, Framework Preset=`Vite`, Build=`npm run build`,
   Output=`dist` 설정.
3. Vercel Environment Variables에
   `VITE_API_URL=https://YOUR-RENDER.onrender.com` 지정 (끝에 `/` 없음).
4. Deploy 또는 Redeploy. Vercel 주소를 Render의 `ALLOWED_ORIGINS`에 넣고 재배포.
5. Vercel 사이트에서 사고 실행 → AI 진단 → 보고서 테스트.

**주의**: `VITE_` 변수는 브라우저에 공개되므로 API 주소만 넣고 비밀키는 절대 넣지 않기.
프론트엔드와 백엔드가 서로 다른 도메인이라 CORS 설정이 필요함.
Render 무료 인스턴스는 대기 후 첫 요청이 지연될 수 있고, ML 모델은 프로세스 첫 진단에서 학습되어 지연될 수 있음.
학습된 `.joblib` 파일은 Git에 올리지 않음. 런타임에서 생성되며 재시작 시 다시 학습될 수 있음.

## AI 기능의 정확한 범위
- 합성 센서 데이터 + Random Forest로 사고 유형 분류
- 누락/고착/스파이크 센서 오류 주입; 누락·불일치 경고는 규칙 기반
- 대응 전략별 단순화된 사고 모델 결과 비교
- 선택적으로 OpenRouter가 결과를 설명
- **강화학습/자율 대응 정책/실제 물리 검증은 아직 미구현**
