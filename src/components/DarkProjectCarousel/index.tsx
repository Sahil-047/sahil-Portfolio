"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { PROJECTS, PROJECT_SELECT_EVENT, openProject } from "@/lib/projects";

const N = PROJECTS.length;
/** Card plane aspect 16:7 */
const CARD_W = 3.85;
const CARD_H = CARD_W * (7 / 16);
/** Visible air between stacked cards (world units) */
const CARD_GAP = 0.52;
const NEIGHBOR_Y = CARD_H + CARD_GAP;

type Pose = {
  x: number;
  y: number;
  z: number;
  rotX: number;
  rotY: number;
  scale: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
};

/** Shared card style — same tilt/skew; depth + stack position only */
const CARD_YAW = -22;
const CARD_SKEW = { scaleX: 0.88, scaleY: 1.1 } as const;
/** Neighbors drift slightly right + further back */
const NEIGHBOR_X = 0.28;
const NEIGHBOR_Z_EXTRA = 0.22;

const CARD_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Soft blur + animated RGB channel glitches on card images */
const CARD_FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform float opacity;
  uniform float blurAmt;
  uniform float rgbAmt;
  uniform float glitchAmt;
  uniform float time;
  uniform float phase;
  uniform vec3 tint;
  varying vec2 vUv;

  float hash(float n) {
    return fract(sin(n) * 43758.5453);
  }

  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  vec4 sampleBlur(sampler2D tex, vec2 uv, float radius) {
    if (radius < 0.0005) return texture2D(tex, uv);
    vec4 sum = vec4(0.0);
    float wSum = 0.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 o = vec2(float(x), float(y)) * radius;
        float w = 1.0 / (1.0 + float(x * x + y * y));
        sum += texture2D(tex, clamp(uv + o, 0.0, 1.0)) * w;
        wSum += w;
      }
    }
    return sum / wSum;
  }

  void main() {
    float aspect = ${CARD_W.toFixed(3)} / ${CARD_H.toFixed(3)};
    vec2 px = vec2(blurAmt / aspect, blurAmt);

    float drift = sin(time * 0.7 + phase) * 0.18;
    vec2 split = vec2((rgbAmt * (1.0 + drift)) / aspect, rgbAmt * 0.35);

    float tear = 0.0;
    if (glitchAmt > 0.04) {
      float band = floor(vUv.y * 14.0);
      float pulse = step(0.97, hash(band + floor(time * 3.2) + phase * 10.0));
      tear = (hash21(vec2(band, floor(time * 4.0))) - 0.5) * pulse * glitchAmt * 0.028;
    }

    vec4 sR = sampleBlur(map, vUv + split + vec2(tear, 0.0), px.x);
    vec4 sG = sampleBlur(map, vUv + vec2(tear * 0.25, 0.0), px.x);
    vec4 sB = sampleBlur(map, vUv - split + vec2(-tear * 0.45, 0.0), px.x);

    gl_FragColor = vec4(vec3(sR.r, sG.g, sB.b) * tint, sG.a * opacity);
  }
`;

function createCardMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: null as THREE.Texture | null },
      opacity: { value: 0 },
      blurAmt: { value: 0 },
      rgbAmt: { value: 0 },
      glitchAmt: { value: 0 },
      time: { value: 0 },
      phase: { value: 0 },
      tint: { value: new THREE.Color(0xffffff) },
    },
    vertexShader: CARD_VERT,
    fragmentShader: CARD_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
}

function cardOffset(index: number, scroll: number): number {
  let d = index - scroll;
  const half = N / 2;
  while (d > half) d -= N;
  while (d < -half) d += N;
  return d;
}

function poseFor(offset: number, reduceMotion: boolean): Pose {
  const yaw = (deg: number) => THREE.MathUtils.degToRad(deg);
  const style = {
    rotX: 0,
    rotY: yaw(CARD_YAW),
    scaleX: CARD_SKEW.scaleX,
    scaleY: CARD_SKEW.scaleY,
  };

  const abs = Math.abs(offset);
  const yStep = reduceMotion ? NEIGHBOR_Y * 0.92 : NEIGHBOR_Y;
  const zBack = (reduceMotion ? 0.55 : 0.72) + NEIGHBOR_Z_EXTRA;
  const zExtra = reduceMotion ? 0.32 : 0.4;
  const xShift = (t: number) =>
    THREE.MathUtils.lerp(0, reduceMotion ? NEIGHBOR_X * 0.7 : NEIGHBOR_X, t);

  if (abs < 0.001) {
    return {
      x: 0,
      y: 0,
      z: reduceMotion ? 0 : 0.15,
      ...style,
      scale: 1,
      opacity: 1,
    };
  }

  if (abs <= 1) {
    const t = abs;
    return {
      x: xShift(t),
      y: offset * yStep,
      z: THREE.MathUtils.lerp(reduceMotion ? 0 : 0.15, -zBack, t),
      ...style,
      scale: THREE.MathUtils.lerp(1, reduceMotion ? 0.96 : 0.97, t),
      opacity: THREE.MathUtils.lerp(1, 0.55, t),
    };
  }

  if (abs <= 2) {
    const t = abs - 1;
    return {
      x: xShift(THREE.MathUtils.lerp(1, 1.35, t)),
      y: offset * yStep * THREE.MathUtils.lerp(1, 2, t),
      z: THREE.MathUtils.lerp(-zBack, -(zBack + zExtra), t),
      ...style,
      scale: THREE.MathUtils.lerp(reduceMotion ? 0.96 : 0.97, reduceMotion ? 0.93 : 0.94, t),
      opacity: THREE.MathUtils.lerp(0.55, 0, t),
    };
  }

  return {
    x: xShift(1.35),
    y: offset * yStep * 2,
    z: -(zBack + zExtra),
    ...style,
    scale: reduceMotion ? 0.93 : 0.94,
    opacity: 0,
  };
}

function damp(current: number, goal: number, lambda: number, dt: number) {
  return current + (goal - current) * (1 - Math.exp(-lambda * dt));
}

/** Blur / RGB — quiet on the focused card, a little more on neighbors */
function fxFromOffset(
  absOffset: number,
  speed: number,
  reduceMotion: boolean,
) {
  if (reduceMotion) return { blurAmt: 0, rgbAmt: 0.002, glitchAmt: 0 };
  const t = THREE.MathUtils.clamp(absOffset, 0, 2) / 2;
  const ease = t * t * (3 - 2 * t);
  const travel = THREE.MathUtils.clamp(speed * 1.1, 0, 1);
  return {
    blurAmt: ease * 0.01 + travel * 0.018,
    rgbAmt: 0.002 + ease * 0.016 + travel * 0.01,
    glitchAmt: ease * 0.35 + travel * 0.2,
  };
}

type CardMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> & {
  userData: {
    index: number;
    phase: number;
  };
};

/**
 * Dark-mode carousel: damped follow + settle, shader motion blur only.
 */
export default function DarkProjectCarousel() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let scroll = 0;
    let target = 0;
    let lastWheelMs = 0;
    let pointerNorm = 0;
    let pointerNormSmooth = 0;
    let disposed = false;
    let raf = 0;
    const SNAP_IDLE_MS = 140;
    const FOLLOW_LIVE = 16;
    const FOLLOW_SETTLE = 8;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 40);
    camera.position.set(-0.15, 0, 6.2);
    camera.lookAt(-0.25, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    renderer.domElement.className = "project-carousel__canvas";
    renderer.domElement.style.pointerEvents = "auto";
    renderer.domElement.style.willChange = "transform";

    const loader = new THREE.TextureLoader();
    const cards: CardMesh[] = [];
    const group = new THREE.Group();
    group.rotation.y = THREE.MathUtils.degToRad(4);
    scene.add(group);

    const geometry = new THREE.PlaneGeometry(CARD_W, CARD_H, 1, 1);

    PROJECTS.forEach((project, index) => {
      const material = createCardMaterial();
      const mesh = new THREE.Mesh(geometry, material) as CardMesh;
      mesh.userData = { index, phase: index * 1.37 };
      material.uniforms.phase.value = index * 1.37;
      group.add(mesh);
      cards.push(mesh);

      loader.load(
        project.image,
        (tex) => {
          if (disposed) {
            tex.dispose();
            return;
          }
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.magFilter = THREE.LinearFilter;
          material.uniforms.map.value = tex;
          material.needsUpdate = true;
        },
        undefined,
        () => {
          material.uniforms.tint.value.setHex(0x171717);
          material.needsUpdate = true;
        },
      );
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    /** Same card+gap pixel step as light-mode strip so wheel speed matches */
    const pixelsPerCard = () => {
      const h = Math.max(mount.clientHeight, 1);
      const isSm = window.matchMedia("(min-width: 640px)").matches;
      const gap = isSm ? 20 : 16;
      const cardScale = 1.14;
      const width = (h - 2 * gap) * (16 / 27) * cardScale;
      return Math.max(width * (9 / 16) + gap, 1);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      pointerNorm = THREE.MathUtils.clamp(
        ((e.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
        -1,
        1,
      );
    };

    const onPointer = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(cards, false);
      if (!hits.length) return;
      const hit = hits[0].object as CardMesh;
      const offset = cardOffset(hit.userData.index, target);
      if (Math.abs(offset) > 0.35) {
        target += offset;
        lastWheelMs = 0;
        return;
      }
      openProject(hit.userData.index);
    };

    const onClick = (e: MouseEvent) => onPointer(e.clientX, e.clientY);
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      e.preventDefault();
      lastWheelMs = performance.now();
      target += e.deltaY / pixelsPerCard();
    };

    const onSelect = (e: Event) => {
      const index = (e as CustomEvent<{ index: number }>).detail?.index;
      if (typeof index !== "number") return;
      target += cardOffset(index, target);
      lastWheelMs = 0;
    };

    renderer.domElement.addEventListener("click", onClick);
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener(PROJECT_SELECT_EVENT, onSelect);

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const clock = new THREE.Clock();

    const tick = () => {
      if (disposed) return;
      raf = requestAnimationFrame(tick);
      // getDelta() must run before reading elapsedTime — getElapsedTime() clears delta
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      const prevScroll = scroll;
      const idle = performance.now() - lastWheelMs > SNAP_IDLE_MS;
      if (idle) target = Math.round(target);

      if (reduceMotion) {
        scroll = target;
      } else {
        const lambda = idle ? FOLLOW_SETTLE : FOLLOW_LIVE;
        scroll = damp(scroll, target, lambda, dt);
        if (idle && Math.abs(target - scroll) < 0.00035) scroll = target;
      }

      const speed = reduceMotion
        ? 0
        : Math.min(Math.abs(scroll - prevScroll) / Math.max(dt, 0.001), 8);

      pointerNormSmooth = damp(pointerNormSmooth, pointerNorm, 8, dt);
      const parallaxZ = -pointerNormSmooth * 0.28;
      const parallaxRotY = pointerNormSmooth * THREE.MathUtils.degToRad(8);
      const rest = THREE.MathUtils.clamp(1 - speed * 0.55, 0, 1);

      cards.forEach((card) => {
        const offset = cardOffset(card.userData.index, scroll);
        const abs = Math.abs(offset);
        card.renderOrder = 8 - abs;
        const p = poseFor(offset, reduceMotion);
        const fx = fxFromOffset(abs, speed, reduceMotion);
        const phase = card.userData.phase;
        const floatY = reduceMotion
          ? 0
          : Math.sin(t * 0.55 + phase) * 0.016 * rest;
        const floatRotZ = reduceMotion
          ? 0
          : Math.sin(t * 0.4 + phase) * 0.006 * rest;

        card.position.set(p.x, p.y + floatY, p.z + parallaxZ);
        card.rotation.x = p.rotX;
        card.rotation.z = floatRotZ;
        card.rotation.y = p.rotY + parallaxRotY;
        card.scale.set(p.scale * p.scaleX, p.scale * p.scaleY, p.scale);

        const mat = card.material;
        mat.uniforms.opacity.value = p.opacity;
        mat.uniforms.blurAmt.value = fx.blurAmt;
        mat.uniforms.rgbAmt.value = fx.rgbAmt;
        mat.uniforms.glitchAmt.value = fx.glitchAmt;
        mat.uniforms.time.value = t;
        mat.uniforms.phase.value = phase;
        card.visible = p.opacity > 0.02;
      });

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("click", onClick);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener(PROJECT_SELECT_EVENT, onSelect);
      renderer.domElement.style.filter = "none";
      cards.forEach((card) => {
        card.material.uniforms.map.value?.dispose();
        card.material.dispose();
      });
      geometry.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <aside
      className="project-carousel project-carousel--coverflow pointer-events-none absolute inset-y-0 left-[26%] z-[26] sm:left-[32%]"
      aria-label="Projects"
      data-carousel="three-coverflow"
    >
      <div ref={mountRef} className="project-carousel__viewport h-full w-full" />
      <ul className="sr-only">
        {PROJECTS.map((p) => (
          <li key={p.id}>{p.label}</li>
        ))}
      </ul>
    </aside>
  );
}
