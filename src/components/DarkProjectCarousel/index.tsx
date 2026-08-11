"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { PROJECTS } from "@/lib/projects";

const N = PROJECTS.length;
/** Card plane aspect 16:7 */
const CARD_W = 3.35;
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
    if (radius < 0.0004) return texture2D(tex, uv);
    vec4 sum = vec4(0.0);
    float wSum = 0.0;
    for (int y = -2; y <= 2; y++) {
      for (int x = -2; x <= 2; x++) {
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

    // Continuous chromatic drift
    float drift = sin(time * 1.7 + phase) * 0.35 + sin(time * 0.9 + phase * 1.3) * 0.25;
    float baseSplit = rgbAmt + glitchAmt * 0.006;
    vec2 split = vec2((baseSplit * (1.0 + drift)) / aspect, baseSplit * 0.4);

    // Occasional horizontal tear / slice glitch
    float band = floor(vUv.y * 18.0);
    float tearPulse = step(0.92, hash(band + floor(time * 6.0) + phase * 10.0));
    float tear = (hash21(vec2(band, floor(time * 8.0))) - 0.5) * tearPulse * glitchAmt * 0.045;

    // Sparse blocky RGB kick
    float block = step(0.96, hash(floor(time * 4.5) + phase * 7.0));
    float blockShift = (hash(time * 0.2 + phase) - 0.5) * block * glitchAmt * 0.03;

    vec2 uvR = vUv + split + vec2(tear + blockShift, 0.0);
    vec2 uvG = vUv + vec2(tear * 0.35, 0.0);
    vec2 uvB = vUv - split + vec2(-tear * 0.6 - blockShift * 0.5, 0.0);

    float r = sampleBlur(map, uvR, px.x).r;
    float g = sampleBlur(map, uvG, px.x).g;
    float b = sampleBlur(map, uvB, px.x).b;
    float a = sampleBlur(map, vUv, px.x).a;

    // Mild channel boost on glitch hits
    vec3 col = vec3(r, g, b) * tint;
    col.r += tearPulse * glitchAmt * 0.04;
    col.b += tearPulse * glitchAmt * 0.03;

    gl_FragColor = vec4(col, a * opacity);
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

function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    x: THREE.MathUtils.lerp(a.x, b.x, t),
    y: THREE.MathUtils.lerp(a.y, b.y, t),
    z: THREE.MathUtils.lerp(a.z, b.z, t),
    rotX: THREE.MathUtils.lerp(a.rotX, b.rotX, t),
    rotY: THREE.MathUtils.lerp(a.rotY, b.rotY, t),
    scale: THREE.MathUtils.lerp(a.scale, b.scale, t),
    scaleX: THREE.MathUtils.lerp(a.scaleX, b.scaleX, t),
    scaleY: THREE.MathUtils.lerp(a.scaleY, b.scaleY, t),
    opacity: THREE.MathUtils.lerp(a.opacity, b.opacity, t),
  };
}

function poseForFloat(offset: number, reduceMotion: boolean): Pose {
  const i0 = Math.floor(offset);
  const i1 = Math.ceil(offset);
  if (i0 === i1) return poseFor(i0, reduceMotion);
  const t = offset - i0;
  return lerpPose(poseFor(i0, reduceMotion), poseFor(i1, reduceMotion), t);
}

/** Blur / RGB / glitch strength — always some RGB, stronger off-center */
function fxFromOffset(absOffset: number, reduceMotion: boolean) {
  if (reduceMotion) return { blurAmt: 0, rgbAmt: 0.004, glitchAmt: 0 };
  const t = THREE.MathUtils.clamp(absOffset, 0, 2) / 2;
  const ease = t * t * (3 - 2 * t);
  return {
    blurAmt: ease * 0.024,
    // Center keeps a light chromatic fringe; neighbors go harder
    rgbAmt: 0.006 + ease * 0.034,
    glitchAmt: 0.55 + ease * 1.35,
  };
}

type CardMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> & {
  userData: {
    index: number;
    phase: number;
  };
};

/**
 * Dark-mode carousel: continuous inertial scroll, mouse parallax tilt, motion blur.
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
    let scrollVel = 0;
    let pointerNorm = 0;
    let pointerNormSmooth = 0;
    let disposed = false;
    let raf = 0;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);
    camera.position.set(-0.15, 0, 5.85);
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
      const offset = cardOffset(hit.userData.index, scroll);
      if (Math.abs(offset) > 0.35) {
        scroll += Math.sign(offset);
        scrollVel = Math.sign(offset) * 0.8;
      }
    };

    const onClick = (e: MouseEvent) => onPointer(e.clientX, e.clientY);
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      e.preventDefault();
      // Light mode: track.scrollTop += deltaY — same card travel per pixel here
      scroll += e.deltaY / pixelsPerCard();
      if (!reduceMotion && e.deltaY !== 0) {
        scrollVel += e.deltaY * 0.012;
      }
    };

    renderer.domElement.addEventListener("click", onClick);
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("pointermove", onPointerMove, { passive: true });

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

      if (!reduceMotion) {
        // scrollVel is blur energy only (position is 1:1 like light mode)
        scrollVel *= Math.pow(0.86, dt * 60);
        if (Math.abs(scrollVel) < 0.0008) scrollVel = 0;
      }

      pointerNormSmooth += (pointerNorm - pointerNormSmooth) * 0.14;
      // Left → tilt toward screen; right → recede
      const parallaxZ = -pointerNormSmooth * 0.32;
      const parallaxRotY = pointerNormSmooth * THREE.MathUtils.degToRad(9);

      const blur = reduceMotion
        ? 0
        : Math.min(14, Math.abs(scrollVel) * 110);
      renderer.domElement.style.filter =
        blur > 0.35 ? `blur(0px ${blur.toFixed(2)}px)` : "none";

      const order = [...cards].sort((a, b) => {
        const za = poseForFloat(cardOffset(a.userData.index, scroll), reduceMotion).z;
        const zb = poseForFloat(cardOffset(b.userData.index, scroll), reduceMotion).z;
        return za - zb;
      });
      order.forEach((card, i) => {
        card.renderOrder = i;
      });

      cards.forEach((card) => {
        const offset = cardOffset(card.userData.index, scroll);
        const p = poseForFloat(offset, reduceMotion);
        const fx = fxFromOffset(Math.abs(offset), reduceMotion);
        const phase = card.userData.phase;
        const floatY = reduceMotion
          ? 0
          : Math.sin(t * 1.05 + phase) * 0.045 +
            Math.sin(t * 0.55 + phase * 1.2) * 0.02;
        const floatX = reduceMotion
          ? 0
          : Math.sin(t * 0.7 + phase) * 0.02;
        const floatRotZ = reduceMotion
          ? 0
          : Math.sin(t * 0.8 + phase) * 0.012;

        card.position.set(p.x + floatX, p.y + floatY, p.z + parallaxZ);
        card.rotation.x = p.rotX;
        card.rotation.z = floatRotZ;
        card.rotation.y =
          p.rotY +
          parallaxRotY +
          (reduceMotion ? 0 : Math.sin(t * 0.6 + phase) * 0.015);
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
      className="project-carousel project-carousel--coverflow pointer-events-none absolute inset-y-4 left-[32%] z-[26] sm:inset-y-5 sm:left-[38%]"
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
