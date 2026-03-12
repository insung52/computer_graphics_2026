import * as THREE from 'three';
import { mergeVertices } from 'addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'GLTFLoader';
import { WaterSphere } from 'WaterSphere';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast, MeshBVHHelper, MeshBVH } from 'three-mesh-bvh';
import { Reflector } from 'Reflector';

THREE.Mesh.prototype.raycast = acceleratedRaycast;
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;

var game;
var deltaTime = 0;
var newTime = new Date().getTime();
var oldTime = new Date().getTime();

var plane_velocity = new THREE.Vector2(0, 0);

var power = 0;

function resetGame() {
  plane_velocity = new THREE.Vector2(0, 0);
  power = 0;
  game = {
    speed: 0,
    initSpeed: .00035,
    baseSpeed: .00035,
    targetBaseSpeed: 0.000001,
    incrementSpeedByTime: .0000025,
    incrementSpeedByLevel: .000005,
    distanceForSpeedUpdate: 100,
    speedLastUpdate: 0,
    distance: 0,
    ratioSpeedDistance: 50,
    energy: 100.0,
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
    seaRadius: 10000000,
    seaLength: 20000000,
    wavesMinAmp: 5,
    wavesMaxAmp: 20,
    wavesMinSpeed: 0.001,
    wavesMaxSpeed: 0.003,
    cameraFarPos: 30000,
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
}

var scene,
  camera, fieldOfView, aspectRatio, nearPlane, farPlane,
  renderer,
  container;

var HEIGHT, WIDTH,
  mousePos = { x: 0, y: 0 };

let orbiting = false;
function createScene() {
  HEIGHT = window.innerHeight;
  WIDTH = window.innerWidth;
  scene = new THREE.Scene();
  aspectRatio = WIDTH / HEIGHT;
  fieldOfView = 50;
  nearPlane = .1;
  farPlane = 20000000;
  camera = new THREE.PerspectiveCamera(
    fieldOfView,
    aspectRatio,
    nearPlane,
    farPlane
  );
  camera.position.x = -800;
  camera.up.set(0, 1, 0);
  camera.lookAt(new THREE.Vector3(0, 0, 0));

  scene.add(camera);
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(WIDTH, HEIGHT);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container = document.getElementById('world');
  container.appendChild(renderer.domElement);
  window.addEventListener('resize', handleWindowResize, false);
}

function handleWindowResize() {
  HEIGHT = window.innerHeight;
  WIDTH = window.innerWidth;
  renderer.setSize(WIDTH, HEIGHT);
  renderer.setViewport(0, 0, WIDTH, HEIGHT);
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


var airplane_collider_box1;
var jetFlames = [];
var plane_mirror;
var AirPlane = function () {
  this.mesh = new THREE.Object3D();
  this.mesh.name = "airPlane";
  this.isLoaded = false;
  const loader = new GLTFLoader();
  const self = this;

  loader.load(
    '../models/ranger_pbr.glb',
    function (gltf) {
      const model = gltf.scene;
      model.scale.set(100, 100, 100);
      model.rotation.y = -Math.PI / 2;
      model.traverse(function (child) {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.material.side = THREE.DoubleSide;
          if (!(child.material instanceof THREE.MeshStandardMaterial)) {
            const oldMat = child.material;
            const newMat = new THREE.MeshStandardMaterial({
              map: oldMat.map || null,
              color: oldMat.color || new THREE.Color(0xffffff),
              metalness: 0.5,
              roughness: 0.5,
              //envMap: bgRenderTarget.texture,
              envMapIntensity: 1
            });
            child.material = newMat;
          } else {
            child.material.roughness = 0;
            child.material.metalness = 1;
            child.material.envMapIntensity = 1;
            child.material.needsUpdate = true;
          }

          child.material.needsUpdate = true;
        }
      });

      self.mesh.add(model);
      self.isLoaded = true;
    },
    undefined,
    function (error) {
      console.error('GLB 로딩 오류:', error);
    }
  );

  this.mesh.castShadow = true;
  this.mesh.receiveShadow = true;

  const box1 = new THREE.Box3(
    new THREE.Vector3(-90, 15, -40),
    new THREE.Vector3(100, 40, 40)
  );
  airplane_collider_box1 = box1;
  //const helper1 = new THREE.Box3Helper(box1, 0xffffff);
  //this.mesh.add(helper1);

  const geometry = new THREE.ConeGeometry(0.5, 2, 16);  // 원뿔 또는 BoxGeometry로 사각뿔도 가능
  const material = new THREE.ShaderMaterial({
    vertexShader: `
// vertexShader.glsl
uniform float time;
varying float vFlameNoise;
varying float vY;
float hash(float x) {
  return fract(sin(x * 123.456) * 789.123);
}
void main() {
  vec3 pos = position;
  float noise = hash(pos.y + time);
  float wave = sin(pos.y * 10.0 + time * 10.0) * 0.1;
  float randJitter = (noise - 0.5) * 1.2;  // -0.1 ~ 0.1 범위
  pos.x += wave;
  pos.y += randJitter;
  vFlameNoise = wave;
  vY = pos.y;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
    `,
    fragmentShader: `
// fragmentShader.glsl
uniform float power;
uniform float time;
varying float vFlameNoise;
varying float vY;

void main() {
  float yFade = smoothstep(-1.0, 1.0, vY);
  vec3 coreColor = vec3(0.1, 0.3, 0.8);
  vec3 glowColor = vec3(0.6, 0.9, 1.0);
  float flicker = sin(time * 30.0 + vY * 10.0 + vFlameNoise * 10.0) * 0.3 + 0.7;
  vec3 flameColor = mix(coreColor, glowColor, yFade) * flicker;
  float alpha = (1.0 - yFade) * flicker;

  gl_FragColor = vec4(flameColor, alpha * power);
}
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    uniforms: {
      time: { value: 0 },
      power: { value: 1 }
    }
  });
  const jetFlame = new THREE.Mesh(geometry, material);
  jetFlame.position.set(-100, 22, 17);  // 엔진 위치에 맞게 조절
  jetFlame.scale.set(10, 15, 15);
  jetFlame.rotation.z = Math.PI / 2;
  this.mesh.add(jetFlame);

  const flameLight = new THREE.PointLight(0x6ed0fa, 2000, 500); // 색상, 강도, 거리
  flameLight.position.set(0, 0, 0); // 제트 위치에 따라 배치
  jetFlame.add(flameLight); // 불꽃 메시에 붙이면 자동으로 따라다님
  jetFlames.push([jetFlame, flameLight]);

  const jetFlame2 = new THREE.Mesh(geometry, material);
  jetFlame2.position.set(-100, 22, -17);  // 엔진 위치에 맞게 조절
  jetFlame2.scale.set(10, 15, 15);
  jetFlame2.rotation.z = Math.PI / 2;
  this.mesh.add(jetFlame2);

  const flameLight2 = new THREE.PointLight(0x6ed0fa, 2000, 500); // 색상, 강도, 거리
  flameLight2.position.set(0, 0, 0); // 제트 위치에 따라 배치
  jetFlame2.add(flameLight2); // 불꽃 메시에 붙이면 자동으로 따라다님
  jetFlames.push([jetFlame2, flameLight2]);



  const mirrorGeometry = new THREE.PlaneGeometry(1000, 1000); // 크기 조절 가능
  plane_mirror = new Reflector(mirrorGeometry, {
    clipBias: 0.003,
    textureWidth: window.innerWidth * window.devicePixelRatio,
    textureHeight: window.innerHeight * window.devicePixelRatio

  });

  // 2. 위치: 우주선 아래
  plane_mirror.rotation.x = -Math.PI / 2;  // 평면이 위로 향하게
  plane_mirror.position.x = -100;
  plane_mirror.position.y = -20;

  scene.add(plane_mirror);

};

var wave_vector = new THREE.Vector3(-3.1, 0, 1);
var hor_velocity = 0;

const threshold_wave = 0.06;

var sunDir;
var sunarrowHelper;
function Sea() {
  //let geom = new THREE.CylinderGeometry(game.seaRadius, game.seaRadius, game.seaLength, 4000, 10, true);
  let geometry = new THREE.SphereGeometry(game.seaRadius, 1000, 100);

  geometry = mergeVertices(geometry, 2.1);

  var l = geometry.attributes.position.count;
  for (var i = 0; i < l; i++) {
    var x = geometry.attributes.position.getX(i);
    var y = geometry.attributes.position.getY(i);
    var z = geometry.attributes.position.getZ(i);

    var pos_dir = new THREE.Vector3(x, y, z).normalize();
    const dot = pos_dir.dot(wave_vector.normalize());
    if (Math.abs(dot) < threshold_wave) {
      //const diff =  Math.pow((threshold_wave-Math.abs(dot))*10,3)*0.1;
      const diff = (threshold_wave - Math.abs(dot)) / threshold_wave;
      const cosdiff = (-Math.cos(diff * Math.PI) + 1) / 2;
      const scaled = new THREE.Vector3(x, y, z).multiplyScalar(1 + 0.06 * cosdiff);
      geometry.attributes.position.setXYZ(i, scaled.x, scaled.y, scaled.z);
    }
  }
  geometry.attributes.position.needsUpdate = true;
  //geometry.attributes.position.needsUpdate = true;

  sunDir = new THREE.Vector3(1, 0.56, -0.01);
  sunarrowHelper = new THREE.ArrowHelper(
    sunDir,
    new THREE.Vector3(0, 0, 0),
    500000000,
    0xffff00
  );
  sunDir = sunDir.normalize();

  const set_bvh = new MeshBVH(geometry);
  geometry.boundsTree = set_bvh;
  this.mesh = new WaterSphere(
    geometry,
    {
      textureWidth: 1024,
      textureHeight: 1024,
      waterNormals: new THREE.TextureLoader().load('textures/waternormals.jpg', (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      }),
      sunDirection: sunDir,
      sunColor: 0xc5c5c5,
      waterColor: 0x00242e,
      distortionScale: 3.7,
      fog: true
    }
  );

  //this.mesh.material.side = THREE.DoubleSide;
  this.mesh.rotation.x = -Math.PI / 2;
  //this.mesh.rotation.y = Math.PI / 2;
  this.mesh.name = "waves";
  this.mesh.receiveShadow = true;
  geometry.computeVertexNormals();

  /*
  ssrPass = new SSRPass({
    renderer,
    scene,
    camera,
    width: window.innerWidth,
    height: window.innerHeight,
    useDepthPass:true,
    selects: [ this.mesh]  // SSR 대상 등록
  });
  composer.addPass(ssrPass);*/
}

Sea.prototype.moveWaves = function () {
  sea.mesh.material.uniforms.resolution.value = new THREE.Vector2(window.innerWidth, window.innerHeight);
  sea.mesh.material.uniforms.inverseProjectionMatrix.value = new THREE.Matrix4().copy(camera.projectionMatrix).invert();
  sea.mesh.material.uniforms.inverseViewMatrix.value = new THREE.Matrix4().copy(camera.matrixWorld);
  sea.mesh.material.uniforms.sunDirection.value = sunDir;
  const worldCameraPos = new THREE.Vector3();
  camera.getWorldPosition(worldCameraPos);
  sea.mesh.material.uniforms.cameraPosition.value.copy(worldCameraPos);
  sea.mesh.material.uniforms['time'].value -= 1.0 / 60.0;
  return;
}

// 3D Models
var sea;
var airplane;
var plane_box;
var camera_box;
var arrowHelper;
window.addEventListener('keydown', (e) => {
  if (e.key === 'v') {
    airplane.mesh.visible = !airplane.mesh.visible;
    console.log('Toggle airplane visibility:', airplane.mesh.visible);
  }
});

const origin = new THREE.Vector3(0, 0, 0);
const dir_current = 0;
const dir_target = 0;
const dir_lerped = 0;
const arrowLength = 200;
var arrowCurrent, arrowTarget, arrowNew;

var debris_center;
var debris = [];
var debris_count = 300;
const returny = 0.96;
function createDebris() {
  const geometry = new THREE.SphereGeometry(1, 10, 10);
  const material = new THREE.MeshStandardMaterial({ color: 0xffff00 });
  debris_center = new THREE.Mesh(geometry, material);

  debris_center.position.set(0, -game.seaRadius, 0);

  debris_center.name = 'debris_center';

  scene.add(debris_center);

  const radius = game.seaRadius;
  const loader = new GLTFLoader();

  loader.load('models/debris1_mn.glb', function (gltf) {
    const originalModel = gltf.scene;
    originalModel.traverse(function (child) {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        //child.material.side = THREE.DoubleSide;


        if (!(child.material instanceof THREE.MeshStandardMaterial)) {
          const oldMat = child.material;
          const newMat = new THREE.MeshStandardMaterial({
            map: oldMat.map || null,
            color: oldMat.color || new THREE.Color(0xffffff),
            metalness: 0.5,
            roughness: 1,
            //envMap: bgRenderTarget.texture,
            envMapIntensity: 1
          });
          child.material = newMat;
        } else {
          //child.material.envMap = yourEnvMap;
          child.material.roughness = 1;
          child.material.metalness = 0.5;
          child.material.envMapIntensity = 1;
          child.material.needsUpdate = true;
        }
        child.material.normalMap = null;
        child.material.needsUpdate = true;
      }
    });

    originalModel.scale.set(10000, 10000, 10000);
    for (let r = 0; r < debris_count; r++) {
      let theta = Math.random() * 2 * Math.PI;
      let phi = Math.random() * Math.acos(returny);

      let x = Math.sin(phi) * Math.cos(theta);
      let y = Math.cos(phi);
      let z = Math.sin(phi) * Math.sin(theta);
      while (y > 0.999999) {
        //console.log("ih");
        theta = Math.random() * 2 * Math.PI;
        phi = Math.random() * Math.acos(0.9);

        x = Math.sin(phi) * Math.cos(theta);
        y = Math.cos(phi);
        z = Math.sin(phi) * Math.sin(theta);
      }
      const pos = new THREE.Vector3(x, y, z).multiplyScalar(radius + Math.random() * 100);

      const debrisClone = gltf.scene.clone(true);
      debrisClone.position.set(pos.x, pos.y, pos.z);

      debrisClone.traverse((child) => {
        if (child.isMesh && child.geometry) {
          child.geometry.boundsTree = new MeshBVH(child.geometry, { lazyGeneration: false });
        }
      });

      debris_center.add(debrisClone);
      debris.push(debrisClone);

    }
  });
}

function updateDebris() {
  const worldPos = new THREE.Vector3();
  const thy = game.seaRadius * returny - game.seaRadius;
  for (const db of debris) {
    db.getWorldPosition(worldPos);
    if (worldPos.y < thy) {
      worldPos.x *= -1;
      const parentInvMatrix = new THREE.Matrix4().copy(db.parent.matrixWorld).invert();
      worldPos.applyMatrix4(parentInvMatrix);

      db.position.copy(worldPos);
    }
  }
}
var particlePoints;
function createPlane() {
  const planeGeometry = new THREE.BoxGeometry(1, 1, 1);
  const blackMaterial = new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.0 });
  plane_box = new THREE.Mesh(planeGeometry, blackMaterial);
  plane_box.position.y = 0;
  scene.add(plane_box);

  camera_box = new THREE.Mesh(planeGeometry, blackMaterial);
  plane_box.add(camera_box);
  //plane_box.visible=false;
  airplane = new AirPlane();
  plane_box.add(airplane.mesh);
  //camera.lookAt(new THREE.Vector3(1000,0,0));
  camera_box.add(camera);
  camera.position.y += 70;
  //airplane.mesh.add(camera);
  arrowCurrent = new THREE.ArrowHelper(dir_current, origin, arrowLength, 0xffffff);
  //scene.add(arrowCurrent);
  arrowTarget = new THREE.ArrowHelper(dir_target, origin, arrowLength, 0xff0000);
  //scene.add(arrowTarget);
  arrowNew = new THREE.ArrowHelper(dir_lerped, origin, arrowLength, 0xffff00);
  //scene.add(arrowNew);
  //plane_box.add(arrowCurrent, arrowTarget, arrowNew);
  const sphereGeometry = new THREE.SphereGeometry(100, 32, 32);
  const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x444466, wireframe: true });
  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  //airplane.mesh.add(sphere);

  particlePoints = new THREE.Points(particleGeometry, particleMaterial);
  particlePoints.frustumCulled = false;
  scene.add(particlePoints);
}

function createSea() {
  sea = new Sea();
  sea.mesh.position.y = -game.seaRadius;
  scene.add(sea.mesh);
}

const bgScene = new THREE.Scene();
const bgCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
bgCamera.position.z = 1;
const bgRenderTarget = new THREE.WebGLRenderTarget(512, 512);
var skyBox;

var pmremGenerator;

function getYRotationMatrix(angleRad) {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return new THREE.Matrix3().set(
    c, 0, s,
    0, 1, 0,
    -s, 0, c
  );
}
function getRotationMatrix3(xRad, yRad, zRad) {
  const cx = Math.cos(xRad), sx = Math.sin(xRad);
  const cy = Math.cos(yRad), sy = Math.sin(yRad);
  const cz = Math.cos(zRad), sz = Math.sin(zRad);
  const rotX = new THREE.Matrix3().set(
    1, 0, 0,
    0, cx, -sx,
    0, sx, cx
  );
  const rotY = new THREE.Matrix3().set(
    cy, 0, sy,
    0, 1, 0,
    -sy, 0, cy
  );
  const rotZ = new THREE.Matrix3().set(
    cz, -sz, 0,
    sz, cz, 0,
    0, 0, 1
  );
  const result = new THREE.Matrix3();
  result.multiplyMatrices(rotY, rotX);
  result.premultiply(rotZ);
  return result;
}
function createCubeMap() {
  const envMap1 = new THREE.CubeTextureLoader()
    .setPath('textures/cubemap/')
    .load([
      'px.png', 'nx.png',
      'py.png', 'ny.png',
      'pz.png', 'nz.png'
    ]);

  const envMap2 = new THREE.CubeTextureLoader()
    .setPath('textures/cubemap_space/')
    .load([
      'px.png', 'nx.png',
      'py.png', 'ny.png',
      'pz.png', 'nz.png'
    ]);
  const uniforms = {
    envMap1: { value: envMap1 },
    envMap2: { value: envMap2 },
    mixFactor: { value: 0.0 },
    rotationMatrix1: { value: getYRotationMatrix(0) },
    rotationMatrix2: { value: getRotationMatrix3(Math.PI / 2 + 0.2, 0.0, 0.25 - Math.PI / 2) },
  };

  const skyboxMaterial = new THREE.ShaderMaterial({
    uniforms: uniforms,
    vertexShader:/* glsl */`
    varying vec3 vWorldDirection;

    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldDirection = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`,
    fragmentShader: /* glsl */`
    uniform samplerCube envMap1;
    uniform samplerCube envMap2;
    uniform float mixFactor;
    uniform mat3 rotationMatrix1;
    uniform mat3 rotationMatrix2;
    varying vec3 vWorldDirection;

    void main() {
      vec3 dir = normalize(vWorldDirection);
      vec3 rotatedDir1 = rotationMatrix1 * dir;
      vec3 rotatedDir2 = rotationMatrix2 * dir;

      vec4 color1 = textureCube(envMap1, rotatedDir1);
      vec4 color2 = textureCube(envMap2, rotatedDir2);
      vec4 boost = vec4(pow(color2.rgb,vec3(1.8)),1.0);
      gl_FragColor = mix(color1, boost, mixFactor);
    }
`,
    side: THREE.BackSide,
    depthWrite: false,
  });


  skyBox = new THREE.Mesh(new THREE.BoxGeometry(game.seaRadius, game.seaRadius, game.seaRadius), skyboxMaterial);
  skyBox.scale.set(game.seaRadius, game.seaRadius, game.seaRadius);
  skyBox.rotation.z = +0.1 + Math.PI;
  skyBox.rotation.y = - 0.2;
  skyBox.rotation.order = 'ZXY';
  bgScene.add(skyBox);
  pmremGenerator = new THREE.PMREMGenerator(renderer);
}
let processedEnvMap = null;
var game_clear = false;
function loop() {
  const altitude = plane_box.position.y;
  const mixFactor = THREE.MathUtils.clamp(altitude / 1000000 / 10, 0, 1);
  if (skyBox.material != null) {
    skyBox.material.uniforms.mixFactor.value = mixFactor;
  }

  skyBox.rotation.z -= 0.00003;
  sunDir.applyAxisAngle(new THREE.Vector3(0, 0, 1), - 0.00003);

  newTime = new Date().getTime();
  deltaTime = newTime - oldTime;
  oldTime = newTime;

  if (game.status == "playing") {

    updatePlane();
    updateDistance();
    updateEnergy();
    updateDebris();
    gamesystem();
    game.baseSpeed += (game.targetBaseSpeed - game.baseSpeed) * deltaTime * 0.02;

    //CG:0513
    game.speed = game.baseSpeed * game.planeSpeed;

  } else if (game.status == "gameover") {
    game.speed *= .99;
    airplane.mesh.rotation.z += (-Math.PI / 2 - airplane.mesh.rotation.z) * .0002 * deltaTime;
    airplane.mesh.rotation.x += 0.0003 * deltaTime;
    game.planeFallSpeed *= 1.05;
    airplane.mesh.position.y -= game.planeFallSpeed * deltaTime;

    if (airplane.mesh.position.y < -200) {
      showReplay();
      game.status = "waitingReplay";

    }
  } else if (game.status == "waitingReplay") {

  }
  sea.moveWaves();

  renderer.setRenderTarget(bgRenderTarget);
  renderer.render(bgScene, camera);
  renderer.setRenderTarget(null);

  if (processedEnvMap) processedEnvMap.dispose();
  processedEnvMap = pmremGenerator.fromEquirectangular(bgRenderTarget.texture).texture;

  airplane.mesh.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material.envMap = processedEnvMap;
      child.material.envMapIntensity = 1;
      child.material.needsUpdate = true;
    }
  });
  for (const db of debris) {
    db.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.envMap = processedEnvMap;
        child.material.envMapIntensity = 1;
        child.material.needsUpdate = true;
      }
    });
  }

  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.5;
  scene.background = bgRenderTarget.texture;
  scene.environment = processedEnvMap;
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function updateDistance() {
  game.distance += game.speed * deltaTime * game.ratioSpeedDistance;
  //fieldDistance.innerHTML = Math.floor(game.distance);
  var d = 502 * (1 - (game.distance % game.distanceForLevelUpdate) / game.distanceForLevelUpdate);
  //levelCircle.setAttribute("stroke-dashoffset", d);
}

function updateEnergy() {
  game.energy -= power * 0.0002;
  if (game.energy <= 0) {
    power *= 0.6;
  }
  game.energy = Math.max(0, game.energy);
  //energyBar.style.right = (100 - game.energy) + "%";
  //energyBar.style.backgroundColor = (game.energy < 50) ? "#f25346" : "#68c3c0";

  if (game.energy < 30) {
    //energyBar.style.animationName = "blinking";
  } else {
    //energyBar.style.animationName = "none";
  }

  if (game.energy < 1) {
    //game.status = "gameover";
  }
}

var gamedistance = 0;

function updatePlane() {
  for (let i = 0; i < jetFlames.length; i++) {
    const [flameMesh, flameLight] = jetFlames[i];
    const engine_power = power + 0.1;
    flameMesh.scale.y = 0.4 * engine_power;
    flameMesh.material.uniforms.power.value = engine_power;
    flameMesh.material.uniforms.time.value = deltaTime;
    flameLight.intensity = engine_power * 300;
  }
}

function showReplay() {
  replayMessage.style.display = "block";
}

function hideReplay() {
  replayMessage.style.display = "none";
  airplane.mesh.position.y = 0;
  airplane.mesh.rotation.x = 0;
  airplane.mesh.rotation.y = 0;
  airplane.mesh.rotation.z = 0;
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
var vx_view, vy_view, speed_view, altitude_view;

function init(event) {
  // UI
  fieldDistance = document.getElementById("distValue");
  energyBar = document.getElementById("energyBar");
  replayMessage = document.getElementById("replayMessage");
  fieldLevel = document.getElementById("levelValue");
  levelCircle = document.getElementById("levelCircleStroke");

  vx_view = document.getElementById('vx');
  vy_view = document.getElementById('vy');
  speed_view = document.getElementById('speed');
  altitude_view = document.getElementById('altitude');

  resetGame();
  createScene();

  //createLights();
  createPlane();
  createSea();

  createCubeMap();
  createDebris();
  document.addEventListener('mousemove', handleMouseMove, false);
  document.addEventListener('touchmove', handleTouchMove, false);
  document.addEventListener('mouseup', handleMouseUp, false);
  document.addEventListener('touchend', handleTouchEnd, false);
  loop();
}

const keys = {};

document.addEventListener("keydown", (e) => {
  //console.log(e.code);
  keys[e.code] = true;
  if (e.code == "Space") {
    orbiting = true;
  }
});

document.addEventListener("keyup", (e) => {
  keys[e.code] = false;
  if (e.code == "Space") {
    orbiting = false;
  }
});

window.addEventListener('load', init, false);

function lerp(a, b, t) {
  return a + (b - a) * t * deltaTime;
}
const MAX_DRAG_ALTITUDE = 100000; // 이 고도 이상이면 공기저항 없음

// 입자 배열
const particles = [];
const maxParticles = 10000;

// 입자용 버퍼 지오메트리
const particleGeometry = new THREE.BufferGeometry();
const positions = new Float32Array(maxParticles * 3);
const alphas = new Float32Array(maxParticles);

particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
particleGeometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

const particleMaterial = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 1,
  transparent: true,
  opacity: 0.6,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

function emitParticle(dragDir,rotationDelta) {
  if (particles.length >= maxParticles) return;

  // 구 표면 랜덤 위치 구하기
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);

  // 구 좌표 (구면 좌표 → 데카르트 좌표)
  const x = 100 * Math.sin(phi) * Math.cos(theta);
  const y = 100 * Math.sin(phi) * Math.sin(theta);
  const z = 100 * Math.cos(phi);
  const position = new THREE.Vector3(x, y, z);

  // 표면 법선 (구 중심에서 입자 위치 방향)
  const normal = position.clone();
  position.y = plane_box.position.y+y;

  // 바람 방향 벡터 (예: 약간 바람 방향을 튜닝)
  const windDir = new THREE.Vector3(dragDir.x*10000,dragDir.y*-500000,0.0);

  // 입자 초기 속도: 법선과 바람 방향 적절히 혼합 (예: 70% 바람 + 30% 법선)
  const velocity = windDir.multiplyScalar(2.0).add(normal.multiplyScalar(windDir.length()*0.005));
  
  // 입자 객체
  const particle = {
    position,
    velocity,
    age: 0,
    life: 50 + Math.random() * 1, // 수명 2~3초
  };
  particles.push(particle);
  //console.log(windDir.length().toFixed(2));
  windDir.y=dragDir.y*10000;
  particlePoints.material.opacity=Math.min(0.4,windDir.length()*0.01)+rotationDelta;
  //particlePoints.material.opacity=1.0;
  particlePoints.material.size=Math.min(100.0,0.1+windDir.length()*0.4)+rotationDelta*20;
  //particlePoints.material.size=20.0;
}

function updateParticles(delta) {
  let idx = 0;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.position.add(p.velocity.clone().multiplyScalar(delta));
    p.age += delta;

    // 알파: 수명 끝날수록 투명해짐
    alphas[i] = 1 - (p.age / p.life);
    if (alphas[i] < 0) alphas[i] = 0;

    // 위치 업데이트
    positions[idx++] = p.position.x;
    positions[idx++] = p.position.y;
    positions[idx++] = p.position.z;

    if (p.age > p.life) {
      particles.splice(i, 1);
      // 뒤로 땡겨서 배열 유지
      // 나중에 최적화 가능
    }
  }

  particleGeometry.attributes.position.needsUpdate = true;
  particleGeometry.attributes.alpha.needsUpdate = true;
}


function applyAirResistance(plane_velocity, dragFactor, b) {
  const DRAG_COEFF = 0.0001;
  const speed = Math.hypot(plane_velocity.x, plane_velocity.y);
  if (speed === 0) return plane_velocity;
  const effectiveDrag = DRAG_COEFF * dragFactor;
  const dragMagnitude = effectiveDrag * Math.sqrt(speed, 2);
  const dragDir = {
    x: -plane_velocity.x / speed* dragMagnitude * deltaTime,
    y: -plane_velocity.y / speed* dragMagnitude * deltaTime/10
  };
  plane_velocity.x += dragDir.x;
  plane_velocity.y += dragDir.y;
  let currentAngle = Math.atan2(plane_velocity.y, plane_velocity.x);
  const deltaAngle = THREE.MathUtils.degToRad(b * 90);
  let targetAngle = deltaAngle;
  let angleDiff = targetAngle - currentAngle;
  angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
  const lerpFactor = 0.0003 * plane_velocity.length();
  const rotationDelta = angleDiff * lerpFactor * dragFactor;
  plane_velocity.rotateAround(new THREE.Vector2(0, 0), rotationDelta);

  emitParticle(dragDir,rotationDelta*100);            // 매 프레임 새 입자 방출 (필요시 조절)
  updateParticles(deltaTime*0.1);



  return plane_velocity;
}

function distribute_power(b, pw) {
  const vx = pw * Math.sqrt(1 - Math.abs(b));
  const vy = pw * Math.sign(b) * Math.sqrt(Math.abs(b));
  return { vx, vy };
}

function generatePointsInsideBox(box, resolution) {
  const points = [];
  const stepX = (box.max.x - box.min.x) / resolution;
  const stepY = (box.max.y - box.min.y) / resolution;
  const stepZ = (box.max.z - box.min.z) / resolution;

  for (let i = 0; i <= resolution; i++) {
    for (let j = 0; j <= resolution; j++) {
      for (let k = 0; k <= resolution; k++) {
        points.push(new THREE.Vector3(
          box.min.x + stepX * i,
          box.min.y + stepY * j,
          box.min.z + stepZ * k
        ));
      }
    }
  }
  return points;
}

function isPointInsideMesh(point, mesh) {
  const direction = new THREE.Vector3(0, -1, 0);
  const raycaster = new THREE.Raycaster(point, direction.clone().normalize(), 0, 1000000000);
  const tempMesh = mesh.clone();
  tempMesh.applyMatrix4(mesh.matrixWorld);
  const intersects = raycaster.intersectObject(tempMesh, true);
  intersects.forEach((hit, i) => {
    plane_mirror.position.y = Math.min(0.0, hit.point.y - 15);
  });
  return intersects.length % 2 === 0;
}

var floatvelocity = 0;
function updateAltitudeBar(altitude, maxAltitude = 200) {
  const fill = document.getElementById('altitudeFill');
  const label = document.getElementById('altitudeText');
  const percent = THREE.MathUtils.clamp(altitude / maxAltitude, 0, 1);
  fill.style.height = `${percent * 100}%`;
  label.textContent = `Altitude: ${(altitude / 10).toFixed(1)}`;
}

function updateHUD(pitchDeg, rollDeg, speed, fuelPercent, solarPercent) {
  const horizon = document.getElementById('horizon');
  const speedDisplay = document.getElementById('speed-display');
  const maxPitchOffset = 150;
  const clampedPitch = THREE.MathUtils.clamp(pitchDeg, -90, 90);
  const pitchOffset = -clampedPitch / 90 * maxPitchOffset;
  horizon.style.transform = `translateY(${pitchOffset}px) rotate(${-rollDeg}deg)`;
  speedDisplay.textContent = `${speed.toFixed(0)} km/h`;
  document.getElementById('fuelFill').style.height = `${THREE.MathUtils.clamp(fuelPercent, 0, 100)}%`;
  document.getElementById('solarFill').style.width = `${THREE.MathUtils.clamp(solarPercent, 0, 100)}%`;
  document.getElementById('distance-display').textContent = `Distance: ${gamedistance.toFixed(2)} km`;
}
function gamesystem() {
  sea.mesh.material.uniforms['rotationAngle'].value -= 0.00000048;
  const totalSpeed = Math.hypot(plane_velocity.x, plane_velocity.y);
  const plane_altitude = plane_box.position.y * 0.04;
  const dragFactor = 1.0 - Math.min(plane_altitude / MAX_DRAG_ALTITUDE, 1.0);
  const dir = airplane.mesh.rotation.z * 0.9;
  const dis_power = distribute_power(dir, power / 200000);
  plane_velocity.x += dis_power.vx * deltaTime;
  plane_velocity.y += dis_power.vy * deltaTime;
  plane_velocity = applyAirResistance(plane_velocity, dragFactor, dir);

  airplane.mesh.updateWorldMatrix();
  const airplane2world = new THREE.Matrix4().copy(airplane.mesh.matrixWorld);
  const world2sea = new THREE.Matrix4().copy(sea.mesh.matrixWorld).invert();
  const airplane2sea = new THREE.Matrix4().multiplyMatrices(world2sea, airplane2world);
  const intersects1 = sea.mesh.geometry.boundsTree.intersectsBox(airplane_collider_box1, airplane2sea);
  const intersects2 = detectdebris();

  if (intersects2) {
    plane_velocity.x *= 0.94;
    plane_velocity.y *= 0.94;
    if (totalSpeed > 5) {
      game.status = "gameover";
    }
  }
  const accu = 5;
  const points = generatePointsInsideBox(airplane_collider_box1, accu);
  let isInside = false;
  var count = 0;
  for (const p of points) {
    const localP = p.clone().applyMatrix4(airplane2world);
    if (isPointInsideMesh(localP, sea.mesh)) {
      count++;
      isInside = true;
    }
  }
  count /= accu * accu * accu;
  if (!orbiting) {
    airplane.mesh.rotation.z = lerp(airplane.mesh.rotation.z, mousePos.y, totalSpeed * 0.0003 * dragFactor + power * 0.000001);
  }
  if ((intersects1 || isInside) && game.status != "gameover") {
    if (totalSpeed > 5) {
      plane_velocity.x = 0;
      plane_velocity.y = 0;
      game.status = "gameover";
    }
    plane_velocity.x -= plane_velocity.x * 0.07 * count * deltaTime * 0.1;
    plane_velocity.y -= plane_velocity.y * 0.05 * count * deltaTime * 0.1;
    floatvelocity += 0.003 * count;
    floatvelocity *= 1.001;
    airplane.mesh.rotation.z += -airplane.mesh.rotation.z * 0.001 * deltaTime;
    hor_velocity *= 0.7;
  }
  else {
    floatvelocity *= 0.98;
    plane_velocity.y -= (0.001) * Math.pow(Math.max(0.0, 200000 - plane_altitude) / 200000, 2);
  }
  hor_velocity *= 0.991;
  plane_box.position.y += plane_velocity.y * deltaTime + floatvelocity * deltaTime;
  const scale = game.seaRadius / (game.seaRadius + plane_altitude);
  skyBox.rotation.z += plane_velocity.x * 0.000001 * deltaTime * scale;
  sunDir.applyAxisAngle(new THREE.Vector3(0, 0, 1), plane_velocity.x * 0.000001 * deltaTime * scale);
  sea.mesh.rotation.y -= plane_velocity.x * 0.000001 * scale + 0.000003;//*game.seaRotationSpeed;\
  sea.mesh.rotation.x += hor_velocity * 0.00000001 * scale;
  airplane.mesh.rotation.x = -hor_velocity * 0.002 * scale;
  debris_center.rotation.z += plane_velocity.x * 0.000001 * scale;//*game.seaRotationSpeed;\
  debris_center.rotation.x += hor_velocity * 0.00000001 * scale;
  if (keys["KeyW"] && power < 200 && game.energy > 0) {
    power += 1;
  }
  else if (power > 0) {
    power -= 1;
  }
  if (keys["KeyS"]) {

  }
  if (keys["KeyA"] && game.energy > 0) {

    hor_velocity += 1;
  }
  if (keys["KeyD"] && game.energy > 0) {
    hor_velocity -= 1;
  }
  updateAltitudeBar(plane_box.position.y, game.seaRadius * 0.06);
  if (!game_clear && plane_box.position.y / 1000000 / 10 >= 1) {
    game_clear = true;
    const message = document.getElementById('success-message');
    message.classList.add('show');
  }
  const pitch = THREE.MathUtils.radToDeg(-airplane.mesh.rotation.z);
  const roll = THREE.MathUtils.radToDeg(-airplane.mesh.rotation.x);
  const rotationZ = skyBox.rotation.z % (Math.PI * 2);
  const baseSunDirection = new THREE.Vector3(-1, 0, 0);
  const sunRotation = new THREE.Euler(0, 0, rotationZ);
  const sunDirection = baseSunDirection.clone().applyEuler(sunRotation);
  const upVector = new THREE.Vector3(0.2, 1, 0).normalize();
  const worldUp = upVector.clone().applyQuaternion(airplane.mesh.quaternion);
  arrowTarget.setDirection(worldUp);
  const solarAmount = Math.max(0.1, sunDirection.dot(worldUp));
  if (game.energy < 100) {
    game.energy += solarAmount * 0.025;
  }
  updateHUD(pitch, roll, totalSpeed * 100 - 7, game.energy, solarAmount * 100);
  if (orbiting) {
    camcontrol();
  }
  else {
    camcontroloff();
  }
  gamedistance += plane_velocity.x * 0.0001 * deltaTime;
}

function detectdebris() {
  const worldPos = new THREE.Vector3();
  const playerPos = airplane.mesh.getWorldPosition(new THREE.Vector3());
  const filterDistanceSq = 200000000;
  for (const db of debris) {
    db.getWorldPosition(worldPos);
    const distSq = playerPos.distanceToSquared(worldPos);
    if (distSq > filterDistanceSq) continue;
    const db2world = new THREE.Matrix4().copy(db.matrixWorld);
    const world2db = new THREE.Matrix4().copy(db2world).invert();
    const airplane2db = new THREE.Matrix4().multiplyMatrices(world2db, airplane.mesh.matrixWorld);
    let hit = false;
    db.traverse(child => {
      if (child.isMesh && child.geometry && child.geometry.boundsTree) {
        const intersects = child.geometry.boundsTree.intersectsBox(airplane_collider_box1, airplane2db);
        if (intersects) {
          hit = true;
        }
      }
    });
    if (hit) {

      return true;
    }
  }
  return false;
}

function camcontrol() {
  camera.position.x = lerp(camera.position.x, -2000, 0.001);
  const targetEuler = new THREE.Euler(
    0,
    -mousePos.x * Math.PI,
    mousePos.y * Math.PI / 2,
    'YXZ'
  );
  const targetQuaternion = new THREE.Quaternion().setFromEuler(targetEuler);
  camera_box.quaternion.slerp(targetQuaternion, 0.05);
}
function camcontroloff() {
  camera.position.x = lerp(camera.position.x, -800, 0.001);
  const targetEuler = new THREE.Euler(
    0,
    0,
    0,
    'YXZ'
  );
  const targetQuaternion = new THREE.Quaternion().setFromEuler(targetEuler);
  camera_box.quaternion.slerp(targetQuaternion, 0.05);

}