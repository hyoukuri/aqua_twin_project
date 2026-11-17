import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

function makeLabel(value){
  const c=document.createElement('canvas');c.width=320;c.height=100;
  const ctx=c.getContext('2d');ctx.fillStyle='rgba(5,22,39,.94)';ctx.fillRect(0,0,320,100);
  ctx.strokeStyle='#397f91';ctx.lineWidth=4;ctx.strokeRect(2,2,316,96);
  ctx.fillStyle='#e1faff';ctx.font='bold 37px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(value,160,50);
  const tex=new THREE.CanvasTexture(c);const material=new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false});
  const sprite=new THREE.Sprite(material);sprite.scale.set(1.05,.33,1);return sprite;
}
export function createTwin(container,config,onSelect){
  let renderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}
  catch(e){container.textContent='WebGL을 사용할 수 없습니다. 브라우저에서 3D 가속을 활성화해 주세요.';return {setFrame(){},setSelected(){},dispose(){}};}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.8));
  renderer.setClearColor(0x071522,0);container.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x071523,.014);
  const camera=new THREE.PerspectiveCamera(46,1,.1,120);camera.position.set(13,25,30);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
  controls.target.set(11.6,0,3.1);controls.minDistance=8;controls.maxDistance=58;controls.maxPolarAngle=Math.PI*.49;
  scene.add(new THREE.AmbientLight(0xa3d3e5,1.7));
  const light=new THREE.DirectionalLight(0xc8fcff,2);light.position.set(5,18,10);scene.add(light);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(33,16),new THREE.MeshStandardMaterial({color:0x0a2b3e,transparent:true,opacity:.72,metalness:.2,roughness:.65}));
  floor.rotation.x=-Math.PI/2;floor.position.set(11.6,-.55,3.1);scene.add(floor);
  const grid=new THREE.GridHelper(34,34,0x1b5266,0x123447);grid.position.set(11.6,-.52,3.1);scene.add(grid);
  const roomMeshes={};const hitTargets=[];const pos={};
  for(const [id,room] of Object.entries(config.rooms))pos[id]=new THREE.Vector3(room.x,0,room.z);
  const pipeMat=new THREE.MeshStandardMaterial({color:0x2c6678,metalness:.7,roughness:.3,emissive:0x083c4b});
  for(const [a,b] of config.links){
    const start=pos[a].clone().setY(-.08),end=pos[b].clone().setY(-.08),dir=end.clone().sub(start);
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,dir.length(),8),pipeMat);
    mesh.position.copy(start).add(end).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());scene.add(mesh);
  }
  for(const [id,room] of Object.entries(config.rooms)){
    const group=new THREE.Group();group.position.copy(pos[id]);scene.add(group);
    const body=new THREE.Mesh(new THREE.BoxGeometry(1.04,.7,.92),new THREE.MeshPhysicalMaterial({color:0x24b6b7,metalness:.25,roughness:.35,transparent:true,opacity:.86}));
    body.userData.id=id;group.add(body);hitTargets.push(body);
    const edge=new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry),new THREE.LineBasicMaterial({color:0x87e9f0}));group.add(edge);
    const water=new THREE.Mesh(new THREE.BoxGeometry(.95,.02,.82),new THREE.MeshBasicMaterial({color:0x3a83ff,transparent:true,opacity:.7,depthWrite:false}));water.position.y=-.33;group.add(water);
    const led=new THREE.Mesh(new THREE.SphereGeometry(.09,8,8),new THREE.MeshBasicMaterial({color:0x5bf5c2}));led.position.set(.43,.28,-.39);group.add(led);
    const label=makeLabel(id.replace('B',''));label.position.y=.70;group.add(label);
    roomMeshes[id]={body,edge,water,led};
  }
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  function onClick(event){
    const r=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);
    raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(hitTargets);
    if(hits.length)onSelect(hits[0].object.userData.id);
  }
  renderer.domElement.addEventListener('click',onClick);
  function resize(){const w=Math.max(260,container.clientWidth),h=Math.max(290,container.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  let selected='B01-2';
  function setSelected(id){selected=id;for(const [rid,m] of Object.entries(roomMeshes))m.edge.material.color.setHex(rid===selected?0xffe68b:0x87e9f0);}
  function setFrame(frame){
    for(const [id,m] of Object.entries(roomMeshes)){
      const v=frame?.zones?.[id];const risk=v?.risk??0;const water=v?.water??0;
      m.body.material.color.setHex(risk>20?0xf04f72:risk>8?0xf4b75b:0x29bfc0);
      m.led.material.color.setHex(risk>20?0xff5a79:risk>8?0xffc45b:0x5bf5c2);
      const h=Math.max(.02,water/100*.66);m.water.scale.y=h/.02;m.water.position.y=-.34+h/2;
    }
  }
  let running=true,raf=0;
  function animate(){if(!running)return;raf=requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);}animate();
  setSelected(selected);
  return {setSelected,setFrame,dispose(){running=false;cancelAnimationFrame(raf);observer.disconnect();renderer.domElement.removeEventListener('click',onClick);controls.dispose();scene.traverse(o=>{o.geometry?.dispose();if(o.material){const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>{m.map?.dispose();m.dispose();});}});renderer.dispose();renderer.domElement.remove();}};
}
