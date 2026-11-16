"""Deterministic educational digital twin; NOT a validated physical/safety model."""
import random

ZONES = ['A', 'B', 'C', 'D', 'E', 'F']
LABELS = {'A':'관제실','B':'연구실','C':'전력실','D':'거주실','E':'생명유지실','F':'비상설비실'}
# Same physical connectivity as the Three.js model.
LINKS = [('A','B'),('B','C'),('C','F'),('F','E'),('E','D'),('D','A'),('B','E')]
INCIDENTS = ['none','leak','power','oxygen']
STRATEGIES = ['none','isolate','pump','shutdown','reroute','oxygen_boost']


def clamp(value, lo=0.0, hi=1.0):
    return max(lo, min(hi, value))


def simulate(incident='leak', origin='B', strategy='none', steps=12, severity=.85, seed=17):
    if incident not in INCIDENTS or origin not in ZONES or strategy not in STRATEGIES:
        raise ValueError('Invalid scenario')
    steps = max(1, min(40, int(steps)))
    severity = clamp(float(severity), .15, 1.5)
    water = {z:0.0 for z in ZONES}
    power = {z:1.0 for z in ZONES}
    oxygen = 1.0
    history = []
    for t in range(steps+1):
        if t:
            if incident == 'leak':
                inflow = .105*severity*(.43 if strategy == 'pump' else 1.0)
                water[origin] += inflow
                if strategy == 'pump':
                    for z in ZONES:
                        water[z] = max(0,water[z]-.023)
                updated = water.copy()
                for a,b in LINKS:
                    if strategy == 'isolate' and origin in (a,b):
                        continue
                    flow = (water[a]-water[b])*.085
                    updated[a] -= flow
                    updated[b] += flow
                water = {z:clamp(updated[z]) for z in ZONES}
            if incident == 'power':
                power[origin] = min(power[origin], clamp(1-t*.115*severity))
                for a,b in LINKS:
                    if origin in (a,b):
                        other = b if a == origin else a
                        if strategy != 'isolate':
                            power[other] = min(power[other],clamp(1-t*.042*severity))
            if incident == 'oxygen':
                oxygen = clamp(oxygen-.057*severity)
            for z in ZONES:
                power[z] = min(power[z],clamp(1-max(0,water[z]-.22)*1.18))
            if strategy == 'reroute':
                # Limited backup power: helps power failures, costs reserve capacity.
                if incident == 'power':
                    power[origin] = clamp(power[origin]+.20)
                    for a,b in LINKS:
                        if origin in (a,b):
                            other = b if a == origin else a
                            power[other] = clamp(power[other]+.07)
                power['F'] = min(power['F'],.87)
            if strategy == 'pump':
                power['F'] = min(power['F'],.90)
            if strategy == 'oxygen_boost':
                if sum(power.values())/len(ZONES) > .48:
                    oxygen = clamp(oxygen+.045)
                    power['E'] = min(power['E'],.91)
            if strategy == 'shutdown':
                for z in ZONES:
                    power[z] = min(power[z],.15)
            avg_power = sum(power.values())/len(ZONES)
            oxygen = clamp(oxygen-(.026 if avg_power < .55 else .0035))
        avg_water = sum(water.values())/len(ZONES)
        avg_power = sum(power.values())/len(ZONES)
        risk = clamp(.51*avg_water+.32*(1-avg_power)+.17*(1-oxygen))*100
        history.append({
            'minute':t,'risk':round(risk,1),'power':round(avg_power*100,1),
            'oxygen':round(oxygen*100,1),
            'zones':{z:{'water':round(water[z]*100,1),'power':round(power[z]*100,1)} for z in ZONES}
        })
    return {
        'history':history,'final':history[-1],
        'score':round(sum(x['risk'] for x in history)/len(history),2),
        'model_note':'합성·단순화된 교육용 수치 모델입니다. 실제 해저 시설 안전 판단에 사용할 수 없습니다.'
    }


def sensors_from_frame(frame, incident, origin, fault_mode='none', seed=42):
    """Only observed readings are passed to ML. injected_fault is test metadata, not a feature."""
    rng = random.Random(seed)
    zones = {}
    for z, state in frame['zones'].items():
        water = state['water']
        zones[z] = {
            'water':round(clamp(water+rng.gauss(0,1.5),0,100),1),
            'humidity':round(clamp(40+water*.52+rng.gauss(0,2.7),0,100),1),
            'pressure':round(clamp(18+water*.65+rng.gauss(0,2.4),0,100),1),
            'power':round(clamp(state['power']+rng.gauss(0,1.6),0,100),1),
        }
    oxygen = round(clamp(frame['oxygen']+rng.gauss(0,1.5),0,100),1)
    fault = {'mode':fault_mode,'zone':None,'sensor':None}
    if fault_mode != 'none':
        target = origin
        sensor = 'water' if incident == 'leak' else 'power' if incident == 'power' else 'oxygen' if incident == 'oxygen' else 'humidity'
        if sensor == 'oxygen':
            oxygen = None if fault_mode == 'missing' else 100.0 if fault_mode == 'stuck' else 5.0
            target = 'global'
        else:
            zones[target][sensor] = None if fault_mode == 'missing' else 0.0 if fault_mode == 'stuck' else 100.0
        fault = {'mode':fault_mode,'zone':target,'sensor':sensor}
    return {'zones':zones,'oxygen':oxygen,'injected_fault':fault}
