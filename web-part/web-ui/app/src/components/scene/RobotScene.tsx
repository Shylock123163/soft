import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, Float, OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';

function RobotBody() {
  return (
    <group position={[0, -0.05, 0]}>
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.24, 1.4]} />
        <meshStandardMaterial color="#f1f5f7" metalness={0.18} roughness={0.55} />
      </mesh>

      <mesh position={[-0.7, 0.18, 0]} castShadow>
        <boxGeometry args={[0.55, 0.12, 1.4]} />
        <meshStandardMaterial color="#ffffff" metalness={0.16} roughness={0.52} />
      </mesh>

      <mesh position={[0.72, 0.18, 0]} castShadow>
        <boxGeometry args={[0.56, 0.12, 1.4]} />
        <meshStandardMaterial color="#ffffff" metalness={0.16} roughness={0.52} />
      </mesh>

      <mesh position={[0.14, 0.27, 0]} castShadow>
        <boxGeometry args={[2.25, 0.025, 1.42]} />
        <meshStandardMaterial color="#fbfcfd" metalness={0.25} roughness={0.38} />
      </mesh>

      <mesh position={[0.06, 0.29, 0]} castShadow>
        <boxGeometry args={[2.32, 0.02, 0.08]} />
        <meshStandardMaterial color="#0f1217" metalness={0.35} roughness={0.45} />
      </mesh>

      <mesh position={[0.06, 0.29, 0.38]} castShadow rotation={[0, 0, 0]}>
        <boxGeometry args={[2.32, 0.02, 0.08]} />
        <meshStandardMaterial color="#0f1217" metalness={0.35} roughness={0.45} />
      </mesh>

      <mesh position={[0.06, 0.29, -0.38]} castShadow>
        <boxGeometry args={[2.32, 0.02, 0.08]} />
        <meshStandardMaterial color="#0f1217" metalness={0.35} roughness={0.45} />
      </mesh>

      <mesh position={[-0.38, 0.3, 0]} castShadow rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[1.48, 0.02, 0.08]} />
        <meshStandardMaterial color="#0f1217" metalness={0.35} roughness={0.45} />
      </mesh>

      <mesh position={[0.48, 0.3, 0]} castShadow rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[1.48, 0.02, 0.08]} />
        <meshStandardMaterial color="#0f1217" metalness={0.35} roughness={0.45} />
      </mesh>

      <mesh position={[-1.08, 0.06, 0.25]} rotation={[0, 0, Math.PI / 4]} castShadow>
        <boxGeometry args={[1.0, 0.08, 0.16]} />
        <meshStandardMaterial color="#e6ecef" metalness={0.12} roughness={0.65} />
      </mesh>
      <mesh position={[-1.08, 0.06, -0.25]} rotation={[0, 0, -Math.PI / 4]} castShadow>
        <boxGeometry args={[1.0, 0.08, 0.16]} />
        <meshStandardMaterial color="#e6ecef" metalness={0.12} roughness={0.65} />
      </mesh>

      {[
        [-0.72, -0.02, 0.64],
        [-0.72, -0.02, -0.64],
        [0.72, -0.02, 0.64],
        [0.72, -0.02, -0.64]
      ].map((position, index) => (
        <group key={index} position={position as [number, number, number]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.22, 0.16, 24]} />
            <meshStandardMaterial color="#1d2229" metalness={0.3} roughness={0.5} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.19, 0.035, 12, 24]} />
            <meshStandardMaterial color="#cfd7dc" metalness={0.42} roughness={0.32} />
          </mesh>
        </group>
      ))}

      <mesh position={[-0.98, 0.02, 0]} castShadow>
        <boxGeometry args={[0.15, 0.12, 0.28]} />
        <meshStandardMaterial color="#10161c" metalness={0.4} roughness={0.38} />
      </mesh>
      <mesh position={[-1.07, 0.02, 0]} castShadow>
        <boxGeometry args={[0.03, 0.1, 0.9]} />
        <meshStandardMaterial emissive="#4ff0d0" emissiveIntensity={1.8} color="#bffff2" />
      </mesh>
    </group>
  );
}

export function RobotScene() {
  return (
    <Canvas camera={{ position: [3.6, 2.2, 3.5], fov: 35 }}>
      <color attach="background" args={['#071018']} />
      <fog attach="fog" args={['#071018', 5, 11]} />
      <ambientLight intensity={1.2} />
      <directionalLight
        castShadow
        intensity={2.1}
        position={[4.5, 6, 3]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      <Float speed={1.4} rotationIntensity={0.12} floatIntensity={0.16}>
        <RobotBody />
      </Float>

      <ContactShadows position={[0, -0.4, 0]} opacity={0.45} scale={7} blur={2.8} far={2.3} />
      <Environment preset="city" />

      <EffectComposer>
        <Bloom mipmapBlur intensity={0.45} luminanceThreshold={0.3} />
        <Noise opacity={0.03} />
        <Vignette eskil={false} offset={0.18} darkness={0.72} />
      </EffectComposer>

      <OrbitControls enablePan={false} minDistance={3.2} maxDistance={6.2} />
    </Canvas>
  );
}
