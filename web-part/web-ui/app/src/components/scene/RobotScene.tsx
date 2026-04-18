import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Float, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function RobotBody() {
  const mats = useMemo(() => ({
    body: new THREE.MeshStandardMaterial({ color: '#f1f5f7', metalness: 0.18, roughness: 0.55 }),
    white: new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.16, roughness: 0.52 }),
    top: new THREE.MeshStandardMaterial({ color: '#fbfcfd', metalness: 0.25, roughness: 0.38 }),
    dark: new THREE.MeshStandardMaterial({ color: '#0f1217', metalness: 0.35, roughness: 0.45 }),
    arm: new THREE.MeshStandardMaterial({ color: '#e6ecef', metalness: 0.12, roughness: 0.65 }),
    wheel: new THREE.MeshStandardMaterial({ color: '#1d2229', metalness: 0.3, roughness: 0.5 }),
    rim: new THREE.MeshStandardMaterial({ color: '#cfd7dc', metalness: 0.42, roughness: 0.32 }),
    sensor: new THREE.MeshStandardMaterial({ color: '#10161c', metalness: 0.4, roughness: 0.38 }),
    glow: new THREE.MeshStandardMaterial({ emissive: '#4ff0d0', emissiveIntensity: 1.8, color: '#bffff2' }),
  }), []);

  const wheelPositions: [number, number, number][] = [
    [-0.72, -0.02, 0.64],
    [-0.72, -0.02, -0.64],
    [0.72, -0.02, 0.64],
    [0.72, -0.02, -0.64],
  ];

  return (
    <group position={[0, -0.05, 0]}>
      <mesh position={[0, 0.15, 0]} material={mats.body}>
        <boxGeometry args={[2.4, 0.24, 1.4]} />
      </mesh>
      <mesh position={[-0.7, 0.18, 0]} material={mats.white}>
        <boxGeometry args={[0.55, 0.12, 1.4]} />
      </mesh>
      <mesh position={[0.72, 0.18, 0]} material={mats.white}>
        <boxGeometry args={[0.56, 0.12, 1.4]} />
      </mesh>
      <mesh position={[0.14, 0.27, 0]} material={mats.top}>
        <boxGeometry args={[2.25, 0.025, 1.42]} />
      </mesh>
      <mesh position={[0.06, 0.29, 0]} material={mats.dark}>
        <boxGeometry args={[2.32, 0.02, 0.08]} />
      </mesh>
      <mesh position={[0.06, 0.29, 0.38]} material={mats.dark}>
        <boxGeometry args={[2.32, 0.02, 0.08]} />
      </mesh>
      <mesh position={[0.06, 0.29, -0.38]} material={mats.dark}>
        <boxGeometry args={[2.32, 0.02, 0.08]} />
      </mesh>
      <mesh position={[-0.38, 0.3, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.dark}>
        <boxGeometry args={[1.48, 0.02, 0.08]} />
      </mesh>
      <mesh position={[0.48, 0.3, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.dark}>
        <boxGeometry args={[1.48, 0.02, 0.08]} />
      </mesh>
      <mesh position={[-1.08, 0.06, 0.25]} rotation={[0, 0, Math.PI / 4]} material={mats.arm}>
        <boxGeometry args={[1.0, 0.08, 0.16]} />
      </mesh>
      <mesh position={[-1.08, 0.06, -0.25]} rotation={[0, 0, -Math.PI / 4]} material={mats.arm}>
        <boxGeometry args={[1.0, 0.08, 0.16]} />
      </mesh>

      {wheelPositions.map((pos, i) => (
        <group key={i} position={pos}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.wheel}>
            <cylinderGeometry args={[0.22, 0.22, 0.16, 16]} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.rim}>
            <torusGeometry args={[0.19, 0.035, 8, 16]} />
          </mesh>
        </group>
      ))}

      <mesh position={[-0.98, 0.02, 0]} material={mats.sensor}>
        <boxGeometry args={[0.15, 0.12, 0.28]} />
      </mesh>
      <mesh position={[-1.07, 0.02, 0]} material={mats.glow}>
        <boxGeometry args={[0.03, 0.1, 0.9]} />
      </mesh>
    </group>
  );
}

export function RobotScene() {
  return (
    <Canvas
      camera={{ position: [3.6, 2.2, 3.5], fov: 35 }}
      dpr={[1, 1.5]}
      shadows={false}
      gl={{ antialias: false, powerPreference: 'low-power' }}
      frameloop="demand"
    >
      <color attach="background" args={['#071018']} />
      <fog attach="fog" args={['#071018', 5, 11]} />
      <ambientLight intensity={1.35} />
      <directionalLight intensity={1.8} position={[4.5, 6, 3]} />
      <directionalLight intensity={0.6} position={[-3, 2.4, -2.5]} color="#7fe7ff" />

      <Float speed={1.4} rotationIntensity={0.12} floatIntensity={0.16}>
        <RobotBody />
      </Float>

      <mesh position={[0, -0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.1, 32]} />
        <meshBasicMaterial color="#0b1921" opacity={0.92} transparent />
      </mesh>

      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={3.2}
        maxDistance={6.2}
        minPolarAngle={0.9}
        maxPolarAngle={1.55}
      />
    </Canvas>
  );
}
