import './style.css';
import { createTwin } from './twin3d.js';
const API=(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/,'');
const $=id=>document.getElementById(id);
const names={water:'침수',power:'전력',oxygen:'산소',temperature:'온도',pressure:'압력',air_quality:'공기 질',integrity:'구조 건전성',comms:'통신'};
const policyNames={ml:'AI 지휘',rules:'규칙 기반',none:'무대응'};
let config=null,scenario=null,mission=null,twin=null,minute=0,policy='ml',selected='B01-2',timer=null,loading=false;
const text=(tag,value,className='')=>{const e=document.createElement(tag);e.textContent=String(value);if(className)e.className=className;return e;};
function clear(node){node.replaceChildren();}
function status(message,good=true){$('status').replaceChildren(text('span','','mini-led'),document.createTextNode(' '+message));$('status').classList.toggle('bad',!good);}
function showError(message){$('error').textContent=message;$('error').classList.remove('hidden');status('연결 확인 필요',false);}
function hideError(){$('error').classList.add('hidden');}
async function api(path,data){
  const ctrl=new AbortController(),id=setTimeout(()=>ctrl.abort(),90000);
  try{
    const response=await fetch(API+path,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},signal:ctrl.signal,...(data===undefined?{}:{body:JSON.stringify(data)})});
    if(!response.ok){let detail='';try{const body=await response.json();detail=typeof body.detail==='string'?body.detail:JSON.stringify(body.detail||'');}catch{}throw new Error(`HTTP ${response.status} ${detail}`);}
    return await response.json();
  }catch(err){if(err instanceof TypeError)throw new Error(`API 연결 실패 (${API}). Vercel의 VITE_API_URL, Render의 ALLOWED_ORIGINS, 서버 로그를 확인하세요. 원인: ${err.message}`);throw err;}
  finally{clearTimeout(id);}
}
function setPhase(n){for(let i=1;i<=3;i++){$(`step${i}`).classList.toggle('complete',i<n);$(`step${i}`).classList.toggle('current',i===n);}}
function severityCell(n){const s=text('span','','severity'+(n>=4?' high':''));for(let i=0;i<5;i++)s.append(text('i','',''+(i<n?'on':'')));return s;}
function eventRows(){
  const body=$('eventRows');clear(body);
  for(const e of [...scenario.events].sort((a,b)=>a.start-b.start)){
    const tr=document.createElement('tr');tr.dataset.room=e.room;
    tr.append(text('td',`T+${String(e.start).padStart(2,'0')}:00`),text('td',`${e.emoji} ${e.name}`,'event-name'),
      text('td',`${e.building} / ${e.room_name}`,'location'));
    const sev=document.createElement('td');sev.append(severityCell(e.severity),text('small',` ${e.severity}/5`));tr.append(sev,text('td',`${e.duration}분`));
    tr.addEventListener('click',()=>{selected=e.room;twin?.setSelected(selected);renderRoom();document.getElementById('visual').scrollIntoView({behavior:'smooth'});});body.append(tr);
  }
  $('briefMeta').replaceChildren(...[
    ['MISSION STATUS','사건 브리핑 완료'],['EVENTS',`${scenario.events.length}건`],['TIME WINDOW',`${scenario.steps} MIN`],
    ['GENERATION',scenario.generation_mode==='openrouter_llm'?'OPENROUTER AI':'절차적 난수']
  ].map(([a,b])=>{const div=document.createElement('div');div.append(text('small',a),text('b',b));return div;}));
  $('scenarioSeed').textContent=`SEED ${scenario.seed}`;
  $('scenarioHint').textContent='모든 사건을 확인한 뒤 시뮬레이션 시작 버튼을 누르세요.';
  $('startBtn').disabled=false;setPhase(2);
}
function stop(){if(timer){clearInterval(timer);timer=null;}$('playBtn').textContent='▶ 재생';}
function frame(){return mission?.policies?.[policy]?.history?.[minute]||null;}
function renderRoom(){
  if(!config)return;const r=config.rooms[selected];if(!r)return;
  $('roomTitle').textContent=r.name;$('roomSubtitle').textContent=`${r.building} · ${selected}`;
  const p=$('roomStats');clear(p);const zone=frame()?.zones?.[selected];
  if(zone){for(const [key,label] of Object.entries(names)){const d=text('div','','inspect-stat');d.append(text('small',label),text('strong',`${zone[key]}${key==='temperature'?'°':'%'}`));p.append(d);}}
  else{p.append(text('div','시뮬레이션 전 — 정상 상태','empty'));}
  const related=scenario?.events?.filter(e=>e.room===selected)||[];
  $('roomEvents').textContent=related.length?`예정된 사건: ${related.map(e=>`${e.name} (T+${e.start}분, 강도 ${e.severity})`).join(' / ')}`:'해당 구역의 직접 발생 예정 사고 없음';
}
function renderIncidentOverlay(){
  const panel=$('incidentOverlay'),list=$('incidentNow'),count=$('incidentCount');
  if(!panel||!list||!count)return;
  clear(list);
  if(!scenario){
    count.textContent='대기 중';
    list.append(text('div','새 시나리오를 생성하면 사고 위치가 표시됩니다.','incident-empty'));
    panel.classList.remove('incident-live');
    return;
  }
  const sorted=[...scenario.events].sort((a,b)=>a.start-b.start);
  const current=mission?sorted.filter(e=>minute>=e.start&&minute<e.start+e.duration):[];
  const upcoming=mission?sorted.filter(e=>e.start>minute):sorted;
  const visible=current.length?current:upcoming.slice(0,3);
  const active=current.length>0;
  panel.classList.toggle('incident-live',active);
  count.textContent=active?`현재 ${current.length}건 발생`:mission?`다음 사고 ${upcoming.length}건`:`예정 ${sorted.length}건`;
  if(!visible.length){
    list.append(text('div','현재 진행 중이거나 예정된 사고가 없습니다.','incident-empty'));
    return;
  }
  for(const e of visible.slice(0,5)){
    const row=text('button','','incident-item '+(active?'incident-active':'incident-upcoming'));
    row.type='button';
    const detail=text('span','','incident-item-detail');
    detail.append(text('strong',`${e.emoji||'⚠'} ${e.name}`),
      text('small',`${e.building} · ${e.room_name} · 강도 ${e.severity}/5`));
    row.append(detail,text('b',active?`T+${minute} 발생 중`:`T+${e.start} 예정`));
    row.addEventListener('click',()=>{selected=e.room;twin?.setSelected(selected);renderRoom();});
    list.append(row);
  }
}
function updateFrame(){
  const f=frame();if(!f)return;
  $('riskMetric').textContent=f.risk.toFixed(2);
  $('criticalMetric').textContent=f.critical;
  $('powerMetric').textContent=`${f.power.toFixed(1)}%`;
  $('oxygenMetric').textContent=`${f.oxygen.toFixed(1)}%`;
  $('budgetMetric').textContent=f.budget;
  $('timeSlider').value=minute;$('timeLabel').textContent=`T+${String(minute).padStart(2,'0')}:00`;
  twin?.setFrame(f);renderRoom();renderIncidentOverlay();
  const logs=mission.policies[policy].actions.filter(a=>a.minute<=minute);
  $('decisionSummary').textContent=`${policyNames[policy]} · T+${minute}분까지 ${logs.length}회 대응 · 잔여 자원 ${f.budget}/150`;
  const parent=$('actionLog');clear(parent);
  if(!logs.length)parent.append(text('div','현재 시점까지 실행된 대응 없음','empty'));
  for(const a of logs.slice(-18).reverse()){
    const row=text('div','','action-row');const left=text('div','');left.append(text('strong',`${a.name} · ${config.rooms[a.room]?.name||a.room}`),text('small',a.reason));
    const right=text('div','');right.append(text('b',`T+${a.minute} · −${a.cost}`),text('small',`잔여 ${a.remaining}`));row.append(left,right);
    row.addEventListener('click',()=>{selected=a.room;minute=a.minute;stop();updateFrame();twin?.setSelected(selected);});parent.append(row);
  }
}
function renderChart(){
  const svg=$('riskChart');clear(svg);if(!mission)return;
  const ns='http://www.w3.org/2000/svg',make=(name,attrs)=>{const el=document.createElementNS(ns,name);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);svg.append(el);return el;};
  const colors={ml:'#2866e9',rules:'#e7a53a',none:'#e16a7b'};
  const max=Math.max(8,...Object.values(mission.policies).flatMap(p=>p.history.map(f=>f.risk)))*1.13;
  for(let i=0;i<=4;i++){
    const y=215-i*45;make('line',{x1:35,y1:y,x2:625,y2:y,stroke:'#e1e7ef','stroke-dasharray':'4 6'});
    const label=make('text',{x:2,y:y+4,fill:'#7b899b','font-size':11});label.textContent=(max*i/4).toFixed(0);
  }
  for(const key of ['none','rules','ml']){
    const history=mission.policies[key].history;
    const points=history.map((f,i)=>`${35+i*590/30},${215-f.risk/max*180}`).join(' ');
    make('polyline',{points,fill:'none',stroke:colors[key],'stroke-width':key==='ml'?3.5:2.3,'stroke-linecap':'round','stroke-linejoin':'round'});
  }
  const x=35+minute*590/30;make('line',{x1:x,x2:x,y1:24,y2:215,stroke:'#7c91ac','stroke-width':1,'stroke-dasharray':'3 5'});
  for(let t=0;t<=30;t+=10){const label=make('text',{x:35+t*590/30,y:237,'text-anchor':'middle',fill:'#7b899b','font-size':11});label.textContent=`${t}분`;}
}
function renderCompare(){
  const parent=$('comparison');clear(parent);if(!mission)return;
  const policies=mission.policies,max=Math.max(1,...Object.values(policies).map(p=>p.score));
  for(const key of ['ml','rules','none']){
    const p=policies[key],d=text('div','','compare-card'),head=text('div','','compare-head');
    head.append(text('strong',policyNames[key]),text('b',`${p.score.toFixed(2)} 위험도`));d.append(head);
    const track=text('div','','compare-track'),bar=text('div','','compare-bar '+(key==='ml'?'':key));bar.style.width=`${p.score/max*100}%`;track.append(bar);d.append(track);
    d.append(text('small',`대응 ${p.actions.length}회 · 자원 ${p.resources_used}/150 · 위험 구역-분 ${p.critical_minutes}`));parent.append(d);
  }
  const best=Object.entries(policies).sort((a,b)=>a[1].score-b[1].score)[0][0];
  parent.append(text('div',`이번 시나리오 최저 위험도: ${policyNames[best]}. 결과는 시나리오마다 달라질 수 있습니다.`,'decision-summary'));
}
function renderDiagnosis(){
  const parent=$('diagnosis');clear(parent);if(!mission)return;
  $('sensorSummary').textContent=`센서 고장 주입 ${mission.sensor_faults_for_evaluation}개 모듈 · 관측 센서 기반 ML 분류 (정답 사건 목록 비공개)`;
  const items=mission.diagnosis.room_predictions.slice(0,8);
  for(const item of items){const d=text('div','','diagnosis-row'),left=text('div',''),right=text('div','');
    left.append(text('strong',config.rooms[item.room]?.name||item.room),text('small',`${item.room} · 누락 ${item.missing?.length||0}개`));
    right.append(text('b',config.event_types[item.predicted_type]?.name||item.predicted_type),text('small',`분류 점수 ${(item.confidence*100).toFixed(0)}%`));d.append(left,right);
    d.addEventListener('click',()=>{selected=item.room;twin?.setSelected(selected);renderRoom();});parent.append(d);
  }
  if(!items.length)parent.append(text('div','탐지된 이상 패턴 없음','empty'));
  const e=mission.diagnosis.evaluation;
  $('mlScore').textContent=`합성 데이터 홀드아웃 정확도 ${(e.accuracy*100).toFixed(1)}% · Macro-F1 ${e.macro_f1}. 모델 분류 점수는 실제 사고 확률이 아닙니다.`;
}
function setPolicy(next){if(!mission)return;policy=next;document.querySelectorAll('#policySwitch button').forEach(b=>b.classList.toggle('selected',b.dataset.policy===next));updateFrame();renderChart();}
async function generate(){if(loading)return;loading=true;stop();hideError();$('generateBtn').disabled=true;$('generateBtn').textContent='생성 중…';$('startBtn').disabled=true;scenario=null;mission=null;setPhase(1);$('benchmarkResults').classList.add('hidden');
  try{scenario=await api('/api/scenario',{});eventRows();twin?.setScenario(scenario.events);renderIncidentOverlay();$('report').textContent='시뮬레이션이 시작되면 보고서를 생성할 수 있습니다.';status('사고 브리핑 완료');
  }catch(e){showError(`시나리오 생성 실패: ${e.message}`);}finally{loading=false;$('generateBtn').disabled=false;$('generateBtn').textContent='✦ 새로운 사건 생성';}
}
async function start(){if(loading||!scenario)return;loading=true;hideError();$('startBtn').disabled=true;$('startBtn').textContent='AI 지휘 계산 중…';
  try{mission=await api('/api/mission',{seed:scenario.seed,events:scenario.events});policy='ml';minute=0;
    document.querySelectorAll('#policySwitch button').forEach(b=>{b.disabled=false;b.classList.toggle('selected',b.dataset.policy==='ml');});
    $('playBtn').disabled=false;$('timeSlider').disabled=false;$('benchmarkBtn').disabled=false;$('reportBtn').disabled=false;
    setPhase(3);renderCompare();renderDiagnosis();updateFrame();renderChart();status('AI 지휘 시뮬레이션 준비 완료');play();
  }catch(e){showError(`시뮬레이션 실패: ${e.message}`);}finally{loading=false;$('startBtn').disabled=false;$('startBtn').textContent='▶ AI 대응 시뮬레이션 시작';}
}
function play(){if(!mission)return;if(timer){stop();return;}if(minute>=30)minute=0;
  $('playBtn').textContent='Ⅱ 일시정지';timer=setInterval(()=>{minute=Math.min(30,minute+1);updateFrame();renderChart();if(minute===30)stop();},Number($('speedSelect').value));
}
async function benchmark(){if(!scenario)return;$('benchmarkBtn').disabled=true;$('benchmarkBtn').textContent='여러 시나리오 계산 중…';
  try{const r=await api(`/api/benchmark?runs=6&seed=${scenario.seed}`);const box=$('benchmarkResults');clear(box);box.classList.remove('hidden');
    box.append(text('strong','6개 동일 조건 비교 실험 · 평균 위험도 (낮을수록 좋음)'));
    const table=document.createElement('table'),head=document.createElement('tr');['정책','평균 위험도','최저 위험도 횟수'].forEach(x=>head.append(text('th',x)));table.append(head);
    for(const p of ['ml','rules','none']){const tr=document.createElement('tr');tr.append(text('td',policyNames[p]),text('td',r.averages[p].toFixed(2)),text('td',`${r.wins[p]}/6`));table.append(tr);}box.append(table,text('small',r.limitations));
  }catch(e){showError(`벤치마크 실행 실패: ${e.message}`);}finally{$('benchmarkBtn').disabled=false;$('benchmarkBtn').textContent='▦ 여러 시나리오 벤치마크';}
}
async function report(){if(!mission)return;$('reportBtn').disabled=true;$('report').textContent='보고서 생성 중…';
  try{const r=await api('/api/report',{events:mission.events,diagnosis:mission.diagnosis,recommendation:{name:'센서 관측 기반 ML 지휘 (비교 실험 포함)'},final:mission.final});$('report').textContent=`[${r.mode==='openrouter'?'OpenRouter 생성':'오프라인 요약'}]\n\n${r.text}`;}
  catch(e){$('report').textContent=`보고서 오류: ${e.message}`;}finally{$('reportBtn').disabled=false;}
}
function setupNavigation(){
  const links=[...document.querySelectorAll('.rail-group a[href^="#"]')];
  if(!('IntersectionObserver' in window))return;
  const observer=new IntersectionObserver(entries=>{
    const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio);
    if(!visible.length)return;
    const id=visible[0].target.id;
    links.forEach(link=>link.classList.toggle('is-active',link.getAttribute('href')==='#'+id));
  },{rootMargin:'-12% 0px -55% 0px',threshold:[0,.1,.3]});
  for(const link of links){const target=document.querySelector(link.getAttribute('href'));if(target)observer.observe(target);}
}
async function init(){
  setupNavigation();
  $('generateBtn').addEventListener('click',generate);$('startBtn').addEventListener('click',start);
  $('playBtn').addEventListener('click',play);$('timeSlider').addEventListener('input',e=>{stop();minute=Number(e.target.value);updateFrame();renderChart();});
  $('speedSelect').addEventListener('change',()=>{if(timer){stop();play();}});
  $('benchmarkBtn').addEventListener('click',benchmark);$('reportBtn').addEventListener('click',report);
  $('resetCamera').addEventListener('click',()=>twin?.reset());
  document.querySelectorAll('#policySwitch button').forEach(b=>b.addEventListener('click',()=>{stop();setPolicy(b.dataset.policy);}));
  try{const health=await api('/api/health');if(!health.ok)throw new Error('health ok=false');
    config=await api('/api/config');$('buildingCount').textContent=config.buildings.length;$('roomCount').textContent=Object.keys(config.rooms).length;$('typeCount').textContent=Object.keys(config.event_types).length;
    twin=createTwin($('twin3d'),config,id=>{selected=id;renderRoom();});renderRoom();renderIncidentOverlay();status(`백엔드 연결됨 · v${health.version}`);
  }catch(e){showError(`초기 연결 오류: ${e.message}`);$('generateBtn').disabled=true;}
}
init();
