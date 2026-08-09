"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { PROJECTS } from "@/lib/projects";

const N = PROJECTS.length;
/** Card plane aspect 16:7 */
const CARD_W = 3.35;
const CARD_H = CARD_W * (7 / 16);

type Pose = {
  y: number;
  z: number;
  rotX: number;
  scale: number;
  opacity: number;
};

function ringOffset(i: number, active: number) {
  let d = i - active;
  if (d > N / 2) d -= N;
  if (d < -N / 2) d += N;
  return d;
}

function poseFor(offset: number, reduceMotion: boolean): Pose {
  if (reduceMotion) {
    if (offset === 0)
      return { y: 0, z: 0, rotX: 0, scale: 1, opacity: 1 };
    if (offset === -1)
      return { y: 1.25, z: 0, rotX: 0, scale: 0.92, opacity: 0.55 };
    if (offset === 1)
      return { y: -1.25, z: 0, rotX: 0, scale: 0.92, opacity: 0.55 };
    return { y: offset * 1.5, z: -1.5, rotX: 0, scale: 0.85, opacity: 0 };
  }

  if (offset === 0)
    return { y: 0, z: 0.15, rotX: 0, scale: 1, opacity: 1 };
  if (offset === -1)
    return { y: 1.35, z: -1.05, rotX: THREE.MathUtils.degToRad(-18), scale: 0.92, opacity: 0.55 };
  if (offset === 1)
    return { y: -1.35, z: -1.05, rotX: THREE.MathUtils.degToRad(18), scale: 0.92, opacity: 0.55 };
  if (offset <= -2)
    return { y: 2.55, z: -1.9, rotX: THREE.MathUtils.degToRad(-28), scale: 0.86, opacity: 0 };
  if (offset >= 2)
    return { y: -2.55, z: -1.9, rotX: THREE.MathUtils.degToRad(28), scale: 0.86, opacity: 0 };
  return { y: offset * 1.4, z: -2.2, rotX: 0, scale: 0.8, opacity: 0 };
}

type CardMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> & {
  userData: {
    index: number;
    phase: number;
    pose: Pose;
  };
};

/**
 * Dark-mode carousel: Three.js floating coverflow cards.
 * Center faces camera; neighbors tilt via rotateX + translateZ; idle float.
 */
export default function DarkProjectCarousel() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let active = 0;
    let locked = false;
    let disposed = false;
    let raf = 0;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
    camera.position.set(0.35, 0, 6.4);
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
    renderer.domElement.style.pointerEvents = "auto";

    const loader = new THREE.TextureLoader();
    const cards: CardMesh[] = [];
    const group = new THREE.Group();
    // Slight shared yaw so cards read like angled photographs
    group.rotation.y = THREE.MathUtils.degToRad(-8);
    scene.add(group);

    const geometry = new THREE.PlaneGeometry(CARD_W, CARD_H, 1, 1);

    PROJECTS.forEach((project, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.FrontSide,
      });

      const mesh = new THREE.Mesh(geometry, material) as CardMesh;
      mesh.userData = {
        index,
        phase: index * 1.37,
        pose: poseFor(ringOffset(index, active), reduceMotion),
      };
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
          material.map = tex;
          material.needsUpdate = true;
        },
        undefined,
        () => {
          // Fallback solid if image fails
          material.color.setHex(0x171717);
          material.needsUpdate = true;
        },
      );
    });

    const applyPoseImmediate = () => {
      cards.forEach((card) => {
        const offset = ringOffset(card.userData.index, active);
        card.userData.pose = poseFor(offset, reduceMotion);
      });
    };
    applyPoseImmediate();

    const tweenToActive = () => {
      cards.forEach((card) => {
        const offset = ringOffset(card.userData.index, active);
        const target = poseFor(offset, reduceMotion);
        gsap.killTweensOf(card.userData.pose);
        gsap.to(card.userData.pose, {
          y: target.y,
          z: target.z,
          rotX: target.rotX,
          scale: target.scale,
          opacity: target.opacity,
          duration: reduceMotion ? 0 : 0.65,
          ease: "power3.out",
        });
      });
    };

    const step = (dir: 1 | -1) => {
      if (locked) return;
      locked = true;
      active = (active + dir + N) % N;
      tweenToActive();
      window.setTimeout(() => {
        locked = false;
      }, 480);
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const onPointer = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(cards, false);
      if (!hits.length) return;
      const hit = hits[0].object as CardMesh;
      const offset = ringOffset(hit.userData.index, active);
      if (offset === -1) step(-1);
      else if (offset === 1) step(1);
    };

    const onClick = (e: MouseEvent) => onPointer(e.clientX, e.clientY);
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      e.preventDefault();
      if (Math.abs(e.deltaY) < 4) return;
      step(e.deltaY > 0 ? 1 : -1);
    };

    renderer.domElement.addEventListener("click", onClick);
    window.addEventListener("wheel", onWheel, { passive: false });

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
      const t = clock.getElapsedTime();

      // Stable draw order: farther / lower opacity first
      const order = [...cards].sort(
        (a, b) => a.userData.pose.z - b.userData.pose.z,
      );
      order.forEach((card, i) => {
        card.renderOrder = i;
      });

      cards.forEach((card) => {
        const p = card.userData.pose;
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

        card.position.set(floatX, p.y + floatY, p.z);
        card.rotation.x = p.rotX;
        card.rotation.z = floatRotZ;
        // Mild shared photographic yaw (plus tiny idle sway)
        card.rotation.y =
          THREE.MathUtils.degToRad(10) +
          (reduceMotion ? 0 : Math.sin(t * 0.6 + phase) * 0.02);
        card.scale.setScalar(p.scale);
        card.material.opacity = p.opacity;
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
      cards.forEach((card) => {
        gsap.killTweensOf(card.userData.pose);
        card.material.map?.dispose();
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
      className="project-carousel project-carousel--coverflow pointer-events-none absolute inset-y-4 right-2 left-[36%] z-[26] sm:inset-y-5 sm:right-4 sm:left-[42%]"
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
