"""Educational, simplified undersea-habitat simulator. Not for real safety decisions."""
import random

ZONES = ['A', 'B', 'C', 'D', 'E', 'F']
LABELS = {'A':'관제실','B':'연구실','C':'전력실','D':'거주실','E':'생명유지실','F':'비상설비실'}
LINKS = [('A','B'),('B','C'),('C','F'),('F','E'),('E','D'),('D','A'),('B','E')]
INCIDENTS = ['none', 'leak', 'power', 'oxygen']
STRATEGIES = ['none', 'isolate', 'pump', 'shutdown']

def simulate(incident='leak', origin='B', strategy='none', steps=12, severity=0.8, seed=17):
    """Returns 0..steps snapshots. Strategy is fixed during each example run."""
    if incident not in INCIDENTS or origin not in ZONES or strategy not in STRATEGIES:
        raise ValueError('Invalid scenario selection')
    steps = max(1, min(40, int(steps)))
    severity = max(0.15, min(1.5, float(severity)))
    rng = random.Random(seed)
    water = {z: 0.0 for z in ZONES}
    power = {z: 1.0 for z in ZONES}
    oxygen = 1.0
    history = []
    for t in range(steps + 1):
        if t:
            if incident == 'leak':
                water[origin] += (0.11 if strategy != 'pump' else 0.048) * severity
                if strategy == 'pump':
                    for z in ZONES:
                        water[z] = max(0.0, water[z] - 0.023)
                updated = water.copy()
                for a, b in LINKS:
                    if strategy == 'isolate' and origin in (a, b):
                        continue
                    delta = (water[a] - water[b]) * 0.085
                    updated[a] -= delta
                    updated[b] += delta
                water = {z: min(1.0, max(0.0, updated[z])) for z in ZONES}
                for z in ZONES:
                    power[z] = max(0.0, 1 - max(0, water[z] - .23) * 1.1)
            elif incident == 'power':
                power[origin] = max(0.0, 1 - t * .12 * severity)
                for a,b in LINKS:
                    if origin in (a,b):
                        other = b if a == origin else a
                        power[other] = min(power[other], max(.05, 1 - t*.045*severity))
            elif incident == 'oxygen':
                oxygen = max(0.0, 1 - t * .055 * severity)
            if strategy == 'shutdown':
                for z in ZONES:
                    power[z] = .12
            power_avg = sum(power.values()) / 6
            oxygen = max(0.0, oxygen - (.024 if power_avg < .6 else .0035))
        wp = sum(water.values()) / 6
        pp = sum(power.values()) / 6
        risk = min(100.0, 100 * (.52*wp + .32*(1-pp) + .16*(1-oxygen)))
        zones = {z: {'water': round(water[z]*100,1), 'power': round(power[z]*100,1)} for z in ZONES}
        history.append({'minute':t, 'risk':round(risk,1), 'power':round(pp*100,1),
                        'oxygen':round(oxygen*100,1), 'zones': zones})
    return {'history':history, 'final':history[-1],
            'score':round(sum(x['risk'] for x in history)/len(history), 2),
            'model_note':'교육용 합성 물리 모델입니다. 실환경 안전 예측에 사용하지 마세요.'}

def sensors_from_frame(frame, incident, origin, fault_mode='none', seed=42):
    """Simulated heterogeneous sensors: water, humidity, pressure, power, oxygen.
    One selected sensor may freeze, drop out, or produce an inaccurate value."""
    rng = random.Random(seed)
    zones = {}
    for z, v in frame['zones'].items():
        water = v['water']
        zones[z] = {
            'water': round(max(0.0, water + rng.gauss(0, 1.6)),1),
            'humidity': round(min(100, max(0, 40 + water*.52 + rng.gauss(0,2.8))),1),
            'pressure': round(min(100,max(0, 18 + water*.65 + rng.gauss(0, 2.4))),1),
            'power': round(min(100,max(0, v['power'] + rng.gauss(0,1.5))),1)
        }
    observed_oxygen = round(min(100,max(0,frame['oxygen'] + rng.gauss(0,1.4))),1)
    fault = {'mode':fault_mode, 'sensor':None, 'zone':None}
    if fault_mode != 'none':
        target = origin
        sensor = 'water' if incident == 'leak' else 'power' if incident == 'power' else 'humidity'
        if incident == 'oxygen':
            sensor = 'oxygen'
            observed_oxygen = None if fault_mode == 'missing' else (100.0 if fault_mode == 'stuck' else 20.0)
        else:
            zones[target][sensor] = None if fault_mode == 'missing' else (0.0 if fault_mode == 'stuck' else 100.0)
        fault = {'mode':fault_mode, 'sensor':sensor, 'zone':target if sensor != 'oxygen' else 'global'}
    return {'zones':zones, 'oxygen': observed_oxygen, 'injected_fault':fault}
