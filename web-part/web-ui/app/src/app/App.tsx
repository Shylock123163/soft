import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Navbar } from '@/app/components/Navbar';
import { FootNav } from '@/app/components/FootNav';
import { HomePage } from '@/app/pages/HomePage';
import { MonitorPage } from '@/app/pages/MonitorPage';
import { ChatPage } from '@/app/pages/ChatPage';
import { LoginPage } from '@/app/pages/LoginPage';
import { AboutPage } from '@/app/pages/AboutPage';
import { SplashScreen } from '@/app/components/SplashScreen';
import { useSplashStore } from '@/stores/splashStore';

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        style={{ flex: 1 }}
      >
        <Routes location={location}>
          <Route path="/" element={<HomePage />} />
          <Route path="/monitor" element={<MonitorPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export function App() {
  const splashDone = useSplashStore((s) => s.done);

  if (!splashDone) return <SplashScreen />;

  return (
    <BrowserRouter basename="/sr">
      <Navbar />
      <AnimatedRoutes />
      <FootNav />
    </BrowserRouter>
  );
}
