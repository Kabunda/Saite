import { GameCore } from './core.js';
import { MultGame } from './game-multiple.js';
import { NeighborsGame } from './game-neighbors.js';
import { ComplitGame } from './game-complit.js';

const gameModes = {
    multiple: MultGame,
    neighbors: NeighborsGame,
    complit: ComplitGame
};

document.addEventListener('DOMContentLoaded', () => {
    new GameCore(gameModes);
});