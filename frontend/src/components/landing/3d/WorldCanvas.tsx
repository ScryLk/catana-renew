/**
 * WorldCanvas.tsx
 * Fullscreen Three.js WebGL World Navigation Engine for the Catana Atelier.
 * Users travel through 3D space along the Z-axis, discovering the 5 artisan stations.
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ARTISAN_STATIONS, ArtisanStation, drawStationCanvas } from './ArtisanStations';

export interface WorldCoords {
  x: number;
  y: number;
  z: number;
  progress: number;
  speed: number;
  activeStation: ArtisanStation;
}

interface WorldCanvasProps {
  onCoordsChange?: (coords: WorldCoords) => void;
  onSelectStation?: (station: ArtisanStation) => void;
  targetStationId?: string | null;
}

export const WorldCanvas: React.FC<WorldCanvasProps> = ({
  onCoordsChange,
  onSelectStation,
  targetStationId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetZRef = useRef<number>(0);
  const currentZRef = useRef<number>(0);
  const mouseRef = useRef<{ x: number; y: number; normX: number; normY: number }>({
    x: 0,
    y: 0,
    normX: 0,
    normY: 0,
  });
  const isDraggingRef = useRef<boolean>(false);
  const dragStartYRef = useRef<number>(0);
  const hoveredStationIdRef = useRef<string | null>(null);

  // Smooth tween to target station if changed from HUD
  useEffect(() => {
    if (targetStationId) {
      const station = ARTISAN_STATIONS.find((s) => s.id === targetStationId);
      if (station) {
        // Place camera slightly in front of the station so it fills the screen majestically
        targetZRef.current = station.zCoord + 180;
      }
    }
  }, [targetStationId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Three.js Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#070709');
    scene.fog = new THREE.FogExp2('#070709', 0.0012);

    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      1,
      4000
    );
    camera.position.set(0, 0, 100);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // 2. Atmospheric Lighting
    const ambientLight = new THREE.AmbientLight('#FFFFFF', 0.9);
    scene.add(ambientLight);

    const goldPointLight = new THREE.PointLight('#D4AF37', 2.2, 800);
    goldPointLight.position.set(0, 50, 0);
    scene.add(goldPointLight);

    // 3. Floating Dust / Champagne Particle Field
    const particleCount = 750;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleScales = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 800;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 500;
      particlePositions[i * 3 + 2] = 200 - Math.random() * 3400; // spreads along the full Z path
      particleScales[i] = Math.random() * 2.5 + 0.5;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('scale', new THREE.BufferAttribute(particleScales, 1));

    const particleMaterial = new THREE.PointsMaterial({
      color: '#D4AF37',
      size: 3.5,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // 4. Station Meshes & Canvas Textures
    const stationMeshes: {
      mesh: THREE.Mesh;
      station: ArtisanStation;
      canvas: HTMLCanvasElement;
      ctx: CanvasRenderingContext2D;
      texture: THREE.CanvasTexture;
      baseX: number;
      baseY: number;
      baseZ: number;
    }[] = [];

    // Layout configuration for the 5 stations along Z
    // Alternating X positions creates a cinematic meandering corridor
    const stationOffsets = [
      { x: -55, y: 0 },   // Station 1 (Éléonore) - slightly left
      { x: 55, y: 0 },    // Station 2 (Henri) - slightly right
      { x: -50, y: 0 },   // Station 3 (Kenji) - slightly left
      { x: 50, y: 0 },    // Station 4 (Vesper) - slightly right
      { x: 0, y: 0 },     // Station 5 (Monument) - majestic center
    ];

    ARTISAN_STATIONS.forEach((station, index) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 768;
      const ctx = canvas.getContext('2d')!;

      // Initial draw
      drawStationCanvas(ctx, station, 0, false);

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      // Station Plane Geometry
      const planeGeo = new THREE.PlaneGeometry(160, 120, 16, 16);
      const planeMat = new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.DoubleSide,
        roughness: 0.25,
        metalness: 0.1,
      });

      const mesh = new THREE.Mesh(planeGeo, planeMat);
      const offset = stationOffsets[index];
      mesh.position.set(offset.x, offset.y, station.zCoord);

      // Slight natural tilt towards the camera corridor
      if (offset.x < 0) mesh.rotation.y = 0.12;
      else if (offset.x > 0) mesh.rotation.y = -0.12;

      mesh.userData = { stationId: station.id, station };
      scene.add(mesh);

      stationMeshes.push({
        mesh,
        station,
        canvas,
        ctx,
        texture,
        baseX: offset.x,
        baseY: offset.y,
        baseZ: station.zCoord,
      });
    });

    // 5. Raycaster for Interactive Hover & Clicks
    const raycaster = new THREE.Raycaster();
    const mouseVector = new THREE.Vector2();

    // 6. Navigation Controls: Scroll & Momentum
    const minZ = -3000;
    const maxZ = 120;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Scroll moves camera along Z
      targetZRef.current -= e.deltaY * 0.85;
      targetZRef.current = Math.max(minZ, Math.min(maxZ, targetZRef.current));
    };

    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      dragStartYRef.current = e.clientY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const normX = (e.clientX / window.innerWidth) * 2 - 1;
      const normY = -(e.clientY / window.innerHeight) * 2 + 1;
      mouseRef.current = { x: e.clientX, y: e.clientY, normX, normY };
      mouseVector.set(normX, normY);

      if (isDraggingRef.current) {
        const deltaY = e.clientY - dragStartYRef.current;
        dragStartYRef.current = e.clientY;
        targetZRef.current += deltaY * 2.2;
        targetZRef.current = Math.max(minZ, Math.min(maxZ, targetZRef.current));
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        isDraggingRef.current = true;
        dragStartYRef.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isDraggingRef.current && e.touches.length > 0) {
        const deltaY = e.touches[0].clientY - dragStartYRef.current;
        dragStartYRef.current = e.touches[0].clientY;
        targetZRef.current += deltaY * 2.5;
        targetZRef.current = Math.max(minZ, Math.min(maxZ, targetZRef.current));
      }
    };

    const handleTouchEnd = () => {
      isDraggingRef.current = false;
    };

    const handleClick = () => {
      raycaster.setFromCamera(mouseVector, camera);
      const intersects = raycaster.intersectObjects(stationMeshes.map((s) => s.mesh));
      if (intersects.length > 0) {
        const hit = intersects[0].object.userData.station as ArtisanStation;
        if (hit && onSelectStation) {
          onSelectStation(hit);
        }
      }
    };

    // Attach listeners
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('click', handleClick);

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // 7. Animation Loop (60/120 FPS Fluid Luxury Render)
    let animationFrameId: number;
    let clock = new THREE.Clock();
    let lastZ = currentZRef.current;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Camera Damping (Smooth Inertia)
      const damping = 0.075;
      currentZRef.current += (targetZRef.current - currentZRef.current) * damping;
      camera.position.z = currentZRef.current;

      // Subtle Parallax Sway with Mouse
      const targetCamX = mouseRef.current.normX * 12;
      const targetCamY = mouseRef.current.normY * 8;
      camera.position.x += (targetCamX - camera.position.x) * 0.05;
      camera.position.y += (targetCamY - camera.position.y) * 0.05;

      // Gold light follows camera path
      goldPointLight.position.z = camera.position.z + 50;

      // Calculate speed
      const speed = Math.abs(currentZRef.current - lastZ);
      lastZ = currentZRef.current;

      // Raycasting for hover
      raycaster.setFromCamera(mouseVector, camera);
      const intersects = raycaster.intersectObjects(stationMeshes.map((s) => s.mesh));
      const hoveredId = intersects.length > 0 ? (intersects[0].object.userData.stationId as string) : null;
      hoveredStationIdRef.current = hoveredId;

      if (hoveredId) {
        document.body.style.cursor = 'pointer';
      } else {
        document.body.style.cursor = isDraggingRef.current ? 'grabbing' : 'default';
      }

      // Update Station Textures & Dynamic 3D Floating
      stationMeshes.forEach((item) => {
        const isHovered = item.station.id === hoveredId;

        // Subtle organic float
        const floatDelta = Math.sin(elapsedTime * 1.5 + item.mesh.position.x) * 1.5;
        item.mesh.position.y = item.baseY + floatDelta;

        // Hover 3D Tilt
        if (isHovered) {
          item.mesh.rotation.x = -mouseRef.current.normY * 0.15;
          item.mesh.rotation.y = mouseRef.current.normX * 0.15;
        } else {
          item.mesh.rotation.x = 0;
          if (item.baseX < 0) item.mesh.rotation.y = 0.12;
          else if (item.baseX > 0) item.mesh.rotation.y = -0.12;
          else item.mesh.rotation.y = 0;
        }

        // Redraw canvas animation every frame for live craft motion
        drawStationCanvas(item.ctx, item.station, elapsedTime, isHovered);
        item.texture.needsUpdate = true;
      });

      // Atmospheric particles gentle drift
      const positions = particles.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        // Slow rotation around Z
        positions[i * 3 + 1] += Math.sin(elapsedTime * 0.5 + i) * 0.08;
      }
      particles.geometry.attributes.position.needsUpdate = true;

      // Identify Active Station
      let closestStation = ARTISAN_STATIONS[0];
      let minDistance = 999999;
      ARTISAN_STATIONS.forEach((s) => {
        const dist = Math.abs(currentZRef.current - s.zCoord);
        if (dist < minDistance) {
          minDistance = dist;
          closestStation = s;
        }
      });

      // Progress: 0% at Z = 100 to 100% at Z = -2900
      const totalDist = 3000;
      const traveled = Math.max(0, 100 - currentZRef.current);
      const progress = Math.min(100, Math.max(0, Math.round((traveled / totalDist) * 100)));

      // Report coords to HUD
      if (onCoordsChange) {
        onCoordsChange({
          x: parseFloat(camera.position.x.toFixed(2)),
          y: parseFloat(camera.position.y.toFixed(2)),
          z: parseFloat(camera.position.z.toFixed(1)),
          progress,
          speed: parseFloat(speed.toFixed(2)),
          activeStation: closestStation,
        });
      }

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);

      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [onCoordsChange, onSelectStation]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full z-0 overflow-hidden select-none bg-[#070709]"
    />
  );
};
