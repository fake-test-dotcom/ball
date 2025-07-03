'use client';
import React, { useEffect, useRef } from 'react';

type CanvasProps = React.CanvasHTMLAttributes<HTMLCanvasElement> & {
  draw: (ctx: CanvasRenderingContext2D) => void;
};

const Canvas = React.forwardRef<HTMLCanvasElement, CanvasProps>(
  ({ draw, width, height, ...rest }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      const canvas = (ref as React.RefObject<HTMLCanvasElement>)?.current || canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let animationFrameId: number;

      const render = () => {
        if (ctx) {
          draw(ctx); // ✅ Only use draw if ctx is not null
          animationFrameId = requestAnimationFrame(render);
        }
      };

      render();

      return () => cancelAnimationFrame(animationFrameId);
    }, [draw, ref]);

    return (
      <canvas
        ref={ref || canvasRef}
        width={width}
        height={height}
        {...rest}
      />
    );
  }
);

Canvas.displayName = 'Canvas';

export default Canvas;
