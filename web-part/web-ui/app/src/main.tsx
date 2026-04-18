import ReactDOM from 'react-dom/client';
import { AnimatorGeneralProvider } from '@arwes/react';
import { App } from '@/app/App';
import '@/styles/index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found.');
}

ReactDOM.createRoot(rootElement).render(
  <AnimatorGeneralProvider
    duration={{
      enter: 0.22,
      exit: 0.18,
      stagger: 0.035
    }}
  >
    <App />
  </AnimatorGeneralProvider>
);
