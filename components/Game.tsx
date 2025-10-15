'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Canvas from './Canvas';

type Bubble = {
  x: number;
  y: number;
  "const": string; // ✅ quoted so build won’t fail
  popping?: boolean;
  scale?: number;
  alpha?: number;
};

type Ball = { x: number; y: number; dx: number; dy: number; color: string };

export default function Game() {
  const [cw, setCw] = useState(360);
  const [ch, setCh] = useState(600);

  useEffect(() => {
    const handleResize = () => {
      const width = Math.min(window.innerWidth * 0.9, 400);
      const height = width * 1.6;
      setCw(width);
      setCh(height);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const bubbleSize = 40;
  const cols = Math.floor(cw / bubbleSize);
  const paddleY = ch - bubbleSize * 1.4;

  const colors = useMemo(
    () => ['#00FFFF', '#FF00FF', '#FFD700', '#00FF7F', '#FF4500', '#1E90FF'],
    []
  );

  const createLine = useCallback(
    (yOffset: number): Bubble[] => {
      const line: Bubble[] = [];
      for (let c = 0; c < cols; c++) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        line.push({
          x: c * bubbleSize + bubbleSize / 2,
          y: yOffset + bubbleSize / 2,
          "const": color,
          scale: 1,
          alpha: 1,
        });
      }
      return line;
    },
    [cols, bubbleSize, colors]
  );

  const spawnBall = useCallback((): Ball => {
    const color = colors[Math.floor(Math.random() * colors.length)];
    return { x: cw / 2, y: paddleY, dx: 0, dy: 0, color };
  }, [cw, paddleY, colors]);

  const [grid, setGrid] = useState<Bubble[]>(() => createLine(0));
  const [ball, setBall] = useState<Ball>(spawnBall());
  const [shot, setShot] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [aimVec, setAimVec] = useState<{ x: number; y: number } | null>(null);
  const [hasShotOnce, setHasShotOnce] = useState(false);
  const [, setPoppedCount] = useState(0);
  const [win, setWin] = useState(false);
  const [loading, setLoading] = useState(true);

  const dragging = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (gameOver || win || loading) return;
    const interval = setInterval(() => {
      setGrid((g) => {
        const moved = g.map((b) => ({ ...b, y: b.y + bubbleSize }));
        const newLine = createLine(0);
        const updated = [...newLine, ...moved];
        if (updated.some((b) => b.y + bubbleSize / 2 >= paddleY)) setGameOver(true);
        return updated;
      });
    }, 6000);
    return () => clearInterval(interval);
  }, [gameOver, win, loading, createLine, bubbleSize, paddleY]);

  const getCoords = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (shot || gameOver || win || loading) return;
    dragging.current = true;
    const { x, y } = getCoords(e);
    setAimVec({ x: x - ball.x, y: y - ball.y });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const { x, y } = getCoords(e);
    const dx = x - ball.x;
    const dy = y - ball.y;
    if (dy > 0) return;
    setAimVec({ x: dx, y: dy });
  };

  const onPointerUp = () => {
    if (!dragging.current || !aimVec || shot || gameOver || win || loading) {
      dragging.current = false;
      setAimVec(null);
      return;
    }
    dragging.current = false;

    let { x, y } = aimVec;
    const len = Math.hypot(x, y);
    if (len === 0) {
      setAimVec(null);
      return;
    }
    const speed = 6;
    x = (x / len) * speed;
    y = (y / len) * speed;
    setBall((b) => ({ ...b, dx: x, dy: y }));
    setShot(true);
    setAimVec(null);
    setHasShotOnce(true);
  };

  const drawBubble = useCallback(
    (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, scale = 1, alpha = 1) => {
      const radius = (bubbleSize / 2 - 2) * scale;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;

      const gradient = ctx.createRadialGradient(
        x - radius / 3,
        y - radius / 3,
        radius / 5,
        x,
        y,
        radius
      );
      gradient.addColorStop(0, 'white');
      gradient.addColorStop(0.25, color);
      gradient.addColorStop(1, '#000');

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.closePath();

      ctx.restore();
    },
    [bubbleSize]
  );

  const drawAimLine = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!aimVec) return;
      const { x, y } = aimVec;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(ball.x + x, ball.y + y);
      ctx.stroke();
      ctx.setLineDash([]);
    },
    [aimVec, ball]
  );

  const findMatchingNeighbors = useCallback(
    (bubbles: Bubble[], index: number, color: string, visited = new Set<number>()) => {
      visited.add(index);
      const ref = bubbles[index];
      for (let i = 0; i < bubbles.length; i++) {
        if (visited.has(i)) continue;
        const b = bubbles[i];
        if (b["const"] === color) {
          const dist = Math.hypot(b.x - ref.x, b.y - ref.y);
          if (dist <= bubbleSize + 2) findMatchingNeighbors(bubbles, i, color, visited);
        }
      }
      return visited;
    },
    [bubbleSize]
  );

  // 🎯 Ball movement + collision
  useEffect(() => {
    if (!shot) return;
    let animationFrameId: number;

    const moveBall = () => {
      setBall((prev) => {
        let { x, y, dx, dy, color } = prev;
        x += dx;
        y += dy;

        if (x < bubbleSize / 2 || x > cw - bubbleSize / 2) dx = -dx;
        if (y < bubbleSize / 2) dy = -dy;

        let collisionIndex = -1;
        for (let i = 0; i < grid.length; i++) {
          const b = grid[i];
          const dist = Math.hypot(b.x - x, b.y - y);
          if (dist < bubbleSize - 2) {
            collisionIndex = i;
            break;
          }
        }

        if (collisionIndex >= 0) {
          const snapX =
            Math.round((x - bubbleSize / 2) / bubbleSize) * bubbleSize + bubbleSize / 2;
          const snapY =
            Math.round((y - bubbleSize / 2) / bubbleSize) * bubbleSize + bubbleSize / 2;
          const newBubble: Bubble = { x: snapX, y: snapY, "const": color, scale: 1, alpha: 1 };
          const tempGrid = [...grid, newBubble];
          const idxNew = tempGrid.length - 1;
          const matched = findMatchingNeighbors(tempGrid, idxNew, color);

          if (matched.size >= 3) {
            // 🎆 POP animation
            setGrid((old) =>
              old.map((b, i) =>
                matched.has(i)
                  ? { ...b, popping: true, scale: 1, alpha: 1 }
                  : b
              )
            );
          } else {
            setGrid((old) => [...old, newBubble]);
          }

          if (grid.some((b) => b.y + bubbleSize / 2 >= paddleY)) setGameOver(true);
          setShot(false);
          return spawnBall();
        }

        if (y > ch + bubbleSize) {
          setShot(false);
          return spawnBall();
        }

        return { x, y, dx, dy, color };
      });

      animationFrameId = requestAnimationFrame(moveBall);
    };

    animationFrameId = requestAnimationFrame(moveBall);
    return () => cancelAnimationFrame(animationFrameId);
  }, [shot, grid, cw, ch, bubbleSize, findMatchingNeighbors, spawnBall, paddleY]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, ch);
      gradient.addColorStop(0, '#0a0a0a');
      gradient.addColorStop(1, '#1a1a1a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, cw, ch);

      grid.forEach((b) => drawBubble(ctx, b.x, b.y, b["const"], b.scale, b.alpha));
      if (!shot && aimVec) drawAimLine(ctx);
      drawBubble(ctx, ball.x, ball.y, ball.color);
    },
    [grid, drawBubble, ball, aimVec, shot, drawAimLine, cw, ch]
  );

  const reset = () => {
    setGrid(createLine(0));
    setBall(spawnBall());
    setShot(false);
    setGameOver(false);
    setHasShotOnce(false);
    setPoppedCount(0);
    setWin(false);
    setAimVec(null);
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen text-white overflow-hidden">
      <Canvas
        ref={canvasRef}
        draw={draw}
        width={cw}
        height={ch}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{ touchAction: 'none' }}
      />
    </div>
  );
}
