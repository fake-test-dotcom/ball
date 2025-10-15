'use client';
import React, { useEffect, useRef, useState } from 'react';

interface Bubble {
  x: number;
  y: number;
  color: string;
  scale: number;
  alpha: number;
}

type BubbleGrid = (Bubble | null)[][];

const colors = ['#ff4d4d', '#4dff88', '#4da6ff', '#ffff4d', '#ff4dff'];

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [bubbles, setBubbles] = useState<BubbleGrid>([]);
  const [playerBubble, setPlayerBubble] = useState<Bubble | null>(null);
  const [nextBubble, setNextBubble] = useState<Bubble | null>(null);
  const [angle, setAngle] = useState(0);
  const [score, setScore] = useState(0);
  const [popCount, setPopCount] = useState(0); // ✅ track how many pops occurred

  const bubbleSize = 40;
  const rows = 9;
  const cols = 11;

  // ✅ initialize grid
  useEffect(() => {
    const createLine = (yOffset: number): Bubble[] => {
      const line: Bubble[] = [];
      for (let c = 0; c < cols; c++) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        line.push({
          x: c * bubbleSize + bubbleSize / 2,
          y: yOffset + bubbleSize / 2,
          color,
          scale: 1,
          alpha: 1,
        });
      }
      return line;
    };

    const newBubbles: BubbleGrid = [];
    for (let r = 0; r < rows; r++) {
      newBubbles.push(createLine(r * bubbleSize));
    }
    setBubbles(newBubbles);

    const startColor = colors[Math.floor(Math.random() * colors.length)];
    setPlayerBubble({
      x: (cols / 2) * bubbleSize,
      y: rows * bubbleSize + 50,
      color: startColor,
      scale: 1,
      alpha: 1,
    });

    const nextColor = colors[Math.floor(Math.random() * colors.length)];
    setNextBubble({
      x: (cols / 2) * bubbleSize + 100,
      y: rows * bubbleSize + 50,
      color: nextColor,
      scale: 1,
      alpha: 1,
    });
  }, []);

  // ✅ Draw bubbles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      bubbles.forEach(row => {
        row.forEach(b => {
          if (!b) return;
          ctx.globalAlpha = b.alpha;
          ctx.beginPath();
          ctx.arc(b.x, b.y, (bubbleSize / 2) * b.scale, 0, Math.PI * 2);
          ctx.fillStyle = b.color;
          ctx.fill();
          ctx.closePath();
        });
      });

      // player bubble
      if (playerBubble) {
        ctx.globalAlpha = playerBubble.alpha;
        ctx.beginPath();
        ctx.arc(
          playerBubble.x,
          playerBubble.y,
          (bubbleSize / 2) * playerBubble.scale,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = playerBubble.color;
        ctx.fill();
        ctx.closePath();
      }

      // next bubble preview
      if (nextBubble) {
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(
          nextBubble.x,
          nextBubble.y,
          (bubbleSize / 2) * nextBubble.scale * 0.8,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = nextBubble.color;
        ctx.fill();
        ctx.closePath();
      }
    };

    const interval = setInterval(draw, 30);
    return () => clearInterval(interval);
  }, [bubbles, playerBubble, nextBubble]);

  // ✅ Mouse angle tracker
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const dx = mouseX - (cols / 2) * bubbleSize;
      const dy = mouseY - (rows * bubbleSize + 50);
      setAngle(Math.atan2(dy, dx));
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // ✅ find matches of same color
  const findMatches = (grid: BubbleGrid, row: number, col: number, color: string) => {
    const visited = new Set<string>();
    const matches: [number, number][] = [];

    const dfs = (r: number, c: number) => {
      if (r < 0 || r >= grid.length || c < 0 || c >= grid[0].length) return;
      const key = `${r}-${c}`;
      if (visited.has(key)) return;
      if (!grid[r][c] || grid[r][c]?.color !== color) return;

      visited.add(key);
      matches.push([r, c]);
      dfs(r - 1, c);
      dfs(r + 1, c);
      dfs(r, c - 1);
      dfs(r, c + 1);
    };

    dfs(row, col);
    return matches;
  };

  // ✅ popping animation
  const animatePop = (grid: BubbleGrid, matched: [number, number][]) => {
    matched.forEach(([r, c]) => {
      const bubble = grid[r][c];
      if (!bubble) return;

      let scale = 1;
      const shrink = setInterval(() => {
        scale -= 0.1;
        if (scale <= 0) {
          clearInterval(shrink);
          grid[r][c] = null;
          setBubbles([...grid]);
        } else {
          bubble.scale = scale;
          bubble.alpha = scale;
          setBubbles([...grid]);
        }
      }, 30);
    });
  };

  // ✅ shooting logic
  const shootBubble = () => {
    if (!playerBubble) return;

    const speed = 10;
    let { x, y } = { x: playerBubble.x, y: playerBubble.y };
    let dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed; // ✅ const instead of let
    const { color } = playerBubble;

    const move = () => {
      x += dx;
      y += dy;

      if (x <= bubbleSize / 2 || x >= cols * bubbleSize - bubbleSize / 2) {
        dx = -dx;
      }

      if (y <= bubbleSize / 2) {
        clearInterval(timer);
        const newRow = Math.floor(y / bubbleSize);
        const newCol = Math.floor(x / bubbleSize);
        const newBubbles = [...bubbles.map(row => [...row])] as BubbleGrid;
        newBubbles[newRow][newCol] = { x, y, color, scale: 1, alpha: 1 };

        const matches = findMatches(newBubbles, newRow, newCol, color);
        if (matches.length >= 3) {
          setScore(s => s + matches.length * 10);
          setPopCount(p => p + 1);
          animatePop(newBubbles, matches);

          if (popCount + 1 >= 3) {
            setTimeout(() => alert('🎉 You Win!'), 300);
          }
        } else {
          setBubbles(newBubbles);
        }

        setPlayerBubble({
          x: (cols / 2) * bubbleSize,
          y: rows * bubbleSize + 50,
          color: nextBubble?.color || colors[Math.floor(Math.random() * colors.length)],
          scale: 1,
          alpha: 1,
        });

        const nextColor = colors[Math.floor(Math.random() * colors.length)];
        setNextBubble({
          x: (cols / 2) * bubbleSize + 100,
          y: rows * bubbleSize + 50,
          color: nextColor,
          scale: 1,
          alpha: 1,
        });
      } else {
        setPlayerBubble(prev => prev && { ...prev, x, y });
      }
    };

    const timer = setInterval(move, 20);
  };

  return (
    <div className="game-container">
      <canvas
        ref={canvasRef}
        width={cols * bubbleSize}
        height={rows * bubbleSize + 150}
        className="game-canvas"
        onClick={shootBubble}
      />
      <div className="hud">
        <div className="score">🏆 Score: {score}</div>
        <div className="pops">💥 Pops: {popCount}/3</div>
      </div>
    </div>
  );
}
