import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { healCards } from './domain/heal';
import './index.css';

void navigator.storage?.persist?.().catch(() => {});
void healCards().catch(() => {});

// 注册 PWA 并开启新版本自动更新
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true);
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});

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
