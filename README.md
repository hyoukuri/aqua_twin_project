# AQUA TWIN 3.0 — 센서 불확실성 기반 해저기지 AI 관제

**GitHub + Render + Vercel 배포용 전체 웹사이트 소스** (Windows 로컬 실행 지원)

## 기능

1. **실제 Three.js 3D 기지**: 6개 구역 A~F, 연결관 7개, 마우스 회전/확대, 구역 선택, 침수 수위 및 전력 상태 시각화
2. **시간별 사고 시뮬레이션**: 침수 / 전력 고장 / 산소 장애 / 정상; 사고 위치·강도·대응 전략 설정; 0~N분 슬라이더 및 자동 재생
3. **센서 오류 주입**: 누락(missing), 고착(stuck), 이상치(spike), 정상(none)
4. **머신러닝 모델 2개**: Random Forest 사고 유형 분류와 센서 오류 패턴 분류. 입력은 관측 센서값만 사용하며, 시나리오의 정답 레이블은 모델 입력에 전달하지 않음
5. **대응 전략 비교 및 추천**: ML이 추정한 사고 유형을 가정하여 6가지 전략의 평균 위험도를 재시뮬레이션한 후 가장 낮은 후보를 제시. **강화학습은 아님**
6. **AI 보고서**: OpenRouter API 키를 Render 서버에 등록하면 LLM 보고서, 없으면 오프라인 보고서
7. **GitHub Actions 테스트**: Python API 테스트 + Vite 빌드 검사

## 구조

```text
AQUA_TWIN_FINAL_GitHub_Render_Vercel/
├─ .github/workflows/check.yml     GitHub Actions
├─ backend/
│  ├─ app/main.py                   FastAPI / CORS / 보고서
│  ├─ app/simulation.py             6구역 물리 모델·센서 생성
│  ├─ app/ml.py                     사고·센서 오류 ML 2개
│  ├─ tests/test_api.py             API 자동 테스트
│  ├─ requirements.txt
│  └─ start.bat
├─ frontend/
│  ├─ src/app.js                    API 호출, UI, 타임라인
│  ├─ src/twin3d.js                 Three.js 3D
│  ├─ src/style.css
│  ├─ index.html
│  ├─ package.json
│  ├─ vercel.json
│  ├─ .env.example
│  └─ start.bat
├─ render.yaml                      Render Blueprint
└─ start-local.bat                  Windows 통합 시작
```

## 1. Windows PC에서 실행

필수 설치: **Python 3.11/3.12**, **Node.js LTS**, Git(배포할 때), VS Code(수정할 때).

1. ZIP을 압축 해제한다.
2. `start-local.bat`을 더블클릭한다. 두 개의 명령 프롬프트 창이 열린다.
3. 첫 실행은 Python 패키지와 npm 패키지 설치에 시간이 걸린다. 인터넷 연결이 필요하다.
4. 브라우저에서 **http://localhost:5173**을 연다.
5. 시뮬레이션 실행 버튼을 누르면 처음 요청 시 ML 모델을 학습한다.
6. 백엔드 확인: http://localhost:8000/api/health

### 수동 실행 (PowerShell)

```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

새 터미널:

```powershell
cd frontend
npm install
npm run dev
```

## 2. GitHub 업로드

GitHub에서 새 **빈 저장소**를 만든 뒤, 이 프로젝트의 최상위 폴더에서:

```powershell
git init
git add .
git commit -m "AQUA TWIN 3.0 completed MVP"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

`USERNAME/REPOSITORY`는 본인의 저장소 주소로 변경. GitHub 로그인/인증이 필요할 수 있다.

## 3. Render — 백엔드 배포

1. Render 대시보드에서 **New → Blueprint**로 GitHub 저장소를 연결하고 루트의 `render.yaml`을 적용한다.
2. 또는 Web Service를 직접 만들 때: **Root Directory = `backend`**, Build Command = `pip install -r requirements.txt`, Start Command = `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
3. 배포 주소를 기록한다: `https://YOUR-RENDER.onrender.com`.
4. `https://YOUR-RENDER.onrender.com/api/health`가 `{"ok":true,...}`를 반환하는지 확인한다.
5. OpenRouter 보고서를 사용하려면 Render **Environment**에 `OPENROUTER_API_KEY`를 설정한다. 선택적으로 `OPENROUTER_MODEL`도 설정한다. **키를 GitHub에 올리지 않는다.**

## 4. Vercel — 프론트엔드 배포

1. Vercel → Add New Project → 같은 GitHub 저장소 Import.
2. **Root Directory = `frontend`** (중요), Framework Preset = **Vite**.
3. Environment Variables: `VITE_API_URL` = `https://YOUR-RENDER.onrender.com` (마지막 `/` 제외).
4. Deploy. 이후 `VITE_API_URL`을 바꾸면 **재배포**해야 한다.
5. 실제 Vercel URL (예: `https://YOUR-SITE.vercel.app`)을 복사한다.
6. Render → Environment → `ALLOWED_ORIGINS` = `https://YOUR-SITE.vercel.app` 로 설정하고 Render 서비스를 재배포한다. (정확한 URL, 마지막 `/` 없음.)
7. Vercel 사이트에서 시뮬레이션과 보고서를 실행한다.

**CORS**: Render와 Vercel은 도메인이 달라서 Render의 `ALLOWED_ORIGINS`가 실제 Vercel URL과 일치해야 한다. 사용자 지정 도메인을 추가했다면 쉼표로 구분해 추가할 수 있다.

## 5. 테스트

```powershell
cd backend
python -m pip install -r requirements.txt pytest
python -m pytest -q
```

```powershell
cd frontend
npm install
npm run build
```

## 기술적 한계 / 연구 윤리

- **모든 물리 데이터와 ML 학습 데이터는 합성 데이터**. 실제 해저기지·센서·사고 데이터가 아님.
- ML 평가 수치는 **같은 합성 생성기에서 무작위 분리한 테스트 세트**의 결과. 현실 일반화 성능이 아님.
- Random Forest의 `predict_proba`는 보정된 실제 사고 확률이나 신뢰 보증이 아님.
- 센서 오류 추정은 실제 오류를 놓치거나 정상 센서를 오류로 판단할 수 있음.
- 추천은 **예측된 사고 유형을 입력한 단순 반사실 시뮬레이션** 결과이지, 강화학습·PPO·DQN이 아님.
- 화면의 사고 원인/강도는 실험자가 주입한 정답이지만, ML 진단 모델에는 관측 센서값만 제공됨.
- Render 인스턴스가 재시작되면 모델을 다시 학습할 수 있고 첫 호출이 지연될 수 있음.
- 실제 시설 안전·인명 보호 판단에 사용 금지.
