'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { LAYERS } from './layers';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;
const INNER = ['crumbleMid', 'vanilla', 'berry']; // hidden inside the swirl until the cup opens
const FILL_TEXTURE = '/textures/fill.png';         // replace this file to update the fill look
const DOUBLE_TAP_MS = 320;

export default function ParfaitViewer() {
  const stageRef = useRef(null);
  const canvasHostRef = useRef(null);
  const labelRefs = useRef({});
  const leaderRefs = useRef({});
  const openRef = useRef(false);
  const nudgeRef = useRef(null);
  const pickRef = useRef(null);
  const toggleRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(null);

  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => {
    pickRef.current = (k) => setActive((cur) => (cur === k ? null : k));
    toggleRef.current = () => setOpen((o) => !o);
  }, []);

  useEffect(() => {
    const host = canvasHostRef.current;
    const stage = stageRef.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---------- renderer, scene, camera
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

    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 10);

    // One lighting setup for every MUNZ product: soft key, warm orange rim, light grayish fill
    scene.add(new THREE.HemisphereLight(0xffffff, 0x30133c, 0.55));
    const key = new THREE.DirectionalLight(0xfff4ea, 2.4); key.position.set(-0.7, 1.0, 0.9); scene.add(key);
    const rim = new THREE.DirectionalLight(0xeba367, 3.2); rim.position.set(0.8, 0.5, -0.9); scene.add(rim);
    const fillL = new THREE.DirectionalLight(0xdedee0, 0.7); fillL.position.set(0.9, 0.2, 0.6); scene.add(fillL);

    const root = new THREE.Group();
    scene.add(root);

    // soft contact shadow under the cup
    const sc = document.createElement('canvas'); sc.width = sc.height = 128;
    const g = sc.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(12,3,18,0.6)'); grd.addColorStop(0.55, 'rgba(12,3,18,0.25)'); grd.addColorStop(1, 'rgba(12,3,18,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(sc);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.0004;
    scene.add(shadow);

    // ---------- model
    const groups = {}; const baseY = {}; const boxes = {};
    let fillGroup = null; const fillMats = [];
    let disposed = false;
    const draco = new DRACOLoader().setDecoderPath('/draco/');
    const loader = new GLTFLoader().setDRACOLoader(draco);
    loader.load('/models/parfait.glb', (gltf) => {
      if (disposed) return;
      const model = gltf.scene;
      model.traverse((o) => {
        if (!o.isMesh) return;
        const m = o.material;
        if (m.name === 'M_PET') {
          o.material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.13,
            clearcoat: 1, clearcoatRoughness: 0.03, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.8,
          });
          o.renderOrder = 2;
        } else if (m.name === 'M_CupPrint') {
          m.transparent = true; m.alphaTest = 0.02; m.depthWrite = false; o.renderOrder = 3;
        } else if (m.name === 'M_FillBaked') {
          fillMats.push(m);
        }
      });
      root.add(model);
      model.updateMatrixWorld(true);
      for (const L of LAYERS) {
        const node = model.getObjectByName(L.group);
        if (!node) continue;
        groups[L.key] = node; baseY[L.key] = node.position.y;
        const b = new THREE.Box3().setFromObject(node);
        boxes[L.key] = { center: b.getCenter(new THREE.Vector3()), size: b.getSize(new THREE.Vector3()) };
      }
      fillGroup = model.getObjectByName('G_Fill');
      // The fill pattern is a separate file so it can be swapped without re-exporting the model.
      // It must keep the same UV layout as the baked texture inside the GLB.
      new THREE.TextureLoader().load(FILL_TEXTURE, (tex) => {
        if (disposed) { tex.dispose(); return; }
        tex.flipY = false;                       // glTF UV convention
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        for (const m of fillMats) { m.map?.dispose(); m.map = tex; m.needsUpdate = true; }
      });
      INNER.forEach((k) => { if (groups[k]) groups[k].visible = false; });
      setReady(true);
    }, undefined, () => setError('تعذّر تحميل النموذج. حدّث الصفحة وحاول مرة أخرى.'));

    // ---------- interaction: drag to rotate (yaw) and tilt (pitch)
    let yaw = -0.35, yawVel = 0, pitch = 0.16, dragging = false, lastX = 0, lastY = 0, lastMove = -1e9;
    let downX = 0, downY = 0;
    const canvas = renderer.domElement;
    const onDown = (e) => {
      dragging = true; lastX = downX = e.clientX; lastY = downY = e.clientY; yawVel = 0;
      canvas.setPointerCapture(e.pointerId); lastMove = performance.now();
    };
    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      yaw += dx * 0.009; yawVel = dx * 0.009 * 60;
      pitch = THREE.MathUtils.clamp(pitch + dy * 0.004, -0.05, 0.6);
      lastMove = performance.now();
    };
    const raycaster = new THREE.Raycaster();
    // which layer (if any) is under a screen point; `onModel` is true for any part of the parfait
    const pickAt = (x, y) => {
      const r = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObject(root, true).filter((h) => h.object.visible);
      let key = null;
      for (const h of hits) {
        let n = h.object;
        while (n && !LAYERS.find((L) => L.group === n.name)) n = n.parent;
        if (!n) continue;
        const L = LAYERS.find((x2) => x2.group === n.name);
        if (L.key === 'cup' && !openRef.current) continue;   // closed: the cup wall shouldn't steal taps
        key = L.key; break;
      }
      return { key, onModel: hits.length > 0 };
    };
    // tap = select a layer; double tap / double click on the parfait = open or close the layers
    let lastTap = null, tapTimer = 0;
    const onUp = (e) => {
      if (!dragging) return;
      dragging = false;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) >= 6) return;   // it was a drag
      const { key, onModel } = pickAt(e.clientX, e.clientY);
      const now = performance.now();
      const isDouble = lastTap && now - lastTap.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30;
      if (isDouble && onModel && lastTap.onModel) {
        clearTimeout(tapTimer); lastTap = null;
        toggleRef.current?.();
        return;
      }
      lastTap = { t: now, x: e.clientX, y: e.clientY, onModel };
      clearTimeout(tapTimer);
      if (key) tapTimer = setTimeout(() => pickRef.current?.(key), DOUBLE_TAP_MS);   // wait: maybe a double tap
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    nudgeRef.current = (d) => { yawVel = d * 3.2; lastMove = performance.now(); };

    // ---------- sizing
    let W = 1, H = 1;
    const resize = () => {
      W = host.clientWidth; H = host.clientHeight;
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
    };
    const ro = new ResizeObserver(resize); ro.observe(host); resize();

    // ---------- per-frame
    let p = 0; // 0 = assembled, 1 = opened
    let last = performance.now();
    const tmp = new THREE.Vector3(), right = new THREE.Vector3(), target = new THREE.Vector3();
    let raf = 0;

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;

      // explode progress
      const goal = openRef.current ? 1 : 0;
      p = reduce ? goal : (goal > p ? Math.min(goal, p + dt / 1.7) : Math.max(goal, p - dt / 1.4));

      // spin: inertia after a drag, then a slow idle turn
      if (!dragging) {
        const idle = now - lastMove > 2600 && !reduce;
        yawVel = lerp(yawVel, idle ? 0.28 : 0, idle ? 0.02 : 0.06);
        yaw += yawVel * dt;
      }
      root.rotation.y = yaw;

      // layers
      for (const L of LAYERS) {
        const node = groups[L.key]; if (!node) continue;
        const lt = ease(clamp01((p - L.delay) / 0.7));
        node.position.y = baseY[L.key] + L.lift * lt;
        if (INNER.includes(L.key)) node.visible = p > 0.002;
      }
      if (fillGroup) {
        const op = 1 - clamp01(p / 0.22);
        fillGroup.visible = op > 0.01;
        for (const m of fillMats) { m.transparent = op < 0.999; m.opacity = op; m.depthWrite = op > 0.5; }
      }
      shadow.material.opacity = 1;

      // camera framing: tighter when closed, taller and shifted right when open (labels sit on the left)
      const e = ease(p);
      const wide = W >= 720;
      const cy = lerp(0.118, 0.335, e);
      const hNeed = lerp(0.30, 0.70, e);
      const wNeed = 0.13 / (1 - lerp(0, wide ? 0.4 : 0.48, e));
      const fov = THREE.MathUtils.degToRad(camera.fov);
      const dist = Math.max((hNeed / 2) / Math.tan(fov / 2), (wNeed / 2) / (Math.tan(fov / 2) * camera.aspect)) * lerp(1.1, 1.0, e);
      target.set(0, cy, 0);
      camera.position.set(0, cy + Math.sin(pitch) * dist, Math.cos(pitch) * dist);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      const shift = lerp(0, wide ? 0.36 : 0.4, e);       // move the cup toward screen right
      camera.projectionMatrix.elements[8] = -shift;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

      renderer.render(scene, camera);

      // labels + leader lines
      const show = clamp01((p - 0.55) / 0.35);
      stage.style.setProperty('--labels', show.toFixed(3));
      if (show > 0) {
        right.set(1, 0, 0).applyQuaternion(camera.quaternion);
        const items = [];
        for (const L of LAYERS) {
          const node = groups[L.key]; const box = boxes[L.key]; if (!node || !box) continue;
          tmp.copy(box.center); tmp.y += node.position.y - baseY[L.key];
          if (L.key === 'cup') tmp.y = box.center.y - box.size.y * 0.15;
          const c = tmp.clone().project(camera);
          const edge = tmp.clone().addScaledVector(right, -box.size.x * 0.42).project(camera);
          items.push({ L, cx: (c.x + 1) / 2 * W, cy: (1 - c.y) / 2 * H, ax: (edge.x + 1) / 2 * W });
        }
        // measure labels (a selected one grows), then push them apart so none overlap;
        // they are already in top-to-bottom order, and the stack is pulled back up if it runs off the stage
        for (const it of items) {
          const el = labelRefs.current[it.L.key];
          it.w = el ? el.offsetWidth : 0; it.h = el ? el.offsetHeight : 0;
        }
        for (let i = 0; i < items.length; i++) {
          items[i].ly = items[i].cy;
          if (i > 0) items[i].ly = Math.max(items[i].ly, items[i - 1].ly + (items[i - 1].h + items[i].h) / 2 + 4);
        }
        const lastIt = items[items.length - 1];
        const over = lastIt ? lastIt.ly + lastIt.h / 2 - (H - 80) : 0;
        if (over > 0) {
          for (let i = items.length - 1; i >= 0; i--) {
            const lim = i === items.length - 1 ? items[i].ly - over : items[i + 1].ly - (items[i + 1].h + items[i].h) / 2 - 4;
            items[i].ly = Math.min(items[i].ly, lim);
          }
        }
        for (const it of items) {
          const el = labelRefs.current[it.L.key]; const ld = leaderRefs.current[it.L.key];
          if (!el || !ld) continue;
          const w = it.w, h = it.h;
          const colRight = Math.min(it.ax - (wide ? 44 : 18), W - 16);
          const x = Math.max(12, colRight - w);
          el.style.transform = `translate(${x}px, ${it.ly - h / 2}px)`;
          const line = ld.firstChild, dot = ld.lastChild;
          line.setAttribute('x1', x + w + 6); line.setAttribute('y1', it.ly);
          line.setAttribute('x2', it.ax); line.setAttribute('y2', it.cy);
          dot.setAttribute('cx', it.ax); dot.setAttribute('cy', it.cy);
        }
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      clearTimeout(tapTimer);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      draco.dispose(); pmrem.dispose(); shadowTex.dispose();
      renderer.dispose();
      host.removeChild(canvas);
    };
  }, []);

  const onKey = (e) => {
    if (e.key === 'ArrowLeft') { nudgeRef.current?.(-1); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { nudgeRef.current?.(1); e.preventDefault(); }
    else if (e.key === 'Enter' || e.key === ' ') { setOpen((o) => !o); e.preventDefault(); }
  };

  return (
    <div className={`viewer${open ? ' is-open' : ''}`} ref={stageRef}>
      <div
        className="viewer-canvas"
        ref={canvasHostRef}
        tabIndex={0}
        role="img"
        aria-label="نموذج ثلاثي الأبعاد لبيري سويرل بارفيه. اسحب أو استخدم الأسهم للتدوير، وانقر مرتين على الكوب أو اضغط Enter لفتح الطبقات."
        onKeyDown={onKey}
      />

      {!ready && !error && (
        <div className="viewer-loading" role="status">
          <img src="/brand/icon_mark_white.svg" alt="" />
          <span>جارٍ تحضير البارفيه…</span>
        </div>
      )}
      {error && <p className="viewer-error" role="alert">{error}</p>}

      <svg className="viewer-leaders" aria-hidden="true">
        {LAYERS.map((L) => (
          <g key={L.key} ref={(el) => { leaderRefs.current[L.key] = el; }} className={active === L.key ? 'on' : ''}>
            <line />
            <circle r="4" />
          </g>
        ))}
      </svg>

      <ul className="viewer-labels" aria-hidden={!open}>
        {LAYERS.map((L) => (
          <li key={L.key} ref={(el) => { labelRefs.current[L.key] = el; }} className={active === L.key ? 'on' : ''}>
            <button type="button" tabIndex={open ? 0 : -1} onClick={() => setActive((a) => (a === L.key ? null : L.key))}>
              <strong>{L.name}</strong>
              <span>{L.text}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="viewer-controls">
        <button type="button" className="btn-primary" aria-pressed={open} onClick={() => setOpen((o) => !o)} disabled={!ready}>
          {open ? 'أعد تجميع الكوب' : 'افتح الطبقات'}
        </button>
        <span className="viewer-hint">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          اسحب للتدوير · انقر مرتين على الكوب لفتحه
        </span>
      </div>
    </div>
  );
}
