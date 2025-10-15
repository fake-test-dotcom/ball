'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Canvas from './Canvas';

type Bubble = { x: number; y: number; color: string; popping?: boolean; scale?: number; alpha?: number };
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
          color,
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
        if (b.color === color) {
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
          const newBubble: Bubble = { x: snapX, y: snapY, color, scale: 1, alpha: 1 };
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

            let start: number | null = null;
            const animatePop = (timestamp: number) => {
              if (!start) start = timestamp;
              const progress = (timestamp - start) / 300;
              setGrid((g) =>
                g
                  .map((b, i) => {
                    if (!matched.has(i)) return b;
                    const scale = Math.max(0, 1 - progress);
                    const alpha = Math.max(0, 1 - progress);
                    return { ...b, scale, alpha };
                  })
                  .filter((b) => b.alpha! > 0)
              );
              if (progress < 1) requestAnimationFrame(animatePop);
              else {
                setPoppedCount((pc) => {
                  const newCount = pc + matched.size;
                  if (newCount >= 20) setWin(true);
                  return newCount;
                });
              }
            };
            requestAnimationFrame(animatePop);
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

      grid.forEach((b) => drawBubble(ctx, b.x, b.y, b.color, b.scale, b.alpha));
      if (!shot && aimVec) drawAimLine(ctx);
      drawBubble(ctx, ball.x, ball.y, ball.color);
    },
    [grid, drawBubble, ball, aimVec, shot, drawAimLine, cw, ch]
  );

  // ✅ fix: keep reset but silence eslint unused warning
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const reset = () => {
    setGrid(createLine(0));
    setBall(spawnBall());
    setShot(false);
    setGameOver(false);
    setPoppedCount(0);
    setWin(false);
    setAimVec(null);
  };

  return (
    <div
      className="relative flex flex-col items-center justify-center min-h-screen text-white overflow-hidden"
      style={{
        background:
          'linear-gradient(270deg, #ff0000, #00ff00, #0000ff, #ff00ff)',
        backgroundSize: '800% 800%',
        animation: 'rgbShift 15s ease infinite',
      }}
    >
      <style>{`
        @keyframes rgbShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>

      <header className="w-full py-4 text-center text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-pink-500 shadow-lg">
        🎮 Ball One <span className="text-sm">(v3.1)</span>
      </header>

      {loading && (
        <div className="absolute inset-0 flex flex-col justify-center items-center bg-black/90 backdrop-blur-md z-50">
          <div className="animate-pulse text-center">
            <h2 className="text-3xl font-bold mb-3 text-purple-400">Loading...</h2>
            <p className="text-gray-300">Setting up your game</p>
          </div>
        </div>
      )}

      <Canvas
        ref={canvasRef}
        draw={draw}
        width={cw}
        height={ch}
        className="rounded-2xl border border-white/10 shadow-2xl mt-4 sm:mt-6"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{ touchAction: 'none' }}
      />

      {!gameOver && !win && !loading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/60 px-5 py-3 rounded-lg text-center animate-pulse">
            <p className="text-lg sm:text-xl font-semibold text-purple-300">
              Drag or swipe upward to aim and shoot
            </p>
            <p className="text-sm text-gray-400">(Tap, drag, then release)</p>
          </div>
        </div>
      )}

      {(gameOver || win) && (
        <div className="absolute inset-0 flex flex-col justify-center items-center bg-black/80 backdrop-blur-md z-40">
          <h2
            className={`text-4xl font-bold mb-5 ${
              win ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {win ? '🎉 You Win!' : '💀 Game Over'}
          </h2>
          <button
            onClick={() => reset()}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full text-white font-semibold hover:scale-105 transition-transform"
          >
            Restart
          </button>
        </div>
      )}
    </div>
  );
}
