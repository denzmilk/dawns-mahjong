import { INPUT } from '../core/Constants.js';

// A single tap is the entire control scheme (ADR-0002 constraint 1). This turns
// pointer events into taps and nothing else: a drag is not a tap, a long press is
// not a tap, and a second finger is ignored outright.

export class InputSystem {
  constructor(domElement, onTap) {
    this.domElement = domElement;
    this.onTap = onTap;
    this.down = null;

    this.handleDown = this.handleDown.bind(this);
    this.handleUp = this.handleUp.bind(this);
    this.handleCancel = this.handleCancel.bind(this);

    domElement.addEventListener('pointerdown', this.handleDown);
    domElement.addEventListener('pointerup', this.handleUp);
    domElement.addEventListener('pointercancel', this.handleCancel);
    domElement.addEventListener('pointerleave', this.handleCancel);
  }

  handleDown(event) {
    // A second finger cancels the gesture rather than starting another one, so a
    // two-finger touch can never register as two taps.
    if (this.down && this.down.pointerId !== event.pointerId) {
      this.down = null;
      return;
    }
    this.down = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, at: event.timeStamp };
  }

  handleUp(event) {
    const start = this.down;
    this.down = null;
    if (!start || start.pointerId !== event.pointerId) return;

    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    const held = event.timeStamp - start.at;
    if (moved > INPUT.tapMaxMovePx) return;
    if (held > INPUT.tapMaxHoldMs) return;

    this.onTap(event.clientX, event.clientY);
  }

  handleCancel() {
    this.down = null;
  }

  dispose() {
    this.domElement.removeEventListener('pointerdown', this.handleDown);
    this.domElement.removeEventListener('pointerup', this.handleUp);
    this.domElement.removeEventListener('pointercancel', this.handleCancel);
    this.domElement.removeEventListener('pointerleave', this.handleCancel);
  }
}
