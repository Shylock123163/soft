# Dark Zone Catcher — Web UI Technical Summary

> A React 18 single-page application serving as the control console for a smart home robot that retrieves objects from hard-to-reach dark spaces (under beds, sofas, cabinets).

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite 5 (`base: "/sr/"`) |
| Routing | react-router-dom v7 (BrowserRouter, basename `/sr`) |
| State | Zustand v5 (2 stores: `robotStore`, `splashStore`) |
| 3D | Three.js + @react-three/fiber + @react-three/drei |
| Animation | Framer Motion, CSS keyframes, Canvas 2D particle systems |
| Icons | lucide-react |
| Backend | Node.js "OpenClaw" NLP server (port 9012) |
| Deploy | Nginx reverse proxy at `/sr/`, Cloudflare R2 for assets |

## Project Structure

```
app/
  index.html                        Vite entry (title: "暗域捕手")
  vite.config.ts                    base "/sr/", alias @ → src, manual chunks
  public/
    robot.jpg                       Robot photograph (used across pages)
    preview.jpg                     Hero background image
    camera-feed-1.mp4 / 2.mp4      Camera feed videos
    genshin/                        Splash screen audio (BGM, door sounds)
    file-api-config.js              Cloudflare Worker endpoint
  src/
    main.tsx                        Mounts <App/> to #root
    app/
      App.tsx                       Router + splash gate + global layout
      types.ts                      ChatItem, ResponseMeta
      constants.ts                  Initial text, task suggestions, mission presets
      pages/
        HomePage.tsx                Parallax hero + particle title + feature cards + flip card + ring entry
        MonitorPage.tsx             Sidebar modules + camera feed + SLAM map + status table
        ChatPage.tsx                OpenClaw chat interface + quick tasks sidebar
        LoginPage.tsx               3D flip login/register form
        AboutPage.tsx               Project info + tech stack grid
      components/
        SplashScreen.tsx            Genshin Impact-style door opening splash
        ParticleText.tsx            Arknights-style text-to-particle Canvas effect
        FloatingParticles.tsx       Global Canvas particle system (cyan dots)
        TiltCard.tsx                Mouse-tracking 3D tilt card wrapper
        Navbar.tsx                  Fixed top navbar + hamburger mobile sidebar
        FootNav.tsx                 Floating scroll-to-top button
        ChatHistory.tsx             Animated chat message list (framer-motion)
        ScenePanel.tsx              Lazy-loaded 3D robot scene with error boundary
        SlamMapPanel.tsx            CSS-based 2D SLAM room map with animated robot dot
        HeroPanel.tsx               Hero section with robot image and metric cards
        TaskInput.tsx               Task input with mode toggle and suggestions
        MissionOpsStrip.tsx         Mission presets, flow chain, environment constraints
        DecisionPanel.tsx           Decision explanation panel
        ExecutionPreview.tsx        AI response meta + device command preview
        DeviceStatus.tsx            Device status grid (camera, chassis, grip, sensors)
        EventLog.tsx                Task event log
      hooks/
        useOpenClawChat.ts          Chat state, send/reset logic, API calls
        useOpenClawStatus.ts        Polls /api/sr/openclaw/status every 15s
    components/
      scene/
        RobotScene.tsx              Programmatic 3D robot model (react-three-fiber)
    stores/
      robotStore.ts                 Zustand: chassis/grip/sensor state
      splashStore.ts                Zustand: splash screen phase machine
    lib/
      api/
        endpoints.ts                API base URL helpers
        openclaw.ts                 OpenClaw API: fetchStatus, sendChat
    styles/
      index.css                     Global reset + CSS custom properties
      splash.css                    Genshin-style splash (doors, particles, bloom)
      navbar.css                    Top nav + hamburger + sidebar + foot nav
      home.css                      Parallax, hero, particle canvas, feature cards, flip card, ring
      monitor.css                   Sidebar, camera feed, scan lines, status table
      chat.css                      Chat messages, input bar, quick tasks
      login.css                     3D flip login/register form
      about.css                     Project info, tech grid with 3D hover
      slam.css                      2D SLAM room map with grid, furniture, robot dot
    types/
      global.d.ts                   Window.FILE_API_ENDPOINT declaration
```

## Routes

| Path | Page | Description |
|---|---|---|
| `/` | HomePage | Landing page with particle title, parallax, feature cards |
| `/monitor` | MonitorPage | Device sidebar, dual camera feeds, SLAM floor plan, status table |
| `/chat` | ChatPage | Natural language chat with OpenClaw NLP backend |
| `/login` | LoginPage | 3D flip card login/register forms |
| `/about` | AboutPage | Project description, tech stack, architecture |

## App Lifecycle

1. **Splash screen** renders first (gated by `splashStore.done`). No routes mount until splash completes.
2. Splash phases: `loading` (2.5s, progress bar) → `door` (shows "click to enter", auto-advances after 6s) → `entering` (doors slide apart with light burst + sound effects) → `done` (white bloom transition).
3. After splash, `BrowserRouter` mounts with `FloatingParticles` (global canvas), `Navbar`, page routes, and `FootNav`.

## Visual Effects System

### Splash Screen (Genshin Impact-style)
- Two CSS door panels with stone texture gradients, carved patterns, and edge highlights
- Center glow line with pulsing box-shadow
- 40 floating gold particles (CSS animation, bottom-to-top)
- Light burst on enter (radial gradient expanding from center)
- Audio: BGM loop, door impact sound, door slide sound, entry boom
- White-to-dark bloom transition to main app

### Particle Text (Arknights-style)
- `ParticleText` component: renders text to offscreen Canvas, samples pixels (gap=3), creates particle for each qualifying pixel (alpha > 128)
- Particles fly in from random positions (easing divisor: 12 frames)
- Fisher-Yates shuffle on target positions for cross-streaming visual
- Mouse repulsion: inverse-square force (cap 10), spring-back force (0.08)
- Opacity fade-in at 0.025/frame
- Used for the "暗域捕手" hero title on HomePage

### Floating Particles
- `FloatingParticles` component: fixed full-screen Canvas behind all content
- ~50 cyan particles with radial glow, floating upward with random drift
- Lifecycle: spawn at bottom, float up, fade in/out over 300-700 frames

### 3D Card Effects
- `TiltCard` component: mouse-tracking CSS perspective transform (rotateX/Y based on cursor position within card bounds)
- Glare overlay follows cursor angle
- Spring-back on mouse leave (0.5s ease transition)
- Used on feature cards on HomePage

### Per-Page Effects
- **Navbar**: 3D slide-in animation, hover Z-translate, glowing underline, brand hover glow
- **HomePage**: 3D text shadow on title, parallax depth layers with drift animation, pulse ring with scale animation, flip card with enhanced 3D perspective (1200px)
- **MonitorPage**: sidebar slide-in, camera feed scan lines (CSS animation), table row hover with cyan accent
- **ChatPage**: messages enter with 3D perspective rotateX, quick task cards with left-border reveal
- **LoginPage**: 3D perspective flip (rotateY 180deg) between login/register, deep shadow
- **AboutPage**: staggered section fade-in, tech items with 3D translateZ hover, icon rotation

## Design System

```css
--bg: rgba(0, 0, 0, 0.6)           /* dark glass panels */
--bg-light: rgb(234, 234, 239)      /* text color */
--accent: #9cf6ff                    /* cyan accent */
--accent-green: #4ff0d0             /* online/active indicators */
--blur: blur(8px) saturate(160%)    /* glassmorphism backdrop */
--shadow: 8px 8px 16px rgba(0,0,0,0.3), -4px -4px 12px rgba(255,255,255,0.04)
--radius: 10px
--transition: 0.35s ease
```

Dark theme (#0a0a0a background), glassmorphism with backdrop-filter, neumorphic shadows. Sci-fi/game HUD aesthetic. All content in Chinese (zh-CN).

## API Integration

- **OpenClaw NLP backend** at `/api/sr/openclaw/` (proxied by nginx to port 9012)
  - `POST /api/sr/openclaw/chat` — send task in natural language, receive structured response
  - `GET /api/sr/openclaw/status` — polled every 15s for device/connection state
- **Cloudflare Worker** endpoint for file/asset operations (configured via `file-api-config.js`)

## Build & Deploy

```bash
# Dev
npm run dev          # Vite dev server at localhost:5173/sr/

# Build
npm run build        # Output to app/dist/

# Chunks (vite.config.ts manualChunks)
# - react chunk (react + react-dom)
# - three chunk (three + @react-three/*)
# - main index chunk (app code + framer-motion + zustand + lucide)
```

Production is deployed behind nginx at path `/sr/`, with reverse proxy to OpenClaw backend and static file serving from `app/dist/`.

## Key Implementation Notes

- The 3D robot model in `RobotScene.tsx` is **programmatically built** with react-three-fiber primitives (boxes, cylinders), not loaded from a .glb file.
- The SLAM map in `SlamMapPanel.tsx` is **pure CSS** (grid lines, positioned divs for furniture, CSS animation for robot dot movement).
- The splash screen plays audio files copied from a separate `splash-source/` sub-project that contains a full Genshin Impact 3D recreation (WebGL/GLSL). The main app uses a lightweight CSS-only reimplementation instead.
- Camera feeds use `<video>` elements with `.mp4` sources from the public folder. In production, these would be replaced with live RTSP streams via a relay.
- State management is minimal: only 2 Zustand stores. Most component state is local via `useState`/`useRef`.
- No authentication is actually implemented — the login page is a UI mockup.
