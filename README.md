# AQUA TWIN 4.0 — Autonomous Incident Director

**GitHub + Render + Vercel 웹사이트 완성형 MVP**. 사용자가 사고 유형·위치·강도를 입력하지 않아도 웹사이트를 열면 자동으로 복합 사고 시나리오를 생성하고 3D 기지에서 시간에 따른 변화를 재생합니다.

## 주요 기능

- **기지 확장**: 10개 건물 × 3개 모듈 = **30개 모듈**, 33개 연결 통로. 3D Three.js 회전·확대·모듈 선택.
- **사고 유형 14종**: 해수 유입, 전력 고장, 산소 공급 저하, 화재, 냉각수 누출, 압력 저하, 외벽 균열, 통신 두절, 공기 정화 고장, 배수 펌프 고장, 과열, 유해 가스, 구조물 피로, 항법 오류.
- **자동 시나리오**: 매 실행 시 **3~7건**을 난수로 생성. 각각의 유형·건물·모듈·강도(1~5)·시작 시각·지속 시간 결정. 중복 위치 제한. 기본적으로 API 키 없이 작동.
- **선택형 LLM 사고 디렉터**: Render에 `OPENROUTER_API_KEY`와 `ENABLE_LLM_SCENARIOS=1`을 지정하면 OpenRouter가 **허용된 사건·모듈·강도·시간 목록 안에서** JSON 시나리오를 제안. 서버가 검증 후 사용하고 실패 시 난수 방식으로 자동 대체. 프론트엔드에서 생성 방식을 표시.
- **복합 사고 시뮬레이션**: 30분 동안 사건별 국소 영향, 연결 통로를 통한 감쇠 전파, 침수→전력→산소 및 과열→구조물 손상 등의 단순 연쇄 효과. 8개 센서 지표.
- **머신러닝 진단**: 합성 센서 데이터를 학습한 RandomForest가 30개 모듈의 관측값을 이용해 사고 패턴(14종+정상)을 분류. 관측값에는 센서 누락·고착·이상치를 주입. 모델 입력에는 정답 사건 목록을 넣지 않음. 합성 데이터 홀드아웃 평가 표시.
- **대응 전략 평가**: 동일한 가상 사고를 9가지 대응 전략으로 다시 시뮬레이션해 평균 위험도가 낮은 전략 추천. **이는 반사실 시뮬레이션 기반 추천이며 강화학습은 아닙니다.**
- **AI 상황 보고서**: OpenRouter 키가 있으면 LLM 분석 보고서, 없으면 오프라인 보고서.

> **주의**: 실제 공학/안전 시스템이 아닌 교육용 합성 시뮬레이션입니다. 난수 시나리오 생성 자체는 ML이 아니라 규칙·난수 알고리즘입니다. OpenRouter 사용 시에만 LLM이 시나리오 선택에 참여합니다. 모델 정확도는 합성 데이터에서만 측정합니다.

## 프로젝트 구조

```text
AQUA_TWIN_AUTONOMOUS_4_GitHub_Render_Vercel/
├── backend/
│   ├── app/main.py             # FastAPI, LLM 시나리오(선택), 보고서
│   ├── app/simulation.py       # 30개 모듈 / 14종 사고 / 30분 모델
│   ├── app/ml.py               # RandomForest 사고 패턴 진단
│   ├── tests/test_api.py       # 자동 테스트
│   ├── requirements.txt
│   └── start.bat
├── frontend/
│   ├── index.html
│   ├── src/app.js              # 자동 생성, 사건 목록, 재생, 진단 UI
│   ├── src/twin3d.js           # Three.js 30개 모듈 3D
│   ├── src/style.css
│   ├── package.json
│   ├── vercel.json
│   └── start.bat
├── .github/workflows/check.yml
├── render.yaml
└── start-local.bat
```

## Windows 새 컴퓨터에서 실행

1. **Python 3.11 또는 3.12**, **Node.js LTS** 설치. Git은 GitHub 업로드 시 필요.
2. ZIP을 압축 해제하고 최상위 폴더의 `start-local.bat` 더블클릭.
3. 처음 실행할 때 Python과 npm 의존성을 설치하므로 인터넷 연결 필요.
4. 두 서버가 실행되면 **http://localhost:5173** 접속. 처음 접속 시 자동 시나리오가 생성됨.
5. 백엔드 확인: http://localhost:8000/api/health

수동 실행:

```powershell
# 터미널 1: 프로젝트 루트에서
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

```powershell
# 터미널 2: 프로젝트 루트에서
cd frontend
npm install
npm run dev
```

## GitHub에 업로드

GitHub에서 빈 저장소 생성 후 **프로젝트 최상위 폴더**에서:

```powershell
git init
git add .
git commit -m "AQUA TWIN 4.0 autonomous incidents"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

`USERNAME/REPOSITORY`를 본인의 GitHub 저장소 주소로 바꿔야 합니다. `.env`와 비밀키는 절대 GitHub에 올리지 마세요.

## Render 배포 (백엔드)

1. Render → New → Blueprint → GitHub 저장소 연결 → 루트의 `render.yaml` 적용.
2. 직접 Web Service 생성 시: Root Directory `backend`, Build `pip install -r requirements.txt`, Start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
3. Render 주소의 `/api/health`를 확인. 예: `https://YOUR-API.onrender.com/api/health`.
4. `ALLOWED_ORIGINS`를 **실제 Vercel URL**로 설정 (예: `https://YOUR-SITE.vercel.app`). 로컬 테스트도 필요하면 `https://YOUR-SITE.vercel.app,http://localhost:5173`.
5. OpenRouter 기능을 사용하려면 Render 환경변수에 `OPENROUTER_API_KEY` 추가. **LLM 사고 시나리오까지 사용하려면 `ENABLE_LLM_SCENARIOS=1`도 추가**. 없으면 난수 시나리오 + 로컬 보고서로 정상 동작.

## Vercel 배포 (프론트엔드)

1. Vercel → Add New Project → 동일 GitHub 저장소 Import.
2. Root Directory **`frontend`**, Framework **Vite**, Build `npm run build`, Output `dist`.
3. Vercel 환경변수 `VITE_API_URL=https://YOUR-API.onrender.com` 설정 (끝의 `/` 제외).
4. Deploy. URL이 나오면 Render `ALLOWED_ORIGINS`에 해당 URL 등록.
5. 환경변수 변경 시 Vercel 재배포. 브라우저에서 자동 시나리오, 3D, 재생, 전략, 보고서 확인.

**주의**: `VITE_` 환경변수는 브라우저에 공개됩니다. OpenRouter 키를 넣지 마세요. Render 무료 인스턴스는 유휴 상태에서 재시작되어 첫 요청이 지연될 수 있습니다.

## 검증

```powershell
cd backend
python -m unittest discover -s tests -v
```

프론트엔드:

```powershell
cd frontend
npm install
npm run build
```

테스트 결과와 실제 Render/Vercel 배포 여부는 환경에 따라 별도 확인해야 합니다.
