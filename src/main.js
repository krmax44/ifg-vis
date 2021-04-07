import './style.css';
import csv from './data/data.csv';
import * as d3 from 'd3';
import config from './config.json';

let groups = {};
const { colors, labels } = config;

const activeGroups = new Set();

const margin = { top: 20, right: 20, bottom: 20, left: 20 };
const innerX = { top: 0, right: 50, bottom: 30, left: 80 };
const innerY = { top: 30, right: 80, bottom: 80, left: 30 };

const containerWidth = document.getElementById('vis').offsetWidth;
const width = Math.max(containerWidth, 1200) - margin.left - margin.right;
const height = 468 - margin.top - margin.bottom;

const innerXWidth = width - innerX.right - innerX.left;
const x = d3.scaleLinear().range([0, innerXWidth]);

const innerYHeight = height - innerY.top - innerY.bottom;
const y = d3.scaleLinear().domain([0, 100]).range([innerYHeight, 0]);

const yAxis = d3
  .axisLeft(y)
  .tickSize(-width, 0, 0)
  .ticks(5)
  .tickFormat(d => d + '%');

const xAxis = d3
  .axisTop(x)
  .tickSize(-height + innerY.bottom, 0, 0)
  .tickPadding(6)
  .tickFormat(d => d.toString());

const circleRadius = d3.scaleSqrt().rangeRound([1, config.maxDotSize]);

const svg = d3
  .select('#vis')
  .append('svg:svg')
  .attr('width', width + margin.left + margin.right)
  .attr('height', height + margin.top + margin.bottom)
  .append('g')
  .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

svg
  .append('g')
  .attr('class', 'y axis')
  .attr('transform', 'translate(' + innerY.left + ',' + innerY.top + ')')
  .call(yAxis);

svg.select('.y.axis .major line');

const activateGroup = key => {
  const obj = groups[key];

  groups[key].isActive = true;

  obj.group.raise();
  svg.selectAll(`.group[data-group=${key}]`).classed('active', true);
  obj.group.select('.line').style('display', 'block');

  activeInForeground();
};

const deactivateGroup = key => {
  const obj = groups[key];

  if (activeGroups.has(key)) return;
  groups[key].isActive = false;

  obj.group.select('.line').style('display', 'none');
  svg
    .selectAll(`.group[data-group=${key}]`)
    .style('fill', '')
    .classed('active', false);
  obj.group.selectAll('.circle-number').style('display', 'none');
  refreshAllActiveGroups();
};

const toggleGroup = key => {
  if (activeGroups.has(key)) {
    activeGroups.delete(key);
    deactivateGroup(key);
  } else {
    activeGroups.add(key);
    activateGroup(key);
  }
};

const activeInForeground = function () {
  for (const key in groups) {
    if (groups[key].isActive) {
      groups[key].group.raise();
    }
  }

  svg.selectAll('.label').raise();
};

const refreshAllActiveGroups = function () {
  for (const key in groups) {
    if (groups[key].isActive) {
      activateGroup(key);
    }
  }
  activeInForeground();
};

const makeGroup = function (key, groupData) {
  const group = svg
    .append('g')
    .attr('transform', `translate(${innerX.left}, ${innerY.top})`)
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

  const lastBubble = groupData[groupData.length - 1];
  const labelpos = y(lastBubble.transparency);

  return { labelpos, group, isActive: false };
};

const data = csv
  .map(d => {
    d.year = parseInt(d.year, 10);
    d.count = parseInt(d.count, 10);
    d.transparency = parseInt(d.transparency, 10);
    return d;
  })
  .filter(d => d.count > 0)
  .sort((a, b) => a.year - b.year);

x.domain(d3.extent(data, d => d.year));

svg
  .append('g')
  .attr('class', 'x axis')
  .attr('transform', 'translate(' + innerX.left + ',' + innerX.top + ')')
  .call(xAxis);

circleRadius.domain(d3.extent(data, d => d.count));

// Add Circles independent from group
const circleData = [...data].sort((a, b) => b.count - a.count);
svg
  .selectAll('.dot')
  .data(circleData)
  .enter()
  .append('circle')
  .attr('class', 'dot circle')
  .attr('r', d => circleRadius(d.count));

const helpCircleData = circleData
  .slice()
  .filter(d => circleRadius(d.count) <= config.dotSizeNeedsHelp);

svg
  .selectAll('.helpdot')
  .data(helpCircleData)
  .enter()
  .append('circle')
  .attr('r', config.helpDotSize)
  .attr('class', 'helpdot circle');

svg
  .selectAll('.circle')
  .attr('transform', 'translate(' + innerX.left + ',' + innerY.top + ')')
  .attr('cx', d => x(d.year))
  .attr('cy', d => y(d.transparency))
  .on('click', (_e, d) => toggleGroup(d.name))
  .on('mouseover', (_e, d) => activateGroup(d.name))
  .on('mouseout', (_e, d) => deactivateGroup(d.name));

for (const key in labels) {
  groups[key] = makeGroup(
    key,
    data.filter(d => d.name === key)
  );
}
