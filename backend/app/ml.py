"""Two real supervised ML classifiers trained exclusively on synthetic sensor readings.
No injected ground-truth fault labels or incident labels are included in model features.
The test set measures performance on held-out data from the SAME generator, not reality.
"""
import random
import threading
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from .simulation import ZONES, INCIDENTS, simulate, sensors_from_frame

SENSOR_NAMES = ('water','humidity','pressure','power')
FAULTS = ('none','missing','stuck','spike')
_lock = threading.Lock()
_cache = None


def features(observation):
    values = []
    for zone in ZONES:
        for name in SENSOR_NAMES:
            reading = observation['zones'][zone][name]
            values.extend([float(reading) if reading is not None else -1.,float(reading is None)])
    oxygen = observation['oxygen']
    values.extend([float(oxygen) if oxygen is not None else -1.,float(oxygen is None)])
    return values


def train(n=2000):
    rng = random.Random(28112026)
    X, incidents, faults = [], [], []
    for i in range(n):
        incident = INCIDENTS[i % len(INCIDENTS)]
        fault = FAULTS[(i//len(INCIDENTS)) % len(FAULTS)]
        origin = rng.choice(ZONES)
        state = simulate(incident,origin,'none',rng.randint(5,20),rng.uniform(.35,1.5))['final']
        observed = sensors_from_frame(state,incident,origin,fault,seed=9000+i)
        X.append(features(observed))
        incidents.append(incident)
        faults.append(fault)
    X = np.asarray(X,dtype=np.float32)
    train_idx,test_idx = train_test_split(np.arange(n),test_size=.25,random_state=44,
                                          stratify=np.array(incidents)+'_'+np.array(faults))
    result = {'models':{},'evaluation':{}}
    for label, y in [('incident',np.asarray(incidents)),('fault',np.asarray(faults))]:
        model = RandomForestClassifier(n_estimators=100,max_depth=15,min_samples_leaf=2,
                                       random_state=51,n_jobs=-1,class_weight='balanced_subsample')
        model.fit(X[train_idx],y[train_idx])
        predicted = model.predict(X[test_idx])
        result['models'][label] = model
        result['evaluation'][label] = {
            'accuracy':round(float(accuracy_score(y[test_idx],predicted)),3),
            'macro_f1':round(float(f1_score(y[test_idx],predicted,average='macro')),3),
            'samples':n,'test_samples':len(test_idx)
        }
    return result


def get_model():
    global _cache
    with _lock:
        if _cache is None:
            _cache = train()
        return _cache


def predict(model, x):
    probabilities = model.predict_proba([x])[0]
    scores = {str(k):round(float(p),4) for k,p in zip(model.classes_,probabilities)}
    top = max(scores,key=scores.get)
    return top,scores[top],scores


def diagnose(observation):
    bundle = get_model()
    x = features(observation)
    incident,confidence,probs = predict(bundle['models']['incident'],x)
    fault,fault_confidence,fault_probs = predict(bundle['models']['fault'],x)
    warnings = []
    for zone,readings in observation['zones'].items():
        missing = [key for key,value in readings.items() if value is None]
        if missing:
            warnings.append(f'{zone}구역 데이터 누락: {", ".join(missing)}')
        if readings['water'] is not None and readings['humidity'] is not None:
            if readings['water'] < 10 and readings['humidity'] > 67:
                warnings.append(f'{zone}구역 침수·습도 센서 불일치')
    if observation['oxygen'] is None:
        warnings.append('산소 센서 데이터 누락')
    if fault != 'none' and fault_confidence >= .4:
        warnings.append(f'학습 모델이 센서 오류 패턴을 추정: {fault} ({fault_confidence:.0%})')
    return {
        'predicted_incident':incident,'confidence':confidence,'probabilities':probs,
        'predicted_fault':fault,'fault_confidence':fault_confidence,'fault_probabilities':fault_probs,
        'sensor_warnings':warnings,'evaluation':bundle['evaluation'],
        'caveat':'모델 확률은 교정된 실제 사고 확률이 아니며, 합성 데이터에만 검증되었습니다.'
    }
