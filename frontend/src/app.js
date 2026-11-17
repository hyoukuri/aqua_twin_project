import './style.css';
import { createTwin } from './twin3d.js';
const API=(import.meta.env.VITE_API_URL||'http://localhost:8000').replace(/\/$/,'');
const $=id=>document.getElementById(id);
const LABELS={water:'침수',power:'전력',oxygen:'산소',temperature:'온도',pressure:'압력',air_quality:'공기 질',integrity:'구조 건전성',comms:'통신'};
let config=null,result=null,twin=null,selected='B01-2',minute=0,playTimer=null;
function setStatus(message,good=true){$('status').textContent=message;$('status').classList.toggle('bad',!good);}
function error(message){$('error').textContent=message;$('error').classList.remove('hidden');setStatus('연결 오류',false);}
function clearError(){$('error').classList.add('hidden');}
async function request(path,body){const r=await fetch(API+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Error(`${path}: HTTP ${r.status}`);return r.json();}
function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function fmtTime(t){return `${String(t).padStart(2,'0')}:00`;}
function eventLabel(event){return `${event.emoji} ${event.name}`;}
function createEventRow(event,compact=false){
  const node=el('div',compact?'side-event':'event-item');
  const head=el('div','event-top');head.append(el('strong','',eventLabel(event)),el('span','event-time',`T+${event.start}분`));node.append(head);
  node.append(el('div','event-location',`${event.building} · ${event.room_name}`));
  const footer=el('div','event-footer');footer.append(el('span','',`강도 ${'●'.repeat(event.severity)}${'○'.repeat(5-event.severity)}`));
  if(!compact)footer.append(el('span','',`지속 ${event.duration}분`));node.append(footer);
  node.addEventListener('click',()=>{selected=event.room;twin?.setSelected(selected);showRoom();});return node;
}
function renderEvents(){
  $('sideEvents').replaceChildren(...result.events.map(e=>createEventRow(e,true)));
  $('eventTimeline').replaceChildren(...result.events.slice().sort((a,b)=>a.start-b.start).map(e=>createEventRow(e)));
  $('eventCount').textContent=String(result.events.length);
  $('modeTag').textContent=result.generation_mode==='openrouter_llm'?'OpenRouter 시나리오':'난수 기반 시나리오';
}
function renderDiagnosis(){
  const parent=$('diagnosis');parent.replaceChildren();
  const items=result.diagnosis.room_predictions.slice(0,7);
  if(!items.length)parent.append(el('p','muted','탐지된 이상 징후가 없습니다.'));
  for(const item of items){
    const row=el('div','diagnosis-row');const left=el('div','');
    left.append(el('strong','',config.rooms[item.room].name),el('small','',`${item.room} · ${item.missing.length?'누락: '+item.missing.join(', '):'센서값 기반 추론'}`));
    const right=el('div','diagnosis-right');const kind=item.predicted_type==='normal'?'정상 또는 불확실':(config.event_types[item.predicted_type]?.name||item.predicted_type);
    right.append(el('b','',kind),el('small','',`분류 점수 ${(item.confidence*100).toFixed(0)}%`));row.append(left,right);
    row.addEventListener('click',()=>{selected=item.room;twin?.setSelected(selected);showRoom();});parent.append(row);
  }
  const ev=result.diagnosis.evaluation;
  $('mlScore').textContent=`합성 데이터 홀드아웃: 정확도 ${(ev.accuracy*100).toFixed(1)}% · Macro-F1 ${ev.macro_f1} · ${ev.classes}개 클래스 (실제 현장 성능 아님)`;
}
function renderStrategies(){
  const p=$('strategies');p.replaceChildren();const max=Math.max(1,...result.comparisons.map(x=>x.score));
  for(const item of result.comparisons){
    const row=el('div','strategy-row');row.append(el('span','',item.name));
    const track=el('div','track');const bar=el('div','bar');bar.style.width=`${item.score/max*100}%`;if(item.strategy===result.recommendation.strategy)bar.classList.add('best');track.append(bar);
    row.append(track,el('b','',item.score.toFixed(2)));p.append(row);
  }
  $('recommendation').textContent=`◈ 모의 최저 위험도 대응: ${result.recommendation.name} · 평균 위험도 ${result.recommendation.score.toFixed(2)}`;
}
function renderChart(){
  const svg=$('riskChart');svg.replaceChildren();const ns='http://www.w3.org/2000/svg';
  const history=result.history,max=Math.max(10,...history.map(x=>x.risk))*1.12;
  const points=history.map((f,i)=>`${24+i*(476/(history.length-1))},${140-(f.risk/max)*120}`).join(' ');
  const grid=document.createElementNS(ns,'path');grid.setAttribute('d','M24 20 H500 M24 80 H500 M24 140 H500');grid.setAttribute('stroke','#25475b');grid.setAttribute('stroke-dasharray','3 6');svg.append(grid);
  const line=document.createElementNS(ns,'polyline');line.setAttribute('points',points);line.setAttribute('fill','none');line.setAttribute('stroke','#47e5d3');line.setAttribute('stroke-width','3');line.setAttribute('stroke-linecap','round');line.setAttribute('stroke-linejoin','round');svg.append(line);
  const x=24+minute*476/(history.length-1),y=140-(history[minute].risk/max)*120;
  const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',String(x));dot.setAttribute('cy',String(y));dot.setAttribute('r','5');dot.setAttribute('fill','#ffc86c');svg.append(dot);
  for(const [xPos,label] of [[24,'0분'],[262,'15분'],[476,'30분']]){const txt=document.createElementNS(ns,'text');txt.setAttribute('x',String(xPos));txt.setAttribute('y','157');txt.setAttribute('fill','#7a9bad');txt.setAttribute('font-size','10');txt.textContent=label;svg.append(txt);}
}
function showRoom(){
  if(!result||!config)return;
  const room=config.rooms[selected];const values=result.history[minute].zones[selected];
  const root=$('roomInfo');root.replaceChildren();
  const title=el('strong','',`${room.building} / ${room.name}`);root.append(title);
  const metrics=el('div','room-metrics');
  for(const key of ['water','power','oxygen','temperature','pressure','air_quality','integrity','comms'])metrics.append(el('span','',`${LABELS[key]} ${values[key]}${key==='temperature'?'°C':'%'}`));
  root.append(metrics);
}
function renderBuildings(){
  const p=$('buildingGrid');p.replaceChildren();const frame=result.history[minute];
  for(const b of config.buildings){
    const card=el('div','building-card');card.append(el('h3','',b.name));
    for(const [id,room] of Object.entries(config.rooms)){
      if(room.building_id!==b.id)continue;
      const state=frame.zones[id],r=el('button',`room-line ${state.risk>=20?'danger':state.risk>=8?'warning':''}`);
      r.append(el('span','',room.name),el('b','',`${state.risk.toFixed(1)} 위험`));
      r.addEventListener('click',()=>{selected=id;twin?.setSelected(selected);showRoom();});card.append(r);
    }
    p.append(card);
  }
}
function showMinute(value){
  if(!result)return;
  minute=Math.max(0,Math.min(result.history.length-1,Number(value)));
  const f=result.history[minute];$('timeSlider').value=String(minute);$('timeLabel').textContent=fmtTime(minute);
  $('riskMetric').textContent=f.risk.toFixed(1);$('powerMetric').textContent=`${f.power.toFixed(1)}%`;
  $('oxygenMetric').textContent=`${f.oxygen.toFixed(1)}%`;$('criticalMetric').textContent=`${f.critical} / 30`;
  $('minuteMetric').textContent=`${minute}분`;
  twin?.setFrame(f);showRoom();renderBuildings();renderChart();
  for(const [i,node] of [...$('eventTimeline').children].entries()){
    const ev=result.events.slice().sort((a,b)=>a.start-b.start)[i];
    node.classList.toggle('active',ev.start<=minute&&minute<ev.start+ev.duration);
  }
}
function stopPlay(){if(playTimer){clearInterval(playTimer);playTimer=null;}$('playBtn').textContent='▶ 재생';}
function play(){
  if(playTimer){stopPlay();return;}
  if(!result)return;
  if(minute>=result.history.length-1)showMinute(0);
  $('playBtn').textContent='Ⅱ 일시정지';
  playTimer=setInterval(()=>{if(minute>=result.history.length-1){stopPlay();return;}showMinute(minute+1);},550);
}
async function generate(){
  stopPlay();$('generateBtn').disabled=true;$('generateBtn').textContent='시나리오 생성 중…';setStatus('AI 분석 중');clearError();
  try{
    result=await request('/api/generate',{});
    $('report').textContent='「AI 상황 보고서 생성」을 누르면 사고 분석 보고서를 확인할 수 있습니다.';
    renderEvents();renderDiagnosis();renderStrategies();showMinute(0);
    setStatus(`${result.events.length}건의 사고 시뮬레이션 준비 완료`);
    play();
  }catch(e){error(`백엔드 연결에 실패했습니다. Render 서버 주소와 CORS 설정을 확인하세요. ${e.message}`);}
  finally{$('generateBtn').disabled=false;$('generateBtn').textContent='✦ 새 AI 랜덤 시나리오 생성';}
}
async function report(){
  if(!result)return;
  $('reportBtn').disabled=true;$('report').textContent='분석 보고서 작성 중…';
  try{const response=await request('/api/report',{events:result.events,diagnosis:result.diagnosis,recommendation:result.recommendation,final:result.final});
    $('report').textContent=`[${response.mode==='openrouter'?'OpenRouter AI':'오프라인 분석'}]\n${response.text}`;
  }catch(e){$('report').textContent=`보고서 생성 오류: ${e.message}`;}
  finally{$('reportBtn').disabled=false;}
}
async function init(){
  $('generateBtn').addEventListener('click',generate);$('playBtn').addEventListener('click',play);
  $('timeSlider').addEventListener('input',e=>{stopPlay();showMinute(e.target.value);});
  $('reportBtn').addEventListener('click',report);
  try{config=await request('/api/config');
    $('buildingCount').textContent=config.buildings.length;$('roomCount').textContent=Object.keys(config.rooms).length;
    $('typeCount').textContent=Object.keys(config.event_types).length;
    twin=createTwin($('twin3d'),config,id=>{selected=id;twin.setSelected(id);showRoom();});
    await generate();
  }catch(e){error(`초기 연결 오류: ${e.message}. Render 백엔드가 실행 중인지 확인하세요.`);}
}
init();
