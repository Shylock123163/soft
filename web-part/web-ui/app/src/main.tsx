import ReactDOM from 'react-dom/client';
import { App } from '@/app/App';
import '@/styles/index.css';
import '@/styles/navbar.css';
import '@/styles/splash.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found.');
}

ReactDOM.createRoot(rootElement).render(<App />);
