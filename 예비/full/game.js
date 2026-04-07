import * as THREE from 'three';
import { gsap } from 'gsap';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
//COLORS
var Colors = {
  red: 0xf25346,
  white: 0xd8d0d1,
  brown: 0x59332e,
  brownDark: 0x23190f,
  pink: 0xF5986E,
  yellow: 0xf4ce93,
  blue: 0x68c3c0,

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
var isFirstPerson = false;
var isOrbitMode = false;
var orbitControls;
var composer, renderPass, bloomPass;
var keys = {};
var virtualPos = { x: 0, y: 0 };

function resetGame() {
  game = {
    speed: 0,
    initSpeed: .00035,
    baseSpeed: .00035,
    targetBaseSpeed: .00035,
    incrementSpeedByTime: .0000025,
    incrementSpeedByLevel: .000005,
    distanceForSpeedUpdate: 100,
    speedLastUpdate: 0,

    distance: 0,
    ratioSpeedDistance: 50,
    energy: 100,
    ratioSpeedEnergy: 3,

    level: 1,
    levelLastUpdate: 0,
    distanceForLevelUpdate: 1000,

    planeDefaultHeight: 100,
    planeAmpHeight: 80,
    planeAmpWidth: 75,
    planeMoveSensivity: 0.005,
    planeRotXSensivity: 0.0008,
    planeRotZSensivity: 0.0004,
    planeFallSpeed: .001,
    planeMinSpeed: 1.2,
    planeMaxSpeed: 1.6,
    planeSpeed: 0,
    planeCollisionDisplacementX: 0,
    planeCollisionSpeedX: 0,

    planeCollisionDisplacementY: 0,
    planeCollisionSpeedY: 0,

    seaRadius: 600,
    seaLength: 800,
    //seaRotationSpeed:0.006,
    wavesMinAmp: 5,
    wavesMaxAmp: 20,
    wavesMinSpeed: 0.001,
    wavesMaxSpeed: 0.003,

    cameraFarPos: 500,
    cameraNearPos: 150,
    cameraSensivity: 0.002,

    coinDistanceTolerance: 15,
    coinValue: 3,
    coinsSpeed: .5,
    coinLastSpawn: 0,
    distanceForCoinsSpawn: 100,

    ennemyDistanceTolerance: 10,
    ennemyValue: 10,
    ennemiesSpeed: .6,
    ennemyLastSpawn: 0,
    distanceForEnnemiesSpawn: 50,

    status: "playing",
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
  scene.fog = new THREE.Fog(0xf7d9aa, 100, 950);
  camera.position.x = 0;
  camera.position.z = 200;
  camera.position.y = game.planeDefaultHeight;
  //camera.lookAt(new THREE.Vector3(0, 400, 0));

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, logarithmicDepthBuffer: true });
  renderer.setSize(WIDTH, HEIGHT);
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ReinhardToneMapping;
  renderer.toneMappingExposure = 1.25;

  // Post-processing setup
  composer = new EffectComposer(renderer);
  renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  bloomPass = new UnrealBloomPass(new THREE.Vector2(WIDTH, HEIGHT), 1.5, 0.4, 0.85);
  bloomPass.threshold = 0.8;
  bloomPass.strength = 0.7;
  bloomPass.radius = 0.5;
  composer.addPass(bloomPass);

  container = document.getElementById('world');
  container.appendChild(renderer.domElement);

  // OrbitControls (비활성 상태로 시작)
  orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.target.set(0, game.planeDefaultHeight, 0);
  orbitControls.enabled = false;

  window.addEventListener('resize', handleWindowResize, false);
}

// MOUSE AND SCREEN EVENTS

function handleWindowResize() {
  HEIGHT = window.innerHeight;
  WIDTH = window.innerWidth;
  renderer.setSize(WIDTH, HEIGHT);
  composer.setSize(WIDTH, HEIGHT);
  camera.aspect = WIDTH / HEIGHT;
  camera.updateProjectionMatrix();
}

function handleMouseMove(event) {
  var tx = -1 + (event.clientX / WIDTH) * 2;
  var ty = 1 - (event.clientY / HEIGHT) * 2;
  mousePos = { x: tx, y: ty };
}

function handleTouchMove(event) {
  event.preventDefault();
  var tx = -1 + (event.touches[0].pageX / WIDTH) * 2;
  var ty = 1 - (event.touches[0].pageY / HEIGHT) * 2;
  mousePos = { x: tx, y: ty };
}

function handleMouseUp(event) {
  if (game.status == "waitingReplay") {
    resetGame();
    hideReplay();
  }
}


function handleTouchEnd(event) {
  if (game.status == "waitingReplay") {
    resetGame();
    hideReplay();
  }
}

// LIGHTS

var ambientLight, hemisphereLight, shadowLight;

function createLights() {

  hemisphereLight = new THREE.HemisphereLight(0xaaaaaa, 0x000000, 2.8);

  ambientLight = new THREE.AmbientLight(0xdc8874, 1.5);

  shadowLight = new THREE.DirectionalLight(0xffffff, 2.8);
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

  //scene.add(ch);
  scene.add(hemisphereLight);
  scene.add(shadowLight);
  scene.add(ambientLight);

  // 월드 좌표축 표시: 빨강=X, 초록=Y, 파랑=Z
  var axesHelper = new THREE.AxesHelper(500);
  scene.add(axesHelper);

}


var Pilot = function () {
  this.mesh = new THREE.Object3D();
  this.mesh.name = "pilot";
  this.angleHairs = 0;

  var bodyGeom = new THREE.BoxGeometry(15, 15, 15);
  var bodyMat = new THREE.MeshPhongMaterial({ color: Colors.brown, flatShading: true });
  var body = new THREE.Mesh(bodyGeom, bodyMat);
  body.position.set(2, -12, 0);

  this.mesh.add(body);

  var faceGeom = new THREE.BoxGeometry(10, 10, 10);
  var faceMat = new THREE.MeshLambertMaterial({ color: Colors.pink });
  var face = new THREE.Mesh(faceGeom, faceMat);
  this.mesh.add(face);

  var hairGeom = new THREE.BoxGeometry(4, 4, 4);
  var hairMat = new THREE.MeshLambertMaterial({ color: Colors.brown });
  var hair = new THREE.Mesh(hairGeom, hairMat);
  hair.geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 2, 0));
  var hairs = new THREE.Object3D();

  this.hairsTop = new THREE.Object3D();

  for (var i = 0; i < 12; i++) {
    var h = hair.clone();
    var col = i % 3;
    var row = Math.floor(i / 3);
    var startPosZ = -4;
    var startPosX = -4;
    h.position.set(startPosX + row * 4, 0, startPosZ + col * 4);
    h.geometry.applyMatrix4(new THREE.Matrix4().makeScale(1, 1, 1));
    this.hairsTop.add(h);
  }
  hairs.add(this.hairsTop);

  var hairSideGeom = new THREE.BoxGeometry(12, 4, 2);
  hairSideGeom.applyMatrix4(new THREE.Matrix4().makeTranslation(-6, 0, 0));
  var hairSideR = new THREE.Mesh(hairSideGeom, hairMat);
  var hairSideL = hairSideR.clone();
  hairSideR.position.set(8, -2, 6);
  hairSideL.position.set(8, -2, -6);
  hairs.add(hairSideR);
  hairs.add(hairSideL);

  var hairBackGeom = new THREE.BoxGeometry(2, 8, 10);
  var hairBack = new THREE.Mesh(hairBackGeom, hairMat);
  hairBack.position.set(-1, -4, 0)
  hairs.add(hairBack);
  hairs.position.set(-5, 5, 0);

  this.mesh.add(hairs);

  var glassGeom = new THREE.BoxGeometry(5, 5, 5);
  var glassMat = new THREE.MeshLambertMaterial({ color: Colors.brown });
  var glassR = new THREE.Mesh(glassGeom, glassMat);
  glassR.position.set(6, 0, 3);
  var glassL = glassR.clone();
  glassL.position.z = -glassR.position.z

  var glassAGeom = new THREE.BoxGeometry(11, 1, 11);
  var glassA = new THREE.Mesh(glassAGeom, glassMat);
  this.mesh.add(glassR);
  this.mesh.add(glassL);
  this.mesh.add(glassA);

  var earGeom = new THREE.BoxGeometry(2, 3, 2);
  var earL = new THREE.Mesh(earGeom, faceMat);
  earL.position.set(0, 0, -6);
  var earR = earL.clone();
  earR.position.set(0, 0, 6);
  this.mesh.add(earL);
  this.mesh.add(earR);
}

Pilot.prototype.updateHairs = function () {
  //*
  var hairs = this.hairsTop.children;

  var l = hairs.length;
  for (var i = 0; i < l; i++) {
    var h = hairs[i];
    h.scale.y = .75 + Math.cos(this.angleHairs + i / 3) * .25;
  }
  this.angleHairs += game.speed * deltaTime * 40;
  //*/
}

var AirPlane = function () {
  this.mesh = new THREE.Object3D();
  this.mesh.name = "airPlane";
  this.visualMesh = new THREE.Object3D();
  this.visualMesh.name = "airPlaneVisuals";

  // Cabin

  var geomCabin = new THREE.BoxGeometry(80, 50, 50, 1, 1, 1);
  var matCabin = new THREE.MeshPhongMaterial({ color: Colors.red, flatShading: true });

  var pos = geomCabin.attributes.position;
  for (var i = 0; i < pos.count; i++) {
    var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (x < 0) {
      if (y > 0 && z < 0) { y -= 10; z += 20; }
      else if (y > 0 && z > 0) { y -= 10; z -= 20; }
      else if (y < 0 && z < 0) { y += 30; z += 20; }
      else if (y < 0 && z > 0) { y += 30; z -= 20; }
    }
    pos.setXYZ(i, x, y, z);
  }

  var cabin = new THREE.Mesh(geomCabin, matCabin);
  cabin.castShadow = true;
  cabin.receiveShadow = true;
  this.visualMesh.add(cabin);

  // Engine

  var geomEngine = new THREE.BoxGeometry(20, 50, 50, 1, 1, 1);
  var matEngine = new THREE.MeshPhongMaterial({ color: Colors.white, flatShading: true });
  var engine = new THREE.Mesh(geomEngine, matEngine);
  engine.position.x = 50;
  engine.castShadow = true;
  engine.receiveShadow = true;
  this.visualMesh.add(engine);

  // Tail Plane

  var geomTailPlane = new THREE.BoxGeometry(15, 20, 5, 1, 1, 1);
  var matTailPlane = new THREE.MeshPhongMaterial({ color: Colors.red, flatShading: true });
  var tailPlane = new THREE.Mesh(geomTailPlane, matTailPlane);
  tailPlane.position.set(-40, 20, 0);
  tailPlane.castShadow = true;
  tailPlane.receiveShadow = true;
  this.visualMesh.add(tailPlane);

  // Wings

  var geomSideWing = new THREE.BoxGeometry(30, 5, 120, 1, 1, 1);
  var matSideWing = new THREE.MeshPhongMaterial({ color: Colors.red, flatShading: true });
  var sideWing = new THREE.Mesh(geomSideWing, matSideWing);
  sideWing.position.set(0, 15, 0);
  sideWing.castShadow = true;
  sideWing.receiveShadow = true;
  this.visualMesh.add(sideWing);

  var geomWindshield = new THREE.BoxGeometry(3, 15, 20, 1, 1, 1);
  var matWindshield = new THREE.MeshPhongMaterial({ color: Colors.white, transparent: true, opacity: .3, flatShading: true });;
  var windshield = new THREE.Mesh(geomWindshield, matWindshield);
  windshield.position.set(5, 27, 0);

  windshield.castShadow = true;
  windshield.receiveShadow = true;

  this.visualMesh.add(windshield);

  var geomPropeller = new THREE.BoxGeometry(20, 10, 10, 1, 1, 1);
  var pos2 = geomPropeller.attributes.position;
  for (var i = 0; i < pos2.count; i++) {
    var x = pos2.getX(i), y = pos2.getY(i), z = pos2.getZ(i);
    if (x < 0) {
      if (y > 0 && z < 0) { y -= 5; z += 5; }
      else if (y > 0 && z > 0) { y -= 5; z -= 5; }
      else if (y < 0 && z < 0) { y += 5; z += 5; }
      else if (y < 0 && z > 0) { y += 5; z -= 5; }
    }
    pos2.setXYZ(i, x, y, z);
  }
  var matPropeller = new THREE.MeshPhongMaterial({ color: Colors.brown, flatShading: true });
  this.propeller = new THREE.Mesh(geomPropeller, matPropeller);

  this.propeller.castShadow = true;
  this.propeller.receiveShadow = true;

  var geomBlade = new THREE.BoxGeometry(1, 80, 10, 1, 1, 1);
  var matBlade = new THREE.MeshPhongMaterial({ color: Colors.brownDark, flatShading: true });
  var blade1 = new THREE.Mesh(geomBlade, matBlade);
  blade1.position.set(8, 0, 0);

  blade1.castShadow = true;
  blade1.receiveShadow = true;

  var blade2 = blade1.clone();
  blade2.rotation.x = Math.PI / 2;

  blade2.castShadow = true;
  blade2.receiveShadow = true;

  this.propeller.add(blade1);
  this.propeller.add(blade2);
  this.propeller.position.set(60, 0, 0);
  this.visualMesh.add(this.propeller);

  var wheelProtecGeom = new THREE.BoxGeometry(30, 15, 10, 1, 1, 1);
  var wheelProtecMat = new THREE.MeshPhongMaterial({ color: Colors.red, flatShading: true });
  var wheelProtecR = new THREE.Mesh(wheelProtecGeom, wheelProtecMat);
  wheelProtecR.position.set(25, -20, 25);
  this.visualMesh.add(wheelProtecR);

  var wheelTireGeom = new THREE.BoxGeometry(24, 24, 4);
  var wheelTireMat = new THREE.MeshPhongMaterial({ color: Colors.brownDark, flatShading: true });
  var wheelTireR = new THREE.Mesh(wheelTireGeom, wheelTireMat);
  wheelTireR.position.set(25, -28, 25);

  var wheelAxisGeom = new THREE.BoxGeometry(10, 10, 6);
  var wheelAxisMat = new THREE.MeshPhongMaterial({ color: Colors.brown, flatShading: true });
  var wheelAxis = new THREE.Mesh(wheelAxisGeom, wheelAxisMat);
  wheelTireR.add(wheelAxis);

  this.visualMesh.add(wheelTireR);

  var wheelProtecL = wheelProtecR.clone();
  wheelProtecL.position.z = -wheelProtecR.position.z;
  this.visualMesh.add(wheelProtecL);

  var wheelTireL = wheelTireR.clone();
  wheelTireL.position.z = -wheelTireR.position.z;
  this.visualMesh.add(wheelTireL);

  var wheelTireB = wheelTireR.clone();
  wheelTireB.scale.set(.5, .5, .5);
  wheelTireB.position.set(-35, -5, 0);
  this.visualMesh.add(wheelTireB);

  var suspensionGeom = new THREE.BoxGeometry(4, 20, 4);
  suspensionGeom.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 10, 0))
  var suspensionMat = new THREE.MeshPhongMaterial({ color: Colors.red, flatShading: true });
  var suspension = new THREE.Mesh(suspensionGeom, suspensionMat);
  suspension.position.set(-35, -5, 0);
  suspension.rotation.z = -.3;
  this.visualMesh.add(suspension);

  this.pilot = new Pilot();
  this.pilot.mesh.position.set(-10, 27, 0);
  this.visualMesh.add(this.pilot.mesh);


  this.visualMesh.castShadow = true;
  this.visualMesh.receiveShadow = true;

  this.mesh.add(this.visualMesh);
};

var Sky = function () {
  this.mesh = new THREE.Object3D();
  this.nClouds = 20;
  this.clouds = [];
  var stepAngle = Math.PI * 2 / this.nClouds;
  for (var i = 0; i < this.nClouds; i++) {
    var c = new Cloud();
    this.clouds.push(c);
    var a = stepAngle * i;
    var h = game.seaRadius + 150 + Math.random() * 200;
    c.mesh.position.y = Math.sin(a) * h;
    c.mesh.position.x = Math.cos(a) * h;
    c.mesh.position.z = -300 - Math.random() * 500;
    c.mesh.rotation.z = a + Math.PI / 2;
    var s = 1 + Math.random() * 2;
    c.mesh.scale.set(s, s, s);
    this.mesh.add(c.mesh);
  }
}

Sky.prototype.moveClouds = function () {
  for (var i = 0; i < this.nClouds; i++) {
    var c = this.clouds[i];
    c.rotate();
  }
  this.mesh.rotation.z += game.speed * deltaTime;

}

var Sea = function () {
  var geom = new THREE.CylinderGeometry(game.seaRadius, game.seaRadius, game.seaLength, 40, 10);
  geom.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  var pos = geom.attributes.position;
  var l = pos.count;

  var aAngle = new Float32Array(l);
  var aAmp = new Float32Array(l);
  var aSpeed = new Float32Array(l);

  var waveMap = {};
  for (var i = 0; i < l; i++) {
    var vx = pos.getX(i);
    var vy = pos.getY(i);
    var vz = pos.getZ(i);
    var key = Math.round(vx * 100) + '_' + Math.round(vy * 100) + '_' + Math.round(vz * 100);
    if (!waveMap[key]) {
      waveMap[key] = {
        ang: Math.random() * Math.PI * 2,
        amp: game.wavesMinAmp + Math.random() * (game.wavesMaxAmp - game.wavesMinAmp),
        speed: game.wavesMinSpeed + Math.random() * (game.wavesMaxSpeed - game.wavesMinSpeed)
      };
    }
    aAngle[i] = waveMap[key].ang;
    aAmp[i] = waveMap[key].amp;
    aSpeed[i] = waveMap[key].speed;
  }

  geom.setAttribute('aWaveAngle', new THREE.BufferAttribute(aAngle, 1));
  geom.setAttribute('aWaveAmp', new THREE.BufferAttribute(aAmp, 1));
  geom.setAttribute('aWaveSpeed', new THREE.BufferAttribute(aSpeed, 1));

  var loader = new THREE.TextureLoader();
  var textureCloud = loader.load('/textures/lava/cloud.png');
  var textureLava = loader.load('/textures/lava/lavatile.jpg');

  textureCloud.wrapS = textureCloud.wrapT = THREE.RepeatWrapping;
  textureLava.wrapS = textureLava.wrapT = THREE.RepeatWrapping;

  this.customUniforms = {
    uTime: { value: 0 },
    uvScale: { value: new THREE.Vector2(3, 1) },
    fogDensity: { value: 0.0 },
    fogColor: { value: new THREE.Vector3(0, 0, 0) },
    texture1: { value: textureCloud },
    texture2: { value: textureLava },
  };

  var lavaVertexShader = `
    uniform float uTime;
    attribute float aWaveAngle;
    attribute float aWaveAmp;
    attribute float aWaveSpeed;
    uniform vec2 uvScale;
    varying vec2 vUv;

    void main() {
      vUv = uvScale * uv;
      vec3 pos = position;
      float angle = aWaveAngle + uTime * aWaveSpeed;
      pos.x += cos(angle) * aWaveAmp;
      pos.y += sin(angle) * aWaveAmp;
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  var lavaFragmentShader = `
    uniform float uTime;
    uniform float fogDensity;
    uniform vec3 fogColor;
    uniform sampler2D texture1;
    uniform sampler2D texture2;
    varying vec2 vUv;

    void main( void ) {
      vec2 position = -1.0 + 2.0 * vUv;

      vec4 noise = texture2D( texture1, vUv );
      vec2 T1 = vUv + vec2( 1.5, -1.5 ) * uTime * 0.00010;
      vec2 T2 = vUv + vec2( -0.5,  2.0 ) * uTime * 0.00005;

      T1.x += noise.x * 2.0;
      T1.y += noise.y * 2.0;
      T2.x -= noise.y * 0.2;
      T2.y += noise.z * 0.2;

      float p = texture2D( texture1, T1 * 2.0 ).a;
      vec4 color = texture2D( texture2, T2 * 2.0 );
      vec4 temp = color * ( vec4( p, p, p, p ) * 2.0 ) + ( color * color - 0.1 );

      if( temp.r > 1.0 ) { temp.bg += clamp( temp.r - 2.0, 0.0, 100.0 ); }
      if( temp.g > 1.0 ) { temp.rb += temp.g - 1.0; }
      if( temp.b > 1.0 ) { temp.rg += temp.b - 1.0; }

      // Bloom 강화를 위해 아주 밝은 부분의 명도를 뻥튀기함 (HDR 느낌)
      temp.rgb *= 1.5; 

      gl_FragColor = temp;

      float depth = gl_FragCoord.z / gl_FragCoord.w;
      const float LOG2 = 1.442695;
      float fogFactor = exp2( -fogDensity * fogDensity * depth * depth * LOG2 );
      fogFactor = 1.0 - clamp( fogFactor, 0.0, 1.0 );
      gl_FragColor = mix( gl_FragColor, vec4( fogColor, gl_FragColor.w ), fogFactor );
    }
  `;

  var mat = new THREE.ShaderMaterial({
    uniforms: this.customUniforms,
    vertexShader: lavaVertexShader,
    fragmentShader: lavaFragmentShader,
    side: THREE.FrontSide,
  });

  this.mesh = new THREE.Mesh(geom, mat);
  this.mesh.name = "waves";
  this.mesh.receiveShadow = false;
}

Sea.prototype.moveWaves = function () {
  if (this.customUniforms) {
    this.customUniforms.uTime.value += deltaTime;
  }
}

var Cloud = function () {
  this.mesh = new THREE.Object3D();
  this.mesh.name = "cloud";
  var geom = new THREE.BoxGeometry(20, 20, 20);
  var mat = new THREE.MeshPhongMaterial({
    color: Colors.white,

  });

  //*
  var nBlocs = 3 + Math.floor(Math.random() * 3);
  for (var i = 0; i < nBlocs; i++) {
    var m = new THREE.Mesh(geom.clone(), mat);
    m.position.x = i * 15;
    m.position.y = Math.random() * 10;
    m.position.z = Math.random() * 10;
    m.rotation.z = Math.random() * Math.PI * 2;
    m.rotation.y = Math.random() * Math.PI * 2;
    var s = .1 + Math.random() * .9;
    m.scale.set(s, s, s);
    this.mesh.add(m);
    m.castShadow = true;
    m.receiveShadow = true;

  }
  //*/
}

Cloud.prototype.rotate = function () {
  var l = this.mesh.children.length;
  for (var i = 0; i < l; i++) {
    var m = this.mesh.children[i];
    m.rotation.z += Math.random() * .005 * (i + 1);
    m.rotation.y += Math.random() * .002 * (i + 1);
  }
}

var Ennemy = function () {
  var geom = new THREE.TetrahedronGeometry(8, 2);
  var mat = new THREE.MeshPhongMaterial({
    color: Colors.red,
    shininess: 0,
    specular: 0xffffff,
    flatShading: true
  });
  this.mesh = new THREE.Mesh(geom, mat);
  this.mesh.castShadow = true;
  this.angle = 0;
  this.dist = 0;
}

var EnnemiesHolder = function () {
  this.mesh = new THREE.Object3D();
  this.ennemiesInUse = [];
}

EnnemiesHolder.prototype.spawnEnnemies = function () {
  var nEnnemies = game.level;

  for (var i = 0; i < nEnnemies; i++) {
    var ennemy;
    if (ennemiesPool.length) {
      ennemy = ennemiesPool.pop();
    } else {
      ennemy = new Ennemy();
    }

    ennemy.angle = - (i * 0.1);
    ennemy.distance = game.seaRadius + game.planeDefaultHeight + (-1 + Math.random() * 2) * (game.planeAmpHeight - 20);
    ennemy.mesh.position.y = -game.seaRadius + Math.sin(ennemy.angle) * ennemy.distance;
    ennemy.mesh.position.x = Math.cos(ennemy.angle) * ennemy.distance;

    this.mesh.add(ennemy.mesh);
    this.ennemiesInUse.push(ennemy);
  }
}

EnnemiesHolder.prototype.rotateEnnemies = function () {
  for (var i = 0; i < this.ennemiesInUse.length; i++) {
    var ennemy = this.ennemiesInUse[i];
    ennemy.angle += game.speed * deltaTime * game.ennemiesSpeed;

    if (ennemy.angle > Math.PI * 2) ennemy.angle -= Math.PI * 2;

    ennemy.mesh.position.y = -game.seaRadius + Math.sin(ennemy.angle) * ennemy.distance;
    ennemy.mesh.position.x = Math.cos(ennemy.angle) * ennemy.distance;
    ennemy.mesh.rotation.z += Math.random() * .1;
    ennemy.mesh.rotation.y += Math.random() * .1;

    //var globalEnnemyPosition =  ennemy.mesh.localToWorld(new THREE.Vector3());
    var diffPos = airplane.mesh.position.clone().sub(ennemy.mesh.position.clone());
    var d = diffPos.length();
    if (d < game.ennemyDistanceTolerance) {
      particlesHolder.spawnParticles(ennemy.mesh.position.clone(), 15, Colors.red, 3);

      ennemiesPool.unshift(this.ennemiesInUse.splice(i, 1)[0]);
      this.mesh.remove(ennemy.mesh);
      game.planeCollisionSpeedX = 100 * diffPos.x / d;
      game.planeCollisionSpeedY = 100 * diffPos.y / d;
      ambientLight.intensity = 6;

      removeEnergy();
      i--;
    } else if (ennemy.angle > Math.PI) {
      ennemiesPool.unshift(this.ennemiesInUse.splice(i, 1)[0]);
      this.mesh.remove(ennemy.mesh);
      i--;
    }
  }
}

var Particle = function () {
  var geom = new THREE.TetrahedronGeometry(3, 0);
  var mat = new THREE.MeshPhongMaterial({
    color: 0x009999,
    shininess: 0,
    specular: 0xffffff,
    flatShading: true
  });
  this.mesh = new THREE.Mesh(geom, mat);
}

Particle.prototype.explode = function (pos, color, scale) {
  var _this = this;
  var _p = this.mesh.parent;
  this.mesh.material.color = new THREE.Color(color);
  this.mesh.material.needsUpdate = true;
  this.mesh.scale.set(scale, scale, scale);
  var targetX = pos.x + (-1 + Math.random() * 2) * 50;
  var targetY = pos.y + (-1 + Math.random() * 2) * 50;
  var speed = .6 + Math.random() * .2;
  gsap.to(this.mesh.rotation, speed, { x: Math.random() * 12, y: Math.random() * 12 });
  gsap.to(this.mesh.scale, speed, { x: .1, y: .1, z: .1 });
  gsap.to(this.mesh.position, speed, {
    x: targetX, y: targetY, delay: Math.random() * .1, ease: "power2.out", onComplete: function () {
      if (_p) _p.remove(_this.mesh);
      _this.mesh.scale.set(1, 1, 1);
      particlesPool.unshift(_this);
    }
  });
}

var ParticlesHolder = function () {
  this.mesh = new THREE.Object3D();
  this.particlesInUse = [];
}

ParticlesHolder.prototype.spawnParticles = function (pos, density, color, scale) {

  var nPArticles = density;
  for (var i = 0; i < nPArticles; i++) {
    var particle;
    if (particlesPool.length) {
      particle = particlesPool.pop();
    } else {
      particle = new Particle();
    }
    this.mesh.add(particle.mesh);
    particle.mesh.visible = true;
    var _this = this;
    particle.mesh.position.y = pos.y;
    particle.mesh.position.x = pos.x;
    particle.explode(pos, color, scale);
  }
}

var Coin = function () {
  var geom = new THREE.TetrahedronGeometry(5, 0);
  var mat = new THREE.MeshPhongMaterial({
    color: 0x009999,
    shininess: 0,
    specular: 0xffffff,

    flatShading: true
  });
  this.mesh = new THREE.Mesh(geom, mat);
  this.mesh.castShadow = true;
  this.angle = 0;
  this.dist = 0;
}

var CoinsHolder = function (nCoins) {
  this.mesh = new THREE.Object3D();
  this.coinsInUse = [];
  this.coinsPool = [];
  for (var i = 0; i < nCoins; i++) {
    var coin = new Coin();
    this.coinsPool.push(coin);
  }
}

CoinsHolder.prototype.spawnCoins = function () {

  var nCoins = 1 + Math.floor(Math.random() * 10);
  var d = game.seaRadius + game.planeDefaultHeight + (-1 + Math.random() * 2) * (game.planeAmpHeight - 20);
  var amplitude = 10 + Math.round(Math.random() * 10);
  for (var i = 0; i < nCoins; i++) {
    var coin;
    if (this.coinsPool.length) {
      coin = this.coinsPool.pop();
    } else {
      coin = new Coin();
    }
    this.mesh.add(coin.mesh);
    this.coinsInUse.push(coin);
    coin.angle = - (i * 0.02);
    coin.distance = d + Math.cos(i * .5) * amplitude;
    coin.mesh.position.y = -game.seaRadius + Math.sin(coin.angle) * coin.distance;
    coin.mesh.position.x = Math.cos(coin.angle) * coin.distance;
  }
}

CoinsHolder.prototype.rotateCoins = function () {
  for (var i = 0; i < this.coinsInUse.length; i++) {
    var coin = this.coinsInUse[i];
    if (coin.exploding) continue;
    coin.angle += game.speed * deltaTime * game.coinsSpeed;
    if (coin.angle > Math.PI * 2) coin.angle -= Math.PI * 2;
    coin.mesh.position.y = -game.seaRadius + Math.sin(coin.angle) * coin.distance;
    coin.mesh.position.x = Math.cos(coin.angle) * coin.distance;
    coin.mesh.rotation.z += Math.random() * .1;
    coin.mesh.rotation.y += Math.random() * .1;

    //var globalCoinPosition =  coin.mesh.localToWorld(new THREE.Vector3());
    var diffPos = airplane.mesh.position.clone().sub(coin.mesh.position.clone());
    var d = diffPos.length();
    if (d < game.coinDistanceTolerance) {
      this.coinsPool.unshift(this.coinsInUse.splice(i, 1)[0]);
      this.mesh.remove(coin.mesh);
      particlesHolder.spawnParticles(coin.mesh.position.clone(), 5, 0x009999, .8);
      addEnergy();
      i--;
    } else if (coin.angle > Math.PI) {
      this.coinsPool.unshift(this.coinsInUse.splice(i, 1)[0]);
      this.mesh.remove(coin.mesh);
      i--;
    }
  }
}


// 3D Models
var sea, airplane, sky, coinsHolder, ennemiesHolder, particlesHolder;

function createPlane() {
  airplane = new AirPlane();
  airplane.mesh.scale.set(.25, .25, .25);
  airplane.mesh.position.y = game.planeDefaultHeight;
  scene.add(airplane.mesh);
}

function createSea() {
  sea = new Sea();
  sea.mesh.position.y = -game.seaRadius;
  scene.add(sea.mesh);
}

function createSky() {
  sky = new Sky();
  sky.mesh.position.y = -game.seaRadius;
  scene.add(sky.mesh);
}

function createCoins() {

  coinsHolder = new CoinsHolder(20);
  scene.add(coinsHolder.mesh)
}

function createEnnemies() {
  for (var i = 0; i < 10; i++) {
    var ennemy = new Ennemy();
    ennemiesPool.push(ennemy);
  }
  ennemiesHolder = new EnnemiesHolder();
  //ennemiesHolder.mesh.position.y = -game.seaRadius;
  scene.add(ennemiesHolder.mesh)
}

function createParticles() {
  for (var i = 0; i < 10; i++) {
    var particle = new Particle();
    particlesPool.push(particle);
  }
  particlesHolder = new ParticlesHolder();
  //ennemiesHolder.mesh.position.y = -game.seaRadius;
  scene.add(particlesHolder.mesh)
}

function loop() {

  newTime = new Date().getTime();
  deltaTime = newTime - oldTime;
  oldTime = newTime;

  if (game.status == "playing") {

    // Add energy coins every 100m;
    if (Math.floor(game.distance) % game.distanceForCoinsSpawn == 0 && Math.floor(game.distance) > game.coinLastSpawn) {
      game.coinLastSpawn = Math.floor(game.distance);
      coinsHolder.spawnCoins();
    }

    if (Math.floor(game.distance) % game.distanceForSpeedUpdate == 0 && Math.floor(game.distance) > game.speedLastUpdate) {
      game.speedLastUpdate = Math.floor(game.distance);
      game.targetBaseSpeed += game.incrementSpeedByTime * deltaTime;
    }


    if (Math.floor(game.distance) % game.distanceForEnnemiesSpawn == 0 && Math.floor(game.distance) > game.ennemyLastSpawn) {
      game.ennemyLastSpawn = Math.floor(game.distance);
      ennemiesHolder.spawnEnnemies();
    }

    if (Math.floor(game.distance) % game.distanceForLevelUpdate == 0 && Math.floor(game.distance) > game.levelLastUpdate) {
      game.levelLastUpdate = Math.floor(game.distance);
      game.level++;
      fieldLevel.innerHTML = Math.floor(game.level);

      game.targetBaseSpeed = game.initSpeed + game.incrementSpeedByLevel * game.level
    }


    updatePlane();
    updateDistance();
    updateEnergy();
    game.baseSpeed += (game.targetBaseSpeed - game.baseSpeed) * deltaTime * 0.02;
    game.speed = game.baseSpeed * game.planeSpeed;

  } else if (game.status == "gameover") {
    game.speed *= .99;
    airplane.visualMesh.rotation.z += (-Math.PI / 2 - airplane.visualMesh.rotation.z) * .0002 * deltaTime;
    airplane.visualMesh.rotation.x += 0.0003 * deltaTime;
    game.planeFallSpeed *= 1.05;
    airplane.mesh.position.y -= game.planeFallSpeed * deltaTime;

    if (airplane.mesh.position.y < -200) {
      showReplay();
      game.status = "waitingReplay";

    }
  } else if (game.status == "waitingReplay") {

  }


  airplane.propeller.rotation.x += .2 + game.planeSpeed * deltaTime * .005;
  //sea.mesh.rotation.z += game.speed * deltaTime;//*game.seaRotationSpeed;

  if (sea.mesh.rotation.z > 2 * Math.PI) sea.mesh.rotation.z -= 2 * Math.PI;

  ambientLight.intensity += (1.5 - ambientLight.intensity) * deltaTime * 0.005;

  coinsHolder.rotateCoins();
  ennemiesHolder.rotateEnnemies();

  sky.moveClouds();
  sea.moveWaves();

  if (isOrbitMode) orbitControls.update();
  composer.render();
  requestAnimationFrame(loop);
}

function updateDistance() {
  game.distance += game.speed * deltaTime * game.ratioSpeedDistance;
  fieldDistance.innerHTML = Math.floor(game.distance);
  var d = 502 * (1 - (game.distance % game.distanceForLevelUpdate) / game.distanceForLevelUpdate);
  levelCircle.setAttribute("stroke-dashoffset", d);

}

var blinkEnergy = false;

function updateEnergy() {
  game.energy -= game.speed * deltaTime * game.ratioSpeedEnergy;
  game.energy = Math.max(0, game.energy);
  energyBar.style.right = (100 - game.energy) + "%";
  energyBar.style.backgroundColor = (game.energy < 50) ? "#f25346" : "#68c3c0";

  if (game.energy < 30) {
    energyBar.style.animationName = "blinking";
  } else {
    energyBar.style.animationName = "none";
  }

  if (game.energy < 1) {
    game.status = "gameover";
  }
}

function addEnergy() {
  game.energy += game.coinValue;
  game.energy = Math.min(game.energy, 100);
}

function removeEnergy() {
  game.energy -= game.ennemyValue;
  game.energy = Math.max(0, game.energy);
}



function updatePlane() {

  // WASD → virtualPos 부드럽게 이동
  var drift = 0.002 * deltaTime;
  if (keys['KeyW']) virtualPos.y = Math.min(virtualPos.y + drift, 0.75);
  else if (keys['KeyS']) virtualPos.y = Math.max(virtualPos.y - drift, -0.75);
  else virtualPos.y += (0 - virtualPos.y) * deltaTime * 0.005;

  if (keys['KeyD']) virtualPos.x = Math.min(virtualPos.x + drift, 1);
  else if (keys['KeyA']) virtualPos.x = Math.max(virtualPos.x - drift, -1);
  else virtualPos.x += (0 - virtualPos.x) * deltaTime * 0.005;

  // 속도: 마우스 X 로 제어 (기존 동작 유지)
  game.planeSpeed = normalize(mousePos.x, -.5, .5, game.planeMinSpeed, game.planeMaxSpeed);
  // 상하 위치: W/S
  var targetY = normalize(virtualPos.y, -.75, .75, game.planeDefaultHeight - game.planeAmpHeight, game.planeDefaultHeight + game.planeAmpHeight);
  // 비행기 기준 좌우(Z축): A/D → 3인칭 카메라 기준 depth 방향
  var targetZ = normalize(virtualPos.x, -1, 1, -game.planeAmpWidth, game.planeAmpWidth);

  game.planeCollisionDisplacementX += game.planeCollisionSpeedX;

  game.planeCollisionDisplacementY += game.planeCollisionSpeedY;
  targetY += game.planeCollisionDisplacementY;

  airplane.mesh.position.y += (targetY - airplane.mesh.position.y) * deltaTime * game.planeMoveSensivity;
  airplane.mesh.position.z += (targetZ - airplane.mesh.position.z) * deltaTime * game.planeMoveSensivity;

  airplane.visualMesh.rotation.z = (targetY - airplane.mesh.position.y) * deltaTime * game.planeRotXSensivity;
  airplane.visualMesh.rotation.x = (airplane.mesh.position.y - targetY) * deltaTime * game.planeRotZSensivity;
  var targetCameraZ = normalize(game.planeSpeed, game.planeMinSpeed, game.planeMaxSpeed, game.cameraNearPos, game.cameraFarPos);
  if (!isOrbitMode) {
    camera.fov = normalize(mousePos.x, -1, 1, 40, 80);  // FOV: 마우스 X 유지
    camera.updateProjectionMatrix();
    if (!isFirstPerson) {
      camera.position.y += (airplane.mesh.position.y - camera.position.y) * deltaTime * game.cameraSensivity;
    }
  }

  game.planeCollisionSpeedX += (0 - game.planeCollisionSpeedX) * deltaTime * 0.03;
  game.planeCollisionDisplacementX += (0 - game.planeCollisionDisplacementX) * deltaTime * 0.01;
  game.planeCollisionSpeedY += (0 - game.planeCollisionSpeedY) * deltaTime * 0.03;
  game.planeCollisionDisplacementY += (0 - game.planeCollisionDisplacementY) * deltaTime * 0.01;

  airplane.pilot.updateHairs();
}

function showReplay() {
  replayMessage.style.display = "block";
}

function hideReplay() {
  replayMessage.style.display = "none";
}

function normalize(v, vmin, vmax, tmin, tmax) {
  var nv = Math.max(Math.min(v, vmax), vmin);
  var dv = vmax - vmin;
  var pc = (nv - vmin) / dv;
  var dt = tmax - tmin;
  var tv = tmin + (pc * dt);
  return tv;
}

var fieldDistance, energyBar, replayMessage, fieldLevel, levelCircle;

function init(event) {

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

  document.addEventListener('keydown', function (event) {
    // WASD 입력 기록
    if (['KeyW', 'KeyS', 'KeyA', 'KeyD'].includes(event.code)) {
      keys[event.code] = true;
      return;
    }
    if (event.code === 'Space') {
      // 오빗 모드 중에는 스페이스바 무시
      if (isOrbitMode) return;
      isFirstPerson = !isFirstPerson;
      if (isFirstPerson) {
        airplane.mesh.add(camera);
        camera.position.set(-50, 45, 0);
        camera.rotation.set(0, -Math.PI / 2, 0);
      } else {
        scene.add(camera);
        camera.position.set(0, game.planeDefaultHeight, 200);
        camera.rotation.set(0, 0, 0);
      }
    } else if (event.code === 'KeyT') {
      isOrbitMode = !isOrbitMode;
      if (isOrbitMode) {
        // 1인칭 모드였다면 강제 해제
        if (isFirstPerson) {
          isFirstPerson = false;
          scene.add(camera);
          camera.rotation.set(0, 0, 0);
        }
        orbitControls.target.set(
          airplane.mesh.position.x,
          airplane.mesh.position.y,
          airplane.mesh.position.z
        );
        orbitControls.enabled = true;
        scene.fog = null; // 자유관전: fog 제거
      } else {
        orbitControls.enabled = false;
        scene.fog = new THREE.Fog(0xf7d9aa, 100, 950); // fog 복원
        camera.position.set(0, game.planeDefaultHeight, 200);
        camera.rotation.set(0, 0, 0);
        camera.fov = 50;
        camera.updateProjectionMatrix();
      }
    }
  }, false);

  document.addEventListener('keyup', function (event) {
    keys[event.code] = false;
  }, false);

  loop();
}

window.addEventListener('load', init, false);
