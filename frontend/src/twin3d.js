import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Lightweight procedural habitat model. No remote assets, so Vercel needs no model hosting.
const OCEAN=0x092636, AQUA=0x38d8d2, AMBER=0xffc46c, RED=0xff607e;
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
  renderer.toneMappingExposure=1.38;
  renderer.setClearColor(OCEAN,1);container.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color(OCEAN);
  scene.fog=new THREE.FogExp2(0x103e50,.009);
  const camera=new THREE.PerspectiveCamera(44,1,.1,180);camera.position.set(20,29,37);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=5;controls.maxDistance=76;
  controls.maxPolarAngle=Math.PI*.485;controls.target.set(0,0,0);
  const homeTarget=new THREE.Vector3(0,0,0),targetPosition=new THREE.Vector3();
  let focusing=false;
  scene.add(new THREE.HemisphereLight(0xb3f3ff,0x153043,2.65));
  const key=new THREE.DirectionalLight(0xe0fbff,3.2);key.position.set(-13,26,19);scene.add(key);
  const fill=new THREE.DirectionalLight(0x35b9cf,1.7);fill.position.set(24,12,-21);scene.add(fill);
  // Uneven seabed, not a CAD grid. A faint platform grid is drawn above it.
  const terrainGeo=new THREE.PlaneGeometry(49,43,70,58);
  terrainGeo.rotateX(-Math.PI/2);
  const attr=terrainGeo.attributes.position;
  for(let i=0;i<attr.count;i++){
    const x=attr.getX(i),z=attr.getZ(i);
    attr.setY(i,-1.25+Math.sin(x*.48)*.14+Math.cos(z*.55)*.11+Math.sin((x+z)*.28)*.12);
  }
  terrainGeo.computeVertexNormals();
  mesh(terrainGeo,mat(0x163a46,.03,.96),scene,0,0,0);
  const guide=new THREE.GridHelper(45,45,0x366575,0x204758);
  guide.position.set(0,-.93,0);guide.material.transparent=true;guide.material.opacity=.15;scene.add(guide);
  const rockMat=mat(0x294650,.08,.95), rockGeo=new THREE.DodecahedronGeometry(1,0);
  for(let i=0;i<85;i++){
    const x=-25+rand(i*13+1)*50,z=-22+rand(i*13+2)*44;
    if(Math.hypot(x/1.2,z/1.0)<17)continue;
    const rock=mesh(rockGeo,rockMat,scene,x,-1.1,z);const size=.18+rand(i*13+3)*.55;
    rock.scale.set(size,size*(.45+rand(i*13+4)*.5),size);rock.rotation.y=rand(i*13+5)*6.28;
  }
  // Sparse suspended particles create a sense of depth without heavy post-processing.
  const count=185,particlePositions=new Float32Array(count*3);
  for(let i=0;i<count;i++){
    particlePositions[i*3]=-26+rand(i*3+300)*52;
    particlePositions[i*3+1]=rand(i*3+301)*13;
    particlePositions[i*3+2]=-23+rand(i*3+302)*46;
  }
  const particleGeo=new THREE.BufferGeometry();particleGeo.setAttribute('position',new THREE.BufferAttribute(particlePositions,3));
  const particles=new THREE.Points(particleGeo,new THREE.PointsMaterial({color:0x75d5e7,size:.055,transparent:true,opacity:.19,depthWrite:false}));scene.add(particles);
  const hullMat=mat(0x3b7385,.78,.31),trimMat=mat(0x91b8c3,.82,.23),darkMat=mat(0x183449,.68,.36);
  const glassMat=new THREE.MeshPhysicalMaterial({color:0x4dd3e8,metalness:.2,roughness:.12,transparent:true,opacity:.80,emissive:0x155269,emissiveIntensity:.48});
  const conduitMat=mat(0x476c79,.75,.3),floorMat=mat(0x1a4051,.45,.55);
  const safeMat=new THREE.MeshStandardMaterial({color:AQUA,emissive:0x0b9e99,emissiveIntensity:.85,metalness:.2,roughness:.3});
  const pos={},modules={},hits=[],buildings={};
  for(const [id,r] of Object.entries(config.rooms))pos[id]=new THREE.Vector3(r.x,0,r.z);
  // Main walkways and structural conduits follow backend topology exactly.
  for(const [a,b] of config.links){
    if(!pos[a]||!pos[b])continue;
    const p1=pos[a].clone().setY(-.32),p2=pos[b].clone().setY(-.32);
    tube(scene,p1,p2,.29,conduitMat,14);
    tube(scene,p1.clone().add(new THREE.Vector3(0,.21,0)),p2.clone().add(new THREE.Vector3(0,.21,0)),.105,glassMat,12);
    tube(scene,p1.clone().add(new THREE.Vector3(0,-.22,0)),p2.clone().add(new THREE.Vector3(0,-.22,0)),.05,darkMat,8);
  }
  // The central command campus sits on a broad illuminated service platform.
  const campus=new THREE.Group();scene.add(campus);
  mesh(new THREE.CylinderGeometry(5.45,5.70,.23,64),mat(0x183f4f,.72,.40),campus,0,-.94,0);
  const perimeter=mesh(new THREE.TorusGeometry(5.39,.08,10,96),new THREE.MeshBasicMaterial({color:0x48b8c2,transparent:true,opacity:.60}),campus,0,-.78,0);
  perimeter.rotation.x=Math.PI/2;
  for(let i=0;i<16;i++){
    const a=i*Math.PI/8;
    mesh(new THREE.BoxGeometry(.28,.13,.50),mat(i%4===0?0x73c8d2:0x3e8291,.5,.4),campus,Math.cos(a)*5.12,-.74,Math.sin(a)*5.12).rotation.y=-a;
  }
  // Radial dock pads provide a clear architectural hierarchy even at a distance.
  for(let i=1;i<10;i++){
    const a=2*Math.PI*(i-1)/9-Math.PI/2;
    const cx=14.2*Math.cos(a),cz=11.4*Math.sin(a);
    const pad=mesh(new THREE.CylinderGeometry(3.15,3.32,.17,40),mat(0x1a3e4c,.58,.55),scene,cx,-.89,cz);
    const rim=mesh(new THREE.TorusGeometry(3.10,.048,7,52),new THREE.MeshBasicMaterial({color:0x367c89,transparent:true,opacity:.55}),scene,cx,-.79,cz);
    rim.rotation.x=Math.PI/2;
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
    if(kind==='command' && variant===2){
      // Monumental central hub: genuinely larger than all satellite buildings.
      // All parts share the command room selection ID, so incident interaction works.
      const hubBase=mesh(new THREE.CylinderGeometry(2.18,2.44,.55,40),darkMat,g,0,-.46,0);
      const deck=mesh(new THREE.CylinderGeometry(2.00,2.15,.19,40),trimMat,g,0,-.11,0);
      const plinth=mesh(new THREE.CylinderGeometry(1.65,1.85,.98,36),hullMat,g,0,.40,0);
      const glassBand=mesh(new THREE.CylinderGeometry(1.57,1.65,.36,36),glassMat,g,0,1.09,0);
      const upper=mesh(new THREE.CylinderGeometry(1.25,1.50,.98,36),hullMat,g,0,1.74,0);
      const crown=mesh(new THREE.SphereGeometry(1.23,36,18,0,Math.PI*2,0,Math.PI/2),glassMat,g,0,2.24,0);
      const topRing=mesh(new THREE.TorusGeometry(1.31,.10,10,48),trimMat,g,0,2.24,0);topRing.rotation.x=Math.PI/2;
      const observatory=mesh(new THREE.CylinderGeometry(.48,.68,.34,24),darkMat,g,0,3.20,0);
      mesh(new THREE.CylinderGeometry(.07,.09,1.15,12),trimMat,g,0,3.88,0);
      const beaconTop=mesh(new THREE.SphereGeometry(.17,16,12),new THREE.MeshBasicMaterial({color:0x6df6ee}),g,0,4.49,0);
      for(let k=0;k<12;k++){
        const angle=k*Math.PI/6;
        const strut=mesh(new THREE.BoxGeometry(.16,1.45,.19),trimMat,g,Math.cos(angle)*1.54,.63,Math.sin(angle)*1.54);
        strut.rotation.y=-angle;
        const window=mesh(new THREE.BoxGeometry(.37,.25,.08),glassMat,g,Math.sin(angle)*1.72,.50,Math.cos(angle)*1.72);
        window.rotation.y=angle;
      }
      for(const h of [0.16,1.33,2.30]){
        const ring=mesh(new THREE.TorusGeometry(h>2?1.30:h>1?1.56:2.03,.045,8,64),glassMat,g,0,h,0);
        ring.rotation.x=Math.PI/2;
      }
      for(const part of [hubBase,deck,plinth,glassBand,upper,crown,observatory,beaconTop]){
        part.userData.room=id;hits.push(part);
      }
      body=plinth;
    }else if(kind==='power'||kind==='utility'){
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
    if(kind==='comms'||(kind==='command'&&variant!==2)){
      mesh(new THREE.CylinderGeometry(.032,.045,.66,8),trimMat,g,0,.96,0);
      const dish=mesh(new THREE.ConeGeometry(.24,.14,12),glassMat,g,0,1.25,0);dish.rotation.x=Math.PI;
    }else if(kind==='lab'){
      mesh(new THREE.SphereGeometry(.23,12,8),glassMat,g,0,.78,0);
    }else if(kind==='hangar'){
      mesh(new THREE.BoxGeometry(.45,.12,.3),darkMat,g,0,.48,0);
    }
    // Status rim is independent per room, never recolor the whole structure.
    const statusMat=safeMat.clone();statusMaterials.push(statusMat);
    const isHub=kind==='command'&&variant===2;
    const status=mesh(new THREE.TorusGeometry(isHub?2.38:.74,isHub?.065:.047,8,56),statusMat,g,0,isHub?-.72:-.39,0);status.rotation.x=Math.PI/2;
    const beacon=mesh(new THREE.SphereGeometry(.09,10,8),statusMat,g,.5,.62,.45);
    const water=mesh(new THREE.CylinderGeometry(.51,.51,.018,20),new THREE.MeshBasicMaterial({color:0x298fe8,transparent:true,opacity:.62,depthWrite:false}),g,0,-.38,0);
    const selection=mesh(new THREE.TorusGeometry(isHub?2.60:.97,.055,8,56),new THREE.MeshBasicMaterial({color:0xffd685,transparent:true,opacity:0,depthWrite:false}),g,0,-.48,0);selection.rotation.x=Math.PI/2;selection.position.y=isHub?-.73:-.48;
    const alarm=mesh(new THREE.RingGeometry(isHub?2.62:.98,isHub?2.80:1.11,48),new THREE.MeshBasicMaterial({color:RED,side:THREE.DoubleSide,transparent:true,opacity:0,depthWrite:false}),g,0,-.47,0);alarm.rotation.x=-Math.PI/2;alarm.position.y=isHub?-.71:-.47;
    // Incident column provides spatial location cues without a full-screen effect.
    const beam=mesh(new THREE.CylinderGeometry(.08,isHub?1.1:.42,isHub?4.2:2.7,16,1,true),new THREE.MeshBasicMaterial({color:0xffb65e,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}),g,0,isHub?3.5:1.5,0);
    const beaconLight=new THREE.PointLight(0xffa962,0,isHub?8:3.2,2);beaconLight.position.set(0,isHub?3.2:1.0,0);g.add(beaconLight);
    modules[id]={g,status,beacon,water,selection,alarm,beam,beaconLight,statusMat,halo,body,risk:0};
    if(variant===2){
      const tag=label(r.building_id,true);tag.position.set(0,isHub?5.25:2.20,0);g.add(tag);
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
      m.beam.material.opacity=active?.14:preview&&frameMinute===null?.07:0;
      m.beaconLight.intensity=active?1.0:0;
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
  const resetCamera=()=>{focusing=false;controls.target.copy(homeTarget);camera.position.set(20,29,37);controls.update();};
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
      const focusCamera=targetPosition.clone().add(new THREE.Vector3(5.4,9.5,11.0));
      camera.position.lerp(focusCamera,.045);
      if(controls.target.distanceTo(targetPosition)<.035&&camera.position.distanceTo(focusCamera)<.08)focusing=false;
    }
    for(const [id,m] of Object.entries(modules)){
      const active=frameMinute!==null&&events.some(e=>e.room===id&&frameMinute>=e.start&&frameMinute<e.start+e.duration);
      if(active){m.alarm.material.opacity=.23+.22*(.5+.5*Math.sin(elapsed*5));
        m.beam.material.opacity=.11+.08*(.5+.5*Math.sin(elapsed*3.7));
        m.beaconLight.intensity=.8+.5*Math.sin(elapsed*4);
      }
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
