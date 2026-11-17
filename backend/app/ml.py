"""RandomForest trained on synthetic per-room sensor patterns (14 incident classes + normal).
Evaluation is synthetic holdout only; not real-world accuracy or calibrated probabilities.
"""
import random
from threading import Lock
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from .simulation import METRICS, BASELINE, RANGES, EFFECTS, EVENTS, clamp

_lock=Lock();_bundle=None

def feature(row):
    return [float(row.get(k)) if row.get(k) is not None else float(BASELINE[k]) for k in METRICS]+[int(row.get(k) is None) for k in METRICS]

def training_data(n_per_class=165):
    rng=random.Random(70401);xs=[];ys=[]
    for label in ['normal',*EVENTS]:
        for _ in range(n_per_class):
            row=dict(BASELINE)
            if label!='normal':
                intensity=rng.uniform(.5,1.8);elapsed=rng.uniform(2,11)
                for k,delta in EFFECTS[label].items():
                    row[k]+=delta*intensity*elapsed
                if row['water']>22:row['power']-=(row['water']-22)*.07
                if row['power']<60:row['oxygen']-=2.5
            else:
                for k in METRICS:row[k]+=rng.gauss(0,1.8)
            for k in METRICS:row[k]=clamp(row[k]+rng.gauss(0,1.6),*RANGES[k])
            if rng.random()<.12:
                key=rng.choice(METRICS)
                row[key]=None if rng.random()<.7 else BASELINE[key]
            xs.append(feature(row));ys.append(label)
    return np.asarray(xs,dtype=np.float32),np.asarray(ys)

def get_model():
    global _bundle
    with _lock:
        if _bundle is None:
            X,y=training_data()
            xt,xv,yt,yv=train_test_split(X,y,test_size=.22,random_state=20,stratify=y)
            model=RandomForestClassifier(n_estimators=85,max_depth=15,min_samples_leaf=2,
                                         n_jobs=-1,random_state=33,class_weight='balanced_subsample')
            model.fit(xt,yt)
            pred=model.predict(xv)
            _bundle={'model':model,'evaluation':{'accuracy':round(float(accuracy_score(yv,pred)),3),
                'macro_f1':round(float(f1_score(yv,pred,average='macro')),3),
                'test_samples':len(yv),'classes':len(set(y))}}
        return _bundle

def diagnose(observed,top_n=12):
    model=get_model()['model'];zones=observed['zones'];keys=list(zones)
    x=np.asarray([feature(zones[z]) for z in keys],dtype=np.float32)
    probabilities=model.predict_proba(x)
    output=[]
    for i,z in enumerate(keys):
        row=zones[z]
        anomaly=max(0,round(100*max(abs((row[k] if row[k] is not None else BASELINE[k])-BASELINE[k])/
                                     (80 if k=='temperature' else 100) for k in METRICS),1))
        missing=[k for k in METRICS if row[k] is None]
        order=np.argsort(probabilities[i])[::-1]
        winner=str(model.classes_[order[0]])
        if winner!='normal' or missing or anomaly>=8:
            output.append({'room':z,'predicted_type':winner,'confidence':round(float(probabilities[i][order[0]]),3),
                'anomaly':anomaly,'missing':missing,'top2':[
                    {'type':str(model.classes_[j]),'score':round(float(probabilities[i][j]),3)} for j in order[:2]]})
    output.sort(key=lambda item:(item['anomaly'],item['confidence']),reverse=True)
    return {'room_predictions':output[:top_n],
            'suspicious_rooms':len(output),'evaluation':get_model()['evaluation'],
            'note':'센서 관측값만으로 추론한 합성 데이터 학습 모델입니다. 실제 사고의 확률이나 정답을 보장하지 않습니다.'}
