# Three.js 실습 기획서 – The Aviator 프로젝트 확장 실습

## 1. 실습 개요

본 실습은 Three.js 기반 예제 프로젝트인 **The Aviator**를 활용하여
학생들이 **Scene Graph 구조, Transform 활용, Shader 프로그래밍, Post Processing**을 실제 코드 기반에서 학습하도록 하는 것을 목표로 한다.

원본 프로젝트는 약 10년 전에 작성된 코드로, 현재 Three.js 구조와 차이가 있으므로
실습 과정에서 **최신 Three.js 문법으로 포팅하는 과정**을 먼저 진행한다.

또한 본 실습에서는 **Antigravity와 같은 AI 기반 바이브 코딩 도구**를 활용하여
학생들이 새로운 그래픽 기능을 빠르게 구현해보는 경험을 할 수 있도록 한다.

본 실습은 과제가 아닌 **수업 시간 중 함께 진행하는 코드 실습 형태**로 진행된다.

---

# 2. 실습 목표

본 실습을 통해 학생들이 다음 개념을 실습 기반으로 이해하는 것을 목표로 한다.

* 최신 Three.js 코드 구조 이해
* Scene Graph 구조 분석 및 Transform 활용
* CPU 기반 애니메이션을 GPU Shader 기반 애니메이션으로 변경
* Custom Shader 및 Material 적용
* Post Processing 파이프라인 이해
* AI 도구(Antigravity)를 활용한 그래픽 기능 확장 경험

---

# 3. 실습 대상 프로젝트

실습에서 사용할 프로젝트:

The Aviator
https://github.com/yakudoo/TheAviator

본 프로젝트는 다음과 같은 요소를 포함한다.

* 비행기 모델
* 바다(Sea)
* 구름(Cloud)
* 하늘(Sky)
* 간단한 애니메이션

---

# 4. 실습 진행 단계

## 4.1 Three.js 최신 버전으로 포팅

원본 Aviator 코드는 약 10년 전 버전의 Three.js를 기준으로 작성되어 있다.

따라서 다음과 같은 작업을 통해 최신 Three.js 구조로 수정한다.

### 주요 수정 내용

* ES Module 기반 import 구조로 변경
* deprecated API 제거
* geometry / material 생성 방식 업데이트
* renderer / scene 초기화 코드 정리

### 목표

* 최신 Three.js 코드 구조 이해
* 오래된 예제 코드 분석 능력 향상

---

# 4.2 Scene Graph 분석 및 Transform 실습

원본 Aviator 프로젝트의 Scene Graph 구조를 분석하고
Transform을 활용하여 객체 관계를 재구성한다.

### 실습 내용

1. 기존 Scene Tree 구조 분석
2. 비행기 객체를 부모 노드로 설정
3. 카메라를 비행기의 자식 객체로 추가

예시 구조

```
Airplane Box (parent)
 └ Airplane
 └ Camera
```

### 구현 목표

* 비행기의 위치 이동 시 카메라가 함께 이동
* 비행기의 회전은 카메라의 방향을 분리하여 제어

### 학습 포인트

* Scene Graph 구조
* Parent / Child Transform 관계
* Object3D Transform 전파

---

# 4.3 Sea Wave 애니메이션을 GPU Shader로 변경

원본 Aviator 프로젝트에서는 바다의 wave 애니메이션을
CPU에서 vertex 위치를 직접 변경하는 방식으로 처리한다.

본 실습에서는 이를 **Vertex Shader 기반 GPU 애니메이션**으로 변경한다.

### 기존 방식

* JavaScript에서 vertex 위치 직접 수정
* CPU 연산 기반 애니메이션

### 변경 방식

* Vertex Shader에서 sin 함수를 이용한 wave 생성

예시 개념

```
position.y += sin(position.x * frequency + time) * amplitude
```

### 학습 포인트

* CPU vs GPU 애니메이션 차이
* Vertex Shader 활용
* 시간 기반 애니메이션

---

# 4.4 Custom Shader 및 Material 적용

Three.js의 기본 Material 대신
Custom ShaderMaterial을 적용하여 시각 효과를 확장한다.

### 실습 예시

* 바다를 용암(Lava) 느낌으로 변경
* Noise 기반 애니메이션 적용
* 색상 변화 및 emissive 효과 추가

### 실습 방식

* Three.js Shader 예제 참고
* Antigravity를 활용하여 Shader 코드 생성
* 생성된 Shader를 프로젝트에 적용

### 학습 포인트

* ShaderMaterial 구조
* Vertex / Fragment Shader 역할
* Procedural visual effect 생성

---

# 4.5 Post Processing – Selective Bloom 추가

Three.js의 Post Processing 시스템을 활용하여
**Selective Bloom 효과**를 구현한다.

### Post Processing 구조

```
Scene Render
 → Bright Pass
 → Blur
 → Additive Blend
 → Final Image
```

### 실습 목표

특정 오브젝트에만 Bloom 효과 적용

예시

* 비행기 엔진
* 태양
* 용암 바다

### 구현 방법

* Three.js EffectComposer 사용
* UnrealBloomPass 적용
* Layer 시스템을 활용한 Selective Bloom 구현

### 학습 포인트

* Post Processing 파이프라인
* Screen Space Effect 개념
* Selective Rendering

---

# 5. AI 기반 바이브 코딩 활용

본 실습에서는 Antigravity 등의 AI 도구를 활용하여
그래픽 기능을 빠르게 확장하는 경험을 제공한다.

### 활용 예시

학생들이 AI에게 다음과 같은 기능을 요청하여 구현

* Shader 생성
* Particle 효과
* Bloom 효과 확장
* 환경 효과 추가

### 목표

* AI 기반 개발 워크플로우 경험
* 그래픽 프로토타이핑 속도 향상

---

# 6. 기대 학습 효과

본 실습을 통해 학생들은 다음과 같은 능력을 기를 수 있다.

* Three.js 기반 그래픽 프로젝트 구조 이해
* Scene Graph 기반 Transform 제어
* GPU Shader 기반 애니메이션 구현
* Post Processing 효과 구현
* AI 도구를 활용한 그래픽 기능 확장

또한 실제 프로젝트 코드를 분석하고 확장하는 경험을 통해
**그래픽 프로그래밍 실무와 유사한 개발 경험**을 얻을 수 있다.

---
