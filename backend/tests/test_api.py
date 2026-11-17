import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.simulation import BUILDINGS,ROOMS,EVENTS,LINKS,procedural_events,simulate

client=TestClient(app)
class ApiTests(unittest.TestCase):
    def test_scale(self):
        self.assertEqual(len(BUILDINGS),10)
        self.assertEqual(len(ROOMS),30)
        self.assertEqual(len(EVENTS),14)
        self.assertEqual(len(LINKS),33)
    def test_health_and_config(self):
        self.assertEqual(client.get('/api/health').status_code,200)
        self.assertEqual(len(client.get('/api/config').json()['rooms']),30)
    def test_random_scenario(self):
        r=client.post('/api/generate',json={'seed':2026})
        self.assertEqual(r.status_code,200,r.text)
        data=r.json()
        self.assertTrue(3<=len(data['events'])<=7)
        self.assertEqual(len(data['history']),31)
        self.assertEqual(len(data['history'][0]['zones']),30)
        self.assertEqual(len(data['comparisons']),9)
        self.assertIn('room_predictions',data['diagnosis'])
        self.assertEqual(data['generation_mode'],'procedural_random')
    def test_deterministic(self):
        a=procedural_events(42);b=procedural_events(42)
        self.assertEqual(a,b)
        self.assertEqual(simulate(a)['final'],simulate(b)['final'])
    def test_report(self):
        body={'events':[],'diagnosis':{'room_predictions':[]},
              'recommendation':{'name':'관찰 유지'},'final':{'risk':0}}
        r=client.post('/api/report',json=body)
        self.assertEqual(r.status_code,200,r.text)
        self.assertTrue(r.json()['text'])
if __name__=='__main__':unittest.main()

class TwoStageTests(unittest.TestCase):
    def test_scenario_then_simulate(self):
        first = client.post('/api/scenario', json={'seed': 2048})
        self.assertEqual(first.status_code, 200, first.text)
        data = first.json()
        self.assertIn('events', data)
        self.assertNotIn('history', data)
        self.assertTrue(3 <= len(data['events']) <= 7)
        self.assertEqual([e['start'] for e in data['events']], sorted(e['start'] for e in data['events']))
        second = client.post('/api/simulate', json={'seed': data['seed'], 'events': data['events']})
        self.assertEqual(second.status_code, 200, second.text)
        result = second.json()
        self.assertEqual(len(result['history']), 31)
        self.assertEqual([(e['type'],e['room'],e['severity'],e['start']) for e in result['events']],
                         [(e['type'],e['room'],e['severity'],e['start']) for e in data['events']])
    def test_invalid_simulation_rejected(self):
        data = client.post('/api/scenario', json={'seed': 2048}).json()
        data['events'][0]['severity'] = 999
        bad = client.post('/api/simulate', json={'seed': data['seed'], 'events': data['events']})
        self.assertEqual(bad.status_code, 422)
