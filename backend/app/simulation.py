"""Synthetic underwater habitat multi-incident digital twin.
All parameters are educational, NOT calibrated engineering/safety physics.
"""
import random
from collections import deque

BUILDINGS = [
    ('B01','중앙 관제동'),('B02','해양 생물 연구동'),('B03','에너지 발전동'),
    ('B04','승무원 거주동'),('B05','생명 유지동'),('B06','의료·격리동'),
    ('B07','수중 로봇 격납동'),('B08','자원 처리동'),('B09','통신·항법동'),
    ('B10','비상 대응동')
]
ROOM_NAMES = [
    ['통합 관제실','센서 관측실','중앙 서버실'],
    ['시료 분석실','배양 연구실','심해 실험실'],
    ['발전 제어실','배터리실','전력 분배실'],
    ['생활 구역','식당·휴게실','수면 구역'],
    ['산소 생산실','공기 순환실','수처리실'],
    ['진료실','격리실','의약품 보관실'],
    ['ROV 정비실','도킹 베이','기계 공방'],
    ['폐기물 처리실','담수 재생실','자원 저장실'],
    ['안테나 제어실','항법 센터','외부 통신실'],
    ['비상 발전실','구명 설비실','재난 지휘실']
]
ROOMS = {}
for i,(bid,bname) in enumerate(BUILDINGS):
    for j,name in enumerate(ROOM_NAMES[i]):
        rid=f'{bid}-{j+1}'
        ROOMS[rid]={'id':rid,'name':name,'building_id':bid,'building':bname,
                    'x':(i%5)*5.8+(1.5 if i>=5 else 0)+(-1.3 if j==0 else 1.3 if j==2 else 0),
                    'z':(i//5)*7.1+(.6 if i%2==0 else -.4)+(-.65 if j!=1 else .4)}
ROOM_IDS=list(ROOMS)
LINKS=[]
for bid,_ in BUILDINGS:
    LINKS += [[f'{bid}-1',f'{bid}-2'],[f'{bid}-2',f'{bid}-3']]
for i,(bid,_) in enumerate(BUILDINGS):
    if i%5<4: LINKS.append([f'{bid}-2',f'{BUILDINGS[i+1][0]}-2'])
    if i<5: LINKS.append([f'{bid}-2',f'{BUILDINGS[i+5][0]}-2'])
ADJ={z:set() for z in ROOM_IDS}
for a,b in LINKS: ADJ[a].add(b);ADJ[b].add(a)

EVENTS = {
 'leak':('해수 유입','💧','pump'),
 'power_outage':('전력 계통 고장','⚡','reroute'),
 'oxygen_loss':('산소 공급 저하','🫁','oxygen_boost'),
 'fire':('설비 화재','🔥','fire_suppress'),
 'coolant_leak':('냉각수 누출','🧊','cooling'),
 'pressure_drop':('내부 압력 저하','📉','seal'),
 'hull_crack':('외벽 균열','🛠️','seal'),
 'comms_failure':('통신 두절','📡','reroute'),
 'filtration_failure':('공기 정화 장치 고장','🌫️','filtration'),
 'pump_failure':('배수 펌프 고장','🔧','pump'),
 'thermal_spike':('과열 사고','🌡️','cooling'),
 'toxic_gas':('유해 가스 누출','☣️','filtration'),
 'structural_fatigue':('구조물 피로 손상','🏗️','seal'),
 'navigation_failure':('항법 장비 오류','🧭','reroute'),
}
STRATEGIES = {'none':'관찰 유지','pump':'비상 배수','reroute':'예비 전력·통신 우회',
              'oxygen_boost':'산소 공급 증강','fire_suppress':'화재 진압','cooling':'냉각 강화',
              'seal':'구역 밀폐·보강','filtration':'공기 정화 강화','isolate':'사고 구역 격리'}
METRICS=['water','power','oxygen','temperature','pressure','air_quality','integrity','comms']
# event effect: sensor changes per minute at severity 3, for origin room.
EFFECTS={
 'leak':{'water':9,'power':-1.2,'integrity':-.7},
 'power_outage':{'power':-8,'comms':-1.4},
 'oxygen_loss':{'oxygen':-7,'air_quality':-1.8},
 'fire':{'temperature':6,'oxygen':-3.2,'air_quality':-6,'integrity':-2.1},
 'coolant_leak':{'temperature':4.2,'power':-2.2,'integrity':-1},
 'pressure_drop':{'pressure':-8,'oxygen':-2},
 'hull_crack':{'integrity':-6.5,'water':4.5,'pressure':-1.7},
 'comms_failure':{'comms':-10},
 'filtration_failure':{'air_quality':-7,'oxygen':-1.5},
 'pump_failure':{'water':5.5,'power':-1},
 'thermal_spike':{'temperature':9,'power':-1.8},
 'toxic_gas':{'air_quality':-9,'oxygen':-1.8},
 'structural_fatigue':{'integrity':-7,'pressure':-1.1},
 'navigation_failure':{'comms':-7,'power':-.7},
}
BASELINE={'water':0.,'power':100.,'oxygen':100.,'temperature':22.,'pressure':100.,
          'air_quality':100.,'integrity':100.,'comms':100.}
RANGES={'water':(0,100),'power':(0,100),'oxygen':(0,100),'temperature':(0,110),
        'pressure':(0,100),'air_quality':(0,100),'integrity':(0,100),'comms':(0,100)}

def clamp(x,lo,hi): return max(lo,min(hi,x))

def distance_map(origin,max_dist=3):
    distances={origin:0};queue=deque([origin])
    while queue:
        z=queue.popleft()
        for n in ADJ[z]:
            if n not in distances and distances[z]<max_dist:
                distances[n]=distances[z]+1;queue.append(n)
    return distances

def procedural_events(seed=None, count=None, steps=30):
    rng=random.Random(seed)
    count=count if count is not None else rng.randint(3,7)
    if not 1<=count<=10: raise ValueError('Invalid count')
    keys=list(EVENTS)
    chosen_rooms=rng.sample(ROOM_IDS,count)
    chosen_types=rng.sample(keys,min(count,len(keys)))
    return [{'id':f'E{i+1:02d}','type':chosen_types[i%len(chosen_types)],
             'room':chosen_rooms[i],'severity':rng.randint(1,5),
             'start':rng.randint(0,max(0,steps-8)),'duration':rng.randint(7,14)}
            for i in range(count)]

def validate_events(raw,steps=30):
    if not isinstance(raw,list) or not 3<=len(raw)<=7: raise ValueError('event count')
    clean=[];occupied=set()
    for i,e in enumerate(raw):
        if not isinstance(e,dict): raise ValueError('event item')
        kind=e.get('type');room=e.get('room');severity=e.get('severity');start=e.get('start')
        if kind not in EVENTS or room not in ROOMS or room in occupied: raise ValueError('type/room')
        if type(severity) is not int or not 1<=severity<=5: raise ValueError('severity')
        if type(start) is not int or not 0<=start<=steps-8: raise ValueError('start')
        occupied.add(room)
        clean.append({'id':f'E{i+1:02d}','type':kind,'room':room,'severity':severity,
                      'start':start,'duration':10})
    return clean

def simulate(events,steps=30,intervention=None):
    """Concurrent incidents, distance attenuation, simple cascades, no privileged ML inputs."""
    if not 1<=len(events)<=10: raise ValueError('events')
    if not 5<=steps<=60: raise ValueError('steps')
    if intervention and intervention not in STRATEGIES: raise ValueError('intervention')
    state={z:dict(BASELINE) for z in ROOM_IDS}
    distances={e['id']:distance_map(e['room']) for e in events}
    history=[]
    for t in range(steps+1):
        active=[]
        if t>0:
            for e in events:
                if not e['start']<=t<e['start']+e['duration']:continue
                active.append(e['id'])
                dmap=distances[e['id']]
                for z,d in dmap.items():
                    factor=(e['severity']/3)*(.40**d)
                    if d>0 and intervention=='isolate':factor*=.35
                    for metric,delta in EFFECTS[e['type']].items():
                        reduction=1.0
                        if intervention=='pump' and metric=='water':reduction=.45
                        if intervention=='reroute' and metric in ('power','comms'):reduction=.50
                        if intervention=='oxygen_boost' and metric=='oxygen':reduction=.50
                        if intervention=='fire_suppress' and e['type']=='fire':reduction=.30
                        if intervention=='cooling' and metric=='temperature':reduction=.40
                        if intervention=='seal' and metric in ('integrity','pressure','water'):reduction=.55
                        if intervention=='filtration' and metric=='air_quality':reduction=.40
                        state[z][metric]+=delta*factor*reduction
            for z,v in state.items():
                # Cascading interactions. Emergency interventions cost resources.
                if v['water']>22: v['power']-=max(0,v['water']-22)*.014
                if v['power']<60: v['oxygen']-=.33;v['comms']-=.17
                if v['temperature']>45: v['integrity']-=.32
                if v['integrity']<50: v['pressure']-=.21
                if intervention=='oxygen_boost':v['power']-=.15
                if intervention=='pump':v['power']-=.10
                for k,(lo,hi) in RANGES.items():v[k]=clamp(v[k],lo,hi)
        room_risk={}
        for z,v in state.items():
            temp_risk=max(0,v['temperature']-30)/80
            room_risk[z]=round(100*clamp(.19*v['water']/100+.14*(100-v['power'])/100+
                 .14*(100-v['oxygen'])/100+.09*temp_risk+.09*(100-v['pressure'])/100+
                 .13*(100-v['air_quality'])/100+.14*(100-v['integrity'])/100+
                 .08*(100-v['comms'])/100,0,1),1)
        risk=round(sum(room_risk.values())/len(room_risk),1)
        critical=sum(1 for v in room_risk.values() if v>=20)
        history.append({'minute':t,'risk':risk,'critical':critical,'active_events':active,
                        'power':round(sum(v['power'] for v in state.values())/len(state),1),
                        'oxygen':round(sum(v['oxygen'] for v in state.values())/len(state),1),
                        'zones':{z:{**{k:round(val,1) for k,val in v.items()},'risk':room_risk[z]}
                                 for z,v in state.items()}})
    return {'history':history,'final':history[-1],
            'score':round(sum(f['risk'] for f in history)/len(history),2),
            'model_note':'합성·단순화된 교육용 시뮬레이션이며 실제 시설 안전·공학 예측에 사용할 수 없습니다.'}

def observed_sensors(frame,seed):
    """Observed readings have noise and random missing/stuck/spike faults; no true events leaked."""
    rng=random.Random(seed);result={};faults=[]
    for z,v in frame['zones'].items():
        row={k:round(clamp(v[k]+rng.gauss(0,1.3 if k!='temperature' else .6),*RANGES[k]),1)
             for k in METRICS}
        if rng.random()<.13:
            key=rng.choice(METRICS);mode=rng.choice(['missing','stuck','spike'])
            row[key]=None if mode=='missing' else (BASELINE[key] if mode=='stuck' else RANGES[key][rng.randrange(2)])
            faults.append({'room':z,'sensor':key,'mode':mode})
        result[z]=row
    return {'zones':result,'fault_count':len(faults),'injected_faults_for_evaluation':faults}
