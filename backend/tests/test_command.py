"""Regression tests for the version 8 partially-observed decision pipeline."""
from fastapi.testclient import TestClient
from app.main import app
from app.simulation import procedural_events
from app.command import run_mission,run_policy,fault_map,MAX_BUDGET

client=TestClient(app)

def test_health_v8():
    response=client.get('/api/health')
    assert response.status_code==200
    assert response.json()['version']=='8.0.0'

def test_briefing_precedes_execution():
    briefing=client.post('/api/scenario',json={'seed':912}).json()
    assert 'history' not in briefing and 'policies' not in briefing
    assert 3<=len(briefing['events'])<=7
    result=client.post('/api/mission',json={'seed':912,'events':briefing['events']})
    assert result.status_code==200,result.text[:200]
    payload=result.json()
    assert set(payload['policies'])=={'ml','rules','none'}
    assert len(payload['history'])==31
    assert len(payload['policies']['ml']['actions'])>0
    assert all(a['cost']>0 for a in payload['policies']['ml']['actions'])
    assert payload['policies']['ml']['resources_used']<=MAX_BUDGET
    assert payload['policies']['none']['resources_used']==0

def test_deterministic_and_fair():
    events=procedural_events(305)
    one=run_policy(events,305,'ml')
    two=run_policy(events,305,'ml')
    assert one['score']==two['score']
    assert one['actions']==two['actions']
    assert fault_map(305)==fault_map(305)

def test_bad_mission_rejected():
    scenario=client.post('/api/scenario',json={'seed':100}).json()
    scenario['events'][0]['room']='INVALID'
    r=client.post('/api/mission',json={'seed':100,'events':scenario['events']})
    assert r.status_code==422

def test_benchmark_reproducible():
    a=client.get('/api/benchmark?runs=3&seed=711')
    b=client.get('/api/benchmark?runs=3&seed=711')
    assert a.status_code==200
    assert a.json()==b.json()
    assert len(a.json()['runs'])==3
    assert sum(a.json()['wins'].values())==3

def test_benchmark_limits():
    assert client.get('/api/benchmark?runs=100').status_code==422
