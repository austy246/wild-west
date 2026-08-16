import { Game } from './Game';
import { MainMenu } from './ui/MainMenu';
import { MultiplayerMenu } from './ui/MultiplayerMenu';
import { SaveManager } from './core/SaveManager';
import { Net } from './net/Net';
import { GAME_VERSION } from './version';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

// Stamp the build version into the corner
const versionEl = document.getElementById('version-tag');
if (versionEl) versionEl.textContent = `v${GAME_VERSION}`;

let game: Game | null = null;

function startGame(loadSave: boolean, net?: Net): void {
  if (game) return; // never run two worlds at once

  game = new Game(canvas, net);

  if (loadSave) {
    const data = SaveManager.load();
    if (data) {
      game.loadGame(data);
    }
  }

  function gameLoop(): void {
    game!.update();
    requestAnimationFrame(gameLoop);
  }
  requestAnimationFrame(gameLoop);
}

// Show main menu
const menu = new MainMenu();
const net = new Net();
const mpMenu = new MultiplayerMenu(net);

menu.onNewGame = () => startGame(false);
menu.onContinue = () => startGame(true);
menu.onMultiplayer = () => mpMenu.show();

mpMenu.onStart = (session) => startGame(false, session);
mpMenu.onSolo = () => startGame(false);
mpMenu.onBack = () => menu.show();

// Say goodbye properly so the others don't see a frozen cowboy
window.addEventListener('beforeunload', () => net.disconnect());
