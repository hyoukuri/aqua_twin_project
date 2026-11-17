import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Lightweight procedural habitat model. No remote assets, so Vercel needs no model hosting.
const OCEAN=0x061522, AQUA=0x38d8d2, AMBER=0xffc46c, RED=0xff607e;
const rand=(n)=>{const x=Math.sin(n*127.1+78.233)*43758.5453;return x-Math.floor(x);};
const mat=(color,metalness=.45,roughness=.42,emissive=0x000000,emissiveIntensity=.15)=>new THREE.MeshStandardMaterial({color,metalness,roughness,emissive,emissiveIntensity});
function mesh(geometry,material,parent,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);parent.add(m);return m;}
function tube(parent,a,b,r,material,segments=10){
  const delta=new THREE.Vector3().subVectors(b,a);
  const m=mesh(new THREE.CylinderGeometry(r,r,delta.length(),segments),material,parent);
  m.position.copy(a).add(b).multiplyScalar(.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;
}
function label(text,small=false){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
  const c=canvas.getContext('2d');c.fillStyle='rgba(5,21,36,.92)';c.beginPath();c.roundRect(8,8,496,112,24);c.fill();
  c.strokeStyle='#3c8c9c';c.lineWidth=4;c.stroke();c.fillStyle='#e6fbff';
  c.font=`${small?'600 49':'700 56'}px sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(text,256,67,475);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));
  s.scale.set(small?1.8:2.15,small?.45:.54,1);return s;
}
export function createTwin(container,config,onSelect){
  let renderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}
  catch(e){container.textContent='WebGL 3D를 사용할 수 없습니다. 브라우저 하드웨어 가속을 확인해 주세요.';return {setFrame(){},setSelected(){},setScenario(){},reset(){},dispose(){}};}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.65));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.22;
  renderer.setClearColor(OCEAN,1);container.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color(OCEAN);
  scene.fog=new THREE.FogExp2(0x082537,.019);
  const camera=new THREE.PerspectiveCamera(43,1,.1,160);camera.position.set(14,24,33);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=6;controls.maxDistance=70;
  controls.maxPolarAngle=Math.PI*.485;controls.target.set(11.6,0,3.1);
  const homeTarget=new THREE.Vector3(11.6,0,3.1),targetPosition=new THREE.Vector3();
  let focusing=false;
  scene.add(new THREE.HemisphereLight(0x7bd7ee,0x102538,2.25));
  const key=new THREE.DirectionalLight(0xd6f6ff,2.8);key.position.set(-9,22,13);scene.add(key);
  const fill=new THREE.DirectionalLight(0x1d9dbb,1.2);fill.position.set(22,9,-16);scene.add(fill);
  // Uneven seabed, not a CAD grid. A faint platform grid is drawn above it.
  const terrainGeo=new THREE.PlaneGeometry(45,26,65,36);
  terrainGeo.rotateX(-Math.PI/2);
  const attr=terrainGeo.attributes.position;
  for(let i=0;i<attr.count;i++){
    const x=attr.getX(i),z=attr.getZ(i);
    attr.setY(i,-1.25+Math.sin(x*.48)*.14+Math.cos(z*.55)*.11+Math.sin((x+z)*.28)*.12);
  }
  terrainGeo.computeVertexNormals();
  mesh(terrainGeo,mat(0x102c38,.03,.95),scene,11.6,0,3.1);
  const guide=new THREE.GridHelper(37,37,0x265364,0x173b4b);
  guide.position.set(11.6,-.93,3.1);guide.material.transparent=true;guide.material.opacity=.29;scene.add(guide);
  const rockMat=mat(0x294650,.08,.95), rockGeo=new THREE.DodecahedronGeometry(1,0);
  for(let i=0;i<85;i++){
    const x=-8+rand(i*13+1)*40,z=-8+rand(i*13+2)*23;
    if(x>-2&&x<27&&z>-2&&z<10)continue;
    const rock=mesh(rockGeo,rockMat,scene,x,-1.1,z);const size=.18+rand(i*13+3)*.55;
    rock.scale.set(size,size*(.45+rand(i*13+4)*.5),size);rock.rotation.y=rand(i*13+5)*6.28;
  }
  // Sparse suspended particles create a sense of depth without heavy post-processing.
  const count=260,particlePositions=new Float32Array(count*3);
  for(let i=0;i<count;i++){
    particlePositions[i*3]=-9+rand(i*3+300)*42;
    particlePositions[i*3+1]=rand(i*3+301)*13;
    particlePositions[i*3+2]=-10+rand(i*3+302)*25;
  }
  const particleGeo=new THREE.BufferGeometry();particleGeo.setAttribute('position',new THREE.BufferAttribute(particlePositions,3));
  const particles=new THREE.Points(particleGeo,new THREE.PointsMaterial({color:0x75d5e7,size:.055,transparent:true,opacity:.33,depthWrite:false}));scene.add(particles);
  const hullMat=mat(0x39768a,.75,.33),trimMat=mat(0x7da6b4,.8,.25),darkMat=mat(0x152e42,.64,.35);
  const glassMat=new THREE.MeshPhysicalMaterial({color:0x4dd3e8,metalness:.2,roughness:.12,transparent:true,opacity:.78,emissive:0x155269,emissiveIntensity:.35});
  const conduitMat=mat(0x476c79,.75,.3),floorMat=mat(0x1a4051,.45,.55);
  const safeMat=new THREE.MeshStandardMaterial({color:AQUA,emissive:0x0b9e99,emissiveIntensity:.85,metalness:.2,roughness:.3});
  const pos={},modules={},hits=[],buildings={};
  for(const [id,r] of Object.entries(config.rooms))pos[id]=new THREE.Vector3(r.x,0,r.z);
  // Main walkways and structural conduits follow backend topology exactly.
  for(const [a,b] of config.links){
    if(!pos[a]||!pos[b])continue;
    const p1=pos[a].clone().setY(-.32),p2=pos[b].clone().setY(-.32);
    tube(scene,p1,p2,.20,conduitMat,12);
    tube(scene,p1.clone().add(new THREE.Vector3(0,.17,0)),p2.clone().add(new THREE.Vector3(0,.17,0)),.085,glassMat,10);
    tube(scene,p1.clone().add(new THREE.Vector3(0,-.22,0)),p2.clone().add(new THREE.Vector3(0,-.22,0)),.05,darkMat,8);
  }
  const buildingKinds=['command','lab','power','habitat','life','medical','hangar','utility','comms','emergency'];
  const statusMaterials=[];
  for(const [id,r] of Object.entries(config.rooms)){
    const buildingIndex=Math.max(0,Math.min(9,Number(r.building_id.slice(1))-1));
    const kind=buildingKinds[buildingIndex];const variant=Number(id.split('-')[1]);
    const g=new THREE.Group();g.position.copy(pos[id]);scene.add(g);
    // Raised foundation and segmented illuminated outer safety rail.
    mesh(new THREE.CylinderGeometry(.92,.98,.18,24),floorMat,g,0,-.67,0);
    mesh(new THREE.CylinderGeometry(.79,.85,.14,24),darkMat,g,0,-.52,0);
    const haloMat=new THREE.MeshBasicMaterial({color:0x2c99a6,transparent:true,opacity:.22,depthWrite:false});
    const halo=mesh(new THREE.TorusGeometry(.91,.025,6,40),haloMat,g,0,-.56,0);halo.rotation.x=Math.PI/2;
    for(let i=0;i<4;i++){
      const angle=i*Math.PI/2;
      mesh(new THREE.CylinderGeometry(.065,.075,.45,8),trimMat,g,Math.cos(angle)*.72,-.72,Math.sin(angle)*.72);
    }
    // Distinct silhouette by building type: dome, cylindrical, reactor, antenna, hangar.
    let body;
    if(kind==='power'||kind==='utility'){
      body=mesh(new THREE.CylinderGeometry(.56,.67,.88,16),hullMat,g,0,.05,0);
      mesh(new THREE.CylinderGeometry(.32,.48,.3,16),darkMat,g,0,.64,0);
      const ring=mesh(new THREE.TorusGeometry(.43,.055,8,28),glassMat,g,0,.35,0);ring.rotation.x=Math.PI/2;
      for(let j=0;j<3;j++)mesh(new THREE.BoxGeometry(.13,.45,.13),trimMat,g,Math.cos(j*2.09)*.59,.03,Math.sin(j*2.09)*.59);
    }else if(kind==='habitat'||kind==='medical'||kind==='life'){
      body=mesh(new THREE.CylinderGeometry(.61,.63,.52,20),hullMat,g,0,-.11,0);
      const dome=mesh(new THREE.SphereGeometry(.61,20,12,0,Math.PI*2,0,Math.PI/2),glassMat,g,0,.15,0);
      dome.userData.room=id;hits.push(dome);
      const ring=mesh(new THREE.TorusGeometry(.61,.055,8,32),trimMat,g,0,.15,0);ring.rotation.x=Math.PI/2;
    }else if(kind==='hangar'){
      body=mesh(new THREE.BoxGeometry(1.22,.65,1.05),hullMat,g,0,-.05,0);
      mesh(new THREE.BoxGeometry(1.28,.12,1.10),trimMat,g,0,.33,0);
      mesh(new THREE.BoxGeometry(.85,.37,.07),glassMat,g,0,-.07,.54);
    }else{
      body=mesh(new THREE.CylinderGeometry(.56,.62,.83,16),hullMat,g,0,.03,0);
      const cap=mesh(new THREE.SphereGeometry(.55,16,10,0,Math.PI*2,0,Math.PI/2),darkMat,g,0,.42,0);
      cap.userData.room=id;hits.push(cap);
      for(let j=0;j<5;j++){
        const angle=j*Math.PI*2/5;
        const window=mesh(new THREE.BoxGeometry(.25,.15,.055),glassMat,g,Math.sin(angle)*.565,.12,Math.cos(angle)*.565);
        window.rotation.y=angle;
      }
    }
    // Restrained facility-specific hues avoid the uniform toy-block appearance.
    const hullPalette=[0x4c8796,0x407987,0x687c92,0x4a8190,0x438d87,0x60899a,0x5a7c94,0x687e82,0x3c7f95,0x647b96];
    body.material=hullMat.clone();body.material.color.setHex(hullPalette[buildingIndex]);
    body.userData.room=id;hits.push(body);
    // Decorative building-specific tops make groups recognizable at a glance.
    if(kind==='comms'||kind==='command'){
      mesh(new THREE.CylinderGeometry(.032,.045,.66,8),trimMat,g,0,.96,0);
      const dish=mesh(new THREE.ConeGeometry(.24,.14,12),glassMat,g,0,1.25,0);dish.rotation.x=Math.PI;
    }else if(kind==='lab'){
      mesh(new THREE.SphereGeometry(.23,12,8),glassMat,g,0,.78,0);
    }else if(kind==='hangar'){
      mesh(new THREE.BoxGeometry(.45,.12,.3),darkMat,g,0,.48,0);
    }
    // Status rim is independent per room, never recolor the whole structure.
    const statusMat=safeMat.clone();statusMaterials.push(statusMat);
    const status=mesh(new THREE.TorusGeometry(.74,.047,8,36),statusMat,g,0,-.39,0);status.rotation.x=Math.PI/2;
    const beacon=mesh(new THREE.SphereGeometry(.09,10,8),statusMat,g,.5,.62,.45);
    const water=mesh(new THREE.CylinderGeometry(.51,.51,.018,20),new THREE.MeshBasicMaterial({color:0x298fe8,transparent:true,opacity:.62,depthWrite:false}),g,0,-.38,0);
    const selection=mesh(new THREE.TorusGeometry(.97,.045,8,48),new THREE.MeshBasicMaterial({color:0xffd685,transparent:true,opacity:0,depthWrite:false}),g,0,-.48,0);selection.rotation.x=Math.PI/2;
    const alarm=mesh(new THREE.RingGeometry(.98,1.11,40),new THREE.MeshBasicMaterial({color:RED,side:THREE.DoubleSide,transparent:true,opacity:0,depthWrite:false}),g,0,-.47,0);alarm.rotation.x=-Math.PI/2;
    modules[id]={g,status,beacon,water,selection,alarm,statusMat,halo,body,risk:0};
    if(variant===2){
      const tag=label(r.building_id,true);tag.position.set(0,2.05,0);g.add(tag);
      buildings[r.building_id]=g;
    }
  }
  // Highlight prospective incident sites in the preview, without advancing the simulation.
  let events=[],selected='B01-2',frameMinute=null,raf=0,running=true,elapsed=0;
  function updateVisuals(){
    for(const [id,m] of Object.entries(modules)){
      const preview=events.some(e=>e.room===id);
      const active=frameMinute!==null&&events.some(e=>e.room===id&&frameMinute>=e.start&&frameMinute<e.start+e.duration);
      const risk=m.risk;
      const color=risk>=20?RED:risk>=8?AMBER:preview&&frameMinute===null?AMBER:AQUA;
      m.statusMat.color.setHex(color);
      m.statusMat.emissive.setHex(risk>=20?0xe13558:risk>=8||preview&&frameMinute===null?0xb27a24:0x0b9e99);
      m.alarm.material.opacity=active?.32:risk>=20?.18:preview&&frameMinute===null?.15:0;
    }
  }
  function setScenario(next){events=Array.isArray(next)?next:[];frameMinute=null;for(const m of Object.values(modules)){m.risk=0;m.water.scale.y=1;m.water.position.y=-.38;}updateVisuals();}
  function setFrame(frame){
    frameMinute=Number.isFinite(frame?.minute)?frame.minute:null;
    for(const [id,m] of Object.entries(modules)){
      const v=frame?.zones?.[id];m.risk=Number(v?.risk)||0;
      const h=Math.max(.018,Math.min(.62,(Number(v?.water)||0)/100*.62));
      m.water.scale.y=h/.018;m.water.position.y=-.38+h/2;
    }
    updateVisuals();
  }
  function setSelected(id){
    if(!modules[id])return;
    selected=id;
    for(const [rid,m] of Object.entries(modules))m.selection.material.opacity=rid===selected?.96:0;
    targetPosition.copy(pos[id]);focusing=true;
  }
  function onPointer(event){
    const bounds=renderer.domElement.getBoundingClientRect();
    const mouse=new THREE.Vector2((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);
    const ray=new THREE.Raycaster();ray.setFromCamera(mouse,camera);
    const hit=ray.intersectObjects(hits,false)[0];if(hit?.object?.userData?.room)onSelect(hit.object.userData.room);
  }
  let startX=0,startY=0;
  const down=e=>{startX=e.clientX;startY=e.clientY;};
  const up=e=>{if(Math.hypot(e.clientX-startX,e.clientY-startY)<5)onPointer(e);};
  renderer.domElement.addEventListener('pointerdown',down);
  renderer.domElement.addEventListener('pointerup',up);
  controls.addEventListener('start',()=>{focusing=false;});
  const resetCamera=()=>{focusing=false;controls.target.copy(homeTarget);camera.position.set(14,24,33);controls.update();};
  // Double click empty space to return to whole-base view.
  renderer.domElement.addEventListener('dblclick',resetCamera);
  function resize(){const w=Math.max(280,container.clientWidth),h=Math.max(280,container.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  const clock=new THREE.Clock();
  function animate(){
    if(!running)return;raf=requestAnimationFrame(animate);
    elapsed+=Math.min(clock.getDelta(),.05);
    particles.position.y=Math.sin(elapsed*.2)*.11;
    if(focusing){
      controls.target.lerp(targetPosition,.055);
      const focusCamera=targetPosition.clone().add(new THREE.Vector3(4.8,8.8,10.5));
      camera.position.lerp(focusCamera,.045);
      if(controls.target.distanceTo(targetPosition)<.035&&camera.position.distanceTo(focusCamera)<.08)focusing=false;
    }
    for(const [id,m] of Object.entries(modules)){
      const active=frameMinute!==null&&events.some(e=>e.room===id&&frameMinute>=e.start&&frameMinute<e.start+e.duration);
      if(active)m.alarm.material.opacity=.23+.22*(.5+.5*Math.sin(elapsed*5));
      if(id===selected)m.selection.material.opacity=.65+.30*(.5+.5*Math.sin(elapsed*2.5));
    }
    controls.update();renderer.render(scene,camera);
  }
  updateVisuals();animate();
  return {setSelected,setFrame,setScenario,reset:resetCamera,dispose(){
    running=false;cancelAnimationFrame(raf);observer.disconnect();
    renderer.domElement.removeEventListener('pointerdown',down);
    renderer.domElement.removeEventListener('pointerup',up);
    renderer.domElement.removeEventListener('dblclick',resetCamera);
    controls.dispose();
    scene.traverse(obj=>{obj.geometry?.dispose();const ms=Array.isArray(obj.material)?obj.material:[obj.material];for(const m of ms){if(m){m.map?.dispose();m.dispose();}}});
    renderer.dispose();renderer.domElement.remove();
  }};
}
