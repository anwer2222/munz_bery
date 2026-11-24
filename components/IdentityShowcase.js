'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const lerp = (a, b, t) => a + (b - a) * t;

export const IDENTITY_SETS = [
  {
    key: 'emp',
    name: 'بطاقات الموظفين',
    items: [
      { node: 'Emp_Card_1', title: 'لين', sub: 'مديرة المتجر' },
      { node: 'Emp_Card_2', title: 'ستيرلينغ', sub: 'خبير الآيس كريم' },
      { node: 'Emp_Card_3', title: 'رودريغيز', sub: 'فنانة النكهات' },
      { node: 'Emp_Card_4', title: 'دارنيل', sub: 'مشرف الوردية' },
    ],
  },
  {
    key: 'bus',
    name: 'بطاقات العمل',
    items: [
      { node: 'Bus_Card_1', title: 'الوجه البنفسجي', sub: 'هوية منز' },
      { node: 'Bus_Card_2', title: 'فانس', sub: 'المؤسس' },
      { node: 'Bus_Card_3', title: 'الوجه الأبيض', sub: 'تصميم مرح' },
      { node: 'Bus_Card_4', title: 'لين', sub: 'المديرة الإبداعية' },
    ],
  },
  {
    key: 'badges',
    name: 'شارات الأسماء',
    items: [
      { node: 'Badge_1', title: 'ديفيد', sub: 'رئيس النكهات' },
      { node: 'Badge_2', title: 'إيلينا', sub: 'تجربة الضيوف' },
      { node: 'Badge_3', title: 'ليو', sub: 'صانع آيس كريم' },
      { node: 'Badge_4', title: 'سام', sub: 'متدرب' },
    ],
  },
];

const ITEM_GAP = 0.022;  // space between items inside a set (metres)
const SET_GAP = 0.95;    // distance between set centres; the camera slides between them
const CENTER_Y = 0.048;  // vertical midpoint where every item floats cleanly above its shadow
const FRAME_H = 0.125;   // height kept in view

export default function IdentityShowcase() {
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
    scene.environmentIntensity = 0.65;
    const camera = new THREE.PerspectiveCamera(26, 1, 0.01, 10);

    // studio lighting matching CupShowcase
    scene.add(new THREE.HemisphereLight(0xffffff, 0x30133c, 0.65));
    const key = new THREE.DirectionalLight(0xfff4ea, 2.2); key.position.set(-0.6, 0.9, 1.1); scene.add(key);
    const rim = new THREE.DirectionalLight(0xeba367, 2.8); rim.position.set(0.8, 0.5, -0.9); scene.add(rim);
    const fillL = new THREE.DirectionalLight(0xdedee0, 0.75); fillL.position.set(0.9, 0.2, 0.7); scene.add(fillL);

    // soft contact shadow under each item
    const sc = document.createElement('canvas'); sc.width = sc.height = 128;
    const g = sc.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(12,3,18,0.55)'); grd.addColorStop(0.55, 'rgba(12,3,18,0.22)'); grd.addColorStop(1, 'rgba(12,3,18,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(sc);
    const shadowGeo = new THREE.PlaneGeometry(0.09, 0.05);
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });

    const items = [];         // { node, key }
    const setX = [];          // centre of each set
    let frameW = 0.44;
    let disposed = false;

    const draco = new DRACOLoader().setDecoderPath('/draco/');
    const loader = new GLTFLoader().setDRACOLoader(draco);
    loader.load('/models/identity.glb', (gltf) => {
      if (disposed) return;
      const model = gltf.scene;
      scene.add(model);

      IDENTITY_SETS.forEach((S, si) => {
        const nodes = S.items.map((it) => model.getObjectByName(it.node));
        const boxes = nodes.map((n) => (n ? new THREE.Box3().setFromObject(n) : null));
        const widths = boxes.map((b) => (b ? b.getSize(new THREE.Vector3()).x : 0));
        const heights = boxes.map((b) => (b ? b.getSize(new THREE.Vector3()).y : 0));
        const total = widths.reduce((a, w) => a + w, 0) + ITEM_GAP * (nodes.length - 1);
        let x = si * SET_GAP + total / 2;

        nodes.forEach((node, ci) => {
          x -= widths[ci] / 2;
          if (node) {
            // vertically centre each item around CENTER_Y so cards and badges share one clean horizon
            const yOffset = CENTER_Y - heights[ci] / 2;
            node.position.set(x, yOffset, 0);
            node.rotation.set(0, 0, 0);
            const sh = new THREE.Mesh(shadowGeo, shadowMat);
            sh.rotation.x = -Math.PI / 2;
            sh.position.set(x, 0.0004, 0);
            scene.add(sh);
            items.push({ node, key: S.items[ci].node });
          }
          x -= widths[ci] / 2 + ITEM_GAP;
        });

        setX[si] = si * SET_GAP;
        frameW = Math.max(frameW, total + 0.07);
      });
      setReady(true);
    }, undefined, () => setError('تعذّر تحميل البطاقات والشارات. حدّث الصفحة وحاول مرة أخرى.'));

    // drag turns every card/badge on its own Y axis (so you can inspect front & back!)
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

      const idle = now - lastMove > 2600 && !reduce;
      if (!dragging) {
        yawVel = lerp(yawVel, 0, 0.06);
        yaw += yawVel * dt;
        if (idle) yaw = lerp(yaw, Math.round(yaw / (Math.PI * 2)) * Math.PI * 2, 1 - Math.exp(-dt * 1.5));
      }
      sway = lerp(sway, idle ? 1 : 0, 1 - Math.exp(-dt * 1.2));
      for (const it of items) it.node.rotation.y = yaw + sway * Math.sin(now * 0.0007) * 0.45;

      const goalX = setX[setRef.current] ?? setRef.current * SET_GAP;
      camX = reduce ? goalX : lerp(camX, goalX, 1 - Math.exp(-dt * 5));

      const fov = THREE.MathUtils.degToRad(camera.fov);
      const dist = Math.max((FRAME_H / 2) / Math.tan(fov / 2), (frameW / 2) / (Math.tan(fov / 2) * camera.aspect)) * 1.12;
      const pitch = 0.13;
      camera.position.set(camX, CENTER_Y + Math.sin(pitch) * dist, Math.cos(pitch) * dist);
      camera.lookAt(camX, CENTER_Y, 0);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);

      for (const it of items) {
        const el = labelRefs.current[it.key]; if (!el) continue;
        tmp.set(it.node.position.x, -0.006, 0).project(camera);
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
      <div className="cups-tabs" role="tablist" aria-label="مجموعات الهوية">
        {IDENTITY_SETS.map((S, i) => (
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
        aria-label={`نموذج ثلاثي الأبعاد لـ${IDENTITY_SETS[setIdx].name} منز بأربعة تصاميم. اسحب أو استخدم الأسهم للتدوير.`}
        onKeyDown={onKey}
      />

      {!ready && !error && (
        <div className="viewer-loading" role="status">
          <img src="/brand/icon_mark_white.svg" alt="" />
          <span>جارٍ تحضير البطاقات…</span>
        </div>
      )}
      {error && <p className="viewer-error" role="alert">{error}</p>}

      <ul className="cups-labels" aria-hidden={!ready}>
        {IDENTITY_SETS.map((S, si) => S.items.map((it) => (
          <li key={it.node} ref={(el) => { labelRefs.current[it.node] = el; }} className={si === setIdx && ready ? 'on' : ''}>
            <strong>{it.title}</strong>
            <span>{it.sub}</span>
          </li>
        )))}
      </ul>
    </div>
  );
}
