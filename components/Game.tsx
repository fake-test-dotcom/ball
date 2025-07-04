'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Canvas from './Canvas';

type Bubble = { x: number; y: number; color: string };
type Ball = { x: number; y: number; dx: number; dy: number; color: string };

export default function Game() {
  const cw = 360,
    ch = 600;
  const bubbleSize = 30;
  const cols = Math.floor(cw / bubbleSize);
  const paddleY = ch - bubbleSize * 1.5;

  // ✅ Memoize colors array to avoid useCallback warnings
  const colors = useMemo(() => ['red', 'blue', 'green', 'yellow'], []);

  const createLine = useCallback(
    (yOffset: number): Bubble[] => {
      const line: Bubble[] = [];
      for (let c = 0; c < cols; c++) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        line.push({
          x: c * bubbleSize + bubbleSize / 2,
          y: yOffset + bubbleSize / 2,
          color,
        });
      }
      return line;
    },
    [cols, bubbleSize, colors]
  );

  const spawnBall = useCallback((): Ball => {
    const color = colors[Math.floor(Math.random() * colors.length)];
    return {
      x: cw / 2,
      y: paddleY,
      dx: 0,
      dy: 0,
      color,
    };
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
    }, 5000);

    return () => clearInterval(interval);
  }, [gameOver, win, loading, createLine, bubbleSize, paddleY]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (shot || gameOver || win || loading) return;
    dragging.current = true;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setAimVec({ x: x - ball.x, y: y - ball.y });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
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

  const drawAimLine = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!aimVec) return;
      const { x, y } = aimVec;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
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
    (
      bubbles: Bubble[],
      index: number,
      color: string,
      visited = new Set<number>()
    ) => {
      visited.add(index);
      const ref = bubbles[index];
      for (let i = 0; i < bubbles.length; i++) {
        if (visited.has(i)) continue;
        const b = bubbles[i];
        if (b.color === color) {
          const dist = Math.hypot(b.x - ref.x, b.y - ref.y);
          if (dist <= bubbleSize + 2) {
            findMatchingNeighbors(bubbles, i, color, visited);
          }
        }
      }
      return visited;
    },
    [bubbleSize]
  );

  const drawBubble = useCallback(
    (ctx: CanvasRenderingContext2D, x: number, y: number, color: string) => {
      const radius = bubbleSize / 2 - 2;

      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      const gradient = ctx.createRadialGradient(
        x - radius / 3,
        y - radius / 3,
        radius / 5,
        x,
        y,
        radius
      );
      gradient.addColorStop(0, 'white');
      gradient.addColorStop(0.3, color);
      gradient.addColorStop(1, 'black');

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.closePath();

      ctx.beginPath();
      ctx.arc(x - radius / 3, y - radius / 3, radius / 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fill();
      ctx.closePath();

      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    },
    [bubbleSize]
  );

  useEffect(() => {
    if (!shot) return;

    let animationFrameId: number;

    const moveBall = () => {
      setBall((prev) => {
let { x, y, dx, dy } = prev;
const { color } = prev;
        x += dx;
        y += dy;

        if (x < bubbleSize / 2) {
          x = bubbleSize / 2;
          dx = -dx;
        }
        if (x > cw - bubbleSize / 2) {
          x = cw - bubbleSize / 2;
          dx = -dx;
        }
        if (y < bubbleSize / 2) {
          y = bubbleSize / 2;
          dy = -dy;
        }

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
            Math.round((x - bubbleSize / 2) / bubbleSize) * bubbleSize +
            bubbleSize / 2;
          const snapY =
            Math.round((y - bubbleSize / 2) / bubbleSize) * bubbleSize +
            bubbleSize / 2;

          const newBubble: Bubble = { x: snapX, y: snapY, color };
          const tempGrid = [...grid, newBubble];
          const idxNew = tempGrid.length - 1;
          const matched = findMatchingNeighbors(tempGrid, idxNew, color);

          let newGrid = [...grid, newBubble];

          if (matched.size >= 3) {
            newGrid = newGrid.filter((_, i) => !matched.has(i));
            setPoppedCount((pc) => {
              const newCount = pc + matched.size;
              if (newCount >= 19) setWin(true);
              return newCount;
            });
          }

          setGrid(newGrid);

          if (newGrid.some((b) => b.y + bubbleSize / 2 >= paddleY)) {
            setGameOver(true);
          }

          setShot(false);
          setHasShotOnce(true);
          return spawnBall();
        }

        if (y > ch + bubbleSize) {
          setShot(false);
          setHasShotOnce(true);
          return spawnBall();
        }

        return { x, y, dx, dy, color };
      });

      animationFrameId = requestAnimationFrame(moveBall);
    };

    animationFrameId = requestAnimationFrame(moveBall);

    return () => cancelAnimationFrame(animationFrameId);
  }, [
    shot,
    grid,
    bubbleSize,
    cw,
    ch,
    paddleY,
    findMatchingNeighbors,
    spawnBall,
    setGrid,
    setShot,
    setPoppedCount,
    setGameOver,
    setWin,
  ]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      ctx.clearRect(0, 0, cw, ch);
      ctx.fillStyle = '#121212';
      ctx.fillRect(0, 0, cw, ch);

      grid.forEach((b) => {
        drawBubble(ctx, b.x, b.y, b.color);
      });

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
    <div className="relative select-none touch-none bg-[#121212] min-h-screen flex flex-col items-center text-white">
      <header className="w-full p-4 text-center text-2xl font-bold border-b border-gray-700 bg-[#181818]">
        Ball Shooter 	&#40;Beta&#41;
      </header>

      {loading && (
        <div
          className="absolute inset-0 flex flex-col justify-center items-center bg-black bg-opacity-90 z-50"
          style={{
            backgroundImage: 'url(/images/71wqwj7DFWL.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="bg-black bg-opacity-60 p-4 rounded-md">
            <h2 className="text-white text-3xl mb-2 font-semibold">Loading...</h2>
            <p className="text-gray-300">Preparing the game...</p>
          </div>
        </div>
      )}

      <Canvas
        ref={canvasRef}
        draw={draw}
        width={cw}
        height={ch}
        className="border border-gray-700 rounded-lg m-4"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{ touchAction: 'none' }}
      />

      {!gameOver && !hasShotOnce && !win && !loading && (
        <div
          style={{ color: 'white', marginBottom: '200px' }}
          className="mb-6 text-center text-gray-400 pointer-events-none select-none"
        >
          <p>Drag or swipe upward to aim and shoot</p>
          <p className="text-sm">(Tap/click and drag then release)</p>
        </div>
      )}

      {gameOver && (
        <div className="absolute inset-0 flex flex-col justify-center items-center bg-black bg-opacity-80 text-white z-40">
          <h2 className="text-4xl font-bold mb-4">Game Over</h2>
          <button
            onClick={reset}
            className="px-6 py-3 bg-blue-700 rounded hover:bg-blue-800"
          >
            Restart
          </button>
        </div>
      )}

      {win && (
        <div className="absolute inset-0 flex flex-col justify-center items-center bg-gray-900 bg-opacity-90 text-white z-40">
          <h2 className="text-4xl font-bold mb-4">You Win!</h2>
          <button
            onClick={reset}
            className="px-6 py-3 bg-green-600 rounded hover:bg-green-700"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
