import './style.css';
import {createTwin} from './twin3d.js';

const API=(import.meta.env.VITE_API_URL||'http://localhost:8000').replace(/\/$/,'');
const $=id=>document.getElementById(id);
const names={A:'관제실',B:'연구실',C:'전력실',D:'거주실',E:'생명유지실',F:'비상설비실'};
const kinds={none:'사고 없음',leak:'침수 사고',power:'전력 고장',oxygen:'산소 공급 장애'};
const faults={none:'정상 추정',missing:'데이터 누락 추정',stuck:'센서 고착 추정',spike:'이상치 추정'};
const strategies={none:'대응 없음',isolate:'구역 격리',pump:'배수 펌프',shutdown:'전체 전력 차단',reroute:'비상 전력 우회',oxygen_boost:'산소 보충'};
let result=null,minute=12,playTimer=null;
const twin=createTwin($('twin3d'),z=>{$('origin').value=z;twin.setOrigin(z);});
$('severity').addEventListener('input',e=>$('severityOut').textContent=e.target.value);
$('steps').addEventListener('input',e=>$('stepsOut').textContent=e.target.value+'분');
$('origin').addEventListener('change',e=>twin.setOrigin(e.target.value));
function showError(msg){$('error').textContent=msg;$('error').classList.remove('hidden');}
function clearError(){$('error').classList.add('hidden');}
function frame(){return result?.history?.[Math.min(minute,result.history.length-1)];}
function bar(label,value,suffix='%',max=100){const v=Number(value);return `<div class="barrow"><span>${label}</span><div class="track"><div class="fill" style="width:${Math.max(0,Math.min(100,v/max*100))}%"></div></div><b>${v.toFixed(suffix==='%'?1:2)}${suffix}</b></div>`;}
function drawChart(){
  const canvas=$('chart'),rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
  const dpr=Math.min(window.devicePixelRatio||1,2),w=rect.width,h=rect.height;
  canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
  ctx.font='11px Arial';ctx.textBaseline='middle';
  for(let i=0;i<=4;i++){const y=14+(h-44)*i/4;ctx.strokeStyle='#25475a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(34,y);ctx.lineTo(w-12,y);ctx.stroke();ctx.fillStyle='#8db4c8';ctx.fillText(String(100-i*25),5,y);}
  if(!result){ctx.fillStyle='#93b4c5';ctx.fillText('시뮬레이션을 실행하면 위험도 변화가 표시됩니다.',45,h/2);return;}
  const data=result.history;
  ctx.beginPath();data.forEach((p,i)=>{const x=35+(w-49)*i/(data.length-1),y=14+(h-44)*(1-p.risk/100);if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);});
  ctx.strokeStyle='#4ce6d0';ctx.lineWidth=3;ctx.stroke();
  const x=35+(w-49)*minute/(data.length-1);ctx.beginPath();ctx.moveTo(x,14);ctx.lineTo(x,h-30);ctx.strokeStyle='#ffca7c';ctx.lineWidth=1.4;ctx.stroke();
  ctx.fillStyle='#8db4c8';ctx.fillText('0분',35,h-12);ctx.fillText(`${data.length-1}분`,w-54,h-12);
}
function updateFrame(){
  const f=frame();$('timeLabel').textContent=`${f?.minute??minute}분`;
  $('risk').textContent=f?`${f.risk}/100`:'—';$('power').textContent=f?`${f.power}%`:'—';$('oxygen').textContent=f?`${f.oxygen}%`:'—';
  twin.setFrame(f);drawChart();
}
function render(){
  const d=result,diag=d.diagnosis;
  $('prediction').textContent=kinds[diag.predicted_incident]||diag.predicted_incident;
  $('diagnosisType').textContent=kinds[diag.predicted_incident]||diag.predicted_incident;
  $('confidence').textContent=`모델 출력 점수: ${(diag.confidence*100).toFixed(1)}% (실제 확률 아님)`;
  $('accuracy').textContent=`${(diag.evaluation.incident.accuracy*100).toFixed(1)}%`;
  $('samples').textContent=`합성 데이터 ${diag.evaluation.incident.samples}개 · 분리 테스트 ${diag.evaluation.incident.test_samples}개`;
  $('faultType').textContent=faults[diag.predicted_fault]||diag.predicted_fault;
  $('faultConfidence').textContent=`ML 점수 ${(diag.fault_confidence*100).toFixed(1)}% · 합성 테스트 정확도 ${(diag.evaluation.fault.accuracy*100).toFixed(1)}%`;
  $('warnings').textContent=diag.sensor_warnings.length?diag.sensor_warnings.join(' · '):'센서 일관성 규칙에서 별도 경고가 발견되지 않았습니다. 센서 정상임을 보증하지는 않습니다.';
  $('probs').innerHTML=Object.entries(diag.probabilities).map(([key,v])=>bar(kinds[key],v*100)).join('');
  $('recommended').textContent=strategies[d.recommendation.strategy]||d.recommendation.strategy;
  const max=Math.max(10,...d.comparison.map(x=>x.score));
  $('comparison').innerHTML=d.comparison.map(x=>bar(strategies[x.strategy],x.score,'점',max)).join('');
  $('sensorRows').innerHTML=Object.entries(d.sensor_observations.zones).map(([z,o])=>`<tr><td>${z} ${names[z]}</td>${['water','humidity','pressure','power'].map(k=>`<td class="${o[k]===null?'empty':''}">${o[k]===null?'누락':Number(o[k]).toFixed(1)+'%'}</td>`).join('')}</tr>`).join('');
  minute=d.history.length-1;$('timeline').max=minute;$('timeline').value=minute;
  $('timeline').disabled=false;$('play').disabled=false;$('reportBtn').disabled=false;updateFrame();
}
function stopPlay(){if(playTimer){clearInterval(playTimer);playTimer=null;}$('play').textContent='▶ 재생';}
$('timeline').addEventListener('input',e=>{minute=Number(e.target.value);updateFrame();});
$('play').addEventListener('click',()=>{
  if(playTimer){stopPlay();return;}if(!result)return;
  if(minute>=result.history.length-1)minute=0;
  $('play').textContent='■ 정지';playTimer=setInterval(()=>{
    minute=Math.min(minute+1,result.history.length-1);$('timeline').value=minute;updateFrame();
    if(minute===result.history.length-1)stopPlay();
  },650);
});
$('run').addEventListener('click',async()=>{
  clearError();stopPlay();$('run').disabled=true;$('state').textContent='● 모델 학습 및 계산 중';
  const scenario={incident:$('incident').value,origin:$('origin').value,strategy:$('strategy').value,
                  fault_mode:$('fault_mode').value,severity:Number($('severity').value),steps:Number($('steps').value)};
  try{
    const response=await fetch(`${API}/api/run`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(scenario)});
    if(!response.ok)throw Error(`서버 오류 HTTP ${response.status}`);
    result=await response.json();render();
    $('report').textContent='AI 진단 완료. 「보고서 생성」을 누르면 설명을 확인할 수 있습니다.';
    $('state').textContent='● 분석 완료';
  }catch(e){showError(`연결 실패: ${e.message}. Render 서버 주소와 CORS 설정을 확인하세요.`);$('state').textContent='● 오류';}
  finally{$('run').disabled=false;}
});
$('reportBtn').addEventListener('click',async()=>{
  if(!result)return;const btn=$('reportBtn');btn.disabled=true;$('report').textContent='보고서를 생성하는 중입니다…';
  try{
    const r=await fetch(`${API}/api/report`,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({scenario:result.scenario,diagnosis:result.diagnosis,comparison:result.comparison})});
    if(!r.ok)throw Error(`HTTP ${r.status}`);const data=await r.json();
    $('report').textContent=`${data.text}\n\n[보고서 방식: ${data.mode==='openrouter'?'OpenRouter LLM':'오프라인 요약'}]`;
  }catch(e){$('report').textContent=`보고서 생성 실패: ${e.message}`;}
  finally{btn.disabled=false;}
});
window.addEventListener('resize',drawChart);
updateFrame();
