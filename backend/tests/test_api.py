from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    response = client.get('/api/health')
    assert response.status_code == 200
    assert response.json()['ok'] is True

def test_all_incidents_and_faults():
    for incident in ['none','leak','power','oxygen']:
        for fault in ['none','missing','stuck','spike']:
            response=client.post('/api/run',json={
                'incident':incident,'origin':'B','fault_mode':fault,
                'strategy':'none','steps':6,'severity':.85
            })
            assert response.status_code == 200, response.text
            data=response.json()
            assert len(data['history']) == 7
            assert len(data['comparison']) == 6
            assert data['diagnosis']['predicted_incident'] in ['none','leak','power','oxygen']
            assert data['diagnosis']['predicted_fault'] in ['none','missing','stuck','spike']
            assert data['recommendation']['strategy'] in [x['strategy'] for x in data['comparison']]
            assert data['comparison'][0]['score'] <= data['comparison'][-1]['score']

def test_validation():
    assert client.post('/api/run',json={'steps':999}).status_code == 422
    assert client.post('/api/run',json={'incident':'fire'}).status_code == 422

def test_report_offline(monkeypatch):
    monkeypatch.delenv('OPENROUTER_API_KEY',raising=False)
    r=client.post('/api/report',json={'scenario':{},'diagnosis':{'predicted_incident':'leak','predicted_fault':'stuck'},'comparison':[]})
    assert r.status_code == 200
    assert r.json()['mode']=='offline'
