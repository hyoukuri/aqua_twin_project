# AQUA TWIN 5.0 — AI 사고 브리핑 → 별도 시뮬레이션 시작

기존 AQUA TWIN 4.0의 **10개 건물·30개 모듈·14종 사고·3~7건 동시 사건**을 유지하면서 사용자 흐름과 가시성을 개선한 웹사이트입니다.

## 주요 변경

1. 초기 화면은 정상 기지 상태이며 사고가 자동으로 발생하지 않습니다.
2. **AI 사고 시나리오 생성**을 누르면 전체 사고가 상단 브리핑 카드에 시간순으로 나타납니다. 종류, 발생 건물/모듈, 발생 시각, 강도(1~5)를 한눈에 확인할 수 있습니다.
3. **이 시나리오로 시뮬레이션 시작**을 누르면 동일한 사고 목록을 서버로 전달하고, 그제야 사고 전파·ML 센서 진단·대응 전략 비교를 계산해 3D 애니메이션을 시작합니다.
4. 3D 모듈은 기본 박스 대신 원통형 본체와 돔/지붕, 입체 연결 튜브로 개선했습니다.
5. 시나리오 생성과 시뮬레이션 계산은 별도 API로 분리했습니다. 생성 시 결과가 미리 재생되지 않습니다.

## 로컬 Windows 실행

Python 3.11 또는 3.12, Node.js LTS 필요.

- 프로젝트 최상위 폴더의 `start-local.bat` 실행
- 또는 `backend/start.bat`, `frontend/start.bat` 각각 실행
- 브라우저: http://localhost:5173

## GitHub → Render → Vercel

GitHub에 전체 프로젝트 폴더의 **내용물**을 업로드합니다. Render와 Vercel은 같은 GitHub 저장소를 사용합니다.

**Render / Web Service**
- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- `PYTHON_VERSION=3.11.11`
- `ALLOWED_ORIGINS=https://YOUR-SITE.vercel.app` (실제 Vercel URL로 교체, 끝 `/` 제외)
- `ENABLE_LLM_SCENARIOS=1` (OpenRouter를 통해 LLM 시나리오 생성을 사용하려는 경우)
- `OPENROUTER_API_KEY=...` (선택; **Render에만 저장**)
- `OPENROUTER_MODEL=openrouter/auto` (선택; 사용 가능한 모델로 변경 가능)

**Vercel / Project**
- Root Directory: `frontend`
- Framework: `Vite`
- Install: `npm install`
- Build: `npm run build`
- Output: `dist`
- Environment Variable: `VITE_API_URL=https://YOUR-RENDER.onrender.com` (실제 Render URL로 교체, `/api` 붙이지 않음)
- 환경변수 변경 후 Vercel **Redeploy** 필요.

**연결 확인**
- Render: `https://YOUR-RENDER.onrender.com/api/health` → `ok: true`
- Vercel: 웹사이트가 열린 뒤 **AI 사고 시나리오 생성** 클릭
- `Failed to fetch`는 보통 `VITE_API_URL`, `ALLOWED_ORIGINS`, 서버 준비/배포 상태를 확인해야 합니다. 화면이 뜨는 것만으로 API 연결이 성공한 것은 아닙니다.

## API

- `GET /api/health`: 백엔드 상태
- `GET /api/config`: 건물/모듈/사고 유형
- `POST /api/scenario` with `{}`: **사고 목록만 생성**, 시뮬레이션 계산 없음
- `POST /api/simulate` with `{ "seed": 123, "events": [...] }`: 위 사고 목록을 그대로 계산하고 ML 진단 및 전략 비교 반환
- `POST /api/generate`: 이전 버전 호환 원샷 엔드포인트
- `POST /api/report`: 시뮬레이션 결과 설명

## AI 기술과 한계

- `OPENROUTER_API_KEY` 및 `ENABLE_LLM_SCENARIOS=1` 설정 시 OpenRouter가 허용된 사고 유형/장소/강도 범위 내 시나리오를 생성하도록 시도합니다.
- OpenRouter가 미설정이거나 실패하면 **난수 알고리즘**으로 대체합니다. 따라서 이 경우 사고 생성은 AI가 아닙니다.
- 사고 결과는 합성 데이터 기반 규칙 시뮬레이터가 계산하고, Random Forest는 관측 센서 패턴을 분류합니다. 대응 추천은 9개 전략의 모의 결과 비교입니다.
- 강화학습 기반 대응이나 실제 해저 시설 안전 검증은 포함되지 않습니다.

## 검증

`cd backend && python -m unittest discover -s tests -v`

Python API 7개 테스트 통과, JS 구문 검사 통과. 이 실행 환경에서는 npm 설치가 시간 초과되어 실제 Vite 빌드 및 클라우드 배포는 미검증입니다.


## 5.1 — 3D 시각화 리디자인
- 모듈별 용도에 따라 돔/발전기/격납고/관제 안테나 등 외형을 구분
- 해저 지형, 암석, 부유 입자, 창문, 건물 레이블, 입체 통로, 구조물 기초 추가
- 사고 생성 단계에서는 사고 예정 모듈을 황색으로 표시; 시뮬레이션 시작 후에는 위험도에 따라 상태 링과 경보가 변화
- 클릭 시 선택 구역에 카메라 초점 이동, 더블클릭 시 전체 기지 시점 복귀
- GitHub/Render/Vercel 환경변수는 기존 5.0과 동일 (`VITE_API_URL`, `ALLOWED_ORIGINS`)
- 외부 3D 모델 파일을 내려받지 않는 절차적 Three.js 모델이며 실제 해저기지 실사 모델이 아님
