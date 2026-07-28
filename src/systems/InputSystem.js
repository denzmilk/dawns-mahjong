import { INPUT } from '../core/Constants.js';

// A single tap is the entire control scheme (ADR-0002 constraint 1). This turns
// pointer events into taps and nothing else: a drag is not a tap, a long press is
// not a tap, and a second finger is ignored outright.
//
// ONE exception, added by ADR-0004: the magnifying glass can be dragged. It is opt-in, it
// is a physical object she picks up rather than a gesture she has to know about, and it is
// scoped to the glass itself — a pointer that goes down anywhere else on the board still
// gets the old rules exactly. `grab` is what decides which of the two a press is, and it
// is asked once, on pointerdown, so a press can never change its mind halfway through.

export class InputSystem {
  constructor(domElement, onTap, draggable = null) {
    this.domElement = domElement;
    this.onTap = onTap;
    this.draggable = draggable;
    this.down = null;

    this.handleDown = this.handleDown.bind(this);
    this.handleMove = this.handleMove.bind(this);
    this.handleUp = this.handleUp.bind(this);
    this.handleCancel = this.handleCancel.bind(this);

    this.handleLeave = this.handleLeave.bind(this);

    domElement.addEventListener('pointerdown', this.handleDown);
    domElement.addEventListener('pointermove', this.handleMove);
    domElement.addEventListener('pointerup', this.handleUp);
    domElement.addEventListener('pointercancel', this.handleCancel);
    domElement.addEventListener('pointerleave', this.handleLeave);
  }

  handleDown(event) {
    // A second finger cancels the gesture rather than starting another one, so a
    // two-finger touch can never register as two taps.
    if (this.down && this.down.pointerId !== event.pointerId) {
      this.down = null;
      return;
    }
    const dragging = Boolean(this.draggable?.grab(event.clientX, event.clientY));
    this.down = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      at: event.timeStamp,
      dragging,
    };
    // Capture so the glass keeps following her finger even when it strays outside the
    // canvas — otherwise pointerleave drops it mid-drag and it snaps back.
    if (dragging) this.domElement.setPointerCapture?.(event.pointerId);
  }

  handleMove(event) {
    const start = this.down;
    if (!start || !start.dragging || start.pointerId !== event.pointerId) return;
    this.draggable.drag(event.clientX, event.clientY);
  }

  handleUp(event) {
    const start = this.down;
    this.down = null;
    if (!start || start.pointerId !== event.pointerId) return;
    if (start.dragging) this.domElement.releasePointerCapture?.(event.pointerId);

    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    const held = event.timeStamp - start.at;
    if (moved > INPUT.tapMaxMovePx) return;
    if (held > INPUT.tapMaxHoldMs) return;

    // A press on the glass that never moved was a tap, not a drag — and she meant to tap
    // the tile she can see through it. Anything with travel in it moved the glass and is
    // finished with.
    this.onTap(event.clientX, event.clientY);
  }

  /** A genuine cancel — the system took the pointer away. Drop it, drag or not. */
  handleCancel() {
    this.down = null;
  }

  /**
   * The pointer left the canvas. That ends a tap, but it must NOT end a drag: an unsteady
   * hand carrying the glass to the edge of the screen would drop it there and be unable to
   * pick it back up mid-gesture.
   */
  handleLeave() {
    if (this.down?.dragging) return;
    this.down = null;
  }

  dispose() {
    this.domElement.removeEventListener('pointerdown', this.handleDown);
    this.domElement.removeEventListener('pointermove', this.handleMove);
    this.domElement.removeEventListener('pointerup', this.handleUp);
    this.domElement.removeEventListener('pointercancel', this.handleCancel);
    this.domElement.removeEventListener('pointerleave', this.handleLeave);
  }
}
