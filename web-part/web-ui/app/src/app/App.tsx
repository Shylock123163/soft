import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from '@/app/components/Navbar';
import { FootNav } from '@/app/components/FootNav';
import { HomePage } from '@/app/pages/HomePage';
import { MonitorPage } from '@/app/pages/MonitorPage';
import { ChatPage } from '@/app/pages/ChatPage';
import { LoginPage } from '@/app/pages/LoginPage';
import { AboutPage } from '@/app/pages/AboutPage';

export function App() {
  return (
    <BrowserRouter basename="/sr">
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/monitor" element={<MonitorPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
      <FootNav />
    </BrowserRouter>
  );
}
