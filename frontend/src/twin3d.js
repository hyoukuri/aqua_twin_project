import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const POS={A:[-3,-1.8],B:[0,-1.8],C:[3,-1.8],D:[-3,1.8],E:[0,1.8],F:[3,1.8]};
const LINKS=[['A','B'],['B','C'],['C','F'],['F','E'],['E','D'],['D','A'],['B','E']];
const LABELS={A:'관제실',B:'연구실',C:'전력실',D:'거주실',E:'생명유지실',F:'비상설비실'};

function textSprite(text){
  const c=document.createElement('canvas');c.width=512;c.height=128;
  const ctx=c.getContext('2d');ctx.fillStyle='rgba(5,20,36,.88)';ctx.fillRect(4,8,504,112);
  ctx.strokeStyle='#4de8dd';ctx.lineWidth=3;ctx.strokeRect(5,9,502,110);
  ctx.fillStyle='#e4fcff';ctx.font='bold 38px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,64);
  const tex=new THREE.CanvasTexture(c);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));
  sprite.scale.set(2.05,.52,1);return sprite;
}
export function createTwin(container,onSelect){
  let renderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}
  catch(e){container.textContent='3D 가속을 사용할 수 없습니다. 브라우저의 WebGL 설정을 확인하세요.';return {setFrame(){},setOrigin(){}};}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.setClearColor(0x061727,0);
  container.appendChild(renderer.domElement);
  const scene=new THREE.Scene();
  scene.fog=new THREE.FogExp2(0x071d30,.016);
  const camera=new THREE.PerspectiveCamera(42,1,.1,100);
  camera.position.set(8.7,10.7,11.7);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.minDistance=7;controls.maxDistance=26;controls.maxPolarAngle=Math.PI*.49;
  controls.target.set(0,.1,0);
  scene.add(new THREE.AmbientLight(0x98cfe9,1.35));
  const light=new THREE.DirectionalLight(0xb1f8ff,2.0);light.position.set(2,9,5);scene.add(light);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(16,12),new THREE.MeshStandardMaterial({color:0x0b2d43,transparent:true,opacity:.72,metalness:.2,roughness:.5}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-.76;scene.add(ground);
  const grid=new THREE.GridHelper(16,16,0x1b6374,0x123b52);grid.position.y=-.74;scene.add(grid);
  for(const [a,b] of LINKS){
    const p=new THREE.Vector3(POS[a][0],-.18,POS[a][1]);const q=new THREE.Vector3(POS[b][0],-.18,POS[b][1]);
    const d=new THREE.Vector3().subVectors(q,p);const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.095,.095,d.length(),10),new THREE.MeshStandardMaterial({color:0x23657b,metalness:.65,roughness:.28,emissive:0x083c50}));
    pipe.position.copy(p).add(q).multiplyScalar(.5);pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());scene.add(pipe);
  }
  const pick=[];const rooms={};let origin='B';
  for(const [id,[x,z]] of Object.entries(POS)){
    const group=new THREE.Group();group.position.set(x,0,z);scene.add(group);
    const body=new THREE.Mesh(new THREE.BoxGeometry(2.1,1.1,2.15),new THREE.MeshPhysicalMaterial({color:0x1c9f9d,transparent:true,opacity:.65,metalness:.32,roughness:.27,depthWrite:false}));
    body.userData.zone=id;group.add(body);pick.push(body);
    const outline=new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry),new THREE.LineBasicMaterial({color:0x7bfbf0,transparent:true,opacity:.65}));group.add(outline);
    const water=new THREE.Mesh(new THREE.BoxGeometry(1.94,.01,1.98),new THREE.MeshBasicMaterial({color:0x2c88ff,transparent:true,opacity:.68,depthWrite:false}));
    water.position.y=-.53;group.add(water);
    const label=textSprite(`${id}  ${LABELS[id]}`);label.position.set(0,1.08,0);group.add(label);
    const led=new THREE.Mesh(new THREE.SphereGeometry(.10,12,10),new THREE.MeshBasicMaterial({color:0x52efbb}));led.position.set(.88,.45,-.90);group.add(led);
    rooms[id]={body,outline,water,led};
  }
  const ray=new THREE.Raycaster();const pointer=new THREE.Vector2();
  function click(ev){
    const rect=renderer.domElement.getBoundingClientRect();
    pointer.x=((ev.clientX-rect.left)/rect.width)*2-1;pointer.y=-((ev.clientY-rect.top)/rect.height)*2+1;
    ray.setFromCamera(pointer,camera);const hits=ray.intersectObjects(pick);
    if(hits.length)onSelect(hits[0].object.userData.zone);
  }
  renderer.domElement.addEventListener('click',click);
  function resize(){const w=Math.max(container.clientWidth,240),h=Math.max(container.clientHeight,260);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  new ResizeObserver(resize).observe(container);resize();
  function setOrigin(value){origin=value;for(const [id,r] of Object.entries(rooms)){r.outline.material.color.setHex(id===origin?0xffd477:0x7bfbf0);r.outline.material.opacity=id===origin?1:.65;}}
  function setFrame(frame){
    for(const [id,r] of Object.entries(rooms)){
      const v=frame?.zones?.[id];const water=v?.water||0;const power=v?.power??100;
      const color=water>30||power<50?0xff687d:water>12||power<80?0xffc76d:0x31cfb6;
      r.body.material.color.setHex(color);r.led.material.color.setHex(power<50?0xff687d:power<80?0xffc76d:0x55f1bd);
      const height=Math.max(.012,1.04*water/100);r.water.scale.y=height/.01;r.water.position.y=-.54+height/2;
    }
  }
  setOrigin(origin);setFrame(null);
  function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);}animate();
  return {setFrame,setOrigin};
}
