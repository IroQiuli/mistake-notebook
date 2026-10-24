import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

void navigator.storage?.persist?.().catch(() => {});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// 启动画面平滑淡出
const splash = document.getElementById('splash-screen');
if (splash) {
  setTimeout(() => {
    splash.style.opacity = '0';
    splash.style.pointerEvents = 'none';
    setTimeout(() => splash.remove(), 450);
  }, 400);
}
