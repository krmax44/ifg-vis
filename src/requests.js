import * as d3 from 'd3';
import { data } from './data';
import dimensions from './dimensions';
import { colors, labels } from './config.json';

const groupsByYear = data.reduce((obj, d) => {
  if (!obj[d.year]) obj[d.year] = {};
  obj[d.year][d.name] = d.filed_requests || 0;
  obj[d.year].year = d.year;
  return obj;
}, {});

const groups = new Set(Object.keys(labels));
groups.delete('⌀');
const groupData = Object.values(groupsByYear);
const dataset = d3
  .stack()
  .keys([...groups])(groupData)
  .map(d => (d.forEach(v => (v.key = d.key)), d));

const requestsPerYear = groupData.map(g =>
  Object.values({ ...g, year: 0 }).reduce((s, v) => s + v, 0)
);
const maxRequests = Math.max(...requestsPerYear);

export default function (selector) {
  const {
    margin,
    width,
    height,
    innerX,
    innerY,
    innerXWidth,
    innerYHeight
  } = dimensions(selector);

  const x = d3
    .scaleLinear()
    .range([0, innerXWidth])
    .domain(d3.extent(data, d => d.year));

  const y = d3.scaleLinear().domain([0, maxRequests]).range([innerYHeight, 0]);

  const yAxis = (g, y) =>
    g
      .attr('class', 'y axis')
      .attr('transform', `translate(${innerY.left}, ${innerY.top})`)
      .call(
        d3
          .axisLeft(y)
          .tickSize(-width, 0, 0)
          .ticks(5)
          .tickFormat(d => Intl.NumberFormat('de-DE').format(d))
      );

  const xAxis = d3
    .axisBottom(x)
    .tickSize(-height + innerY.bottom, 0, 0)
    .tickPadding(6)
    .tickFormat(d => d.toString());

  const extent = [
    [innerX.left, 0],
    [width - margin.left - margin.right, innerYHeight + margin.top]
  ];

  const zoom = d3
    .zoom()
    .scaleExtent([1, 32])
    .extent(extent)
    .translateExtent(extent)
    .on('zoom', zoomed);

  const parent = d3.select(selector);

  const body = parent
    .append('div')
    .style('overflow-x', 'scroll')
    .style('-webkit-overflow-scrolling', 'touch')
    .style('position', 'relative');

  const rootSvg = body
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  rootSvg
    .append('defs')
    .append('clipPath')
    .attr('id', 'clip')
    .append('rect')
    .attr('x', innerX.left)
    .attr('y', 0)
    .style('fill-opacity', 0.5)
    .attr('width', width)
    .attr('height', innerYHeight + innerY.top);

  const svg = rootSvg
    .append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);

  const pinnedSvg = parent
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('class', 'pinned')
    .style('position', 'absolute')
    .style('left', 0)
    .style('top', 0)
    .style('pointer-events', 'none')
    .style('z-index', '-1')
    .append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);

  const gy = pinnedSvg.append('g').call(yAxis, y);

  const bars = (svg, y) =>
    svg
      .append('g')
      .selectAll('g')
      .data(dataset)
      .join('g')
      .style('fill', d => console.log(d) || colors[d.key])
      .attr('class', 'bar')
      .attr('clip-path', 'url(#clip)')

      .selectAll('rect')
      .data(d => console.log(d.key) || d)
      .join('rect')
      .attr('x', d => x(d.data.year) + innerX.left - 10)
      .attr('y', d => y(d[1]) + innerY.top)
      .attr('height', d => y(d[0]) - y(d[1]))
      .attr('width', 20)
      .attr('title', d => `${labels[d.key]}: ${d.data[d.key]} Anfragen`)
      .attr('data-toggle', 'tooltip')
      .attr('class', 'fraction');

  const gx = svg
    .append('g')
    .attr('class', 'x axis')
    .attr(
      'transform',
      `translate(${innerX.left}, ${innerYHeight + margin.top + margin.bottom})`
    )
    .call(xAxis);

  svg.call(zoom);
  svg.call(bars, y);
  body.node().scrollBy(0, 0);

  function zoomed(event) {
    const yz = event.transform.rescaleY(y);

    gy.call(yAxis, yz);

    svg
      .selectAll('.bar .fraction')
      .attr('y', d => yz(d[1]) + innerY.top)
      .attr('height', d => yz(d[0]) - yz(d[1]));
  }

  BSN.initCallback(parent.node());
}
