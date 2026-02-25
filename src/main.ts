import { Game } from './Game';
import { MainMenu } from './ui/MainMenu';
import { SaveManager } from './core/SaveManager';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

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
