import { Game } from './Game';
import { MainMenu } from './ui/MainMenu';
import { SaveManager } from './core/SaveManager';
import { GAME_VERSION } from './version';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

// Stamp the build version into the corner
const versionEl = document.getElementById('version-tag');
if (versionEl) versionEl.textContent = `v${GAME_VERSION}`;

let game: Game | null = null;

function startGame(loadSave: boolean): void {
  game = new Game(canvas);

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
menu.onNewGame = () => startGame(false);
menu.onContinue = () => startGame(true);
