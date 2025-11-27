// js/utils/render.js
// Modern rendering using CSS classes instead of inline styles

export function renderBoard(container, board, selectedPiece, validSquares = []) {
  container.innerHTML = "";

  for (let r = 0; r < board.size; r++) {
    for (let c = 0; c < board.size; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = r;
      cell.dataset.col = c;

      // Determine if cell is light or dark
      const isDark = (r + c) % 2 === 1;
      cell.classList.add(isDark ? "dark" : "light");

      // Highlight selected cell
      if (
        selectedPiece &&
        selectedPiece.row === r &&
        selectedPiece.col === c
      ) {
        cell.classList.add("selected");
      }

      // Show valid move indicators
      const isValid = validSquares.some(ms => ms.row === r && ms.col === c);
      if (isValid) {
        const dot = document.createElement("div");
        dot.className = "valid-move-indicator";
        cell.appendChild(dot);
      }

      // Render piece if present
      const piece = board.getPiece(r, c);
      if (piece) {
        const pieceEl = document.createElement("div");
        pieceEl.className = `piece ${piece.color}`;
        
        if (piece.king) {
          pieceEl.classList.add("king");
        }

        cell.appendChild(pieceEl);
      }

      container.appendChild(cell);
    }
  }
}
