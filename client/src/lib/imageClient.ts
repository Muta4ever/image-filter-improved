/**
 * Main-thread client for the image-processing Web Worker. Wraps the worker's
 * message protocol in promises and transfers pixel buffers (zero-copy) so the
 * UI thread never blocks on heavy convolution work.
 */
import type { FilterType, ImageMetrics } from "./imageProcessing";

interface FilterResult {
  buffer: ArrayBuffer;
  width: number;
  height: number;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, (value: any) => void>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./imageWorker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e: MessageEvent<{ id: number } & Record<string, unknown>>) => {
      const { id, ...rest } = e.data;
      const resolve = pending.get(id);
      if (resolve) {
        pending.delete(id);
        resolve(rest);
      }
    };
  }
  return worker;
}

/** Measure metrics from a copy of the pixel buffer (worker, off main thread). */
export function computeMetricsAsync(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<ImageMetrics> {
  const w = getWorker();
  const id = nextId++;
  const copy = data.slice(); // detach a copy so the source buffer survives
  return new Promise((resolve) => {
    pending.set(id, (r) => resolve(r.metrics as ImageMetrics));
    w.postMessage({ id, op: "metrics", width, height, buffer: copy.buffer }, [
      copy.buffer,
    ]);
  });
}

/** Run a filter at a given intensity; returns the processed RGBA buffer. */
export function applyFilterAsync(
  filter: FilterType,
  intensity: number,
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<FilterResult> {
  const w = getWorker();
  const id = nextId++;
  const copy = data.slice();
  return new Promise((resolve) => {
    pending.set(id, (r) => resolve(r as FilterResult));
    w.postMessage(
      { id, op: "filter", filter, intensity, width, height, buffer: copy.buffer },
      [copy.buffer],
    );
  });
}
