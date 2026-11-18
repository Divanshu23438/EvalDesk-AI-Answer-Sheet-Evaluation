/**
 * FlipQueue: Sequential, non-overlapping page turn orchestrator.
 * Adheres strictly to Section 5 of PAGE_VIEWER_PLAN.md:
 * - 450 ms ease-in-out flip about spine.
 * - Queueing: if multiple pages complete at once or user rapidly clicks,
 *   flips play one after another (450 ms each), never overlapping.
 * - prefers-reduced-motion: 150 ms duration with crossfade.
 */

export type FlipDirection = 'forward' | 'backward';

export interface FlipStep {
  fromIndex: number;
  toIndex: number;
  direction: FlipDirection;
  duration: number;
  isReducedMotion: boolean;
}

export interface FlipQueueOptions {
  initialIndex?: number;
  pageCount?: number;
  flipDuration?: number; // default 450ms
  reducedMotionDuration?: number; // default 150ms
  isReducedMotion?: boolean;
  onFlipStart?: (step: FlipStep) => void;
  onFlipEnd?: (step: FlipStep) => void;
  onQueueIdle?: (currentIndex: number) => void;
  onPageChange?: (index: number) => void;
}

export class FlipQueue {
  private currentIndex: number;
  private pageCount: number;
  private flipDuration: number;
  private reducedMotionDuration: number;
  private isReducedMotion: boolean;
  private queue: Array<{ fromIndex: number; toIndex: number; direction: FlipDirection }> = [];
  private isProcessing = false;
  private activeStep: FlipStep | null = null;
  private timerId: any = null;

  private onFlipStart?: (step: FlipStep) => void;
  private onFlipEnd?: (step: FlipStep) => void;
  private onQueueIdle?: (currentIndex: number) => void;
  private onPageChange?: (index: number) => void;

  constructor(options: FlipQueueOptions = {}) {
    this.currentIndex = options.initialIndex ?? 0;
    this.pageCount = options.pageCount ?? 1;
    this.flipDuration = options.flipDuration ?? 450;
    this.reducedMotionDuration = options.reducedMotionDuration ?? 150;
    this.isReducedMotion = options.isReducedMotion ?? false;

    this.onFlipStart = options.onFlipStart;
    this.onFlipEnd = options.onFlipEnd;
    this.onQueueIdle = options.onQueueIdle;
    this.onPageChange = options.onPageChange;
  }

  public setPageCount(count: number): void {
    this.pageCount = Math.max(1, count);
    if (this.currentIndex >= this.pageCount) {
      this.currentIndex = this.pageCount - 1;
    }
  }

  public setReducedMotion(reduced: boolean): void {
    this.isReducedMotion = reduced;
  }

  public getDuration(): number {
    return this.isReducedMotion ? this.reducedMotionDuration : this.flipDuration;
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public isFlipping(): boolean {
    return this.isProcessing || this.activeStep !== null;
  }

  public getActiveStep(): FlipStep | null {
    return this.activeStep;
  }

  public getPendingQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Enqueues navigation to targetIndex.
   * If target is further than 1 page away (e.g., jump 0 -> 3),
   * decomposes the jump into atomic single-page flips in order.
   */
  public enqueue(targetIndex: number): void {
    const clampedTarget = Math.max(0, Math.min(targetIndex, this.pageCount - 1));

    // Determine starting index from tail of queue or current index
    let lastTarget = this.currentIndex;
    if (this.queue.length > 0) {
      lastTarget = this.queue[this.queue.length - 1].toIndex;
    } else if (this.activeStep !== null) {
      lastTarget = this.activeStep.toIndex;
    }

    if (clampedTarget === lastTarget) {
      return; // already at or queued to this target
    }

    if (clampedTarget > lastTarget) {
      // Forward steps: lastTarget -> lastTarget + 1 -> ... -> clampedTarget
      for (let i = lastTarget; i < clampedTarget; i++) {
        this.queue.push({
          fromIndex: i,
          toIndex: i + 1,
          direction: 'forward',
        });
      }
    } else {
      // Backward steps: lastTarget -> lastTarget - 1 -> ... -> clampedTarget
      for (let i = lastTarget; i > clampedTarget; i--) {
        this.queue.push({
          fromIndex: i,
          toIndex: i - 1,
          direction: 'backward',
        });
      }
    }

    this.processNext();
  }

  /**
   * Instant jump to index without animation, clearing any pending queue.
   */
  public jumpTo(targetIndex: number): void {
    this.cancel();
    const clamped = Math.max(0, Math.min(targetIndex, this.pageCount - 1));
    this.currentIndex = clamped;
    this.onPageChange?.(this.currentIndex);
    this.onQueueIdle?.(this.currentIndex);
  }

  public cancel(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.queue = [];
    this.activeStep = null;
    this.isProcessing = false;
  }

  private processNext(): void {
    if (this.isProcessing || this.queue.length === 0) {
      if (!this.isProcessing && this.queue.length === 0 && this.activeStep === null) {
        this.onQueueIdle?.(this.currentIndex);
      }
      return;
    }

    this.isProcessing = true;
    const nextHop = this.queue.shift()!;
    const duration = this.getDuration();

    const step: FlipStep = {
      fromIndex: nextHop.fromIndex,
      toIndex: nextHop.toIndex,
      direction: nextHop.direction,
      duration,
      isReducedMotion: this.isReducedMotion,
    };

    this.activeStep = step;
    this.onFlipStart?.(step);

    this.timerId = setTimeout(() => {
      this.timerId = null;
      this.currentIndex = step.toIndex;
      this.onPageChange?.(this.currentIndex);
      this.onFlipEnd?.(step);
      this.activeStep = null;
      this.isProcessing = false;

      // Continue processing remaining items in queue
      this.processNext();
    }, duration);
  }
}
