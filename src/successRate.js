import * as d3 from 'd3';
import config from './config.json';
import { data, groupData } from './data';
import dimensions from './dimensions';

const { colors, labels } = config;

const groups = {};
const activeGroups = new Set();

const groupSelectors = d3.select('.selectors');
const tooltip = d3.select('.vis-tooltip');
let tooltipTimeout;

export default function (selector) {
  const {
    margin,
    width,
    height,
    innerX,
    innerY,
    innerXWidth,
    innerYHeight,
    translate
  } = dimensions(selector);

  const x = d3
    .scaleLinear()
    .range([0, innerXWidth])
    .domain(d3.extent(data, d => d.year));
  const y = d3.scaleLinear().domain([0, 100]).range([innerYHeight, 0]);

  const yAxis = d3
    .axisLeft(y)
    .tickSize(-width, 0, 0)
    .ticks(5)
    .tickFormat(d => `${d} %`);

  const xAxis = d3
    .axisBottom(x)
    .tickSize(-height + innerY.bottom, 0, 0)
    .tickPadding(6)
    .tickFormat(d => d.toString());

  const svg = d3
    .select(selector)
    .append('svg:svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);

  svg
    .append('g')
    .attr('class', 'y axis')
    .attr('transform', `translate(${innerY.left}, ${innerY.top})`)
    .call(yAxis);

  svg
    .append('g')
    .attr('class', 'x axis')
    .attr(
      'transform',
      `translate(${innerX.left}, ${innerYHeight + margin.top + margin.bottom})`
    )
    .call(xAxis);

  for (const [key, group] of Object.entries(groupData)) {
    groups[key] = makeGroup(key, group);

    if (config.defaultInstitutions.includes(key)) {
      toggleGroup(key);
    }

    // add circles independent from group
    const circleRadius = d3
      .scaleSqrt()
      .rangeRound([1, config.maxDotSize])
      .domain(d3.extent(data, d => d.count));

    const circleData = [...data].sort((a, b) => b.count - a.count);

    svg
      .selectAll('.dot')
      .data(circleData)
      .enter()
      .append('circle')
      .attr('class', 'dot circle')
      .attr('r', d => circleRadius(d.count))
      .attr('transform', translate)
      .attr('cx', d => x(d.year))
      .attr('cy', d => y(d.transparency))
      .attr('data-group', d => d.name)
      .style('opacity', d => (activeGroups.has(d.name) ? '1' : '0'))
      .on('click', (_e, d) => toggleGroup(d.name))
      .on('mouseover', (_e, d) => activateGroup(d.name))
      .on('mouseout', (_e, d) => deactivateGroup(d.name))
      .on('mouseover', (e, d) => {
        if (!activeGroups.has(d.name)) return;
        clearTimeout(tooltipTimeout);

        const node = tooltip.node();
        const circle = e.target.getBoundingClientRect();

        const left = circle.left + circle.width / 2 - node.offsetWidth / 2;
        const top = circle.top - node.offsetHeight / 2 - circle.height / 2;

        tooltip
          .style('opacity', 1)
          .style('left', `${left}px`)
          .style('top', `${top}px`)
          .select('.tooltip-inner')
          .text(
            `${d.year} beantwortete das ${labels[d.name]} ${
              d.transparency
            } % von ${d.count} Anfragen`
          );
      })
      .on('mouseout', () => {
        tooltipTimeout = setTimeout(() => tooltip.style('opacity', 0), 200);
      });

    // reload bootstrap tooltips
    BSN.initCallback(document.querySelector('.vis-success-rate'));
  }

  function makeGroup(key, groupData) {
    const group = svg
      .append('g')
      .attr('transform', translate)
      .attr('class', 'group')
      .attr('data-group', key);

    const connectionLine = d3
      .line(
        d => x(d.year),
        d => y(d.transparency)
      )
      .curve(d3.curveCatmullRom);

    group
      .append('svg:path')
      .attr('class', 'line')
      .style('stroke', colors[key])
      .style('display', 'none')
      .attr('d', connectionLine(groupData));

    group
      .data(groupData)
      .on('click', () => toggleGroup(key))
      .on('mouseover', () => activateGroup(key))
      .on('mouseout', () => deactivateGroup(key));

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

    return { group, selector };
  }

  function activateGroup(key) {
    const obj = groups[key];

    if (activeGroups.has(key)) {
      obj.selector.classed('badge-dark', true);
    }

    obj.group.raise();
    obj.group.select('.line').style('display', 'block');

    svg.selectAll(`.dot[data-group=${key}]`).style('opacity', '1');

    activeInForeground();
  }

  function deactivateGroup(key, hide = true) {
    const obj = groups[key];

    if (activeGroups.has(key)) return;

    obj.selector.classed('badge-dark', false);
    svg.selectAll(`.dot[data-group=${key}]`).style('opacity', '0');

    if (hide) obj.group.select('.line').style('display', 'none');
    obj.group.selectAll('.circle-number').style('display', 'none');
  }

  function toggleGroup(key) {
    const transition = groups[key].group
      .select('.line')
      .attr('stroke-dashoffset', 0)
      .transition()
      .duration(300)
      .ease(d3.easeCubicInOut);

    if (activeGroups.has(key)) {
      activeGroups.delete(key);
      deactivateGroup(key, false);

      transition.attrTween('stroke-dashoffset', function () {
        const length = this.getTotalLength();
        return d3.interpolate(0, length);
      });
    } else {
      activeGroups.add(key);
      activateGroup(key);

      transition.attrTween('stroke-dasharray', function () {
        const length = this.getTotalLength();
        return d3.interpolate(`0,${length}`, `${length},${length}`);
      });
    }
  }

  function activeInForeground() {
    for (const key in groups) {
      if (activeGroups.has(key)) {
        groups[key].group.raise();
      }
    }

    svg.selectAll('.label').raise();
  }
}
