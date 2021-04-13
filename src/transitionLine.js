import { easeCubicInOut, interpolate } from 'd3';

const makeTransition = el =>
  el
    .attr('stroke-dashoffset', 0)
    .transition()
    .duration(400)
    .ease(easeCubicInOut);

export const transitionIn = el =>
  makeTransition(el).attrTween('stroke-dasharray', function () {
    const length = this.getTotalLength();
    return interpolate(`0,${length}`, `${length},${length}`);
  });

export const transitionOut = el =>
  makeTransition(el).attrTween('stroke-dashoffset', function () {
    const length = this.getTotalLength();
    return interpolate(0, length);
  });
