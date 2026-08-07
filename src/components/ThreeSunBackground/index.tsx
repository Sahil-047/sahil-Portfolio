"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { registerSunSpin } from "@/lib/sunMotion";

/* —— Photosphere: granulation + limb darkening + convection —— */
const SUN_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const SUN_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;

  // Hash / noise
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec3(1.7, 9.2, 2.3);
      a *= 0.5;
    }
    return v;
  }

  // Worley-ish for granules
  float granule(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    float d = 1.0;
    for (int x = -1; x <= 1; x++)
    for (int y = -1; y <= 1; y++)
    for (int z = -1; z <= 1; z++) {
      vec3 g = vec3(float(x), float(y), float(z));
      vec3 o = vec3(hash(i + g), hash(i + g + 1.3), hash(i + g + 2.1));
      vec3 r = g + o - f;
      d = min(d, dot(r, r));
    }
    return 1.0 - clamp(d * 2.2, 0.0, 1.0);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 view = normalize(vViewDir);
    float ndv = max(dot(n, view), 0.0);

    // Limb darkening (photosphere realism)
    float limb = pow(ndv, 0.45);
    float limbSoft = smoothstep(0.0, 0.85, ndv);

    // Convection flow across surface
    vec3 sp = normalize(vWorldPos) * 3.2;
    vec3 flow = sp + vec3(uTime * 0.035, uTime * 0.02, -uTime * 0.028);
    float g = granule(flow * 2.8);
    float g2 = granule(flow * 5.5 + 10.0);
    float turb = fbm(flow * 1.4);
    float cells = mix(g, g2, 0.45) * 0.75 + turb * 0.35;

    // Hot core → cooler limb
    vec3 hot = vec3(1.0, 0.97, 0.82);
    vec3 mid = vec3(1.0, 0.72, 0.22);
    vec3 cool = vec3(0.95, 0.28, 0.02);
    vec3 deep = vec3(0.45, 0.05, 0.0);

    vec3 base = mix(cool, mid, cells);
    base = mix(base, hot, pow(cells, 2.2) * limb);
    base = mix(deep, base, limbSoft);

    // Faculae / bright ridges
    float facula = smoothstep(0.62, 0.92, cells) * limb;
    base += hot * facula * 0.55;

    // Subtle flicker
    float flicker = 0.92 + 0.08 * sin(uTime * 3.1 + turb * 6.0);
    base *= flicker;

    // Edge rim (chromosphere kiss)
    float rim = pow(1.0 - ndv, 2.8);
    base += vec3(1.0, 0.35, 0.05) * rim * 0.65;

    // HDR-ish intensity for tone mapping
    float intensity = 2.8 + cells * 1.6 + facula * 2.0;
    gl_FragColor = vec4(base * intensity, 1.0);
  }
`;

/* —— Corona / atmosphere with Fresnel falloff —— */
const CORONA_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const CORONA_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    float ndv = max(dot(normalize(vNormal), normalize(vViewDir)), 0.0);
    float fres = pow(1.0 - ndv, 2.1);
    float pulse = 0.85 + 0.15 * sin(uTime * 1.7);
    vec3 col = mix(uColorA, uColorB, fres) * fres * uIntensity * pulse;
    float alpha = clamp(fres * uIntensity * 0.9, 0.0, 0.85);
    gl_FragColor = vec4(col, alpha);
  }
`;

const FLARE_COUNT = 2200;
const VAPOR_COUNT = 900;

/**
 * Ultra-realistic procedural sun (shaders + particle vapors/waves).
 * Scroll tumbles it via sunMotion.
 */
export default function ThreeSunBackground() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070d);

    const camera = new THREE.PerspectiveCamera(
      38,
      mount.clientWidth / Math.max(mount.clientHeight, 1),
      0.1,
      200,
    );
    camera.position.set(0, 0, 13.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const sunGroup = new THREE.Group();
    // Right side — ~¾ of disc in frame
    sunGroup.position.set(5.8, 0.15, 0);
    scene.add(sunGroup);

    const sunUniforms = { uTime: { value: 0 } };
    const sunMat = new THREE.ShaderMaterial({
      vertexShader: SUN_VERT,
      fragmentShader: SUN_FRAG,
      uniforms: sunUniforms,
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(3.55, 128, 128), sunMat);
    sunGroup.add(core);

    const coronaUniforms = {
      uTime: { value: 0 },
      uIntensity: { value: 1.35 },
      uColorA: { value: new THREE.Color(1.0, 0.55, 0.12) },
      uColorB: { value: new THREE.Color(1.0, 0.2, 0.02) },
    };
    const coronaMat = new THREE.ShaderMaterial({
      vertexShader: CORONA_VERT,
      fragmentShader: CORONA_FRAG,
      uniforms: coronaUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
    });
    const corona = new THREE.Mesh(
      new THREE.SphereGeometry(3.95, 64, 64),
      coronaMat,
    );
    sunGroup.add(corona);

    const outerUniforms = {
      uTime: { value: 0 },
      uIntensity: { value: 0.75 },
      uColorA: { value: new THREE.Color(1.0, 0.75, 0.35) },
      uColorB: { value: new THREE.Color(1.0, 0.4, 0.05) },
    };
    const outerMat = new THREE.ShaderMaterial({
      vertexShader: CORONA_VERT,
      fragmentShader: CORONA_FRAG,
      uniforms: outerUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    const outerGlow = new THREE.Mesh(
      new THREE.SphereGeometry(5.1, 48, 48),
      outerMat,
    );
    sunGroup.add(outerGlow);

    // Soft billboard halo (fake volume)
    const haloTex = (() => {
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext("2d")!;
      const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
      g.addColorStop(0, "rgba(255,230,160,0.95)");
      g.addColorStop(0.25, "rgba(255,140,40,0.45)");
      g.addColorStop(0.55, "rgba(255,70,10,0.12)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    })();
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: haloTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.9,
      }),
    );
    halo.scale.set(14, 14, 1);
    sunGroup.add(halo);

    // Wave / prominence ribbons (torus bands)
    const waves: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(
        new THREE.TorusGeometry(4.05 + i * 0.28, 0.028 + i * 0.008, 10, 128),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? 0xffb060 : 0xff6a18,
          transparent: true,
          opacity: 0.22 - i * 0.03,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      m.rotation.x = Math.PI * (0.42 + i * 0.05);
      m.rotation.y = i * 0.55;
      sunGroup.add(m);
      waves.push(m);
    }

    // Flare particles clinging to surface
    const flarePos = new Float32Array(FLARE_COUNT * 3);
    const flareSpeed = new Float32Array(FLARE_COUNT);
    for (let i = 0; i < FLARE_COUNT; i++) {
      const r = 3.5 + Math.random() * 0.9;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      flarePos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      flarePos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      flarePos[i * 3 + 2] = r * Math.cos(phi);
      flareSpeed[i] = 0.4 + Math.random();
    }
    const flareGeo = new THREE.BufferGeometry();
    flareGeo.setAttribute("position", new THREE.BufferAttribute(flarePos, 3));
    const flares = new THREE.Points(
      flareGeo,
      new THREE.PointsMaterial({
        color: 0xffe8b0,
        size: 0.055,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    );
    sunGroup.add(flares);

    // Rising vapor / plasma plumes
    const vaporPos = new Float32Array(VAPOR_COUNT * 3);
    const vaporSeed = new Float32Array(VAPOR_COUNT);
    for (let i = 0; i < VAPOR_COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 3.6 + Math.random() * 2.2;
      vaporPos[i * 3] = Math.cos(a) * r;
      vaporPos[i * 3 + 1] = (Math.random() - 0.35) * 3.0;
      vaporPos[i * 3 + 2] = Math.sin(a) * r * 0.5;
      vaporSeed[i] = Math.random() * Math.PI * 2;
    }
    const vaporGeo = new THREE.BufferGeometry();
    vaporGeo.setAttribute("position", new THREE.BufferAttribute(vaporPos, 3));
    const vapors = new THREE.Points(
      vaporGeo,
      new THREE.PointsMaterial({
        color: 0xff8a3a,
        size: 0.1,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    );
    sunGroup.add(vapors);

    const light = new THREE.PointLight(0xffaa55, 120, 50, 2);
    light.position.set(0, 0, 0);
    sunGroup.add(light);
    scene.add(new THREE.AmbientLight(0x120a04, 0.25));

    const spin = { x: 0, y: 0, z: 0 };
    const unregister = registerSunSpin((deltaY) => {
      if (reduceMotion) return;
      spin.x += deltaY * 0.0048;
      spin.y += deltaY * 0.0024;
      spin.z += deltaY * 0.0015;
    });

    let raf = 0;
    const t0 = performance.now();

    const onResize = () => {
      const w = mount.clientWidth;
      const h = Math.max(mount.clientHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    const animate = (now: number) => {
      const t = (now - t0) * 0.001;
      sunUniforms.uTime.value = t;
      coronaUniforms.uTime.value = t;
      outerUniforms.uTime.value = t;

      sunGroup.rotation.x = spin.x + t * 0.06;
      sunGroup.rotation.y = spin.y + t * 0.09;
      sunGroup.rotation.z = spin.z * 0.4;

      const pulse = 1 + Math.sin(t * 1.3) * 0.012;
      core.scale.setScalar(pulse);
      corona.scale.setScalar(1 + Math.sin(t * 1.05) * 0.02);
      halo.material.opacity = 0.75 + Math.sin(t * 1.8) * 0.12;
      renderer.toneMappingExposure = 1.05 + Math.sin(t * 1.5) * 0.08;

      waves.forEach((ring, i) => {
        ring.rotation.z = t * (0.2 + i * 0.07);
        ring.rotation.x = Math.PI * 0.42 + Math.sin(t * 0.65 + i) * 0.28;
        const s = 1 + Math.sin(t * 1.5 + i * 1.1) * 0.05;
        ring.scale.set(s, s, 1);
      });

      // Flares orbit / lift
      const fp = flareGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < FLARE_COUNT; i++) {
        const ix = i * 3;
        const x = fp[ix];
        const y = fp[ix + 1];
        const z = fp[ix + 2];
        const len = Math.hypot(x, y, z) || 1;
        const lift =
          3.5 +
          (0.2 + 0.7 * flareSpeed[i]) *
            (0.5 + 0.5 * Math.sin(t * flareSpeed[i] + i));
        fp[ix] = (x / len) * lift;
        fp[ix + 1] = (y / len) * lift;
        fp[ix + 2] = (z / len) * lift;
      }
      flareGeo.attributes.position.needsUpdate = true;
      flares.rotation.y = t * 0.12;

      const vp = vaporGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < VAPOR_COUNT; i++) {
        const ix = i * 3;
        const seed = vaporSeed[i];
        vp[ix + 1] += 0.014 + (i % 5) * 0.0018;
        vp[ix] += Math.sin(t * 1.6 + seed) * 0.007;
        vp[ix + 2] += Math.cos(t * 1.3 + seed) * 0.006;
        if (vp[ix + 1] > 4.5) {
          const a = Math.random() * Math.PI * 2;
          const r = 3.55 + Math.random() * 1.4;
          vp[ix] = Math.cos(a) * r;
          vp[ix + 1] = -2.4 - Math.random();
          vp[ix + 2] = Math.sin(a) * r * 0.5;
        }
      }
      vaporGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      unregister();
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      sunMat.dispose();
      coronaMat.dispose();
      outerMat.dispose();
      core.geometry.dispose();
      corona.geometry.dispose();
      outerGlow.geometry.dispose();
      haloTex.dispose();
      (halo.material as THREE.Material).dispose();
      flareGeo.dispose();
      (flares.material as THREE.Material).dispose();
      vaporGeo.dispose();
      (vapors.material as THREE.Material).dispose();
      waves.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="galaxy-rgb pointer-events-none fixed inset-0 z-0" aria-hidden>
      <div ref={mountRef} className="galaxy-rgb__three absolute inset-0" />
      <div className="galaxy-rgb__grain" />
    </div>
  );
}
