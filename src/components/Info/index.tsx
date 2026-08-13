"use client";

import { useState, useEffect, useRef } from "react";
import Navbar from "@/components/Navbar";
import RevealText from "@/components/RevealText";
import { SITE } from "@/lib/site";
import { useTheme } from "@/components/ThemeProvider";
import RevealImage from "@/components/RevealImage";
import * as THREE from "three";

type InfoProps = {
  onIndexClick?: () => void;
  onInfoClick?: () => void;
  onContactClick?: () => void;
};

const labelClass =
  "m-0 mb-1.5 font-[family-name:var(--font-body)] text-[clamp(0.7rem,1.2vw,0.8rem)] font-medium tracking-[-0.03em]";
const valueClass =
  "m-0 font-[family-name:var(--font-body)] text-[clamp(0.85rem,1.5vw,0.95rem)] font-semibold leading-snug tracking-[-0.04em]";
const bioClass =
  "m-0 font-[family-name:var(--font-body)] text-[clamp(1.15rem,2.4vw,1.35rem)] font-semibold leading-relaxed tracking-[-0.04em]";

function DarkAboutPortrait() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let raf = 0;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 20);
    camera.position.set(0, 0, 5.5);
    camera.lookAt(0, 0, 0);

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

    const loader = new THREE.TextureLoader();
    const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);

    const CARD_VERT = /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

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
        float aspect = 16.0 / 9.0;
        vec2 px = vec2(blurAmt / aspect, blurAmt);

        float drift = sin(time * 1.7 + phase) * 0.35 + sin(time * 0.9 + phase * 1.3) * 0.25;
        float baseSplit = rgbAmt + glitchAmt * 0.006;
        vec2 split = vec2((baseSplit * (1.0 + drift)) / aspect, baseSplit * 0.4);

        float band = floor(vUv.y * 18.0);
        float tearPulse = step(0.92, hash(band + floor(time * 6.0) + phase * 10.0));
        float tear = (hash21(vec2(band, floor(time * 8.0))) - 0.5) * tearPulse * glitchAmt * 0.045;

        float block = step(0.96, hash(floor(time * 4.5) + phase * 7.0));
        float blockShift = (hash(time * 0.2 + phase) - 0.5) * block * glitchAmt * 0.03;

        vec2 uvR = vUv + split + vec2(tear + blockShift, 0.0);
        vec2 uvG = vUv + vec2(tear * 0.35, 0.0);
        vec2 uvB = vUv - split + vec2(-tear * 0.6 - blockShift * 0.5, 0.0);

        float r = sampleBlur(map, uvR, px.x).r;
        float g = sampleBlur(map, uvG, px.x).g;
        float b = sampleBlur(map, uvB, px.x).b;
        float a = sampleBlur(map, vUv, px.x).a;

        vec3 col = vec3(r, g, b) * tint;
        col.r += tearPulse * glitchAmt * 0.04;
        col.b += tearPulse * glitchAmt * 0.03;

        gl_FragColor = vec4(col, a * opacity);
      }
    `;

    const material = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: null as THREE.Texture | null },
        opacity: { value: 0 },
        blurAmt: { value: 0 },
        rgbAmt: { value: 0.0008 },
        glitchAmt: { value: 0.04 },
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

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    loader.load(
      "/images/projects/portfolio.jpeg",
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
        material.uniforms.opacity.value = 1;
        material.needsUpdate = true;
      },
      undefined,
      () => {
        material.uniforms.tint.value.setHex(0x171717);
        material.uniforms.opacity.value = 1;
        material.needsUpdate = true;
      }
    );

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      const distance = camera.position.z;
      const vFovRad = THREE.MathUtils.degToRad(camera.fov);
      const planeH = 2 * Math.tan(vFovRad / 2) * distance;
      const planeW = planeH * camera.aspect;

      mesh.scale.set(planeW, planeH, 1);
      renderer.setSize(w, h, false);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const clock = new THREE.Clock();

    const tick = () => {
      if (disposed) return;
      raf = requestAnimationFrame(tick);

      const t = clock.elapsedTime;

      mesh.position.set(0, 0, 0);
      mesh.rotation.set(0, 0, 0);

      material.uniforms.time.value = t;

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      material.uniforms.map.value?.dispose();
      material.dispose();
      geometry.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="h-full w-full" />;
}

function AboutPortrait() {
  const { isDark } = useTheme();

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-neutral-950">
      {isDark ? (
        <DarkAboutPortrait />
      ) : (
        <div className="project-carousel__card pointer-events-auto absolute inset-0 h-full w-full overflow-hidden bg-neutral-950">
          <RevealImage
            src="/images/projects/portfolio.jpeg"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      )}
    </div>
  );
}

export default function Info({
  onIndexClick,
  onInfoClick,
  onContactClick,
}: InfoProps) {
  return (
    <main
      id="page-content"
      className="relative z-[10] flex h-dvh max-h-dvh flex-col overflow-hidden bg-transparent px-3 py-4 sm:px-4 sm:py-5"
    >
      <div
        aria-hidden
        className="film-grain pointer-events-none absolute inset-0 -z-[1] opacity-40"
      />

      <header className="relative z-30 mb-4 grid w-full shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 sm:mb-5">
        <RevealText
          as="p"
          className="cursor-default justify-self-start pl-1.5 font-[family-name:var(--font-display)] text-[clamp(1.05rem,2vw,.65rem)] font-semibold uppercase leading-none tracking-[-0.05em]"
        >
          {SITE.name}
        </RevealText>

        <button
          type="button"
          onClick={onIndexClick}
          className="cursor-pointer justify-self-center leading-none"
        >
          <RevealText className="inline-block whitespace-nowrap font-[family-name:var(--font-body)] text-[clamp(1.05rem,2vw,0.65rem)] font-semibold leading-none tracking-[-0.05em]">
            ← Index
          </RevealText>
        </button>

        <div className="justify-self-end">
          <Navbar
            active="info"
            onInfoClick={onInfoClick}
            onContactClick={onContactClick}
          />
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(18rem,42%)] lg:items-stretch lg:gap-10 xl:gap-14">
        <div className="flex min-h-0 flex-1 flex-col">
          <RevealText
            as="h1"
            className="m-0 !block cursor-default font-[family-name:var(--font-display)] text-[clamp(3.25rem,12vw,9.5rem)] font-bold uppercase leading-[0.85em] tracking-[-0.09em]"
          >
            About
          </RevealText>

          <div className="mt-auto flex max-w-[min(100%,32rem)] flex-col gap-4 pl-1.5 pt-6">
            {SITE.bio.map((paragraph) => (
              <RevealText
                key={paragraph.slice(0, 24)}
                as="p"
                className={bioClass}
              >
                {paragraph}
              </RevealText>
            ))}
          </div>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-5 sm:max-w-md sm:self-end lg:max-w-none lg:self-stretch">
          <AboutPortrait />

          <div className="mt-auto grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-x-8 gap-y-10 sm:gap-x-10 lg:flex-1 lg:grid-rows-[auto_1fr]">
            {/* Row 1 Col 1 */}
            <div className="self-start">
              <RevealText as="p" className={labelClass}>
                Tools
              </RevealText>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {SITE.frontendTools.map((line) => (
                  <li key={line}>
                    <RevealText as="p" className={valueClass}>
                      {line}
                    </RevealText>
                  </li>
                ))}
              </ul>
            </div>

            {/* Row 1 Col 2 */}
            <div className="self-start">
              <RevealText as="p" className={labelClass}>
                Backend Tools
              </RevealText>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {SITE.backendTools.map((line) => (
                  <li key={line}>
                    <RevealText as="p" className={valueClass}>
                      {line}
                    </RevealText>
                  </li>
                ))}
              </ul>
            </div>

            {/* Row 1 Col 3 */}
            <div aria-hidden className="hidden sm:block" />

            {/* Row 2 Col 1 */}
            <div className="self-end pointer-events-auto flex flex-col gap-1">
              <RevealText as="p" className={labelClass}>
                Contact
              </RevealText>
              <a
                href={`mailto:${SITE.email}`}
                className={`${valueClass} text-neutral-900 no-underline`}
              >
                <RevealText className={valueClass}>{SITE.email}</RevealText>
              </a>
            </div>

            {/* Row 2 Col 2 */}
            <div className="self-end flex flex-col gap-1">
              <RevealText as="p" className={labelClass}>
                Available
              </RevealText>
              <RevealText as="p" className={valueClass}>
                {SITE.available}
              </RevealText>
            </div>

            {/* Row 2 Col 3 */}
            <div className="self-end">
              <RevealText as="p" className={`${valueClass} mb-0 shrink-0`}>
                © {SITE.year}
              </RevealText>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
