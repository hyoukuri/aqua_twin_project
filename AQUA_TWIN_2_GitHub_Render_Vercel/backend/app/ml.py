"""Supervised synthetic fault diagnosis. Model is NOT trained on real subsea data."""
from pathlib import Path
import threading
import random
import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from .simulation import ZONES, INCIDENTS, simulate, sensors_from_frame

MODEL_FILE = Path(__file__).parent / 'sensor_model.joblib'
_lock = threading.Lock()
_cache = None
SENSOR_NAMES = ['water','humidity','pressure','power']

def features(obs):
    values = []
    for z in ZONES:
        for sensor in SENSOR_NAMES:
            raw = obs['zones'][z][sensor]
            values += [float(raw) if raw is not None else -1.0, int(raw is None)]
    oxygen = obs['oxygen']
    values += [float(oxygen) if oxygen is not None else -1.0, int(oxygen is None)]
    return values

def _dataset(n=1800):
    randomizer = random.Random(48012)
    X, y = [], []
    for i in range(n):
        kind = INCIDENTS[i % len(INCIDENTS)]
        origin = randomizer.choice(ZONES)
        severity = randomizer.uniform(.5, 1.5)
        frame = simulate(kind, origin, 'none', steps=randomizer.randint(4,12),
                         severity=severity, seed=i)['final']
        fault_mode = randomizer.choices(['none','missing','stuck','spike'], [.45,.23,.23,.09])[0]
        observation = sensors_from_frame(frame, kind, origin, fault_mode, seed=i+8000)
        X.append(features(observation))
        y.append(kind)
    return np.asarray(X,dtype=np.float32), np.asarray(y)

def train():
    X, y = _dataset()
    # Stratified and reproducible; separate synthetic test set for evaluation.
    X_train, X_test, y_train, y_test = train_test_split(X,y,test_size=.25,
                                                       random_state=42,stratify=y)
    model = RandomForestClassifier(n_estimators=130,max_depth=13,min_samples_leaf=2,
                                   n_jobs=-1,random_state=42,class_weight='balanced_subsample')
    model.fit(X_train,y_train)
    predictions = model.predict(X_test)
    meta = {'accuracy':round(float(accuracy_score(y_test,predictions)),3),
            'samples':len(X), 'test_samples':len(X_test),
            'classification_report':classification_report(y_test,predictions,output_dict=True,
                                                          zero_division=0),
            'data_source':'합성 시뮬레이션 데이터',
            'limitations':'현실 해저 시설에 대한 유효성이 검증되지 않음'}
    joblib.dump({'model':model,'meta':meta},MODEL_FILE)
    return {'model':model,'meta':meta}

def get_model():
    global _cache
    with _lock:
        if _cache is None:
            if MODEL_FILE.exists():
                try:
                    _cache = joblib.load(MODEL_FILE)
                except Exception:
                    _cache = train()
            else:
                _cache = train()
    return _cache

def diagnose(observation):
    bundle = get_model()
    probabilities = bundle['model'].predict_proba([features(observation)])[0]
    labels = bundle['model'].classes_
    predicted = labels[np.argmax(probabilities)]
    # Simple consistency checks are independent of the ML classifier.
    warnings = []
    fault = observation.get('injected_fault',{})
    for z, readings in observation['zones'].items():
        missing = [k for k,v in readings.items() if v is None]
        if missing:
            warnings.append(f'{z}구역 데이터 누락: {", ".join(missing)}')
        if readings['water'] is not None and readings['humidity'] is not None:
            if readings['water'] < 10 and readings['humidity'] > 70:
                warnings.append(f'{z}구역 센서 불일치: 침수값 낮음 / 습도 높음')
    if observation['oxygen'] is None:
        warnings.append('산소 센서 데이터 누락')
    return {'predicted_incident':str(predicted),
            'confidence':round(float(max(probabilities)),3),
            'probabilities':{str(label):round(float(prob),3) for label,prob in zip(labels,probabilities)},
            'sensor_warnings':warnings,
            'injected_fault':fault,
            'evaluation':bundle['meta']}
