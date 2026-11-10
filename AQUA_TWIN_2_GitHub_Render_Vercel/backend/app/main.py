import os
import json
import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Literal
from .simulation import simulate, sensors_from_frame, ZONES
from .ml import diagnose, get_model

app = FastAPI(title='AQUA TWIN — Sensor AI',version='2.0')
from fastapi.middleware.cors import CORSMiddleware

allowed = [s.strip().rstrip('/') for s in os.getenv('ALLOWED_ORIGINS', 'http://localhost:5173').split(',') if s.strip()]
app.add_middleware(CORSMiddleware, allow_origins=allowed, allow_methods=['GET','POST'], allow_headers=['Content-Type'])

class Scenario(BaseModel):
    incident: Literal['none','leak','power','oxygen']='leak'
    origin: Literal['A','B','C','D','E','F']='B'
    strategy: Literal['none','isolate','pump','shutdown']='none'
    fault_mode: Literal['none','missing','stuck','spike']='stuck'
    steps: int=Field(default=12,ge=1,le=40)
    severity: float=Field(default=.85,ge=.15,le=1.5)

@app.get('/api/health')
def health():
    return {'ok':True,'version':'2.0'}

@app.get('/api/model')
def model_info():
    return get_model()['meta']

@app.post('/api/run')
def run(s:Scenario):
    result = simulate(s.incident,s.origin,s.strategy,s.steps,s.severity)
    # For fair strategy comparison all variants use identical incident and severity.
    comparison = []
    for strategy in ['none','isolate','pump','shutdown']:
        alt = simulate(s.incident,s.origin,strategy,s.steps,s.severity)
        comparison.append({'strategy':strategy,'score':alt['score'],
                           'final_risk':alt['final']['risk']})
    comparison.sort(key=lambda x: x['score'])
    current = result['history'][-1]
    observed = sensors_from_frame(current,s.incident,s.origin,s.fault_mode)
    analysis = diagnose(observed)
    return {'scenario':s.model_dump(), 'history':result['history'],
            'final':result['final'], 'comparison':comparison,
            'sensor_observations':observed, 'diagnosis':analysis,
            'model_note':result['model_note']}

class ReportRequest(BaseModel):
    scenario:dict
    diagnosis:dict
    comparison:list

@app.post('/api/report')
async def report(req:ReportRequest):
    predicted = req.diagnosis.get('predicted_incident','unknown')
    best = req.comparison[0]['strategy'] if req.comparison else 'unknown'
    warnings = req.diagnosis.get('sensor_warnings',[])
    fallback = (f'[오프라인 분석] 추정 사고 유형: {predicted}. '
                f'교육용 평균 위험도 기준 비교 1순위: {best}. '
                f'센서 점검 항목: {"; ".join(warnings) if warnings else "특이 경고 없음"}. '
                '센서와 모델에 불확실성이 있으므로 이 결과를 실제 안전 판단에 사용하지 마세요.')
    key = os.environ.get('OPENROUTER_API_KEY','').strip()
    if not key:
        return {'text':fallback,'mode':'offline'}
    model = os.environ.get('OPENROUTER_MODEL','openrouter/auto')
    prompt = ('가상 해저기지 교육용 시뮬레이터의 진단 결과를 한국어로 요약하세요. '
              '센서 고장 가능성, 사고 추정, 후보 전략 비교, 불확실성 및 한계를 각각 짧게 설명하세요. '
              '실제 시설에 적용할 안전 지침이라고 주장하지 마세요. 입력: '
              + json.dumps(req.model_dump(),ensure_ascii=False)[:9500])
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post('https://openrouter.ai/api/v1/chat/completions',
                                         headers={'Authorization':f'Bearer {key}'},
                                         json={'model':model,'messages':[{'role':'user','content':prompt}],
                                               'max_tokens':650})
            response.raise_for_status()
            return {'text':response.json()['choices'][0]['message']['content'],'mode':'openrouter'}
    except Exception:
        return {'text':fallback+' (외부 AI 요청 실패로 오프라인 분석을 표시합니다.)','mode':'offline'}
