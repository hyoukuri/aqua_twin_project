"""AQUA TWIN 8.0: partially observed synthetic response benchmark.

The ML planner never reads the ground-truth event list while choosing actions.
It combines a synthetic-trained classifier with bounded one-step counterfactual
search over actions, target rooms, and a finite resource budget. Not RL/MPC.
"""
from __future__ import annotations
import copy
import random
from functools import lru_cache
from statistics import mean
import numpy as np
from .simulation import (
    ROOM_IDS, ADJ, BASELINE, RANGES, METRICS, EVENTS, EFFECTS, clamp,
    distance_map,
)
from .ml import get_model, feature

ACTIONS = {
    'pump': {'label':'비상 배수', 'cost':6, 'metric':'water', 'delta':-17},
    'seal': {'label':'격벽 밀폐·보강', 'cost':8, 'metric':'integrity', 'delta':15},
    'reroute': {'label':'전력 우회', 'cost':5, 'metric':'power', 'delta':16},
    'oxygen_boost': {'label':'산소 긴급 공급', 'cost':7, 'metric':'oxygen', 'delta':16},
    'fire_suppress': {'label':'화재 진압', 'cost':7, 'metric':'temperature', 'delta':-16},
    'filtration': {'label':'유해 가스 정화', 'cost':5, 'metric':'air_quality', 'delta':17},
    'pressure_restore': {'label':'압력 복구', 'cost':6, 'metric':'pressure', 'delta':17},
    'comms_restore': {'label':'통신 복구', 'cost':4, 'metric':'comms', 'delta':18},
    'cooling': {'label':'열관리 강화', 'cost':5, 'metric':'temperature', 'delta':-13},
}
EVENT_ACTION = {key: value[2] for key,value in EVENTS.items()}
EVENT_ACTION.update({'pressure_drop':'pressure_restore','comms_failure':'comms_restore',
                     'navigation_failure':'comms_restore','thermal_spike':'cooling'})
MAX_BUDGET = 150


def room_risk(v):
    temp=max(0, v['temperature']-30)/80
    return round(100*clamp(.19*v['water']/100+.14*(100-v['power'])/100+
        .14*(100-v['oxygen'])/100+.09*temp+.09*(100-v['pressure'])/100+
        .13*(100-v['air_quality'])/100+.14*(100-v['integrity'])/100+
        .08*(100-v['comms'])/100,0,1),2)


def frame(state,minute,active,budget,action):
    risks={z:room_risk(v) for z,v in state.items()}
    vals=list(risks.values())
    return {
        'minute':minute,'risk':round(mean(vals),2),'worst_risk':round(max(vals),2),
        'critical':sum(v>=20 for v in vals), 'power':round(mean(v['power'] for v in state.values()),1),
        'oxygen':round(mean(v['oxygen'] for v in state.values()),1),
        'budget':budget,'active_events':active,'action':action,
        'zones':{z:{**{k:round(v,1) for k,v in state[z].items()},'risk':risks[z]} for z in ROOM_IDS}
    }


def step_hazards(state,events,t):
    active=[]
    for event in events:
        if not (event['start'] <= t < event['start']+event['duration']):continue
        active.append(event['id'])
        for room,d in distance_map(event['room'],3).items():
            scale=(event['severity']/3)*(.40**d)
            for k,delta in EFFECTS[event['type']].items():state[room][k]+=delta*scale
    return active


def cascades(state):
    for v in state.values():
        if v['water']>22:v['power']-=max(0,v['water']-22)*.018
        if v['power']<60:v['oxygen']-=.37;v['comms']-=.19
        if v['temperature']>45:v['integrity']-=.34
        if v['integrity']<50:v['pressure']-=.25
        if v['air_quality']<45:v['oxygen']-=.2
        for k,(lo,hi) in RANGES.items():v[k]=clamp(v[k],lo,hi)


def apply_action(state,action,target):
    spec=ACTIONS[action]
    for room,dist in distance_map(target,1).items():
        weight=1 if dist==0 else .24
        k=spec['metric'];state[room][k]=clamp(state[room][k]+spec['delta']*weight,*RANGES[k])
        if action=='seal':
            state[room]['water']=clamp(state[room]['water']-5*weight,0,100)
            state[room]['pressure']=clamp(state[room]['pressure']+6*weight,0,100)
        if action=='fire_suppress':
            state[room]['air_quality']=clamp(state[room]['air_quality']+5*weight,0,100)
    # All emergency responses consume energy; opportunity cost is modeled explicitly.
    state[target]['power']=clamp(state[target]['power']-1.0,0,100)


def fault_map(seed):
    rng=random.Random(seed ^ 0xBEEF)
    faults={}
    for room in ROOM_IDS:
        if rng.random()<.20:
            faults[room]={'metric':rng.choice(METRICS), 'mode':rng.choice(['missing','stuck','spike'])}
    return faults


def observe(state,t,seed,faults):
    # Same random stream for every policy at the same time/room; fair comparison.
    rng=random.Random(seed*1009+t*379)
    obs={}
    for room in ROOM_IDS:
        obs[room]={k:round(clamp(state[room][k]+rng.gauss(0,.9 if k!='temperature' else .5),*RANGES[k]),1)
                   for k in METRICS}
        f=faults.get(room)
        if f:
            k=f['metric'];mode=f['mode']
            if mode=='missing':obs[room][k]=None
            elif mode=='stuck':obs[room][k]=BASELINE[k]
            else:obs[room][k]=RANGES[k][0 if (t+len(room))%2==0 else 1]
    return obs


def impute(observations,previous=None):
    out={}
    for room,row in observations.items():
        out[room]={k:(row[k] if row[k] is not None else
                 (previous[room][k] if previous and room in previous and previous[room].get(k) is not None else BASELINE[k]))
                 for k in METRICS}
    return out


def choose_rules(est,budget):
    # Fixed priority, single-target reactive baseline, no ML.
    priority=[('water',22,'pump',False),('temperature',43,'fire_suppress',False),
              ('oxygen',75,'oxygen_boost',True),('power',70,'reroute',True),
              ('air_quality',70,'filtration',True),('integrity',70,'seal',True),
              ('pressure',72,'pressure_restore',True),('comms',65,'comms_restore',True)]
    for metric,threshold,action,low in priority:
        if budget<ACTIONS[action]['cost']:continue
        room=max(est,key=lambda r:est[r][metric]) if not low else min(est,key=lambda r:est[r][metric])
        value=est[room][metric]
        if (value<threshold if low else value>threshold):
            return {'type':action,'room':room,'reason':f'고정 임계값: {metric}={value:.1f}', 'confidence':None}
    return None


def choose_ml(est,raw,budget,model):
    """ML labels prioritize candidate rooms; one-step search uses *observed* state only."""
    keys=list(est)
    X=np.asarray([feature(raw[r]) for r in keys],dtype=np.float32)
    probs=model.predict_proba(X)
    classes=list(model.classes_)
    # Rank by observed risk and classifier anomaly confidence.
    ranking=[]
    for i,r in enumerate(keys):
        top=int(np.argmax(probs[i]));label=str(classes[top]);conf=float(probs[i,top])
        ranking.append((room_risk(est[r]) + (conf*4 if label!='normal' else 0),r,label,conf))
    ranking.sort(reverse=True)
    # Search all affordable actions at the 6 most suspicious rooms; no truth-event access.
    candidates=ranking[:6]
    best=None;best_utility=.0
    for _,room,label,confidence in candidates:
        before=sum(room_risk(est[z])*(1.4 if z==room else .6 if z in ADJ[room] else 0)
                   for z in [room,*ADJ[room]])
        for action,spec in ACTIONS.items():
            if spec['cost']>budget:continue
            # Prioritize matching ML event type but do not blindly follow classifier.
            test={r:dict(v) for r,v in est.items()}
            apply_action(test,action,room)
            after=sum(room_risk(test[z])*(1.4 if z==room else .6)
                      for z in [room,*ADJ[room]])
            bonus=1.0*confidence if label!='normal' and EVENT_ACTION.get(label)==action else 0
            utility=(before-after)+bonus-.12*spec['cost']
            if utility>best_utility:
                best_utility=utility
                best={'type':action,'room':room,
                      'reason':f'관측 위험 감소 추정 {before-after:.2f}, ML 추정 {label} ({confidence:.0%})',
                      'confidence':round(confidence,3), 'predicted_type':label}
    return best


def run_policy(events,seed,policy='ml'):
    if policy not in ('ml','rules','none'):raise ValueError('policy')
    state={r:dict(BASELINE) for r in ROOM_IDS}
    faults=fault_map(seed)
    budget=MAX_BUDGET;history=[];log=[];prev=None;model=get_model()['model'] if policy=='ml' else None
    history.append(frame(state,0,[],budget,None))
    for t in range(1,31):
        active=step_hazards(state,events,t)
        cascades(state)
        obs=observe(state,t,seed,faults)
        est=impute(obs,prev)
        action=(choose_ml(est,obs,budget,model) if policy=='ml' else
                choose_rules(est,budget) if policy=='rules' else None)
        if action:
            budget-=ACTIONS[action['type']]['cost']
            apply_action(state,action['type'],action['room'])
            log.append({'minute':t,'action':action['type'],'name':ACTIONS[action['type']]['label'],
                        'room':action['room'],'cost':ACTIONS[action['type']]['cost'],
                        'remaining':budget,'reason':action['reason'],
                        'confidence':action.get('confidence'),'predicted_type':action.get('predicted_type')})
        cascades(state)
        history.append(frame(state,t,active,budget,action))
        prev=est
    area=round(mean(f['risk'] for f in history),2)
    final=history[-1]
    return {'policy':policy,'history':history,'actions':log,'score':area,
            'final_risk':final['risk'],'peak_risk':max(f['risk'] for f in history),
            'critical_minutes':sum(f['critical'] for f in history),
            'resources_used':MAX_BUDGET-budget,'remaining_budget':budget,
            'damaged_rooms':sum(f['risk']>=20 for f in final['zones'].values())}


def run_mission(events,seed):
    ml=run_policy(events,seed,'ml')
    rules=run_policy(events,seed,'rules')
    none=run_policy(events,seed,'none')
    policies={'ml':ml,'rules':rules,'none':none}
    peak=max(ml['history'],key=lambda f:f['risk'])
    from .ml import diagnose
    observed={'zones':observe({z:{k:peak['zones'][z][k] for k in METRICS} for z in ROOM_IDS},
                               peak['minute'],seed,fault_map(seed))}
    diagnostic=diagnose(observed)
    return {'seed':seed,'policies':policies,'history':ml['history'],
            'final':ml['history'][-1], 'diagnosis':diagnostic,
            'sensor_faults_for_evaluation':len(fault_map(seed)),
            'note':'ML은 합성 센서로 학습한 Random Forest, 의사결정은 관측 상태 기반 제한적 1단계 탐색입니다. 강화학습이 아닙니다.'}


def benchmark(seeds,make_events):
    runs=[]
    for seed in seeds:
        events=make_events(seed)
        scores={p:run_policy(events,seed,p)['score'] for p in ('ml','rules','none')}
        runs.append({'seed':seed,'scores':scores,'winner':min(scores,key=scores.get)})
    avg={p:round(mean(r['scores'][p] for r in runs),2) for p in ('ml','rules','none')}
    wins={p:sum(r['winner']==p for r in runs) for p in ('ml','rules','none')}
    return {'runs':runs,'averages':avg,'wins':wins,'metric':'30분 평균 위험도 (낮을수록 좋음)',
            'limitations':'동일한 합성 시뮬레이터에서만 평가. 실제 시설 데이터 및 외부 검증 없음.'}
