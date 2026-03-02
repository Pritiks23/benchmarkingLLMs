export interface BenchmarkRecord {
  model: string;
  family: string;
  paramsB: number;
  source: string;
  hardwareVendor: string;
  hardwareSku: string;
  acceleratorCount: number;
  runtime: string;
  runtimeVersion: string;
  buildTag: string;
  precision: 'fp16' | 'bf16' | 'int8' | 'fp8';
  batchSize: number;
  contextLength: number;
  tokensPerSecond: number;
  latencyMs: number;
  vramGb: number;
  powerW: number;
  date: string;
}
