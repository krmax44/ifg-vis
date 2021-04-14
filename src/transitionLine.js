import { easeCubicInOut, interpolate } from 'd3';

const totalLength = el => el.node().getTotalLength();

export const cleanTransition = el =>
  el.attr('stroke-dashoffset', null).attr('stroke-dasharray', null);

const makeTransition = el => el.transition().duration(400).ease(easeCubicInOut);

export const transitionIn = el => {
  el.classed('hidden', false);

  makeTransition(cleanTransition(el)).attrTween('stroke-dasharray', () => {
    const length = totalLength(el);
    return interpolate(`0,${length}`, `${length},${length}`);
  });
};
export const transitionOut = el => {
  const length = totalLength(el);
  el.attr('stroke-dasharray', `${length},${length}`);

  return makeTransition(el)
    .attrTween('stroke-dashoffset', () => interpolate(0, totalLength(el)))
    .on('end', () => el.classed('hidden', true));
};
