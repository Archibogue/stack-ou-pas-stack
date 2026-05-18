import { initUI } from './ui.js';

const app = document.getElementById('app');
if (app) {
  app.textContent = 'Chargement de l’interface…';
}

window.addEventListener('DOMContentLoaded', async () => {
  try {
    await initUI();
  } catch (error) {
    console.error('Échec du démarrage de l’UI V2 :', error);
    showFatalError(error);
  }
});

function showFatalError(error) {
  const appNode = document.getElementById('app');
  if (!appNode) return;
  appNode.innerHTML = `
    <div style="padding: 24px; background: rgba(0,0,0,0.65); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; color: #fff; max-width: 800px; margin: 32px auto;">
      <h1>Erreur de démarrage</h1>
      <p>Impossible d’initialiser l’interface. Ouvrez la console du navigateur pour voir l’erreur.</p>
      <pre style="white-space: pre-wrap; word-break: break-word; color: #ffb878;">${String(error)}</pre>
    </div>
  `;
}
