'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const lerp = (a, b, t) => a + (b - a) * t;

// `node` is the empty's name in /public/models/cups.glb. Small sits on the right (RTL reading order).
export const CUP_SETS = [
  {
    key: 'paper', name: 'أكواب ورقية',
    cups: [
      { node: 'Paper_Cup_S', size: 'صغير', spec: '٧٢ × ٥٥ ملم' },
      { node: 'Paper_Cup_M', size: 'وسط', spec: '٨٠ × ٩٠ ملم' },
      { node: 'Paper_Cup_L', size: 'كبير', spec: '٩٠ × ١١٥ ملم' },
    ],
  },
  {
    key: 'clear', name: 'أكواب شفافة',
    cups: [
      { node: 'Clear_Cup_S', size: 'صغير', spec: '٧٥ × ٨٠ ملم' },
      { node: 'Clear_Cup_M', size: 'وسط', spec: '٨٥ × ١٠٥ ملم' },
      { node: 'Clear_Cup_L', size: 'كبير', spec: '٩٥ × ١٣٠ ملم' },
    ],
  },
];
const SLOTS = [0.125, 0, -0.13];   // x of small, medium, large inside a set (metres)
const SET_GAP = 0.6;               // distance between the two sets; the camera slides between them
const FRAME_W = 0.42, FRAME_H = 0.17;

export default function CupShowcase() {
  const stageRef = useRef(null);
  const canvasHostRef = useRef(null);
  const labelRefs = useRef({});
  const setRef = useRef(0);
  const nudgeRef = useRef(null);
  const [setIdx, setSetIdx] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setRef.current = setIdx; }, [setIdx]);

  useEffect(() => {
    const host = canvasHostRef.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.5;
    const camera = new THREE.PerspectiveCamera(26, 1, 0.01, 10);

    // same lighting as the parfait viewer: soft key, warm orange rim, light grayish fill
    scene.add(new THREE.HemisphereLight(0xffffff, 0x30133c, 0.55));
    const key = new THREE.DirectionalLight(0xfff4ea, 2.4); key.position.set(-0.7, 1.0, 0.9); scene.add(key);
    const rim = new THREE.DirectionalLight(0xeba367, 3.2); rim.position.set(0.8, 0.5, -0.9); scene.add(rim);
    const fillL = new THREE.DirectionalLight(0xdedee0, 0.7); fillL.position.set(0.9, 0.2, 0.6); scene.add(fillL);

    // soft contact shadow, one per cup
    const sc = document.createElement('canvas'); sc.width = sc.height = 128;
    const g = sc.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(12,3,18,0.6)'); grd.addColorStop(0.55, 'rgba(12,3,18,0.25)'); grd.addColorStop(1, 'rgba(12,3,18,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(sc);
    const shadowGeo = new THREE.PlaneGeometry(0.15, 0.15);
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });

    const cups = [];   // { node, setIndex, slot }
    let disposed = false;
    const draco = new DRACOLoader().setDecoderPath('/draco/');
    const loader = new GLTFLoader().setDRACOLoader(draco);
    loader.load('/models/cups.glb', (gltf) => {
      if (disposed) return;
      const model = gltf.scene;
      model.traverse((o) => {
        if (!o.isMesh) return;
        const name = o.material.name;
        if (name === 'Clear_PET') {
          o.material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.13,
            clearcoat: 1, clearcoatRoughness: 0.03, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.8,
          });
          o.renderOrder = 2;
        } else if (name.startsWith('Clear_Print')) {
          const m = o.material;
          m.transparent = true; m.alphaTest = 0.02; m.depthWrite = false; m.side = THREE.DoubleSide;
          o.renderOrder = 3;
        }
      });
      scene.add(model);
      CUP_SETS.forEach((S, si) => S.cups.forEach((c, ci) => {
        const node = model.getObjectByName(c.node);
        if (!node) return;
        node.position.set(si * SET_GAP + SLOTS[ci], 0, 0);
        node.rotation.set(0, 0, 0);
        const sh = new THREE.Mesh(shadowGeo, shadowMat);
        sh.rotation.x = -Math.PI / 2; sh.position.set(node.position.x, 0.0004, 0);
        scene.add(sh);
        const height = new THREE.Box3().setFromObject(node).getSize(new THREE.Vector3()).y;
        cups.push({ node, key: c.node, height });
      }));
      setReady(true);
    }, undefined, () => setError('تعذّر تحميل الأكواب. حدّث الصفحة وحاول مرة أخرى.'));

    // ---------- interaction: drag turns every cup on its own axis
    let yaw = 0, yawVel = 0, dragging = false, lastX = 0, lastMove = -1e9;
    const canvas = renderer.domElement;
    const onDown = (e) => {
      dragging = true; lastX = e.clientX; yawVel = 0;
      canvas.setPointerCapture(e.pointerId); lastMove = performance.now();
    };
    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX; lastX = e.clientX;
      yaw += dx * 0.012; yawVel = dx * 0.012 * 60;
      lastMove = performance.now();
    };
    const onUp = () => { dragging = false; };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    nudgeRef.current = (d) => { yawVel = d * 3.2; lastMove = performance.now(); };

    let W = 1, H = 1;
    const resize = () => {
      W = host.clientWidth; H = host.clientHeight;
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
    };
    const ro = new ResizeObserver(resize); ro.observe(host); resize();

    let camX = 0, sway = 0, last = performance.now(), raf = 0;
    const tmp = new THREE.Vector3();
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;

      // after a drag the cups coast, then settle back facing front and sway gently
      const idle = now - lastMove > 2600 && !reduce;
      if (!dragging) {
        yawVel = lerp(yawVel, 0, 0.06);
        yaw += yawVel * dt;
        if (idle) yaw = lerp(yaw, Math.round(yaw / (Math.PI * 2)) * Math.PI * 2, 1 - Math.exp(-dt * 1.5));
      }
      sway = lerp(sway, idle ? 1 : 0, 1 - Math.exp(-dt * 1.2));
      for (const c of cups) c.node.rotation.y = yaw + sway * Math.sin(now * 0.0007) * 0.7;

      const goalX = setRef.current * SET_GAP;
      camX = reduce ? goalX : lerp(camX, goalX, 1 - Math.exp(-dt * 5));

      const fov = THREE.MathUtils.degToRad(camera.fov);
      const dist = Math.max((FRAME_H / 2) / Math.tan(fov / 2), (FRAME_W / 2) / (Math.tan(fov / 2) * camera.aspect)) * 1.12;
      const cy = 0.062, pitch = 0.2;
      camera.position.set(camX, cy + Math.sin(pitch) * dist, Math.cos(pitch) * dist);
      camera.lookAt(camX, cy, 0);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);

      // size labels sit under each cup
      for (const c of cups) {
        const el = labelRefs.current[c.key]; if (!el) continue;
        tmp.set(c.node.position.x, -0.012, 0).project(camera);
        el.style.transform = `translate(${((tmp.x + 1) / 2 * W).toFixed(1)}px, ${((1 - tmp.y) / 2 * H).toFixed(1)}px) translate(-50%, 0)`;
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      draco.dispose(); pmrem.dispose(); shadowTex.dispose(); shadowGeo.dispose(); shadowMat.dispose();
      renderer.dispose();
      host.removeChild(canvas);
    };
  }, []);

  const onKey = (e) => {
    if (e.key === 'ArrowLeft') { nudgeRef.current?.(-1); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { nudgeRef.current?.(1); e.preventDefault(); }
  };

  return (
    <div className="cups-stage" ref={stageRef}>
      <div className="cups-tabs" role="tablist" aria-label="مجموعات الأكواب">
        {CUP_SETS.map((S, i) => (
          <button key={S.key} type="button" role="tab" aria-selected={setIdx === i} onClick={() => setSetIdx(i)}>
            {S.name}
          </button>
        ))}
      </div>

      <div
        className="cups-canvas"
        ref={canvasHostRef}
        tabIndex={0}
        role="img"
        aria-label={`نموذج ثلاثي الأبعاد لـ${CUP_SETS[setIdx].name} منز بثلاثة أحجام. اسحب أو استخدم الأسهم لتدوير الأكواب.`}
        onKeyDown={onKey}
      />

      {!ready && !error && (
        <div className="viewer-loading" role="status">
          <img src="/brand/icon_mark_white.svg" alt="" />
          <span>جارٍ تحضير الأكواب…</span>
        </div>
      )}
      {error && <p className="viewer-error" role="alert">{error}</p>}

      <ul className="cups-labels" aria-hidden={!ready}>
        {CUP_SETS.map((S, si) => S.cups.map((c) => (
          <li key={c.node} ref={(el) => { labelRefs.current[c.node] = el; }} className={si === setIdx && ready ? 'on' : ''}>
            <strong>{c.size}</strong>
            <span>{c.spec}</span>
          </li>
        )))}
      </ul>
    </div>
  );
}
