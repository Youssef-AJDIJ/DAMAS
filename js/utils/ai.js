// js/utils/ai.js
// Enhanced AI for checkers with multi-capture search and minimax (depth 2)
// Mantiene las mismas funciones públicas: getBestMove, makeMove, etc.

import { getValidMoves } from './moves.js';

export class CheckersAI {
  constructor(difficulty = 'medium') {
    this.difficulty = difficulty;
  }

  /**
   * Public - devuelve el mejor movimiento { piece, move } o null
   */
  getBestMove(board, aiColor) {
    const allPieces = board.getPiecesOfColor(aiColor);
    const allMoves = [];

    // Recolectar todos los movimientos válidos
    for (const piece of allPieces) {
      const moves = getValidMoves(board, piece);
      for (const move of moves) {
        allMoves.push({ piece, move });
      }
    }

    if (allMoves.length === 0) return null;

    // FORCED CAPTURES: si hay capturas inmediatas, considerar solo esas
    const captures = allMoves.filter(m => m.move.capture);
    const movesToConsider = captures.length > 0 ? captures : allMoves;

    switch (this.difficulty) {
      case 'easy':
        return this.getRandomMove(movesToConsider);
      case 'medium':
        return this.getMediumMove(movesToConsider, board, aiColor);
      case 'hard':
        return this.getHardMove(movesToConsider, board, aiColor);
      default:
        return this.getRandomMove(movesToConsider);
    }
  }

  /**
   * Random move
   */
  getRandomMove(allMoves) {
    const randomIndex = Math.floor(Math.random() * allMoves.length);
    return allMoves[randomIndex];
  }

  /**
   * Medium: prioriza capturas (y multi-capturas), luego control de centro con variedad
   */
  getMediumMove(allMoves, board, aiColor) {
    // Prefer captures (inmediatas)
    const captures = allMoves.filter(m => m.move.capture);
    if (captures.length > 0) {
      // Entre capturas, preferir cadenas largas
      const scored = captures.map(m => {
        const chain = this.getMaxCaptureChain(board, m.piece, m.move);
        return { ...m, chain };
      });
      // ordenar por chain desc
      scored.sort((a, b) => b.chain - a.chain);
      const bestChain = scored[0].chain;
      const top = scored.filter(s => s.chain === bestChain);
      return this.getRandomMove(top);
    }

    // Si no hay capturas, ponderar por posición (centro) y seguridad
    const scored = allMoves.map(m => {
      const posScore = this.evaluatePosition(m.move.row, m.move.col, board.size);
      // penalizar si después de mover te comen
      const danger = this.moveLeadsToImmediateCapture(board, m, aiColor) ? -30 : 0;
      return { ...m, score: posScore + danger };
    });

    scored.sort((a, b) => b.score - a.score);
    const topMoves = scored.slice(0, Math.min(3, scored.length));
    return this.getRandomMove(topMoves);
  }

  /**
   * Hard: minimax ligero (profundidad 2) + búsqueda de cadenas de captura
   */
  getHardMove(allMoves, board, aiColor) {
    const scored = allMoves.map(m => {
      // simular move en clon ligero
      const clone = this.cloneBoardForAI(board);
      const clonePiece = clone.getPiece(m.piece.row, m.piece.col);
      this.applyMoveOnClone(clone, clonePiece, m.move);

      // usar minimax de profundidad 2 (IA -> oponente -> IA)
      const score = this.minimax(clone, 2, false, aiColor);
      return { ...m, score };
    });

    scored.sort((a, b) => b.score - a.score);

    // seleccionar entre movimientos mejores con un poco de aleatoriedad
    const topScore = scored[0].score;
    const topMoves = scored.filter(m => m.score >= topScore - 10);
    return this.getRandomMove(topMoves);
  }

  /**
   * --------------------------
   * Helper: clon ligero del tablero
   * --------------------------
   * Crea un objeto tablero solo para simulación con la API mínima que usa getValidMoves:
   * - size
   * - grid (matriz de piezas o null)
   * - getPiece(row,col)
   * - movePiece(piece, newRow, newCol)
   * - removePiece(row,col)
   * - inBounds(row,col)
   * - getPiecesOfColor(color)
   *
   * NO modifica el Board real.
   */
  cloneBoardForAI(board) {
    const size = board.size;
    // clon simple de piezas: copiar propiedades esenciales (color,row,col,king)
    const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => null));

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const p = board.getPiece(r, c);
        if (p) {
          // crear objeto plano con las propiedades mínimas requeridas
          grid[r][c] = {
            color: p.color,
            row: p.row,
            col: p.col,
            king: !!p.king
          };
        }
      }
    }

    const clone = {
      size,
      grid,
      inBounds: function (row, col) {
        return row >= 0 && row < this.size && col >= 0 && col < this.size;
      },
      getPiece: function (row, col) {
        if (!this.inBounds(row, col)) return null;
        return this.grid[row][col];
      },
      movePiece: function (piece, newRow, newCol) {
        if (!piece) return;
        // limpiar origen si pieza coincide
        if (this.grid[piece.row] && this.grid[piece.row][piece.col] === piece) {
          this.grid[piece.row][piece.col] = null;
        } else {
          // buscar origen por coincidencia de coordenadas si referencia distinta
          if (this.inBounds(piece.row, piece.col) && this.grid[piece.row][piece.col]) {
            this.grid[piece.row][piece.col] = null;
          }
        }
        piece.row = newRow;
        piece.col = newCol;
        this.grid[newRow][newCol] = piece;
      },
      removePiece: function (row, col) {
        if (!this.inBounds(row, col)) return;
        this.grid[row][col] = null;
      },
      getPiecesOfColor: function (color) {
        const pieces = [];
        for (let r = 0; r < this.size; r++) {
          for (let c = 0; c < this.size; c++) {
            const p = this.grid[r][c];
            if (p && p.color === color) pieces.push(p);
          }
        }
        return pieces;
      }
    };

    return clone;
  }

  /**
   * Aplica un movimiento sobre el clon (o sobre cualquier tablero que tenga la API usada arriba)
   * - mueve la pieza
   * - elimina pieza capturada si existe
   * - mantiene .king como estaba; la promoción la dejamos al caller si lo desea (pero hacemos set king si corresponde)
   */
  applyMoveOnClone(clone, piece, move) {
    if (!piece || !move) return;

    // Si captura es un objeto {row,col} (según tu moves.js)
    if (move.capture) {
      // eliminar la pieza capturada
      clone.removePiece(move.capture.row, move.capture.col);
    }

    // mover pieza
    clone.movePiece(piece, move.row, move.col);

    // promoción: según tus reglas en moves.js, filas 0 o size-1 (peón -> rey)
    if (!piece.king) {
      const becomesKing = (piece.color === 'red' && move.row === 0) ||
                         (piece.color === 'black' && move.row === clone.size - 1);
      if (becomesKing) piece.king = true;
    }
  }

  /**
   * DFS para encontrar la máxima longitud de cadena de capturas empezando por un movimiento dado.
   * Usa la clonación interna y getValidMoves (de tu moves.js).
   * Devuelve cuántas capturas totales puede conseguirse (0 si ninguna).
   */
  getMaxCaptureChain(board, piece, startMove) {
    // clonamos y aplicamos startMove
    const clone = this.cloneBoardForAI(board);
    const clonePiece = clone.getPiece(piece.row, piece.col);
    if (!clonePiece) {
      // si por alguna razón no encontramos la pieza (referencias distintas), buscar por coords
      const candidates = clone.getPiecesOfColor(piece.color).filter(p => p.row === piece.row && p.col === piece.col);
      if (candidates.length > 0) clonePiece = candidates[0];
    }
    if (!clonePiece) return 0;

    this.applyMoveOnClone(clone, clonePiece, startMove);

    // ahora buscar recursivamente las capturas adicionales desde la nueva posición
    const dfs = (b, p) => {
      const moves = getValidMoves(b, p).filter(m => m.capture);
      if (moves.length === 0) return 0;
      let best = 0;
      for (const m of moves) {
        // clonar para rama
        const b2 = this.cloneBoardForAI(b);
        const p2 = b2.getPiece(p.row, p.col);
        this.applyMoveOnClone(b2, p2, m);
        const sub = 1 + dfs(b2, p2); // 1 captura ahora + futuras
        if (sub > best) best = sub;
      }
      return best;
    };

    return dfs(clone, clonePiece);
  }

  /**
   * Comprueba si, tras aplicar el movimiento, el oponente puede capturar esa pieza inmediatamente.
   * Devuelve true si existe captura del oponente que toma la pieza movida.
   */
  moveLeadsToImmediateCapture(board, moveObj, aiColor) {
    const clone = this.cloneBoardForAI(board);
    // encontrar pieza clon equivalente
    let clonePiece = clone.getPiece(moveObj.piece.row, moveObj.piece.col);
    if (!clonePiece) {
      const cand = clone.getPiecesOfColor(moveObj.piece.color).find(p => p.row === moveObj.piece.row && p.col === moveObj.piece.col);
      clonePiece = cand || null;
    }
    if (!clonePiece) return false;

    this.applyMoveOnClone(clone, clonePiece, moveObj.move);

    const opponent = aiColor === 'red' ? 'black' : 'red';
    const oppPieces = clone.getPiecesOfColor(opponent);

    for (const p of oppPieces) {
      const moves = getValidMoves(clone, p);
      for (const m of moves) {
        if (m.capture && m.capture.row === clonePiece.row && m.capture.col === clonePiece.col) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Evaluación de tablero (para minimax):
   * - material: pieza normal = 100, rey = 160
   * - posición: evaluatePosition (centro, filas)
   * - seguridad: penaliza piezas vulnerables
   */
  evaluateBoard(boardLike, aiColor) {
    let score = 0;
    const opponent = aiColor === 'red' ? 'black' : 'red';

    for (let r = 0; r < boardLike.size; r++) {
      for (let c = 0; c < boardLike.size; c++) {
        const p = boardLike.getPiece(r, c);
        if (!p) continue;

        const base = p.king ? 160 : 100;
        const pos = this.evaluatePosition(p.row, p.col, boardLike.size);

        if (p.color === aiColor) {
          score += base + pos;
          // penalizar si pieza está en peligro tras su posición actual
          const vulnerable = this.pieceIsVulnerable(boardLike, p);
          if (vulnerable) score -= 40;
        } else {
          score -= base + pos;
          const vulnerableOpp = this.pieceIsVulnerable(boardLike, p);
          if (vulnerableOpp) score += 20; // preferir piezas enemigas en peligro
        }
      }
    }

    return score;
  }

  /**
   * Determina si una pieza (en el tablero simulado) puede ser capturada inmediatamente por el oponente.
   */
  pieceIsVulnerable(boardLike, piece) {
    const opponent = piece.color === 'red' ? 'black' : 'red';
    const oppPieces = boardLike.getPiecesOfColor(opponent);

    for (const p of oppPieces) {
      const moves = getValidMoves(boardLike, p);
      for (const m of moves) {
        if (m.capture && m.capture.row === piece.row && m.capture.col === piece.col) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Minimax simplificado (sin alpha-beta) profundidad variable.
   * isMax: true si es turno del AI (queremos maximizar)
   */
  minimax(boardLike, depth, isMax, aiColor) {
    if (depth === 0) return this.evaluateBoard(boardLike, aiColor);

    const color = isMax ? aiColor : (aiColor === 'red' ? 'black' : 'red');
    const pieces = boardLike.getPiecesOfColor(color);

    // recolectar movimientos
    const moves = [];
    for (const piece of pieces) {
      const valid = getValidMoves(boardLike, piece);
      valid.forEach(m => moves.push({ piece, move: m }));
    }

    if (moves.length === 0) {
      // sin movimientos: si es max, mal para AI; si es min, bien para AI
      return isMax ? -9999 : 9999;
    }

    if (isMax) {
      let best = -Infinity;
      for (const m of moves) {
        const clone = this.cloneBoardForAI(boardLike);
        const cp = clone.getPiece(m.piece.row, m.piece.col);
        this.applyMoveOnClone(clone, cp, m.move);
        const val = this.minimax(clone, depth - 1, false, aiColor);
        if (val > best) best = val;
      }
      return best;
    } else {
      let worst = Infinity;
      for (const m of moves) {
        const clone = this.cloneBoardForAI(boardLike);
        const cp = clone.getPiece(m.piece.row, m.piece.col);
        this.applyMoveOnClone(clone, cp, m.move);
        const val = this.minimax(clone, depth - 1, true, aiColor);
        if (val < worst) worst = val;
      }
      return worst;
    }
  }

  /**
   * Evaluación simple de posición: centro + bonus de fila trasera
   */
  evaluatePosition(row, col, boardSize) {
    const centerRow = (boardSize - 1) / 2;
    const centerCol = (boardSize - 1) / 2;

    const distFromCenter = Math.abs(row - centerRow) + Math.abs(col - centerCol);
    const centerScore = Math.max(0, 10 - distFromCenter); // más cerca del centro = mejor

    // back row bonus (defensa)
    const backRowScore = (row === 0 || row === boardSize - 1) ? 4 : 0;

    return centerScore + backRowScore;
  }

  /**
   * Igual que antes: pequeña demora para que la IA "parezca" pensar
   */
  async makeMove(callback, delayMs = 1000) {
    return new Promise(resolve => {
      setTimeout(() => {
        callback();
        resolve();
      }, delayMs);
    });
  }
}
