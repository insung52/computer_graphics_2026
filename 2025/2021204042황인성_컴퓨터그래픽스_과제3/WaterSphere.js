import {
	Color,
	FrontSide,
	Matrix4,
	Mesh,
	PerspectiveCamera,
	Plane,
	ShaderMaterial,
	UniformsLib,
	UniformsUtils,
	Vector2,
	Vector3,
	Vector4,
	WebGLRenderTarget,
	NormalBlending
} from 'three';

/**
 * Work based on :
 * https://github.com/Slayvin: Flat mirror for three.js
 * https://home.adelphi.edu/~stemkoski/ : An implementation of water shader based on the flat mirror
 * http://29a.ch/ && http://29a.ch/slides/2012/webglwater/ : Water shader explanations in WebGL
 */

class WaterSphere extends Mesh {

	constructor(geometry, options = {}) {

		super(geometry);

		this.isWater = true;

		const scope = this;

		const textureWidth = options.textureWidth !== undefined ? options.textureWidth : 512;
		const textureHeight = options.textureHeight !== undefined ? options.textureHeight : 512;

		const clipBias = options.clipBias !== undefined ? options.clipBias : 0.0;
		const alpha = options.alpha !== undefined ? options.alpha : 1.0;
		const time = options.time !== undefined ? options.time : 0.0;
		const normalSampler = options.waterNormals !== undefined ? options.waterNormals : null;
		const sunDirection = options.sunDirection !== undefined ? options.sunDirection : new Vector3(0.70707, 0.70707, 0.0);
		const sunColor = new Color(options.sunColor !== undefined ? options.sunColor : 0xffffff);
		const waterColor = new Color(options.waterColor !== undefined ? options.waterColor : 0x7F7F7F);
		const eye = options.eye !== undefined ? options.eye : new Vector3(0, 0, 0);
		const distortionScale = options.distortionScale !== undefined ? options.distortionScale : 20.0;
		const side = options.side !== undefined ? options.side : FrontSide;
		const fog = options.fog !== undefined ? options.fog : false;

		const mirrorPlane = new Plane();
		const normal = new Vector3();
		const mirrorWorldPosition = new Vector3();
		const cameraWorldPosition = new Vector3();
		const rotationMatrix = new Matrix4();
		const lookAtPosition = new Vector3(0, 0, - 1);
		const clipPlane = new Vector4();

		const view = new Vector3();
		const target = new Vector3();
		const q = new Vector4();

		const textureMatrix = new Matrix4();

		const mirrorCamera = new PerspectiveCamera();

		const renderTarget = new WebGLRenderTarget(textureWidth, textureHeight);

		const mirrorShader = {

			name: 'MirrorShader',

			uniforms: UniformsUtils.merge([
				UniformsLib['fog'],
				UniformsLib['lights'],
				{
					'normalSampler': { value: null },
					'mirrorSampler': { value: null },
					'alpha': { value: 1.0 },
					'time': { value: 0.0 },
					'size': { value: 10000000.0 },
					'textureMatrix': { value: new Matrix4() },
					'sunColor': { value: new Color(0xc5c5c5) },
					'sunDirection': { value: new Vector3(1.0, 1.0, 0.0) },
					'eye': { value: new Vector3() },
					'waterColor': { value: new Color(0x555555) },
					'wave_vector': { value: new Vector3(0.0, 0.0, 0.0) },
					'rotationAngle': { value: 0.0 },
					'resolution' : {value:new Vector2(0.0, 0.0)},
					'inverseProjectionMatrix': {value: null},
					'inverseViewMatrix': {value: null},
					'cameraPosition': {value: new Vector3(0.0, 0.0, 0.0)}
					
				}
			]),
			vertexShader: /* glsl */`
				//uniform mat4 modelViewMatrix;
				//uniform mat4 projectionMatrix;
				//attribute vec3 position;
				//attribute vec2 uv;
				//uniform mat4 projectionMatrix;
				//uniform mat4 viewMatrix;
				uniform mat4 textureMatrix;
				uniform float time;
				uniform float rotationAngle;
				uniform vec3 wave_vector;
				uniform vec2 resolution;

				varying vec4 mirrorCoord;
				varying vec4 worldPosition;
				varying vec2 vUv;
				varying vec3 vWorldNormal;
				varying vec3 vcolor;
				varying vec2 vScreenUV;

				#include <common>
				#include <fog_pars_vertex>
				#include <shadowmap_pars_vertex>
				#include <logdepthbuf_pars_vertex>

				void main() {
					vec3 pos = position;
					vec3 pos_dir = normalize(pos);
					vec3 wave_dir = normalize(wave_vector);

					float dot_angle = dot(pos_dir, wave_dir);

					vUv = uv;
					vWorldNormal = normalize( mat3(modelMatrix)*normal);
					mirrorCoord = modelMatrix * vec4( position, 1.0 );
					worldPosition = mirrorCoord.xyzw;
					mirrorCoord = textureMatrix * mirrorCoord;
					vec4 mvPosition =  modelViewMatrix * vec4( position, 1.0 );
					vec4 clipPosition = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
					vScreenUV = (clipPosition.xy / clipPosition.w) * 0.5 + 0.5;
					gl_Position = projectionMatrix * mvPosition;

				#include <beginnormal_vertex>
				#include <defaultnormal_vertex>
				#include <logdepthbuf_vertex>
				#include <fog_vertex>
				#include <shadowmap_vertex>
			}`,

			fragmentShader: /* glsl */`
				uniform sampler2D mirrorSampler;
				uniform float alpha;
				uniform float time;
				uniform float size;
				uniform sampler2D normalSampler;
				uniform vec3 sunColor;
				uniform vec3 sunDirection;
				uniform vec3 eye;
				uniform vec3 waterColor;
				uniform float rotationAngle;
				uniform vec3 wave_vector;
				uniform vec2 resolution;
				uniform mat4 inverseProjectionMatrix;
				uniform mat4 inverseViewMatrix;
				uniform mat4 projectionMatrix;
				
				varying vec4 mirrorCoord;
				varying vec4 worldPosition;
				varying vec2 vUv;
				varying vec3 vWorldNormal;
				varying vec3 vcolor;
				varying vec2 vScreenUV;


				vec4 getNoise( vec2 uv ) {
					
					vec2 uv0 = fract(( uv / 103.0 ) + vec2(time / 17.0, time / 29.0));
					vec2 uv1 = fract(uv / 107.0-vec2( time / -19.0, time / 31.0 ));
					vec2 uv2 = fract(uv / vec2( 8907.0, 9803.0 ) + vec2( time / 101.0, time / 97.0 ));
					vec2 uv3 = fract(uv / vec2( 1091.0, 1027.0 ) - vec2( time / 109.0, time / -113.0 ));
					vec4 noise = texture2D( normalSampler, uv0 ) +
						texture2D( normalSampler, uv1 ) +
						texture2D( normalSampler, uv2 ) +
						texture2D( normalSampler, uv3 );
					return noise * 0.5 - 1.0;
				}

				#include <common>
				#include <packing>
				#include <bsdfs>
				#include <fog_pars_fragment>
				#include <logdepthbuf_pars_fragment>
				#include <lights_pars_begin>
				#include <shadowmap_pars_fragment>
				#include <shadowmask_pars_fragment>

				void main() {

					#include <logdepthbuf_fragment>
					
					vec2 scaledUV = vec2(vUv.x+rotationAngle, vUv.y * 0.3);
					vec4 noise = getNoise(scaledUV*size);

					vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );
					vec3 diffuseLight = vec3(0.0);
					vec3 specularLight = vec3(0.0);
					vec3 worldToEye = eye-worldPosition.xyz;
					vec3 eyeDirection = normalize( worldToEye);
					vec2 screenUV = gl_FragCoord.xy / resolution;	//스크린 샘플 위치
					vec2 ndc = screenUV * 2.0 - 1.0;
					vec4 clipPos = vec4(ndc, 1.0, 1.0); // z=1: far plane
					vec4 viewPos = inverseProjectionMatrix * clipPos;
					vec4 worldPos = inverseViewMatrix * viewPos;
					vec3 viewRay = normalize(worldPos.xyz);			//눈 -> fragment 방향 벡터
					float NdotV = max(dot(-vWorldNormal,viewRay),0.0);
					float fresnel = pow(1.0 - NdotV, 6.0); // Schlick approximation
					vec3 reflection = reflect(viewRay, normalize(vWorldNormal));	//반사된 방향
					vec3 reflectedPos = worldPos.xyz*1.0 + reflection * 1000000.0;	
					vec4 clip = projectionMatrix * viewMatrix * vec4(reflectedPos, 1.0);
					clip /= clip.w;
					vec2 ssrUV = clip.xy * 0.5+0.5;					//반사 적용한 스크린 샘플 위치
					vec3 reflectionSample = texture2D(mirrorSampler, ssrUV).rgb*fresnel; 
					float sunin = pow(max(dot(sunDirection,reflection),0.0),50.0);
					float theta = max( dot( eyeDirection, surfaceNormal ), 0.0 );
					float rf0 = 0.3;
					float reflectance = rf0 + ( 1.0 - rf0 ) * pow( ( 1.0 - theta ), 5.0 );
					
					vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * waterColor;
					vec3 albedo = mix( ( sunColor * diffuseLight * 0.3 + scatter ) * getShadowMask(), ( vec3( 0.1 ) + reflectionSample * 0.9 + reflectionSample * specularLight ), reflectance);
					vec3 outgoingLight = albedo + sunColor * sunin*0.2;

					gl_FragColor = vec4( outgoingLight,0.93 );
					
					#include <tonemapping_fragment>
					#include <colorspace_fragment>
					#include <fog_fragment>	
				}`

		};

		const material = new ShaderMaterial({
			name: mirrorShader.name,
			uniforms: UniformsUtils.clone(mirrorShader.uniforms),
			vertexShader: mirrorShader.vertexShader,
			fragmentShader: mirrorShader.fragmentShader,
			transparent : true,
			blending: NormalBlending,
			lights: true,
			side: side,
			fog: fog
		});

		material.uniforms['mirrorSampler'].value = renderTarget.texture;
		material.uniforms['textureMatrix'].value = textureMatrix;
		material.uniforms['alpha'].value = alpha;
		material.uniforms['time'].value = time;
		material.uniforms['normalSampler'].value = normalSampler;
		material.uniforms['sunColor'].value = sunColor;
		material.uniforms['waterColor'].value = waterColor;
		material.uniforms['sunDirection'].value = sunDirection;
		material.uniforms['eye'].value = eye;

		scope.material = material;

		scope.onBeforeRender = function (renderer, scene, camera) {

			mirrorWorldPosition.setFromMatrixPosition(scope.matrixWorld);
			cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);

			rotationMatrix.extractRotation(scope.matrixWorld);

			normal.set(0, 0, 1);
			normal.applyMatrix4(rotationMatrix);

			view.subVectors(mirrorWorldPosition, cameraWorldPosition);

			// Avoid rendering when mirror is facing away

			if (view.dot(normal) > 0) return;

			view.reflect(normal).negate();
			view.add(mirrorWorldPosition);

			rotationMatrix.extractRotation(camera.matrixWorld);

			lookAtPosition.set(0, 0, - 1);
			lookAtPosition.applyMatrix4(rotationMatrix);
			lookAtPosition.add(cameraWorldPosition);

			target.subVectors(mirrorWorldPosition, lookAtPosition);
			target.reflect(normal).negate();
			target.add(mirrorWorldPosition);

			mirrorCamera.position.copy(view);
			mirrorCamera.up.set(0, 1, 0);
			mirrorCamera.up.applyMatrix4(rotationMatrix);
			mirrorCamera.up.reflect(normal);
			mirrorCamera.lookAt(target);

			mirrorCamera.far = camera.far; // Used in WebGLBackground

			mirrorCamera.updateMatrixWorld();
			mirrorCamera.projectionMatrix.copy(camera.projectionMatrix);

			// Update the texture matrix
			textureMatrix.set(
				0.5, 0.0, 0.0, 0.5,
				0.0, 0.5, 0.0, 0.5,
				0.0, 0.0, 0.5, 0.5,
				0.0, 0.0, 0.0, 1.0
			);
			textureMatrix.multiply(mirrorCamera.projectionMatrix);
			textureMatrix.multiply(mirrorCamera.matrixWorldInverse);

			const inverseMatrix = new Matrix4().copy(scope.matrixWorld).invert();
			textureMatrix.multiply(inverseMatrix);

			// Now update projection matrix with new clip plane, implementing code from: http://www.terathon.com/code/oblique.html
			// Paper explaining this technique: http://www.terathon.com/lengyel/Lengyel-Oblique.pdf
			mirrorPlane.setFromNormalAndCoplanarPoint(normal, mirrorWorldPosition);
			mirrorPlane.applyMatrix4(mirrorCamera.matrixWorldInverse);

			clipPlane.set(mirrorPlane.normal.x, mirrorPlane.normal.y, mirrorPlane.normal.z, mirrorPlane.constant);

			const projectionMatrix = mirrorCamera.projectionMatrix;

			q.x = (Math.sign(clipPlane.x) + projectionMatrix.elements[8]) / projectionMatrix.elements[0];
			q.y = (Math.sign(clipPlane.y) + projectionMatrix.elements[9]) / projectionMatrix.elements[5];
			q.z = - 1.0;
			q.w = (1.0 + projectionMatrix.elements[10]) / projectionMatrix.elements[14];

			// Calculate the scaled plane vector
			clipPlane.multiplyScalar(2.0 / clipPlane.dot(q));

			// Replacing the third row of the projection matrix
			projectionMatrix.elements[2] = clipPlane.x;
			projectionMatrix.elements[6] = clipPlane.y;
			projectionMatrix.elements[10] = clipPlane.z + 1.0 - clipBias;
			projectionMatrix.elements[14] = clipPlane.w;

			eye.setFromMatrixPosition(camera.matrixWorld);
			material.uniforms['eye'].value = eye;
			//console.log(eye);
			// Render

			const currentRenderTarget = renderer.getRenderTarget();

			const currentXrEnabled = renderer.xr.enabled;
			const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;

			scope.visible = false;

			renderer.xr.enabled = false; // Avoid camera modification and recursion
			renderer.shadowMap.autoUpdate = false; // Avoid re-computing shadows

			renderer.setRenderTarget(renderTarget);

			renderer.state.buffers.depth.setMask(true); // make sure the depth buffer is writable so it can be properly cleared, see #18897

			if (renderer.autoClear === false) renderer.clear();
			renderer.render(scene, mirrorCamera);

			scope.visible = true;

			renderer.xr.enabled = currentXrEnabled;
			renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;

			renderer.setRenderTarget(currentRenderTarget);

			// Restore viewport

			const viewport = camera.viewport;

			if (viewport !== undefined) {

				renderer.state.viewport(viewport);

			}

		};

	}

}

export { WaterSphere };
