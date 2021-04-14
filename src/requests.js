import * as d3 from 'd3';
import { data } from './data';
import dimensions from './dimensions';
import { colors, labels, requestViews, requestViewUnits } from './config.json';
import fdsShare from './data/fds.csv';
import { transitionIn, transitionOut } from './transitionLine';

const hasTouch =
  'ontouchstart' in window ||
  navigator.maxTouchPoints > 0 ||
  navigator.msMaxTouchPoints > 0;

const getData = key => {
  const groupsByYear = data.reduce((obj, d) => {
    if (!obj[d.year]) obj[d.year] = {};

    obj[d.year][d.name] = d[key] || 0;
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

  const perYear = groupData.map(g =>
    Object.values({ ...g, year: 0 }).reduce((s, v) => s + v, 0)
  );
  const highestValue = Math.max(...perYear);

  return { highestValue, dataset };
};

export default function (selector) {
  const requestViewKeys = Object.keys(requestViews);
  let chartView = requestViewKeys[0];
  let subChartView;
  let updateZoom = true;

  const root = d3.select(selector);
  const parent = root.select('.vis-canvas');

  const {
    margin,
    width,
    height,
    innerX,
    innerY,
    innerXWidth,
    innerYHeight,
    translate
  } = dimensions(parent.node());

  const { highestValue, dataset } = getData(chartView);
  const feeData = getData('fees_charged').dataset;

  const hasGroup = key => requestViewKeys.find(k => k.startsWith(`${key}:`));

  const selectors = root
    .select('div.selectors')
    .selectAll('span')
    .data(Object.entries(requestViews))
    .join('span')
    .attr('class', 'badge badge-light selector-badge')
    .classed('group-lead', d => hasGroup(d[0]))
    .classed('group-member', d => d[0].includes(':'))
    .attr('type', 'button')
    .attr('aria-role', 'button')
    .text(d => d[1])
    .on('click', (_e, d) => setChartView(d[0]));

  const updateSelectors = () =>
    selectors.classed(
      'badge-dark',
      d => chartView === d[0] || `${chartView}:${subChartView}` === d[0]
    );

  const body = parent.append('div').attr('class', 'y-container');

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

  const pinnedSvg = parent
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('class', 'pinned')
    .append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);

  const x = d3
    .scaleLinear()
    .range([0, innerXWidth])
    .domain(d3.extent(data, d => d.year));

  const y = d3.scaleLinear().domain([0, highestValue]).range([innerYHeight, 0]);

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
    [width, innerYHeight]
  ];

  const zoom = d3
    .zoom()
    .scaleExtent([1, 64])
    .extent(extent)
    .translateExtent(extent)
    .filter(event => {
      if (event.type === 'wheel' && event.ctrlKey) {
        // prevent browser zoom
        event.preventDefault();
      }

      if (!hasTouch && event.type === 'wheel' && !event.ctrlKey) {
        // only zoom with ctrl
        return false;
      }

      return true;
    })
    .on('zoom', zoomed);

  const gx = svg
    .append('g')
    .attr('class', 'x axis')
    .attr(
      'transform',
      `translate(${innerX.left}, ${innerYHeight + margin.top + margin.bottom})`
    )
    .call(xAxis);

  const gy = pinnedSvg.append('g').call(yAxis, y);

  const clipped = svg.append('g').attr('clip-path', 'url(#clip)');

  const makeBars = (dataset, classes) =>
    clipped
      .append('g')
      .selectAll('g')
      .data(dataset)
      .join('g')
      .style('fill', d => colors[d.key])
      .attr('class', 'bar ' + classes)

      .selectAll('rect')
      .data(d => d)
      .join('rect')
      .attr('width', 20)
      .attr('data-toggle', 'tooltip')
      .attr('data-trigger', 'click focus hover')
      .attr('class', classes);

  const bars = makeBars(dataset, 'fraction');
  const feeBars = makeBars(feeData, 'fees');

  const updateBars = (
    y,
    dataset,
    transition = true,
    selector = '.fraction'
  ) => {
    const isFeeBar = selector !== '.fraction';
    const isFeeView = subChartView === 'with_fees';

    let rects = clipped
      .selectAll('g.bar' + selector)
      .data(dataset)
      .selectAll('rect' + selector)
      .data(d => d)
      .classed('hidden', isFeeBar && !isFeeView);

    if (transition) {
      rects = rects.transition().duration(500);
    }

    const xOffset = isFeeView ? (isFeeBar ? 5 : -25) : -10;

    rects
      .attr('x', d => x(d.data.year) + innerX.left + xOffset)
      .attr('y', d => y(d[1]) + innerY.top)
      .attr('height', d => y(d[0]) - y(d[1]))
      .attr(
        'title',
        d =>
          `${labels[d.key]}: ${d.data[d.key]} ${
            requestViewUnits[chartView][d.data[d.key] === 1 ? 0 : 1]
          }`
      );
  };

  const line = clipped
    .append('path')
    .attr('transform', translate)
    .attr('class', 'line')
    .style('stroke', '#0034a5');

  const drawLine = y => {
    const show = chartView === 'filed_requests' && subChartView === 'via_fds';

    if (show) {
      line
        .attr(
          'd',
          d3
            .line(
              d => x(d.year),
              d => y(d.count)
            )
            .curve(d3.curveCatmullRom)(fdsShare)
        )
        .raise();
      transitionIn(line);
    } else if (line.attr('stroke-dashoffset') === '0') {
      transitionOut(line);
    }
  };

  // call everything
  svg.call(zoom);
  drawLine(y);
  updateBars(y, dataset, false, '.fraction');
  updateBars(y, feeData, false, '.fees');
  updateSelectors();
  body.node().scrollBy(0, 0);

  function zoomed(event) {
    const yz = event.transform.rescaleY(y);
    gy.call(yAxis, yz);

    if (updateZoom) {
      updateBars(yz, dataset, false, '.fraction');
      updateBars(yz, feeData, false, '.fees');
      drawLine(yz);
    }
    updateZoom = true;
  }

  function setChartView(to) {
    const view = to.split(':');
    chartView = view[0];
    subChartView = subChartView === view[1] ? undefined : view[1];

    const { dataset, highestValue } = getData(chartView);

    const yz = y.domain([0, highestValue]);

    gy.transition()
      .duration(500)
      .call(yAxis, yz)
      .on('end', () => {
        updateZoom = false;
        svg.call(zoom);
        svg.call(zoom.scaleTo, 1);
      });

    updateBars(yz, dataset, true, '.fraction');
    updateBars(y, feeData, true, '.fees');
    updateSelectors();
    drawLine(y);
  }

  window.addEventListener('load', () => BSN.initCallback(parent.node()));
}
