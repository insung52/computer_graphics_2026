/*
* Sea 의 geometry 를 vertex shader 에서 변형 시키기

 - original 변형 처럼 부드러운 변형

 - 변형으로 인한 hole 발생 안 시키도록 처리 (uv 좌표계 유지)



* 비행기 조정 (asdw 키 이용)

 - quaternion 의 slerp 사용

 - 키가 눌릴 때마다, target position(300 거리) ？ rotation(PI/1.5) 설정, target pose 로 부드러운 이동



* 비행기 뒤쪽 3인칭 게임용 카메라

 - up vector 유지

 - position 은 비행기의 위치를 따라 이동
*/

import * as THREE from 'three';
//import { BufferGeometryUtils } from 'addons/utils/BufferGeometryUtils.js';
import { mergeVertices } from 'addons/utils/BufferGeometryUtils.js';
// CG:0513
import { OrbitControls } from 'addons/controls/OrbitControls.js'

var sky,coinsHolder, ennemiesHolder,particlesHolder;
//import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';/
//mport * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
//COLORS
var Colors = {
    red:0xf25346,
    white:0xd8d0d1,
    brown:0x59332e,
    brownDark:0x23190f,
    pink:0xF5986E,
    yellow:0xf4ce93,
    blue:0x68c3c0,

};

///////////////

// GAME VARIABLES
var game;
var deltaTime = 0;
var newTime = new Date().getTime();
var oldTime = new Date().getTime();
var ennemiesPool = [];
var particlesPool = [];
var particlesInUse = [];


function resetGame(){
  game = {speed:0,
          initSpeed:.00035,
          baseSpeed:.00035,
          targetBaseSpeed:.00035,
          incrementSpeedByTime:.0000025,
          incrementSpeedByLevel:.000005,
          distanceForSpeedUpdate:100,
          speedLastUpdate:0,

          distance:0,
          ratioSpeedDistance:50,
          energy:100,
          ratioSpeedEnergy:3,

          level:1,
          levelLastUpdate:0,
          distanceForLevelUpdate:1000,

          planeDefaultHeight:100,
          planeAmpHeight:80,
          planeAmpWidth:75,
          planeMoveSensivity:0.005,
          planeRotXSensivity:0.0008,
          planeRotZSensivity:0.0004,
          planeFallSpeed:.001,
          planeMinSpeed:1.2,
          planeMaxSpeed:1.6,
          planeSpeed:0,
          planeCollisionDisplacementX:0,
          planeCollisionSpeedX:0,

          planeCollisionDisplacementY:0,
          planeCollisionSpeedY:0,

          seaRadius:600,
          seaLength:800,
          //seaRotationSpeed:0.006,
          wavesMinAmp : 5,
          wavesMaxAmp : 20,
          wavesMinSpeed : 0.001,
          wavesMaxSpeed : 0.003,

          cameraFarPos:500,
          cameraNearPos:150,
          cameraSensivity:0.002,

          coinDistanceTolerance:15,
          coinValue:3,
          coinsSpeed:.5,
          coinLastSpawn:0,
          distanceForCoinsSpawn:100,

          ennemyDistanceTolerance:10,
          ennemyValue:10,
          ennemiesSpeed:.6,
          ennemyLastSpawn:0,
          distanceForEnnemiesSpawn:50,

          status : "playing",
         };
  fieldLevel.innerHTML = Math.floor(game.level);
}

//THREEJS RELATED VARIABLES

var scene,
    camera, fieldOfView, aspectRatio, nearPlane, farPlane,
    renderer,
    container,
    controls;

//SCREEN & MOUSE VARIABLES

var HEIGHT, WIDTH,
    mousePos = { x: 0, y: 0 };

//INIT THREE JS, SCREEN AND MOUSE EVENTS

function createScene() {

  HEIGHT = window.innerHeight;
  WIDTH = window.innerWidth;

  scene = new THREE.Scene();
  aspectRatio = WIDTH / HEIGHT;
  fieldOfView = 50;
  nearPlane = .1;
  farPlane = 10000;
  camera = new THREE.PerspectiveCamera(
    fieldOfView,
    aspectRatio,
    nearPlane,
    farPlane
    );
  //scene.fog = new THREE.Fog(0xf7d9aa, 100,950);
  camera.position.x = -700;
  camera.position.z = 0;
  camera.position.y = 0;

  camera.up.set(0, 1, 0);
  camera.lookAt(new THREE.Vector3(0, 0, 0));

  
  scene.add(camera);

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(WIDTH, HEIGHT);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 부드러운 그림자

  // CG:0513
 
  controls = new OrbitControls( camera, renderer.domElement );
  controls.target.set( 0, 0.5, 0 );
  controls.update();
  controls.enablePan = false;
  controls.enableDamping = true;
  

  container = document.getElementById('world');
  container.appendChild(renderer.domElement);

  window.addEventListener('resize', handleWindowResize, false);

  /*
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.minPolarAngle = -Math.PI / 2;
  controls.maxPolarAngle = Math.PI ;

  //controls.noZoom = true;
  //controls.noPan = true;
  //*/
}

// MOUSE AND SCREEN EVENTS

function handleWindowResize() {
  HEIGHT = window.innerHeight;
  WIDTH = window.innerWidth;
  renderer.setSize(WIDTH, HEIGHT);
  renderer.setViewport(0, 0, WIDTH, HEIGHT);
  //renderer.setScissor(WIDTH/2, HEIGHT/2, WIDTH, HEIGHT);
  //renderer.setScissorTest(true);
  camera.aspect = WIDTH / HEIGHT;
  camera.updateProjectionMatrix();
}

function handleMouseMove(event) {
  var tx = -1 + (event.clientX / WIDTH)*2;
  var ty = 1 - (event.clientY / HEIGHT)*2;
  mousePos = {x:tx, y:ty};
}

function handleTouchMove(event) {
    event.preventDefault();
    var tx = -1 + (event.touches[0].pageX / WIDTH)*2;
    var ty = 1 - (event.touches[0].pageY / HEIGHT)*2;
    mousePos = {x:tx, y:ty};
}

function handleMouseUp(event){
  if (game.status == "waitingReplay"){
    resetGame();
    hideReplay();
  }
}


function handleTouchEnd(event){
  if (game.status == "waitingReplay"){
    resetGame();
    hideReplay();
  }
}

// LIGHTS

var ambientLight, hemisphereLight, shadowLight;

function createLights() {

  hemisphereLight = new THREE.HemisphereLight(0xaaaaaa,0x000000, .9)

  ambientLight = new THREE.AmbientLight(0xdc8874, 1);

  shadowLight = new THREE.DirectionalLight(0xffffff, 5.9);
  shadowLight.position.set(150, 350, 350);
  shadowLight.castShadow = true;
  shadowLight.shadow.camera.left = -400;
  shadowLight.shadow.camera.right = 400;
  shadowLight.shadow.camera.top = 400;
  shadowLight.shadow.camera.bottom = -400;
  shadowLight.shadow.camera.near = 1;
  shadowLight.shadow.camera.far = 1000;
  shadowLight.shadow.mapSize.width = 4096;
  shadowLight.shadow.mapSize.height = 4096;

  var ch = new THREE.CameraHelper(shadowLight.shadow.camera);

  //조명 세팅
//  hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);

  //scene.add(ch);
  scene.add(hemisphereLight);
  scene.add(shadowLight);
  scene.add(ambientLight);

  const axesHelper = new THREE.AxesHelper(200);
  scene.add(axesHelper);

}


var Pilot = function(){
  this.mesh = new THREE.Object3D();
  this.mesh.name = "pilot";
  this.angleHairs=0;

  var bodyGeom = new THREE.BoxGeometry(15,15,15);
  var bodyMat = new THREE.MeshPhongMaterial({color:Colors.brown, flatShading: true});
  var body = new THREE.Mesh(bodyGeom, bodyMat);
  body.position.set(2,-12,0);

  this.mesh.add(body);

  var faceGeom = new THREE.BoxGeometry(10,10,10);
  var faceMat = new THREE.MeshLambertMaterial({color:Colors.pink});
  var face = new THREE.Mesh(faceGeom, faceMat);
  this.mesh.add(face);

  var hairGeom = new THREE.BoxGeometry(4, 4, 4);
  hairGeom = hairGeom.translate(0, 2, 0); // 꼭 먼저 translate 해줘야 함
  
  var hairMat = new THREE.MeshLambertMaterial({ color: Colors.brown });
  var hair = new THREE.Mesh(hairGeom, hairMat);

  var hairs = new THREE.Object3D();

  this.hairsTop = new THREE.Object3D();

  for (let i = 0; i < 12; i++) {
    const h = hair.clone();
    const col = i % 3;
    const row = Math.floor(i / 3);
    const startPosZ = -4;
    const startPosX = -4;
  
    h.position.set(startPosX + row * 4, 0, startPosZ + col * 4);
  
    // mesh 단위에서 스케일 조절
    h.scale.set(1, 1 + Math.random() * 0.5, 1);
  
    this.hairsTop.add(h);
  }


  hairs.add(this.hairsTop);

  var hairSideGeom = new THREE.BoxGeometry(12,4,2);
  hairSideGeom.translate(-6, 0, 0);
  var hairSideR = new THREE.Mesh(hairSideGeom, hairMat);
  var hairSideL = hairSideR.clone();
  hairSideR.position.set(8,-2,6);
  hairSideL.position.set(8,-2,-6);
  hairs.add(hairSideR);
  hairs.add(hairSideL);

  var hairBackGeom = new THREE.BoxGeometry(2,8,10);
  var hairBack = new THREE.Mesh(hairBackGeom, hairMat);
  hairBack.position.set(-1,-4,0)
  hairs.add(hairBack);
  hairs.position.set(-5,5,0);

  this.mesh.add(hairs);

  var glassGeom = new THREE.BoxGeometry(5,5,5);
  var glassMat = new THREE.MeshLambertMaterial({color:Colors.brown});
  var glassR = new THREE.Mesh(glassGeom,glassMat);
  glassR.position.set(6,0,3);
  var glassL = glassR.clone();
  glassL.position.z = -glassR.position.z

  var glassAGeom = new THREE.BoxGeometry(11,1,11);
  var glassA = new THREE.Mesh(glassAGeom, glassMat);
  this.mesh.add(glassR);
  this.mesh.add(glassL);
  this.mesh.add(glassA);

  var earGeom = new THREE.BoxGeometry(2,3,2);
  var earL = new THREE.Mesh(earGeom,faceMat);
  earL.position.set(0,0,-6);
  var earR = earL.clone();
  earR.position.set(0,0,6);
  this.mesh.add(earL);
  this.mesh.add(earR);
}

Pilot.prototype.updateHairs = function(){
  //*
   var hairs = this.hairsTop.children;

   var l = hairs.length;
   for (var i=0; i<l; i++){
      var h = hairs[i];
      h.scale.y = .75 + Math.cos(this.angleHairs+i/3)*.25;
   }
  this.angleHairs += game.speed*deltaTime*40;
  //*/
}

// CG:0513
let delta_variation = 0;
let my_uniforms = {
  'my_color': { value: new THREE.Vector3( 1, 0, 0 ) },
  'wavesMinAmp' : {value: 5.0},
  'wavesMaxAmp' : {value: 40.0},  // sea 를 회전시키면 버텍스 움직임이 잘 안보여서 값 높게 설정
  'time': {value: 0.0}
  //'fogColor': { value: new THREE.Vector3( 0, 0, 0 ) },
  //'time': { value: 1.0 },
  //'uvScale': { value: new THREE.Vector2( 3.0, 1.0 ) },
  //'texture1': { value: cloudTexture },
  //'texture2': { value: lavaTexture }

};

let my_vtxShader = `
    //uniform mat4 modelViewMatrix;
    //uniform mat4 projectionMatrix;
    //attribute vec3 position;
    //attribute vec2 uv;
    uniform float time;
    uniform float wavesMinAmp;
    uniform float wavesMaxAmp;
    varying vec2 vUv;
    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }
    void main()
    {
      vUv = uv;
      float ang = random(uv) * 3.14f * 2.f + time;  //시간에 따라 증가
      float amp = wavesMinAmp + random(uv) *  (wavesMaxAmp - wavesMinAmp);
      vec3 pos_new;
      pos_new.x = position.x + cos(ang) * amp;
      pos_new.y = position.y + sin(ang) * amp;
      pos_new.z = position.z;
      vec4 mvPosition = modelViewMatrix * vec4( pos_new, 1.0 );
      gl_Position = projectionMatrix * mvPosition;
    }
`;

let my_fragShader = `
    uniform vec3 my_color;
    varying vec2 vUv;

    void main()
    {
      //gl_FragColor = vec4(my_color,1);
      gl_FragColor = vec4(vUv, 1, 0.9);
    }
`;

const my_material = new THREE.ShaderMaterial( {

  uniforms: my_uniforms,
  vertexShader: my_vtxShader,
  fragmentShader: my_fragShader,
  transparent: true,    //반투명 메터리얼 사용

} );

var AirPlane = function(){
  
this.mesh = new THREE.Object3D();
this.mesh.name = "airPlane";

// Cabin
var geomCabin = new THREE.BoxGeometry(80, 50, 50, 1, 1, 1);
const pos = geomCabin.attributes.position.array;
var matCabin = new THREE.MeshPhongMaterial({color:Colors.red, flatShading: true});

// 수정하려는 정점 인덱스 예시 (주의: 박스 geometry의 정점 배치는 좀 복잡함)
// CG:0513
pos[4 * 3 + 1]-=10.0;
pos[4 * 3 + 2]+=20.0;
pos[5 * 3 + 1]-=10.0;
pos[5 * 3 + 2]-=20.0;
pos[6 * 3 + 1]+=30.0;
pos[6 * 3 + 2]+=20.0;
pos[7 * 3 + 1]+=30.0;
pos[7 * 3 + 2]-=20.0;
pos[8 * 3 + 1]-=10.0;
pos[8 * 3 + 2]+=20.0;
pos[10 * 3 + 1]-=10.0;
pos[10 * 3 + 2]-=20.0;
pos[12 * 3 + 1]+=30.0;
pos[12 * 3 + 2]-=20.0;
pos[14 * 3 + 1]+=30.0;
pos[14 * 3 + 2]+=20.0;
pos[16 * 3 + 1]-=10.0;
pos[16 * 3 + 2]-=20.0;
pos[18 * 3 + 1]+=30.0;
pos[18 * 3 + 2]-=20.0;
pos[21 * 3 + 1]-=10.0;
pos[21 * 3 + 2]+=20.0;
pos[23 * 3 + 1]+=30.0;
pos[23 * 3 + 2]+=20.0;

  var cabin = new THREE.Mesh(geomCabin, matCabin);
  cabin.castShadow = true;
  cabin.receiveShadow = true;
  this.mesh.add(cabin);

  // Engine

  var geomEngine = new THREE.BoxGeometry(20,50,50,1,1,1);
  var matEngine = new THREE.MeshPhongMaterial({color:Colors.white, flatShading: true});
  var engine = new THREE.Mesh(geomEngine, matEngine);
  engine.position.x = 50;
  engine.castShadow = true;
  engine.receiveShadow = true;
  this.mesh.add(engine);

  // Tail Plane

  var geomTailPlane = new THREE.BoxGeometry(15,20,5,1,1,1);
  var matTailPlane = new THREE.MeshPhongMaterial({color:Colors.red, flatShading: true});
  var tailPlane = new THREE.Mesh(geomTailPlane, matTailPlane);
  tailPlane.position.set(-40,20,0);
  tailPlane.castShadow = true;
  tailPlane.receiveShadow = true;
  this.mesh.add(tailPlane);

  // Wings

  var geomSideWing = new THREE.BoxGeometry(30,5,120,1,1,1);
  var matSideWing = new THREE.MeshPhongMaterial({color:Colors.red, flatShading: true});
  var sideWing = new THREE.Mesh(geomSideWing, matSideWing);
  sideWing.position.set(0,15,0);
  sideWing.castShadow = true;
  sideWing.receiveShadow = true;
  this.mesh.add(sideWing);

  var geomWindshield = new THREE.BoxGeometry(3,15,20,1,1,1);
  var matWindshield = new THREE.MeshPhongMaterial({color:Colors.white,transparent:true, opacity:.3, flatShading: true});;
  var windshield = new THREE.Mesh(geomWindshield, matWindshield);
  windshield.position.set(5,27,0);

  windshield.castShadow = true;
  windshield.receiveShadow = true;

  this.mesh.add(windshield);

const geomPropeller = new THREE.BoxGeometry(20, 10, 10, 1, 1, 1);
const posp = geomPropeller.attributes.position.array;

// 각 정점은 x, y, z 순서로 배열에 들어있어 → 인덱스는 정점번호 * 3 + 오프셋(x=0, y=1, z=2)
posp[4 * 3 + 1] -= 5; // vertex 4 y
posp[4 * 3 + 2] += 5; // vertex 4 z

posp[5 * 3 + 1] -= 5;
posp[5 * 3 + 2] -= 5;

posp[6 * 3 + 1] += 5;
posp[6 * 3 + 2] += 5;

posp[7 * 3 + 1] += 5;
posp[7 * 3 + 2] -= 5;

geomPropeller.attributes.position.needsUpdate = true;

var matPropeller = new THREE.MeshPhongMaterial({color:Colors.brown, flatShading: true});
this.propeller = new THREE.Mesh(geomPropeller, matPropeller);

this.propeller.castShadow = true;
this.propeller.receiveShadow = true;

var geomBlade = new THREE.BoxGeometry(1,80,10,1,1,1);
var matBlade = new THREE.MeshPhongMaterial({color:Colors.brownDark, flatShading: true});
var blade1 = new THREE.Mesh(geomBlade, matBlade);
blade1.position.set(8,0,0);

blade1.castShadow = true;
blade1.receiveShadow = true;

var blade2 = blade1.clone();
blade2.rotation.x = Math.PI/2;

blade2.castShadow = true;
blade2.receiveShadow = true;

this.propeller.add(blade1);
this.propeller.add(blade2);
this.propeller.position.set(60,0,0);
this.mesh.add(this.propeller);

var wheelProtecGeom = new THREE.BoxGeometry(30,15,10,1,1,1);
var wheelProtecMat = new THREE.MeshPhongMaterial({color:Colors.red, flatShading: true});
var wheelProtecR = new THREE.Mesh(wheelProtecGeom,wheelProtecMat);
wheelProtecR.position.set(25,-20,25);
this.mesh.add(wheelProtecR);

var wheelTireGeom = new THREE.BoxGeometry(24,24,4);
var wheelTireMat = new THREE.MeshPhongMaterial({color:Colors.brownDark, flatShading: true});
var wheelTireR = new THREE.Mesh(wheelTireGeom,wheelTireMat);
wheelTireR.position.set(25,-28,25);

var wheelAxisGeom = new THREE.BoxGeometry(10,10,6);
var wheelAxisMat = new THREE.MeshPhongMaterial({color:Colors.brown, flatShading: true});
var wheelAxis = new THREE.Mesh(wheelAxisGeom,wheelAxisMat);
wheelTireR.add(wheelAxis);

  this.mesh.add(wheelTireR);

  var wheelProtecL = wheelProtecR.clone();
  wheelProtecL.position.z = -wheelProtecR.position.z ;
  this.mesh.add(wheelProtecL);

  var wheelTireL = wheelTireR.clone();
  wheelTireL.position.z = -wheelTireR.position.z;
  this.mesh.add(wheelTireL);

  var wheelTireB = wheelTireR.clone();
  wheelTireB.scale.set(.5,.5,.5);
  wheelTireB.position.set(-35,-5,0);
  this.mesh.add(wheelTireB);

  var suspensionGeom = new THREE.BoxGeometry(4, 20, 4);
  suspensionGeom = suspensionGeom.translate(0, 10, 0);
  
  var suspensionMat = new THREE.MeshPhongMaterial({color: Colors.red, flatShading: true});
  var suspension = new THREE.Mesh(suspensionGeom, suspensionMat);
  suspension.position.set(-35, -5, 0);
  suspension.rotation.z = -0.3;
  this.mesh.add(suspension);

  

  this.pilot = new Pilot();
  this.pilot.mesh.position.set(-10,27,0);
  this.mesh.add(this.pilot.mesh);


  this.mesh.castShadow = true;
  this.mesh.receiveShadow = true;

};

function Sky(){
  this.mesh = new THREE.Object3D();
  this.nClouds = 20;
  this.clouds = [];
  var stepAngle = Math.PI*2 / this.nClouds;
  for(var i=0; i<this.nClouds; i++){
    var c = new Cloud();
    this.clouds.push(c);
    var a = stepAngle*i;
    var h = game.seaRadius + 150 + Math.random()*200;
    c.mesh.position.y = Math.sin(a)*h;
    c.mesh.position.x = Math.cos(a)*h;
    c.mesh.position.z = -300-Math.random()*500;
    c.mesh.rotation.z = a + Math.PI/2;
    var s = 1+Math.random()*2;
    c.mesh.scale.set(s,s,s);
    this.mesh.add(c.mesh);
  }
}

Sky.prototype.moveClouds = function(){
  for(var i=0; i<this.nClouds; i++){
    var c = this.clouds[i];
    c.rotate();
  }
  this.mesh.rotation.z += game.speed*deltaTime;

}

function Sea(){
  // 기본 geometry 생성
  let geom = new THREE.CylinderGeometry(game.seaRadius, game.seaRadius, game.seaLength, 40, 10);
  geom.rotateX(-Math.PI / 2);
  // mergeVertices 적용 (복사해서 새 geometry 생성)

  // 기존 코드
  // geom = mergeVertices(geom);

  // 오차 범위 명시
  geom = mergeVertices(geom,2.1);

  const posAttr = geom.attributes.position;
  const vertexCount = posAttr.count;
/* 기존 코드
  this.waves = [];
  for (let i = 0; i < vertexCount; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    this.waves.push({
      x,
      y,
      z,
      ang: Math.random() * Math.PI * 2,
      amp: game.wavesMinAmp + Math.random() * (game.wavesMaxAmp - game.wavesMinAmp),
      speed: game.wavesMinSpeed + Math.random() * (game.wavesMaxSpeed - game.wavesMinSpeed)
    });
  }

  const mat = new THREE.MeshPhongMaterial({
    color: Colors.blue,
    transparent: true,
    opacity: 0.8,
    flatShading: true
  });
*/
  // CG:0513
  this.mesh = new THREE.Mesh(geom, my_material);
  this.mesh.name = "waves";
  this.mesh.receiveShadow = true;
}

Sea.prototype.moveWaves = function () {
  // CG:0513
  my_uniforms.time.value = performance.now()*0.003;
  //console.log(my_uniforms.time.value);
  return;
}



function Cloud(){
  this.mesh = new THREE.Object3D();
  this.mesh.name = "cloud";
//  var geom = new THREE.CubeGeometry(20,20,20);
  var geom = new THREE.BoxGeometry(20,20,20);
  var mat = new THREE.MeshPhongMaterial({
    color:Colors.white,

  });

  //*
  var nBlocs = 3+Math.floor(Math.random()*3);
  for (var i=0; i<nBlocs; i++ ){
    var m = new THREE.Mesh(geom.clone(), mat);
    m.position.x = i*15;
    m.position.y = Math.random()*10;
    m.position.z = Math.random()*10;
    m.rotation.z = Math.random()*Math.PI*2;
    m.rotation.y = Math.random()*Math.PI*2;
    var s = .1 + Math.random()*.9;
    m.scale.set(s,s,s);
    this.mesh.add(m);
    m.castShadow = true;
    m.receiveShadow = true;

  }
  //*/
}

Cloud.prototype.rotate = function(){
  var l = this.mesh.children.length;
  for(var i=0; i<l; i++){
    var m = this.mesh.children[i];
    m.rotation.z+= Math.random()*.005*(i+1);
    m.rotation.y+= Math.random()*.002*(i+1);
  }
}

function Ennemy(){
  var geom = new THREE.TetrahedronGeometry(8,2);
  var mat = new THREE.MeshPhongMaterial({
    color:Colors.red,
    shininess:0,
    specular:0xffffff,
    //shading:THREE.FlatShading
    flatShading: true
    
  });
  this.mesh = new THREE.Mesh(geom,mat);
  this.mesh.castShadow = true;
  this.angle = 0;
  this.dist = 0;
}

function EnnemiesHolder(){
  this.mesh = new THREE.Object3D();
  this.ennemiesInUse = [];
}

EnnemiesHolder.prototype.spawnEnnemies = function(){
  var nEnnemies = game.level;

  for (var i=0; i<nEnnemies; i++){
    var ennemy;
    if (ennemiesPool.length) {
      ennemy = ennemiesPool.pop();
    }else{
      ennemy = new Ennemy();
    }

    ennemy.angle = - (i*0.1);
    ennemy.distance = game.seaRadius + game.planeDefaultHeight + (-1 + Math.random() * 2) * (game.planeAmpHeight-20);
    ennemy.mesh.position.y = -game.seaRadius + Math.sin(ennemy.angle)*ennemy.distance;
    ennemy.mesh.position.x = Math.cos(ennemy.angle)*ennemy.distance;

    this.mesh.add(ennemy.mesh);
    this.ennemiesInUse.push(ennemy);
  }
}

EnnemiesHolder.prototype.rotateEnnemies = function(){
  for (var i=0; i<this.ennemiesInUse.length; i++){
    var ennemy = this.ennemiesInUse[i];
    ennemy.angle += game.speed*deltaTime*game.ennemiesSpeed;

    if (ennemy.angle > Math.PI*2) ennemy.angle -= Math.PI*2;

    ennemy.mesh.position.y = -game.seaRadius + Math.sin(ennemy.angle)*ennemy.distance;
    ennemy.mesh.position.x = Math.cos(ennemy.angle)*ennemy.distance;
    ennemy.mesh.rotation.z += Math.random()*.1;
    ennemy.mesh.rotation.y += Math.random()*.1;

    //var globalEnnemyPosition =  ennemy.mesh.localToWorld(new THREE.Vector3());
    var diffPos = airplane.mesh.position.clone().sub(ennemy.mesh.position.clone());
    var d = diffPos.length();
    if (d<game.ennemyDistanceTolerance){
      particlesHolder.spawnParticles(ennemy.mesh.position.clone(), 15, Colors.red, 3);

      ennemiesPool.unshift(this.ennemiesInUse.splice(i,1)[0]);
      this.mesh.remove(ennemy.mesh);
      game.planeCollisionSpeedX = 100 * diffPos.x / d;
      game.planeCollisionSpeedY = 100 * diffPos.y / d;
      ambientLight.intensity = 2;

      removeEnergy();
      i--;
    }else if (ennemy.angle > Math.PI){
      ennemiesPool.unshift(this.ennemiesInUse.splice(i,1)[0]);
      this.mesh.remove(ennemy.mesh);
      i--;
    }
  }
}

function Particle(){
  var geom = new THREE.TetrahedronGeometry(3,0);
  var mat = new THREE.MeshPhongMaterial({
    color:0x009999,
    shininess:0,
    specular:0xffffff,
    //shading:THREE.FlatShading
    flatShading: true
  });
  this.mesh = new THREE.Mesh(geom,mat);
}

Particle.prototype.explode = function(pos, color, scale){
  var _this = this;
  var _p = this.mesh.parent;
  this.mesh.material.color = new THREE.Color( color);
  this.mesh.material.needsUpdate = true;
  this.mesh.scale.set(scale, scale, scale);
  var targetX = pos.x + (-1 + Math.random()*2)*50;
  var targetY = pos.y + (-1 + Math.random()*2)*50;
  var speed = .6+Math.random()*.2;
  TweenMax.to(this.mesh.rotation, speed, {x:Math.random()*12, y:Math.random()*12});
  TweenMax.to(this.mesh.scale, speed, {x:.1, y:.1, z:.1});
  TweenMax.to(this.mesh.position, speed, {x:targetX, y:targetY, delay:Math.random() *.1, ease:Power2.easeOut, onComplete:function(){
      if(_p) _p.remove(_this.mesh);
      _this.mesh.scale.set(1,1,1);
      particlesPool.unshift(_this);
    }});
}

function ParticlesHolder(){
  this.mesh = new THREE.Object3D();
  this.particlesInUse = [];
}

ParticlesHolder.prototype.spawnParticles = function(pos, density, color, scale){

  var nPArticles = density;
  for (var i=0; i<nPArticles; i++){
    var particle;
    if (particlesPool.length) {
      particle = particlesPool.pop();
    }else{
      particle = new Particle();
    }
    this.mesh.add(particle.mesh);
    particle.mesh.visible = true;
    var _this = this;
    particle.mesh.position.y = pos.y;
    particle.mesh.position.x = pos.x;
    particle.explode(pos,color, scale);
  }
}

function Coin(){
  var geom = new THREE.TetrahedronGeometry(5,0);
  var mat = new THREE.MeshPhongMaterial({
    color:0x009999,
    shininess:0,
    specular:0xffffff,

 //   shading:THREE.FlatShading
    flatShading: true
  });
  this.mesh = new THREE.Mesh(geom,mat);
  this.mesh.castShadow = true;
  this.angle = 0;
  this.dist = 0;
}

function CoinsHolder(nCoins){
  this.mesh = new THREE.Object3D();
  this.coinsInUse = [];
  this.coinsPool = [];
  for (var i=0; i<nCoins; i++){
    var coin = new Coin();
    this.coinsPool.push(coin);
  }
}

CoinsHolder.prototype.spawnCoins = function(){

  var nCoins = 1 + Math.floor(Math.random()*10);
  var d = game.seaRadius + game.planeDefaultHeight + (-1 + Math.random() * 2) * (game.planeAmpHeight-20);
  var amplitude = 10 + Math.round(Math.random()*10);
  for (var i=0; i<nCoins; i++){
    var coin;
    if (this.coinsPool.length) {
      coin = this.coinsPool.pop();
    }else{
      coin = new Coin();
    }
    this.mesh.add(coin.mesh);
    this.coinsInUse.push(coin);
    coin.angle = - (i*0.02);
    coin.distance = d + Math.cos(i*.5)*amplitude;
    coin.mesh.position.y = -game.seaRadius + Math.sin(coin.angle)*coin.distance;
    coin.mesh.position.x = Math.cos(coin.angle)*coin.distance;
  }
}

CoinsHolder.prototype.rotateCoins = function(){
  for (var i=0; i<this.coinsInUse.length; i++){
    var coin = this.coinsInUse[i];
    if (coin.exploding) continue;
    coin.angle += game.speed*deltaTime*game.coinsSpeed;
    if (coin.angle>Math.PI*2) coin.angle -= Math.PI*2;
    coin.mesh.position.y = -game.seaRadius + Math.sin(coin.angle)*coin.distance;
    coin.mesh.position.x = Math.cos(coin.angle)*coin.distance;
    coin.mesh.rotation.z += Math.random()*.1;
    coin.mesh.rotation.y += Math.random()*.1;

    //var globalCoinPosition =  coin.mesh.localToWorld(new THREE.Vector3());
    var diffPos = airplane.mesh.position.clone().sub(coin.mesh.position.clone());
    var d = diffPos.length();
    if (d<game.coinDistanceTolerance){
      this.coinsPool.unshift(this.coinsInUse.splice(i,1)[0]);
      this.mesh.remove(coin.mesh);
      particlesHolder.spawnParticles(coin.mesh.position.clone(), 5, 0x009999, .8);
      addEnergy();
      i--;
    }else if (coin.angle > Math.PI){
      this.coinsPool.unshift(this.coinsInUse.splice(i,1)[0]);
      this.mesh.remove(coin.mesh);
      i--;
    }
  }
}


// 3D Models
var sea;
var airplane;
var plane_box;
var gray_sphere;

function createPlane(){
  const planeGeometry = new THREE.BoxGeometry(1, 1, 1);
  const blackMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
  plane_box = new THREE.Mesh(planeGeometry, blackMaterial);
  plane_box.position.y = game.planeDefaultHeight;
  scene.add(plane_box);

  airplane = new AirPlane();
  airplane.mesh.scale.set(.25,.25,.25);
  //airplane.mesh.position.y = game.planeDefaultHeight;
  plane_box.add(airplane.mesh);
  //camera.lookAt(new THREE.Vector3(1000,0,0));
  plane_box.add(camera);
  //airplane.mesh.add(camera);

  const gray_sphere_Geometry = new THREE.SphereGeometry(2, 32, 32);
  const gray_Material = new THREE.MeshStandardMaterial({ color: 0x808080 });
  gray_sphere = new THREE.Mesh(gray_sphere_Geometry,gray_Material);
  gray_sphere.position.y = game.planeDefaultHeight;
  //gray_sphere.position.z = 100;
  scene.add(gray_sphere);
}

function createSea(){
  sea = new Sea();
  sea.mesh.position.y = -game.seaRadius;
  scene.add(sea.mesh);
}

function createSky(){
  sky = new Sky();
  sky.mesh.position.y = -game.seaRadius;
  scene.add(sky.mesh);
}

function createCoins(){

  coinsHolder = new CoinsHolder(20);
  scene.add(coinsHolder.mesh)
}

function createEnnemies(){
  for (var i=0; i<10; i++){
    var ennemy = new Ennemy();
    ennemiesPool.push(ennemy);
  }
  ennemiesHolder = new EnnemiesHolder();
  scene.add(ennemiesHolder.mesh)
}

function createParticles(){
  for (var i=0; i<10; i++){
    var particle = new Particle();
    particlesPool.push(particle);
  }
  particlesHolder = new ParticlesHolder();
  scene.add(particlesHolder.mesh)
}

function loop(){
  gamesystem();
  newTime = new Date().getTime();
  deltaTime = newTime-oldTime;
  oldTime = newTime;

  if (game.status=="playing"){

    // Add energy coins every 100m;
    if (Math.floor(game.distance)%game.distanceForCoinsSpawn == 0 && Math.floor(game.distance) > game.coinLastSpawn){
      game.coinLastSpawn = Math.floor(game.distance);
      coinsHolder.spawnCoins();
    }

    if (Math.floor(game.distance)%game.distanceForSpeedUpdate == 0 && Math.floor(game.distance) > game.speedLastUpdate){
      game.speedLastUpdate = Math.floor(game.distance);
      game.targetBaseSpeed += game.incrementSpeedByTime*deltaTime;
    }


    if (Math.floor(game.distance)%game.distanceForEnnemiesSpawn == 0 && Math.floor(game.distance) > game.ennemyLastSpawn){
      game.ennemyLastSpawn = Math.floor(game.distance);
      ennemiesHolder.spawnEnnemies();
    }

    if (Math.floor(game.distance)%game.distanceForLevelUpdate == 0 && Math.floor(game.distance) > game.levelLastUpdate){
      game.levelLastUpdate = Math.floor(game.distance);
      game.level++;
      fieldLevel.innerHTML = Math.floor(game.level);

      game.targetBaseSpeed = game.initSpeed + game.incrementSpeedByLevel*game.level
    }


    updatePlane();
    updateDistance();
    updateEnergy();
    game.baseSpeed += (game.targetBaseSpeed - game.baseSpeed) * deltaTime * 0.02;

    //CG:0513
    game.speed = game.baseSpeed * game.planeSpeed;

  }else if(game.status=="gameover"){
    game.speed *= .99;
    airplane.mesh.rotation.z += (-Math.PI/2 - airplane.mesh.rotation.z)*.0002*deltaTime;
    airplane.mesh.rotation.x += 0.0003*deltaTime;
    game.planeFallSpeed *= 1.05;
    airplane.mesh.position.y -= game.planeFallSpeed*deltaTime;

    if (airplane.mesh.position.y <-200){
      showReplay();
      game.status = "waitingReplay";

    }
  }else if (game.status=="waitingReplay"){

  }


  airplane.propeller.rotation.x +=.2 + game.planeSpeed * deltaTime*.005;
  sea.mesh.rotation.z += game.speed*deltaTime;//*game.seaRotationSpeed;

  if ( sea.mesh.rotation.z > 2*Math.PI)  sea.mesh.rotation.z -= 2*Math.PI;

  ambientLight.intensity += (.5 - ambientLight.intensity)*deltaTime*0.005;

  coinsHolder.rotateCoins();
  ennemiesHolder.rotateEnnemies();

  sky.moveClouds();
  sea.moveWaves();

  //조명 세팅
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function updateDistance(){
  game.distance += game.speed*deltaTime*game.ratioSpeedDistance;
  fieldDistance.innerHTML = Math.floor(game.distance);
  var d = 502*(1-(game.distance%game.distanceForLevelUpdate)/game.distanceForLevelUpdate);
  levelCircle.setAttribute("stroke-dashoffset", d);

}



var blinkEnergy=false;

function updateEnergy(){
  game.energy -= game.speed*deltaTime*game.ratioSpeedEnergy;
  game.energy = Math.max(0, game.energy);
  energyBar.style.right = (100-game.energy)+"%";
  energyBar.style.backgroundColor = (game.energy<50)? "#f25346" : "#68c3c0";

  if (game.energy<30){
    energyBar.style.animationName = "blinking";
  }else{
    energyBar.style.animationName = "none";
  }

  if (game.energy <1){
    game.status = "gameover";
  }
}

function addEnergy(){
  game.energy += game.coinValue;
  game.energy = Math.min(game.energy, 100);
}

function removeEnergy(){
  game.energy -= game.ennemyValue;
  game.energy = Math.max(0, game.energy);
}


var rotate_speed = 100;
var rotate_time = 0;
var rotate_quat;

function updatePlane(){
  //airplane.mesh.rotateX(0.01);
  game.planeSpeed = normalize(mousePos.x,-.5,.5,game.planeMinSpeed, game.planeMaxSpeed);
  var targetY = normalize(mousePos.y,-.75,.75,game.planeDefaultHeight-game.planeAmpHeight, game.planeDefaultHeight+game.planeAmpHeight);
  var targetX = normalize(mousePos.x,-1,1,-game.planeAmpWidth*.7, -game.planeAmpWidth);

  game.planeCollisionDisplacementX += game.planeCollisionSpeedX;
  targetX += game.planeCollisionDisplacementX;


  game.planeCollisionDisplacementY += game.planeCollisionSpeedY;
  targetY += game.planeCollisionDisplacementY;

  // CG:0513
  //airplane.mesh.position.y += (targetY-airplane.mesh.position.y)*deltaTime*game.planeMoveSensivity;
  //airplane.mesh.position.x += (targetX-airplane.mesh.position.x)*deltaTime*game.planeMoveSensivity;
  //airplane.mesh.rotation.z = (targetY-airplane.mesh.position.y)*deltaTime*game.planeRotXSensivity;
  //airplane.mesh.rotation.x = (airplane.mesh.position.y-targetY)*deltaTime*game.planeRotZSensivity;

  var targetCameraZ = normalize(game.planeSpeed, game.planeMinSpeed, game.planeMaxSpeed, game.cameraNearPos, game.cameraFarPos);
  //camera.fov = normalize(mousePos.x,-1,1,40, 80);
  //camera.updateProjectionMatrix ()
  //camera.position.y += (airplane.mesh.position.y - camera.position.y)*deltaTime*game.cameraSensivity;

  game.planeCollisionSpeedX += (0-game.planeCollisionSpeedX)*deltaTime * 0.03;
  game.planeCollisionDisplacementX += (0-game.planeCollisionDisplacementX)*deltaTime *0.01;
  game.planeCollisionSpeedY += (0-game.planeCollisionSpeedY)*deltaTime * 0.03;
  game.planeCollisionDisplacementY += (0-game.planeCollisionDisplacementY)*deltaTime *0.01;

  plane_box.position.lerp(gray_sphere.position,0.05);

  if(rotate_time>0){
    rotate_time--;
    if(rotate_time>=rotate_speed/2){
      airplane.mesh.quaternion.slerp(rotate_quat,0.1);
    }
    else {
      airplane.mesh.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0)),0.1);
    }
  }

  airplane.pilot.updateHairs();
}

function showReplay(){
  replayMessage.style.display="block";
}

function hideReplay(){
  replayMessage.style.display="none";
}

function normalize(v,vmin,vmax,tmin, tmax){
  var nv = Math.max(Math.min(v,vmax), vmin);
  var dv = vmax-vmin;
  var pc = (nv-vmin)/dv;
  var dt = tmax-tmin;
  var tv = tmin + (pc*dt);
  return tv;
}

var fieldDistance, energyBar, replayMessage, fieldLevel, levelCircle;


function init(event){






  
  // UI

  fieldDistance = document.getElementById("distValue");
  energyBar = document.getElementById("energyBar");
  replayMessage = document.getElementById("replayMessage");
  fieldLevel = document.getElementById("levelValue");
  levelCircle = document.getElementById("levelCircleStroke");

  resetGame();
  createScene();

  createLights();
  createPlane();
  createSea();
  createSky();
  createCoins();
  createEnnemies();
  createParticles();


 
 

  document.addEventListener('mousemove', handleMouseMove, false);
  document.addEventListener('touchmove', handleTouchMove, false);
  document.addEventListener('mouseup', handleMouseUp, false);
  document.addEventListener('touchend', handleTouchEnd, false);

  loop();
}




window.addEventListener('load', init, false);


  //CG:0408-2  
let firstupdated = false;
let isFirstPerson = false;
document.addEventListener("keydown", (e) => {
  //console.log(e.code);
  //KeyW KeyS KeyD KeyA
  if (e.code === "KeyW") {
    gray_sphere.position.y+=300;
    rotate_time = rotate_speed;
    rotate_quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI/1.5));
  }
  else if (e.code === "KeyS") {
    gray_sphere.position.y-=300;
    rotate_time = rotate_speed;
    rotate_quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI/1.5));
  }
  else if (e.code === "KeyA") {
    gray_sphere.position.z-=300;
    rotate_time = rotate_speed;
    rotate_quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/1.5, 0, 0));
  }
  else if (e.code === "KeyD") {
    gray_sphere.position.z+=300;
    rotate_time = rotate_speed;
    rotate_quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/1.5, 0, 0));
  }
});

function gamesystem(){
  //CG:0408-2
  if (isFirstPerson) {
    // 1인칭 시점
    //const cockpit = airplane.mesh.position.clone();
    //cockpit.y += 25; // cockpit 높이 조정
    //cockpit.x -= 150; // cockpit 앞쪽으로 약간 이동
  //
    //camera.position.copy(cockpit);
    //camera.position.z = airplane.mesh.position.z + 10;
    //camera.lookAt(cockpit.clone().add(new THREE.Vector3(100, 0, 0))); // 앞으로 향하게

    //CG:0408-2
    if (firstupdated == false)
    {
      airplane.mesh.updateMatrix();
      let T_A = airplane.mesh.matrix.clone();//  new THREE.Matrix4();
      camera.updateMatrix();
      let T_C0 = camera.matrix.clone();//  new THREE.Matrix4();
  
      airplane.mesh.add(camera);
      const inverseT_A = new THREE.Matrix4();
      inverseT_A.copy(T_A).invert();
      
      let T_C = new THREE.Matrix4();
      T_C.multiplyMatrices(inverseT_A, T_C0);
  
      camera.matrix.copy(T_C);
      camera.matrixAutoUpdate = false;  
      firstupdated = true;
    }

  } else if (firstupdated == false){

    // 기존 3인칭 시점
    //camera.fov = normalize(mousePos.x,-1,1,40, 80);
    //camera.updateProjectionMatrix();
    //camera.position.y += (airplane.mesh.position.y - camera.position.y)*deltaTime*game.cameraSensivity;
    //camera.position.z = 200;
    //camera.lookAt(new THREE.Vector3(airplane.mesh.position.x + 100, airplane.mesh.position.y, 0));
  }
  
}