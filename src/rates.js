import * as d3 from 'd3';
import {
  colors,
  labels,
  defaultInstitutions,
  maxDotSize,
  rateViews
} from './config.json';
import { data, groupData } from './data';
import dimensions from './dimensions';
import {
  transitionIn,
  transitionOut,
  makeTransition,
  cleanTransition
} from './transitionLine';

export default function (selector) {
  const root = d3.select(selector);
  const parent = root.select('.vis-canvas');

  const groups = {};
  const activeGroups = new Set();

  let category = rateViews[0];
  const getPercentage = d =>
    Math.round((d[category.divident] / d[category.divisor]) * 100);
  const getAbsolute = d => d[category.divisor];

  const categorySelector = root.select('select').on('input', () => {
    const categoryIndex = parseInt(categorySelector.node().value, 10);
    category = rateViews[categoryIndex];
    updateGroups();
  });

  categorySelector
    .selectAll('option')
    .data(rateViews)
    .join('option')
    .text(d => d.name)
    .attr('value', (_d, i) => i);

  const groupSelectors = root.select('.selectors');

  const {
    margin,
    width,
    height,
    innerX,
    innerY,
    innerXWidth,
    innerYHeight,
    translate
  } = dimensions(root.node());

  const x = d3
    .scaleLinear()
    .range([0, innerXWidth])
    .domain(d3.extent(data, d => d.year));
  const y = d3.scaleLinear().domain([0, 100]).range([innerYHeight, 0]);

  const yAxis = (g, y) =>
    g
      .attr('class', 'y axis')
      .attr('transform', `translate(${innerY.left}, ${innerY.top})`)
      .call(
        d3
          .axisLeft(y)
          .tickSize(-width, 0, 0)
          .ticks(5)
          .tickFormat(d => `${d} %`)
      );

  const xAxis = d3
    .axisBottom(x)
    .tickSize(-height + innerY.bottom, 0, 0)
    .tickPadding(6)
    .tickFormat(d => d.toString());

  const circleRadius = d3
    .scaleSqrt()
    .rangeRound([1, maxDotSize])
    .domain(d3.extent(data, d => d.count));

  const body = parent.append('div').attr('class', 'y-container');

  const pinnedSvg = parent
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('class', 'pinned')
    .append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);

  pinnedSvg
    .append('g')
    .append('rect')
    .attr('fill', '#fff')
    .attr('x', margin.left)
    .attr('y', margin.top)
    .attr('width', innerXWidth)
    .attr('height', innerYHeight);
  pinnedSvg.append('g').call(yAxis, y);

  const rootSvg = body
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  rootSvg
    .append('defs')
    .append('clipPath')
    .attr('id', 'clip')
    .append('rect')
    .attr('x', margin.left)
    .attr('y', 0)
    .style('fill-opacity', 0.5)
    .attr('width', width + margin.left)
    .attr('height', innerYHeight + innerY.top);

  const svg = rootSvg
    .append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);

  svg
    .append('g')
    .attr('class', 'x axis')
    .attr(
      'transform',
      `translate(${innerX.left}, ${innerYHeight + margin.top + margin.bottom})`
    )
    .call(xAxis);

  const clipped = svg.append('g').attr('clip-path', 'url(#clip)');

  for (const [key, group] of Object.entries(groupData)) {
    groups[key] = makeGroup(key, group);

    if (defaultInstitutions.includes(key)) {
      toggleGroup(key);
    }

    // reload bootstrap tooltips
    window.addEventListener('load', () => BSN.initCallback(root.node()));
  }

  function makeGroup(key, groupData) {
    const group = clipped
      .append('g')
      .attr('transform', translate)
      .attr('class', 'group');

    const line = group
      .append('path')
      .attr('class', 'line')
      .style('stroke', colors[key])
      .classed('hidden', true);

    const selector = groupSelectors
      .append('span')
      .attr(
        'class',
        'badge badge-pill badge-light mb-1 mr-1 font-weight-normal'
      )
      .attr('type', 'button')
      .attr('aria-role', 'button')
      .text(key)
      .attr('title', labels[key])
      .attr('data-toggle', 'tooltip')
      .on('click', () => toggleGroup(key));

    return { group, selector, groupData, line };
  }

  function activateGroup(key) {
    const obj = groups[key];

    obj.selector.classed('badge-dark', true);

    if (!obj.circles) {
      obj.circles = obj.group.append('g').attr('class', 'circles hidden');

      obj.circles
        .selectAll('circle.dot')
        .data(obj.groupData)
        .join('circle')
        .attr('class', 'dot circle');

      updateCircles(obj, false);

      BSN.initCallback(root.node());
    }

    updateLine(obj, false);
    transitionIn(obj.line);
    window.requestAnimationFrame(() => obj.circles.classed('hidden', false));
  }

  function deactivateGroup(key) {
    const obj = groups[key];

    obj.selector.classed('badge-dark', false);
    obj.circles.classed('hidden', true);
    transitionOut(obj.line).on('end');
  }

  function toggleGroup(key) {
    if (activeGroups.has(key)) {
      activeGroups.delete(key);
      deactivateGroup(key, false);
    } else {
      activeGroups.add(key);
      activateGroup(key);

      if (activeGroups.size >= 3) {
        const first = activeGroups.values().next().value;
        activeGroups.delete(first);
        deactivateGroup(first, false);
      }
    }
  }

  function updateCircles(obj, transition = true) {
    let circles = obj.circles.selectAll('circle').data(obj.groupData);

    if (transition) circles = makeTransition(circles);

    circles
      .attr('cx', d => x(d.year))
      .attr('r', d => circleRadius(d.count))
      .attr('cy', d => y(getPercentage(d)))
      .attr(
        'title',
        d =>
          `${labels[d.name]}: ${getPercentage(d)} % von ${getAbsolute(
            d
          )} Anfragen`
      )
      .attr('data-toggle', 'tooltip');
  }

  function updateLine(obj, transition = true) {
    const connectionLine = d3
      .line(
        d => x(d.year),
        d => y(getPercentage(d))
      )
      .curve(d3.curveCatmullRom);

    cleanTransition(obj.line);

    const line = transition ? makeTransition(obj.line) : obj.line;
    line.attr('d', connectionLine(obj.groupData));
  }

  function updateGroups() {
    for (const key of activeGroups) {
      const group = groups[key];
      updateCircles(group);
      updateLine(group);
    }
  }
}
