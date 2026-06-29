/// <reference lib="webworker" />
import { applyFilter, computeMetrics, type FilterType } from "./imageProcessing";

type WorkerRequest =
  | { id: number; op: "metrics"; width: number; height: number; buffer: ArrayBuffer }
  | {
      id: number;
      op: "filter";
      filter: FilterType;
      intensity: number;
      width: number;
      height: number;
      buffer: ArrayBuffer;
    };

const ctx = self as unknown as Worker;

ctx.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  const data = new Uint8ClampedArray(msg.buffer);

  if (msg.op === "metrics") {
    const metrics = computeMetrics(data, msg.width, msg.height);
    ctx.postMessage({ id: msg.id, metrics });
    return;
  }

  const out = applyFilter(msg.filter, msg.intensity, data, msg.width, msg.height);
  ctx.postMessage(
    { id: msg.id, width: msg.width, height: msg.height, buffer: out.buffer },
    [out.buffer],
  );
};
