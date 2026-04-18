import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSplashStore } from '@/stores/splashStore';

const ROAD_COUNT = 4;
const ROAD_LENGTH = 12;
const ROAD_GAP = 0.3;
const ROAD_SEGMENT = ROAD_LENGTH + ROAD_GAP;
const CLOUD_COUNT = 30;
const SPEED = 8;
const DOOR_Z = -60;

function GradientSky() {
  const tex = useMemo(() => {
    const size = 256;
    const data = new Uint8Array(size * 4);
    const c1 = new THREE.Color('#001c54');
    const c2 = new THREE.Color('#023fa1');
    const c3 = new THREE.Color('#26a8ff');
    for (let i = 0; i < size; i++) {
      const t = i / (size - 1);
      const c = t < 0.5
        ? c1.clone().lerp(c2, t * 2)
        : c2.clone().lerp(c3, (t - 0.5) * 2);
      data[i * 4] = Math.floor(c.r * 255);
      data[i * 4 + 1] = Math.floor(c.g * 255);
      data[i * 4 + 2] = Math.floor(c.b * 255);
      data[i * 4 + 3] = 255;
    }
    const texture = new THREE.DataTexture(data, 1, size, THREE.RGBAFormat);
    texture.needsUpdate = true;
    return texture;
  }, []);

  return (
    <mesh position={[0, 40, -80]} scale={[200, 100, 1]}>
      <planeGeometry />
      <meshBasicMaterial map={tex} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function Roads() {
  const groupRef = useRef<THREE.Group>(null);
  const phase = useSplashStore((s) => s.phase);

  const roadRefs = useRef<THREE.Mesh[]>([]);

  useFrame((_, delta) => {
    if (phase !== 'flying' && phase !== 'door') return;
    if (phase === 'door') return;
    const cam = groupRef.current?.parent?.parent;
    if (!cam) return;
    for (const road of roadRefs.current) {
      if (!road) continue;
      road.position.z += SPEED * delta;
      if (road.position.z > 10) {
        road.position.z -= ROAD_COUNT * ROAD_SEGMENT;
        road.position.y = -2;
        road.userData.bouncing = true;
        road.userData.bounceT = 0;
      }
      if (road.userData.bouncing) {
        road.userData.bounceT += delta * 3;
        const t = Math.min(road.userData.bounceT, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        road.position.y = -2 + ease * 2;
        if (t >= 1) {
          road.position.y = 0;
          road.userData.bouncing = false;
        }
      }
    }
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: ROAD_COUNT }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) roadRefs.current[i] = el; }}
          position={[0, 0, -i * ROAD_SEGMENT]}
        >
          <boxGeometry args={[3, 0.15, ROAD_LENGTH]} />
          <meshStandardMaterial color="#1a2a3a" metalness={0.3} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function Clouds() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const phase = useSplashStore((s) => s.phase);

  const positions = useMemo(() => {
    const arr: [number, number, number][] = [];
    for (let i = 0; i < CLOUD_COUNT; i++) {
      arr.push([
        (Math.random() - 0.5) * 40,
        3 + Math.random() * 15,
        -Math.random() * 80,
      ]);
    }
    return arr;
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!meshRef.current) return;
    positions.forEach(([x, y, z], i) => {
      dummy.position.set(x, y, z);
      const s = 2 + Math.random() * 4;
      dummy.scale.set(s, s * 0.4, 1);
      dummy.rotation.set(0, Math.random() * Math.PI, 0);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [positions, dummy]);

  useFrame((_, delta) => {
    if (phase !== 'flying' && phase !== 'door') return;
    if (!meshRef.current || phase === 'door') return;
    const mat = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    for (let i = 0; i < CLOUD_COUNT; i++) {
      meshRef.current.getMatrixAt(i, mat);
      mat.decompose(pos, quat, scl);
      pos.z += SPEED * delta * 0.6;
      if (pos.z > 15) pos.z -= 90;
      mat.compose(pos, quat, scl);
      meshRef.current.setMatrixAt(i, mat);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, CLOUD_COUNT]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        color="#a0d4ff"
        transparent
        opacity={0.25}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </instancedMesh>
  );
}

function Door() {
  const groupRef = useRef<THREE.Group>(null);
  const phase = useSplashStore((s) => s.phase);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!glowRef.current) return;
    const t = Math.sin(state.clock.elapsedTime * 2) * 0.3 + 1.5;
    (glowRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = t;
  });

  if (phase !== 'door' && phase !== 'entering') return null;

  return (
    <group ref={groupRef} position={[0, 2.5, DOOR_Z]}>
      <mesh position={[-1.8, 0, 0]}>
        <boxGeometry args={[0.3, 5, 0.3]} />
        <meshStandardMaterial color="#c0d0e0" metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[1.8, 0, 0]}>
        <boxGeometry args={[0.3, 5, 0.3]} />
        <meshStandardMaterial color="#c0d0e0" metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[3.9, 0.3, 0.3]} />
        <meshStandardMaterial color="#c0d0e0" metalness={0.5} roughness={0.3} />
      </mesh>
      <mesh ref={glowRef} position={[0, 0, -0.2]}>
        <planeGeometry args={[3.3, 4.7]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#4fc3f7"
          emissiveIntensity={1.5}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  );
}

function CameraController() {
  const { camera } = useThree();
  const phase = useSplashStore((s) => s.phase);
  const setPhase = useSplashStore((s) => s.setPhase);
  const elapsed = useRef(0);
  const enterStart = useRef(0);

  useEffect(() => {
    camera.position.set(0, 2, 5);
    camera.lookAt(0, 1.5, -20);
  }, [camera]);

  useFrame((_, delta) => {
    elapsed.current += delta;

    if (phase === 'loading') {
      if (elapsed.current > 1.5) {
        setPhase('flying');
      }
      return;
    }

    if (phase === 'flying') {
      camera.position.z -= SPEED * delta;
      camera.lookAt(0, 1.5, camera.position.z - 20);
      if (camera.position.z < DOOR_Z + 20) {
        setPhase('door');
      }
      return;
    }

    if (phase === 'door') {
      camera.lookAt(0, 2.5, DOOR_Z);
      return;
    }

    if (phase === 'entering') {
      if (enterStart.current === 0) enterStart.current = elapsed.current;
      const t = Math.min((elapsed.current - enterStart.current) / 0.8, 1);
      const ease = t * t * t;
      camera.position.z -= ease * 30 * delta;
      camera.lookAt(0, 2.5, DOOR_Z);
      return;
    }
  });

  return null;
}

export function SplashScene() {
  return (
    <>
      <color attach="background" args={['#001c54']} />
      <fog attach="fog" args={['#389af2', 30, 80]} />
      <ambientLight color="#0f6eff" intensity={2} />
      <directionalLight color="#ff6222" intensity={8} position={[5, 10, 3]} />
      <GradientSky />
      <Roads />
      <Clouds />
      <Door />
      <CameraController />
    </>
  );
}

