// js/utils/ai.js
// Simple AI for checkers opponent

import { getValidMoves } from './moves.js';

/**
 * AI Player - Makes moves based on difficulty level
 */
export class CheckersAI {
  constructor(difficulty = 'medium') {
    this.difficulty = difficulty;
  }

  /**
   * Get the best move for the AI
   * @param {Board} board - Current board state
   * @param {string} aiColor - Color the AI is playing ('red' or 'black')
   * @returns {Object} Move object {piece, move}
   */
  getBestMove(board, aiColor) {
    const allPieces = board.getPiecesOfColor(aiColor);
    const allMoves = [];

    // Collect all possible moves
    for (const piece of allPieces) {
      const moves = getValidMoves(board, piece);
      for (const move of moves) {
        allMoves.push({ piece, move });
      }
    }

    if (allMoves.length === 0) {
      return null;
    }

    // FORCED CAPTURES: If any captures are available, only consider those
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
   * Easy AI - Random move
   */
  getRandomMove(allMoves) {
    const randomIndex = Math.floor(Math.random() * allMoves.length);
    return allMoves[randomIndex];
  }

  /**
   * Medium AI - Prefer captures, then center control
   */
  getMediumMove(allMoves, board, aiColor) {
    // Prefer captures
    const captures = allMoves.filter(m => m.move.capture);
    if (captures.length > 0) {
      // Among captures, prefer multi-captures
      const multiCaptures = captures.filter(m => 
        Array.isArray(m.move.capture) && m.move.capture.length > 1
      );
      if (multiCaptures.length > 0) {
        return this.getRandomMove(multiCaptures);
      }
      return this.getRandomMove(captures);
    }

    // Otherwise, prefer center positions
    const scored = allMoves.map(m => ({
      ...m,
      score: this.evaluatePosition(m.move.row, m.move.col, board.size)
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Pick from top 3 moves randomly (add variety)
    const topMoves = scored.slice(0, Math.min(3, scored.length));
    return this.getRandomMove(topMoves);
  }

  /**
   * Hard AI - Minimax with some lookahead
   */
  getHardMove(allMoves, board, aiColor) {
    const opponentColor = aiColor === 'red' ? 'black' : 'red';
    
    // Evaluate each move
    const scored = allMoves.map(m => {
      // Simulate the move
      const score = this.evaluateMoveDeep(m, board, aiColor, opponentColor);
      return { ...m, score };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Small randomness among top moves to avoid predictability
    const topScore = scored[0].score;
    const topMoves = scored.filter(m => m.score >= topScore - 10);
    
    return this.getRandomMove(topMoves);
  }

  /**
   * Evaluate a position on the board
   */
  evaluatePosition(row, col, boardSize) {
    const centerRow = boardSize / 2;
    const centerCol = boardSize / 2;
    
    // Distance from center (lower is better)
    const distFromCenter = Math.abs(row - centerRow) + Math.abs(col - centerCol);
    
    // Center control is good
    const centerScore = 10 - distFromCenter;
    
    // Back row bonus (for defense)
    const backRowScore = (row === 0 || row === boardSize - 1) ? 5 : 0;
    
    return centerScore + backRowScore;
  }

  /**
   * Deep evaluation of a move (simple minimax)
   */
  evaluateMoveDeep(moveObj, board, aiColor, opponentColor) {
    let score = 0;

    // Capture is very valuable
    if (moveObj.move.capture) {
      const captureCount = Array.isArray(moveObj.move.capture) 
        ? moveObj.move.capture.length 
        : 1;
      score += captureCount * 50;
    }

    // King pieces are valuable
    if (moveObj.piece.king) {
      score += 20;
    }

    // Becoming a king is very valuable
    const wouldBecomeKing = !moveObj.piece.king && (
      (aiColor === 'red' && moveObj.move.row === 0) ||
      (aiColor === 'black' && moveObj.move.row === board.size - 1)
    );
    if (wouldBecomeKing) {
      score += 40;
    }

    // Position score
    score += this.evaluatePosition(moveObj.move.row, moveObj.move.col, board.size);

    // Piece safety (avoid edges on sides)
    const isEdge = moveObj.move.col === 0 || moveObj.move.col === board.size - 1;
    if (!isEdge) {
      score += 5;
    }

    // Advancing forward (for non-kings)
    if (!moveObj.piece.king) {
      const advancement = aiColor === 'red' 
        ? (moveObj.piece.row - moveObj.move.row) // Red moves up (decreasing row)
        : (moveObj.move.row - moveObj.piece.row); // Black moves down (increasing row)
      score += advancement * 3;
    }

    return score;
  }

  /**
   * Small delay to make moves feel more natural
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
