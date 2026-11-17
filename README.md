# AQUA TWIN 9.0 — Premium Minimal Edition

AQUA TWIN 8.3을 바탕으로 **웹사이트 외관 전체를 A 스타일(프리미엄 미니멀)**로 재설계한 배포용 소스코드입니다. 기존 AI/사고 시뮬레이션 백엔드와 3D 사고 표시 기능은 유지했습니다.

## 이번에 변경된 것

- **라이트 테마**: 밝은 회백색 캔버스, 화이트 카드, 절제된 블루 포인트
- **타이포그래피**: DM Sans + Noto Sans KR, 크기·굵기·행간 체계 정리
- **사이드바**: 로고, 메뉴, 시설 통계, 현재 섹션 강조 디자인 교체
- **상단 헤더**: 심플한 위치 표시, 서버 연결 상태, 새 소개 문구
- **카드/표/지표**: 테두리 최소화, 넓은 여백, 일관된 그림자·라운드 처리
- **버튼/탭**: 단색 블루 주요 버튼, 차분한 보조 버튼, 선택 상태 강조
- **3D 구역**: 주변 UI는 밝게, 3D 화면은 어두운 해저색으로 유지하여 대비를 확보
- **사고 HUD**: 3D 내부 경고 색상과 사고 표시를 기존대로 유지
- **그래프**: 밝은 배경에서 읽기 쉬운 축과 선 색상으로 변경
- **반응형**: 좁은 화면에서 사이드바 축소, 카드 재배치
- **접근성**: 키보드 포커스와 `prefers-reduced-motion` 대응

## 유지된 기능

- 10개 건물 / 30개 모듈, 중앙 메인 관제동 3D
- 사고 시나리오 생성 → 전체 사건 브리핑 → 별도 시뮬레이션 시작
- AI 지휘, 규칙 기반, 무대응 3개 정책 비교
- 센서 오류 탐지 및 ML 사고 진단
- 재생/일시정지/속도/시간 이동/카메라 포커스
- 벤치마크, AI 의사결정 로그, OpenRouter 보고서(선택)

**중요:** 이 버전은 UI 리디자인입니다. AI 모델이나 시뮬레이션의 과학적 정확도가 개선된 것은 아닙니다.

## 기존 GitHub 저장소에 최소 반영

외관 변경만 반영하려면 아래 **3개 파일**을 교체하세요.

1. `frontend/index.html`
2. `frontend/src/style.css`
3. `frontend/src/app.js`

`frontend/src/twin3d.js`는 8.3과 동일합니다. 전체 ZIP을 올려도 됩니다.

GitHub에 커밋하면 Vercel에서 자동 재배포되며, **Render 및 기존 환경변수는 수정할 필요가 없습니다.**

## 새 프로젝트로 배포

### 로컬 실행

Windows에서 Python 3.11/3.12, Node.js LTS 설치 후 프로젝트 루트의 `start-local.bat` 실행.
브라우저: http://localhost:5173

### Render (backend)

- Root Directory: `backend`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Environment: `ALLOWED_ORIGINS=https://실제-Vercel-주소.vercel.app`
- `OPENROUTER_API_KEY`는 선택 사항이며 **Render에만** 설정
- 상태 확인: `https://실제-Render-주소.onrender.com/api/health`

### Vercel (frontend)

- Root Directory: `frontend`
- Framework: Vite
- Build: `npm run build`
- Output Directory: `dist`
- Environment: `VITE_API_URL=https://실제-Render-주소.onrender.com`

환경변수 변경 후 Vercel Redeploy, Render의 `ALLOWED_ORIGINS` 갱신 필요.

## 검증 범위

- Python `unittest discover -s tests`: 7개 통과
- `node --check`로 JS 구문 검사 통과
- CSS 파서 문법 오류 0건
- npm 패키지 설치가 제한된 실행 환경에서 시간 초과되어 **실제 Vite 빌드/브라우저 렌더링은 미검증**

교육용 합성 데이터 기반 연구 시뮬레이터입니다. 실제 해저기지의 안전 운용에 사용하면 안 됩니다.
