'use client';
import React, { useEffect, useRef, useState } from 'react';

interface Bubble {
  x: number;
  y: number;
  color: string;
  scale: number;
  alpha: number;
}

const colors = ['#ff4d4d', '#4dff88', '#4da6ff', '#ffff4d', '#ff4dff'];

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[][]>([]);
  const [playerBubble, setPlayerBubble] = useState<Bubble | null>(null);
  const [nextBubble, setNextBubble] = useState<Bubble | null>(null);
  const [angle, setAngle] = useState(0);
  const [score, setScore] = useState(0);
  const bubbleSize = 40;
  const rows = 9;
  const cols = 11;

  // Initialize bubbles
  useEffect(() => {
    const createLine = (yOffset: number) => {
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

    const newBubbles: Bubble[][] = [];
    for (let r = 0; r < rows; r++) {
      newBubbles.push(createLine(r * bubbleSize));
    }
    setBubbles(newBubbles);

    // Initial player bubble
    const startColor = colors[Math.floor(Math.random() * colors.length)];
    setPlayerBubble({
      x: (cols / 2) * bubbleSize,
      y: rows * bubbleSize + 50,
      color: startColor,
      scale: 1,
      alpha: 1,
    });

    // Next bubble
    const nextColor = colors[Math.floor(Math.random() * colors.length)];
    setNextBubble({
      x: (cols / 2) * bubbleSize + 100,
      y: rows * bubbleSize + 50,
      color: nextColor,
      scale: 1,
      alpha: 1,
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw all bubbles
      bubbles.forEach(row => {
        row.forEach(b => {
          ctx.globalAlpha = b.alpha;
          ctx.beginPath();
          ctx.arc(b.x, b.y, (bubbleSize / 2) * b.scale, 0, Math.PI * 2);
          ctx.fillStyle = b.color;
          ctx.fill();
          ctx.closePath();
        });
      });

      // Draw player bubble
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

      // Draw next bubble preview
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

  // Update angle on mouse move
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

  // Shoot bubble
  const shootBubble = () => {
    if (!playerBubble) return;
    const speed = 10;
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed;

    let x = playerBubble.x;
    let y = playerBubble.y;
    const color = playerBubble.color;

    const move = () => {
      x += dx;
      y += dy;

      // Bounce off walls
      if (x <= bubbleSize / 2 || x >= cols * bubbleSize - bubbleSize / 2) {
        setAngle(a => Math.PI - a);
      }

      // Stop when reaching top
      if (y <= bubbleSize / 2) {
        clearInterval(timer);
        const newRow = Math.floor(y / bubbleSize);
        const newCol = Math.floor(x / bubbleSize);
        const newBubbles = [...bubbles];
        newBubbles[newRow][newCol] = { x, y, color, scale: 1, alpha: 1 };
        setBubbles(newBubbles);
        setScore(s => s + 10);

        // Replace player bubble with next
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
      <canvas
        ref={canvasRef}
        width={cols * bubbleSize}
        height={rows * bubbleSize + 150}
        className="border-2 border-purple-500 rounded-lg"
        onClick={shootBubble}
      />
      <div className="mt-4 text-lg">Score: {score}</div>
    </div>
  );
}
