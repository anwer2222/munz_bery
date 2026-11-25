'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const lerp = (a, b, t) => a + (b - a) * t;

export const APPAREL_SETS = [
  {
    key: 'uniforms',
    name: 'الأزياء الموحدة',
    gap: 0.16,
    pitch: 0.14,
    items: [
      { node: 'Uniform_1', title: 'بولو منز', sub: 'بنفسجي بياقة برتقالية' },
      { node: 'Uniform_2', title: 'تيشيرت كاجوال', sub: 'برتقالي بياقة بنفسجية' },
      { node: 'Uniform_3', title: 'قميص العمل', sub: 'أبيض بجيب بنفسجي' },
      { node: 'Uniform_4', title: 'سويتشيرت الفريق', sub: 'كم طويل بخطوط برتقالية' },
    ],
  },
  {
    key: 'aprons',
    name: 'المرايل',
    gap: 0.18,
    pitch: 0.12,
    items: [
      { node: 'Apron_1', title: 'مريلة كلاسيك', sub: 'بنفسجي بحواف برتقالية' },
      { node: 'Apron_2', title: 'مريلة الشارة', sub: 'برتقالي بجيوب منقّطة' },
      { node: 'Apron_3', title: 'مريلة ثنائية', sub: 'قصّة مائلة بنفسجي وبرتقالي' },
      { node: 'Apron_4', title: 'مريلة مرحة', sub: 'نقشة قوس قزح وجيب صدر' },
    ],
  },
  {
    key: 'hats',
    name: 'القبعات',
    gap: 0.1,
    pitch: 0.24,
    items: [
      { node: 'Hat_1', title: 'فايزر منز', sub: 'برتقالي بشعار بنفسجي' },
      { node: 'Hat_2', title: 'قبعة شبكية', sub: 'واجهة بيضاء وشبك بنفسجي' },
      { node: 'Hat_3', title: 'قبعة بيسبول', sub: 'بنفسجي بفتحات برتقالية' },
      { node: 'Hat_4', title: 'قبعة باكت', sub: 'كريمي بنقشة الآيس كريم' },
    ],
  },
];

const SET_GAP = 5.5;

export default function ApparelShowcase() {
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
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    const camera = new THREE.PerspectiveCamera(26, 1, 0.01, 30);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x30133c, 0.65));
    const key = new THREE.DirectionalLight(0xfff4ea, 2.3); key.position.set(-1.5, 2.0, 2.2); scene.add(key);
    const rim = new THREE.DirectionalLight(0xeba367, 2.6); rim.position.set(1.8, 1.2, -1.8); scene.add(rim);
    const fillL = new THREE.DirectionalLight(0xdedee0, 0.75); fillL.position.set(1.8, 0.6, 1.4); scene.add(fillL);

    const sc = document.createElement('canvas'); sc.width = sc.height = 128;
    const g = sc.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(12,3,18,0.52)'); grd.addColorStop(0.55, 'rgba(12,3,18,0.20)'); grd.addColorStop(1, 'rgba(12,3,18,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(sc);
    const shadowGeo = new THREE.PlaneGeometry(1, 1);
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });

    const items = [];   // { node, key, labelY }
    const frames = [];  // per-set camera framing: { x, cy, frameW, frameH, pitch }
    let disposed = false;

    const draco = new DRACOLoader().setDecoderPath('/draco/');
    const loader = new GLTFLoader().setDRACOLoader(draco);
    loader.load('/models/apparel.glb', (gltf) => {
      if (disposed) return;
      const model = gltf.scene;
      model.traverse((o) => {
        if (!o.isMesh) return;
        const name = o.material?.name || '';
        if (/^Decal_/.test(name)) {
          const m = o.material;
          m.transparent = true;
          m.alphaTest = 0.05;
          m.depthWrite = false;
          m.side = THREE.DoubleSide;
          o.renderOrder = 3;
        }
      });
      scene.add(model);

      APPAREL_SETS.forEach((S, si) => {
        const nodes = S.items.map((it) => model.getObjectByName(it.node));
        const boxes = nodes.map((n) => (n ? new THREE.Box3().setFromObject(n) : null));
        const widths = boxes.map((b) => (b ? b.getSize(new THREE.Vector3()).x : 0));
        const heights = boxes.map((b) => (b ? b.getSize(new THREE.Vector3()).y : 0));
        const depths = boxes.map((b) => (b ? b.getSize(new THREE.Vector3()).z : 0));
        const maxH = Math.max(0.12, ...heights);
        const total = widths.reduce((a, w) => a + w, 0) + S.gap * (nodes.length - 1);
        let x = si * SET_GAP + total / 2;

        nodes.forEach((node, ci) => {
          x -= widths[ci] / 2;
          if (node) {
            node.position.set(x, 0, 0);
            node.rotation.set(0, 0, 0);
            const sh = new THREE.Mesh(shadowGeo, shadowMat);
            const sw = Math.max(0.18, widths[ci] * 0.9);
            sh.scale.set(sw, sw * 0.6, 1);
            sh.rotation.x = -Math.PI / 2;
            sh.position.set(x, 0.001, 0);
            scene.add(sh);
            const labelY = S.key === 'hats' ? -0.022 : -maxH * 0.08;
            const labelZ = S.key === 'hats' ? depths[ci] * 0.62 : depths[ci] * 0.3;
            items.push({ node, key: S.items[ci].node, labelY, labelZ });
          }
          x -= widths[ci] / 2 + S.gap;
        });

        frames[si] = {
          x: si * SET_GAP,
          cy: S.key === 'hats' ? maxH * 0.36 : maxH * 0.48,
          frameW: total + S.gap * 2.2,
          frameH: S.key === 'hats' ? maxH * 1.45 : maxH * 1.18,
          pitch: S.pitch,
        };
      });
      setReady(true);
    }, undefined, () => setError('تعذّر تحميل الأزياء والقبعات. حدّث الصفحة وحاول مرة أخرى.'));

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

    let camX = 0, camY = 0.34, camDist = 3.2, camPitch = 0.14, sway = 0, last = performance.now(), raf = 0;
    const tmp = new THREE.Vector3();
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;

      const idle = now - lastMove > 2600 && !reduce;
      if (!dragging) {
        yawVel = lerp(yawVel, 0, 0.06);
        yaw += yawVel * dt;
        if (idle) yaw = lerp(yaw, Math.round(yaw / (Math.PI * 2)) * Math.PI * 2, 1 - Math.exp(-dt * 1.5));
      }
      sway = lerp(sway, idle ? 1 : 0, 1 - Math.exp(-dt * 1.2));
      for (const it of items) it.node.rotation.y = yaw + sway * Math.sin(now * 0.0007) * 0.45;

      const F = frames[setRef.current] ?? { x: setRef.current * SET_GAP, cy: 0.34, frameW: 3.0, frameH: 0.9, pitch: 0.14 };
      const fov = THREE.MathUtils.degToRad(camera.fov);
      const goalDist = Math.max((F.frameH / 2) / Math.tan(fov / 2), (F.frameW / 2) / (Math.tan(fov / 2) * camera.aspect)) * 1.12;
      const k = reduce ? 1 : 1 - Math.exp(-dt * 5);
      camX = lerp(camX, F.x, k);
      camY = lerp(camY, F.cy, k);
      camDist = lerp(camDist, goalDist, k);
      camPitch = lerp(camPitch, F.pitch, k);

      camera.position.set(camX, camY + Math.sin(camPitch) * camDist, Math.cos(camPitch) * camDist);
      camera.lookAt(camX, camY, 0);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);

      for (const it of items) {
        const el = labelRefs.current[it.key]; if (!el) continue;
        tmp.set(it.node.position.x, it.labelY, it.labelZ ?? 0).project(camera);
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
      <div className="cups-tabs" role="tablist" aria-label="مجموعات الأزياء والملابس">
        {APPAREL_SETS.map((S, i) => (
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
        aria-label={`نموذج ثلاثي الأبعاد لـ${APPAREL_SETS[setIdx].name} منز بأربعة تصاميم. اسحب أو استخدم الأسهم للتدوير.`}
        onKeyDown={onKey}
      />

      {!ready && !error && (
        <div className="viewer-loading" role="status">
          <img src="/brand/icon_mark_white.svg" alt="" />
          <span>جارٍ تحضير الأزياء…</span>
        </div>
      )}
      {error && <p className="viewer-error" role="alert">{error}</p>}

      <ul className="cups-labels" aria-hidden={!ready}>
        {APPAREL_SETS.map((S, si) => S.items.map((it) => (
          <li key={it.node} ref={(el) => { labelRefs.current[it.node] = el; }} className={si === setIdx && ready ? 'on' : ''}>
            <strong>{it.title}</strong>
            <span>{it.sub}</span>
          </li>
        )))}
      </ul>
    </div>
  );
}
