import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { shaderMaterial, useTexture } from '@react-three/drei'
import { extend } from '@react-three/fiber'

// Day/Night blending shader
const EarthMaterial = shaderMaterial(
  {
    dayTexture: new THREE.Texture(),
    nightTexture: new THREE.Texture(),
    normalMap: new THREE.Texture(),
    specularMap: new THREE.Texture(),
    sunDirection: new THREE.Vector3(1, 0.3, 0.5).normalize(),
  },
  // Vertex shader
  `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vWorldNormal;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment shader
  `
    uniform sampler2D dayTexture;
    uniform sampler2D nightTexture;
    uniform sampler2D normalMap;
    uniform sampler2D specularMap;
    uniform vec3 sunDirection;

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying vec3 vWorldNormal;

    void main() {
      vec3 dayColor = texture2D(dayTexture, vUv).rgb;
      vec3 nightColor = texture2D(nightTexture, vUv).rgb;
      float specularIntensity = texture2D(specularMap, vUv).r;

      // Compute sun illumination
      float sunDot = dot(vWorldNormal, normalize(sunDirection));

      // Smooth transition between day and night
      float dayFactor = smoothstep(-0.15, 0.25, sunDot);

      // Boost night lights
      nightColor *= 1.8;

      // Blend day and night
      vec3 color = mix(nightColor, dayColor, dayFactor);

      // Add subtle specular highlight on oceans (day side only)
      vec3 viewDir = normalize(-vPosition);
      vec3 halfVec = normalize(normalize(sunDirection) + viewDir);
      float spec = pow(max(dot(vNormal, halfVec), 0.0), 64.0);
      color += spec * specularIntensity * 0.3 * dayFactor;

      // Slight ambient to prevent pure black on night side
      color = max(color, vec3(0.002));

      gl_FragColor = vec4(color, 1.0);
    }
  `
)

extend({ EarthMaterial })

declare global {
  namespace JSX {
    interface IntrinsicElements {
      earthMaterial: any
    }
  }
}

export default function Earth() {
  const earthRef = useRef<THREE.Mesh>(null)
  const cloudsRef = useRef<THREE.Mesh>(null)

  // useTexture suspends until all textures are fully loaded (integrates with Suspense)
  const textureMap = useTexture({
    day: '/textures/earth_daymap_2k.jpg',
    night: '/textures/earth_nightmap_2k.jpg',
    clouds: '/textures/earth_clouds_2k.jpg',
    normal: '/textures/earth_normal_2k.jpg',
    specular: '/textures/earth_specular_2k.jpg',
  })

  // Set correct color space per texture type
  const textures = useMemo(() => {
    // Color textures: sRGB (Three.js converts to linear when sampled in shader)
    textureMap.day.colorSpace = THREE.SRGBColorSpace
    textureMap.night.colorSpace = THREE.SRGBColorSpace
    textureMap.clouds.colorSpace = THREE.SRGBColorSpace
    // Non-color data textures: must stay linear
    textureMap.normal.colorSpace = THREE.LinearSRGBColorSpace
    textureMap.specular.colorSpace = THREE.LinearSRGBColorSpace

    for (const tex of Object.values(textureMap)) {
      ;(tex as THREE.Texture).anisotropy = 8
    }
    return textureMap
  }, [textureMap])

  // Compute sun direction from current date
  const sunDir = useMemo(() => {
    const now = new Date()
    const dayOfYear = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
    )
    const hourAngle = (now.getUTCHours() / 24) * Math.PI * 2
    const declination = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10)) * (Math.PI / 180)

    return new THREE.Vector3(
      Math.cos(hourAngle) * Math.cos(declination),
      Math.sin(declination),
      -Math.sin(hourAngle) * Math.cos(declination)
    ).normalize()
  }, [])

  // Rotate clouds slowly
  useFrame((_, delta) => {
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.005
    }
  })

  return (
    <group>
      {/* Main Earth sphere */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[1, 48, 48]} />
        <earthMaterial
          dayTexture={textures.day}
          nightTexture={textures.night}
          normalMap={textures.normal}
          specularMap={textures.specular}
          sunDirection={sunDir}
        />
      </mesh>

      {/* Cloud layer */}
      <mesh ref={cloudsRef} scale={[1.003, 1.003, 1.003]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          map={textures.clouds}
          transparent
          opacity={0.25}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}
