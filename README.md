# AQUA TWIN 8.1 — 중앙 관제동 3D 리디자인

# AQUA TWIN 8.0 — Autonomous Mission Control

> **GitHub + Render + Vercel** 배포 가능한 해저기지 **교육용 합성 재난 AI 실험 플랫폼**. 실제 해저 시설의 사고를 예측하거나 안전 의사결정을 지원하는 검증된 제품이 아닙니다.

## 무엇이 새로워졌나?

| 단계 | 구현 내용 | 기술적 의미 |
|---|---|---|
| 6.0 기반 | 실제 사고를 모르는 AI 대응 지휘관 | AI는 사고 정답 목록을 전달받지 않고 **오류가 주입된 관측 센서**만 봄 |
| 7.0 기반 | 대응 자원 제약 + AI·규칙·무대응 3중 비교 | 매분 **어느 구역에 어떤 행동**을 할지 결정하고 예산 150 units 소모 |
| 8.0 | 3D 재설계 + 브리핑/재생 분리 + 의사결정 로그 + 다중 시드 벤치마크 | 사건을 먼저 공개한 뒤 별도 버튼으로 실행. AI의 판단과 성능을 검증 |

**사고 규모:** 10개 건물 / 30개 모듈 / 14종 사건 / 매 시나리오 3~7건 / 30분.

**UI 흐름:** `사고 시나리오 생성` → `전체 사건 브리핑` → `AI 대응 시뮬레이션 시작` → `3D 재생·센서 추론·행동 로그` → `AI vs 규칙 vs 무대응 비교` → `6개 시드 벤치마크`.

## AI의 정확한 범위

- **사고 시나리오 생성**: 기본은 시드 기반 **절차적 난수 생성**. Render에 `OPENROUTER_API_KEY`를 넣고 `ENABLE_LLM_SCENARIOS=1`로 설정하면 OpenRouter LLM 시나리오 생성 시도. 실패하면 난수로 대체. UI에 생성 방식을 표시.
- **사고 진단**: `backend/app/ml.py`의 **Random Forest**가 합성 데이터로 학습한 15개 클래스(정상 + 사고 14종)를 분류. 검증 정확도는 **합성 데이터 홀드아웃**에 한정됨.
- **AI 대응**: `backend/app/command.py`의 **관측 기반 1단계 제한 탐색**. ML 분류 결과로 위험 구역을 후보화하고, 가용 자원 범위에서 각 행동의 예상 위험 감소를 계산. 정답 사고 목록은 AI 정책 함수에 전달되지 않음.
- **기준 정책**: 고정 임계값 규칙 기반, 무대응. 동일 사고 목록과 동일 센서 고장/난수 시드를 사용해 비교.
- **자원 모델**: 대응마다 4~8 units 비용, 총 150 units. 실제 설비의 비용/물리 법칙과 무관한 교육용 가상 값.
- **아직 없음**: 강화학습(PPO/DQN), 실제 센서 데이터, 물리적으로 검증된 해저 시설 모델, 정교한 원인 추론 확률 그래프, 실전용 구조/인명 안전 판단. `ML`이라고 해서 강화학습이라고 주장하지 않음.

## Windows 로컬 실행

**필수:** Python 3.11/3.12, Node.js LTS, 인터넷 연결(최초 패키지 설치).

1. 압축 해제. 폴더 경로에 한글이 있어도 실행할 수 있도록 `start-local.bat`은 경로 기반으로 구성.
2. `start-local.bat` 더블클릭. 백엔드/프론트엔드 명령창이 각각 열림.
3. `http://localhost:5173` 접속. 처음 서버 실행 시 Python 의존성 설치 및 머신러닝 첫 학습으로 시간이 걸릴 수 있음.

수동 실행:

```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

다른 PowerShell 창:

```powershell
cd frontend
npm install
npm run dev
```

## GitHub → Render → Vercel

**GitHub**: ZIP을 푼 최상위 폴더 안의 `.github`, `backend`, `frontend`, `render.yaml` 등을 **하나의 저장소 루트**에 업로드. `.env`나 API 키를 올리지 않음.

**Render**: New → Web Service → GitHub 저장소 연결

| 설정 | 값 |
|---|---|
| Root Directory | `backend` |
| Runtime | Python |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health Check | `/api/health` |

Render **Environment Variables**:

| Key | Value | 설명 |
|---|---|---|
| `PYTHON_VERSION` | `3.11.11` | 예시 런타임 |
| `ALLOWED_ORIGINS` | `https://실제-Vercel-주소.vercel.app` | Vercel 배포 후 정확한 origin으로 교체. 여러 주소는 쉼표로 구분 |
| `ENABLE_LLM_SCENARIOS` | `0` 또는 `1` | 1 + 유효한 키일 때만 LLM 시나리오 생성 시도 |
| `OPENROUTER_API_KEY` | 실제 비밀키 | 선택, **Render에만 등록** |
| `OPENROUTER_MODEL` | 사용 가능한 모델 ID | 기본 `openrouter/auto` |

**Vercel**: New Project → 같은 GitHub 저장소 Import

| 설정 | 값 |
|---|---|
| Root Directory | `frontend` |
| Framework | Vite |
| Install | `npm install` |
| Build | `npm run build` |
| Output | `dist` |
| Environment Variable `VITE_API_URL` | `https://실제-Render-주소.onrender.com` |

- `VITE_API_URL`은 `/api`나 `/api/health` 없이 **서버 원본 주소만** 넣음. 끝의 `/`는 생략.
- Vercel의 `VITE_` 변수는 브라우저에 노출됨. **API 비밀키를 절대 넣지 말 것.**
- Vercel 주소가 나오면 Render의 `ALLOWED_ORIGINS`를 해당 주소로 설정하고 재배포.
- Vercel 환경변수를 수정하면 Vercel **Redeploy**가 필요.
- Render 무료 인스턴스는 휴면 후 첫 호출이 느릴 수 있음.

### Failed to fetch 문제 해결

1. 브라우저에서 `https://실제-Render-주소.onrender.com/api/health` → `{"ok":true,"version":"8.0.0"}` 확인.
2. Vercel → Settings → Environment Variables → `VITE_API_URL` 정확한 Render 주소 확인 후 Redeploy.
3. Render → Environment → `ALLOWED_ORIGINS`에 **정확한** Vercel origin 등록(https, 서브도메인 포함, 끝 `/` 없음) 후 재시작.
4. 브라우저 F12 → Network → `/api/config`, `/api/scenario`, `/api/mission` 요청 상태 확인. Render Logs에서 서버 오류 확인.
5. **CORS 우회용으로 API 키를 브라우저에 넣거나 무제한 origin을 열지 말 것.**

## API

- `GET /api/health` 서버 상태
- `GET /api/config` 건물·모듈·사고·대응 목록
- `POST /api/scenario` `{}` 또는 `{"seed":123}` → **사건 목록만 생성**
- `POST /api/mission` `{"seed":123,"events":[...]}` → **동일 시나리오 3개 정책 비교, 프레임, 의사결정 로그**
- `GET /api/benchmark?runs=6&seed=2026` → **여러 시드 평균 위험도·승리 횟수** (3~12회 제한)
- `POST /api/report` 선택적 OpenRouter 또는 오프라인 요약
- 이전 호환: `/api/simulate`, `/api/generate`, `/api/model`

## 검증

```bash
cd backend
python -m pip install -r requirements.txt pytest
python -m pytest -q
```

GitHub Actions: `.github/workflows/check.yml`에서 백엔드 테스트와 Vite 빌드 실행.

## 기술적 주의점

- 학습/평가 데이터 모두 합성이며 실제 시설 성능으로 일반화할 수 없음.
- AI 정책의 행동 평가와 사고 전파 엔진은 동일한 가상 모델 계열을 사용하므로 실험 결과에 **모델 편향**이 존재할 수 있음.
- AI가 특정 시드에서 더 나은 결과를 얻더라도 보편적 우월성을 의미하지 않음.
- 시간별 위험도와 모듈별 수치는 교육용 점수이며 실제 위험·생존 확률이 아님.
- 3D는 Three.js 절차적 모델. 외부 3D 에셋 없이 로딩되도록 설계됨.


## 8.1에서 변경된 점

- 중앙 관제동(B01)을 실제로 가장 큰 4층 관제 허브로 재설계하고, 9개 기능별 건물을 둘레에 배치했습니다.
- 30개 구역의 API 좌표를 원형 캠퍼스에 맞게 변경했습니다. 각 건물 3개 구역은 유지됩니다.
- 통로 그래프도 건물 내부 20개 + 외곽 링 9개 + 중앙 연결 4개 = 33개로 변경했습니다.
- 중앙 도킹 플랫폼, 외곽 기지별 플랫폼, 더 선명한 수중 조명과 낮은 안개 밀도, 확대된 뷰포트를 적용했습니다.
- 기존 AI 사고 생성/진단, 위험도 계산, 사건 브리핑, 시뮬레이션, 벤치마크, Render/Vercel 설정은 유지합니다.
- 건물 클릭, 선택 포커스, 사고 경고 및 시간별 상태 변화는 기존 인터페이스와 호환됩니다.
- 실제 해저기지 설계도가 아닌 교육용 가상 시설의 디자인입니다.


## 8.2 카메라 중앙 정렬 패치
- 고해상도/Retina 화면에서 WebGL 캔버스의 실제 픽셀 크기와 CSS 크기가 달라 뷰포트에서 잘리던 문제 수정
- 캔버스 CSS 크기를 100% × 100%로 고정
- 기본 카메라가 기지 중앙을 바라보고 화면 비율에 맞게 전체 기지가 보이도록 거리 자동 계산
- `◎ 전체 보기` 클릭 또는 3D 더블클릭으로 카메라 중심/확대 초기화
- 10개 건물/30개 모듈, AI 시나리오 및 백엔드 설정 변경 없음

### 배포
기존 GitHub 저장소의 `frontend/src/twin3d.js`, `frontend/src/style.css` 두 파일만 교체해도 됨.
Vercel이 GitHub 커밋을 받아 다시 배포되면 Ctrl+Shift+R (Mac: Cmd+Shift+R)로 새로고침.
Render 및 환경변수 수정 불필요.


## AQUA TWIN 8.3 — 3D 가시성 강화
기존 8.2의 중앙 관제동 및 카메라 중앙 정렬 기능 유지.

### 변경
- 해저 배경/지형/건물 색상을 더 밝게 조정하고 안개를 줄임
- 현재 사고 구역: 건물 본체 빨강, 붉은 경광등, 굵은 위험 링, 위쪽 화살표 및 사고명 표지
- 아직 발생하지 않은 예정 사고: 노란색 건물/표지
- 일반 안전 구역: 밝은 청록색 표시
- 3D 화면 좌하단에 **현재 사고 목록** HUD 추가 (사고 종류, 위치, 강도, 발생 시간)
- 사고 목록의 항목을 누르면 해당 모듈로 카메라 이동
- 시뮬레이션 타임라인과 HUD/3D 표지가 동기화됨

### 배포
GitHub 저장소의 다음 세 파일만 교체 가능:
- `frontend/src/twin3d.js`
- `frontend/src/app.js`
- `frontend/index.html`
- `frontend/src/style.css`

Vercel 재배포 후 새로고침. Render/백엔드/환경변수 변경 불필요.

### 검증
- `node --check`로 JavaScript 문법 검사 완료
- 백엔드 unittest 7개 통과
- 이 환경에서 `npm install`이 시간 초과되어 실제 Vite 빌드 및 브라우저 렌더링은 미검증
