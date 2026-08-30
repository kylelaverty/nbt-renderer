import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { BuiltScene } from './meshBuilder';

interface SceneViewerProps {
  scene: BuiltScene | undefined;
  size: [number, number, number] | undefined;
  resetCameraSignal: number;
}

export function SceneViewer({ scene, size, resetCameraSignal }: SceneViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const threeRef = useRef<
    | {
        renderer: THREE.WebGLRenderer;
        scene: THREE.Scene;
        camera: THREE.PerspectiveCamera;
        controls: OrbitControls;
        group: THREE.Group;
      }
    | undefined
  >(undefined);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const scene3 = new THREE.Scene();
    scene3.background = new THREE.Color(0x1a1d23);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
    camera.position.set(20, 20, 20);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.1);
    scene3.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(30, 50, 20);
    scene3.add(dir);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.4);
    dir2.position.set(-20, 10, -30);
    scene3.add(dir2);

    const grid = new THREE.GridHelper(200, 200, 0x555b66, 0x2c313a);
    scene3.add(grid);

    const group = new THREE.Group();
    scene3.add(group);

    threeRef.current = { renderer, scene: scene3, camera, controls, group };

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let raf = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene3, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const ctx = threeRef.current;
    if (!ctx) return;
    while (ctx.group.children.length > 0) {
      const child = ctx.group.children[0];
      ctx.group.remove(child);
    }
    if (scene?.opaqueMesh) ctx.group.add(scene.opaqueMesh);
    if (scene?.transparentMesh) ctx.group.add(scene.transparentMesh);
  }, [scene]);

  useEffect(() => {
    const ctx = threeRef.current;
    if (!ctx || !size) return;
    const [sx, sy, sz] = size;
    const center = new THREE.Vector3(sx / 2, sy / 2, sz / 2);
    const radius = Math.max(sx, sy, sz, 4);
    ctx.controls.target.copy(center);
    ctx.camera.position.set(center.x + radius * 1.2, center.y + radius * 1.0, center.z + radius * 1.2);
    ctx.camera.far = radius * 20 + 100;
    ctx.camera.updateProjectionMatrix();
    ctx.controls.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetCameraSignal]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
