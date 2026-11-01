import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

function scrollParentOf(el: HTMLElement | null): HTMLElement | null {
  let p = el?.parentElement ?? null;
  while (p) {
    const oy = getComputedStyle(p).overflowY;
    if (oy === "auto" || oy === "scroll") return p;
    p = p.parentElement;
  }
  return null;
}

interface VirtualGridProps<T> {
  items: T[];
  getKey: (item: T) => string;
  render: (item: T, index: number) => ReactNode;
  columns?: number;
  minColumnWidth?: number;
  gapX?: number;
  gapY?: number;
  estimateExtra?: number;
  aspect?: number;
  fixedRowHeight?: number;
  overscanRows?: number;
  className?: string;
  dataTour?: string;
}

export default function VirtualGrid<T>({
  items,
  getKey,
  render,
  columns = 0,
  minColumnWidth = 168,
  gapX = 20,
  gapY = 24,
  estimateExtra = 50,
  aspect = 4 / 3,
  fixedRowHeight,
  overscanRows = 3,
  className,
  dataTour,
}: VirtualGridProps<T>) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [measuredRow, setMeasuredRow] = useState<number | null>(null);
  const [range, setRange] = useState({ start: 0, end: 8 });

  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cols = Math.max(1, columns > 0 ? columns : Math.floor((width + gapX) / (minColumnWidth + gapX)) || 1);
  const colWidth = width > 0 ? (width - gapX * (cols - 1)) / cols : minColumnWidth;
  const estimate = fixedRowHeight ?? colWidth * aspect + estimateExtra;
  const rowStride = (measuredRow ?? estimate) + gapY;
  const rowCount = Math.ceil(items.length / cols);
  const totalHeight = Math.max(0, rowCount * rowStride - gapY);

  useEffect(() => {
    setMeasuredRow(null);
  }, [cols, Math.round(colWidth), fixedRowHeight]);

  useLayoutEffect(() => {
    const first = innerRef.current?.firstElementChild as HTMLElement | null;
    if (!first) return;
    const h = first.getBoundingClientRect().height;
    if (h > 0 && (measuredRow === null || Math.abs(h - measuredRow) > 1)) setMeasuredRow(h);
  });

  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;
    const sp = scrollParentOf(outer);
    let frame = 0;
    const compute = () => {
      frame = 0;
      const viewTop = sp ? sp.getBoundingClientRect().top : 0;
      const viewH = sp ? sp.clientHeight : window.innerHeight;
      const top = outer.getBoundingClientRect().top - viewTop;
      const startRow = Math.max(0, Math.floor(-top / rowStride) - overscanRows);
      const endRow = Math.min(rowCount, Math.ceil((viewH - top) / rowStride) + overscanRows);
      setRange((r) => (r.start === startRow && r.end === endRow ? r : { start: startRow, end: Math.max(startRow, endRow) }));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(compute); };
    compute();
    const target: HTMLElement | Window = sp ?? window;
    target.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      target.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [rowStride, rowCount, overscanRows, items.length]);

  const startIdx = range.start * cols;
  const endIdx = Math.min(items.length, range.end * cols);
  const slice = items.slice(startIdx, endIdx);

  return (
    <div ref={outerRef} className={className} data-tour={dataTour} style={{ position: "relative", height: totalHeight }}>
      <div
        ref={innerRef}
        style={{
          position: "absolute",
          top: range.start * rowStride,
          left: 0,
          right: 0,
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          columnGap: gapX,
          rowGap: gapY,
        }}
      >
        {slice.map((item, i) => (
          <div key={getKey(item)} style={fixedRowHeight ? { height: fixedRowHeight } : undefined}>
            {render(item, startIdx + i)}
          </div>
        ))}
      </div>
    </div>
  );
}
