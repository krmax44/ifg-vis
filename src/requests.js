import * as d3 from 'd3';
import { data, intObj } from './data';
import dimensions from './dimensions';
import { colors, labels, requestViews, requestViewUnits } from './config.json';
import fdsShare from './data/fds.csv';
import { cleanTransition, transitionIn, transitionOut } from './transitionLine';

const hasTouch =
  'ontouchstart' in window ||
  navigator.maxTouchPoints > 0 ||
  navigator.msMaxTouchPoints > 0;

const requestViewKeys = Object.keys(requestViews);
let chartView = requestViewKeys[0];
let subChartView;

let filterBfr = false;
const shouldFilterBfr = d => filterBfr && d.name === 'BMEL' && d.year === 2019;
const BFR_REQUESTS = 45245;

const getData = key => {
  const groupsByYear = data.reduce((obj, d) => {
    if (!obj[d.year]) obj[d.year] = {};

    obj[d.year][d.name] = d[key] || 0;
    obj[d.year].year = d.year;

    if (key === 'filed_requests' && shouldFilterBfr(d)) {
      obj[d.year][d.name] -= BFR_REQUESTS;
    }

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

  let { highestValue, dataset } = getData(chartView);

  const hasGroup = key => requestViewKeys.find(k => k.startsWith(`${key}:`));

  const selectors = root
    .select('div.selectors')
    .selectAll('span')
    .data(Object.entries(requestViews))
    .join('span')
    .attr('class', 'badge badge-light selector-badge')
    .classed('group-lead', d => hasGroup(d[0]))
    .classed('group-member', d => d[0].includes(':'))
    .attr('aria-role', 'button')
    .text(d => d[1])
    .on('click', (_e, d) => setChartView(d[0]));

  const updateSelectors = () =>
    selectors.classed(
      'badge-dark',
      d => chartView === d[0] || `${chartView}:${subChartView}` === d[0]
    );

  root.select('#bfr').on('input', e => {
    filterBfr = e.target.checked;
    update(true);
    updateYAxis(y);
  });

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

  const xAxis = d3
    .axisBottom(x)
    .tickSize(-height + innerY.bottom, 0, 0)
    .tickPadding(6)
    .tickFormat(d => d.toString());

  let y = d3.scaleLinear().domain([0, highestValue]).range([innerYHeight, 0]);

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

  const bars = clipped
    .append('g')
    .selectAll('g')
    .data(dataset)
    .join('g')
    .style('fill', d => colors[d.key])
    .attr('class', 'bar')

    .selectAll('rect')
    .data(d => d)
    .join('rect')
    .attr('width', 20)
    .attr('data-toggle', 'tooltip')
    .attr('data-trigger', 'click focus hover')
    .attr('class', 'fraction');

  const updateBars = (y, dataset, transition = true) => {
    let rects = clipped
      .selectAll('g.bar')
      .data(dataset)
      .selectAll('rect')
      .data(d => d);

    if (transition) {
      rects = rects.transition().duration(500);
    }

    rects
      .attr('x', d => x(d.data.year) + innerX.left - 10)
      .attr('y', d => y(d[1] || 0) + innerY.top)
      .attr('height', d => y(d[0] || 0) - y(d[1] || 0))
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
    .attr('class', 'line hidden')
    .style('stroke', '#0034a5');

  const updateLine = (y, transition = true) => {
    const show = chartView === 'filed_requests' && subChartView === 'via_fds';

    if (show) {
      const yVal = ({ count, year }) => {
        const noBfr = shouldFilterBfr(intObj({ count, year, name: 'BMEL' }));
        const val = noBfr ? count - BFR_REQUESTS : count;
        return y(val);
      };

      cleanTransition(line);

      const shouldTransIn = transition && line.classed('hidden');
      let l = line.raise();

      if (shouldTransIn) {
        transitionIn(line);
      } else {
        l = line.transition().duration(500);
      }

      l.attr(
        'd',
        d3
          .line(
            d => x(d.year),
            d => yVal(d)
          )
          .curve(d3.curveCatmullRom)(fdsShare)
      );
    } else if (transitionIn && !line.classed('hidden')) {
      transitionOut(line);
    }
  };

  const update = (transition, yz) => {
    const data = getData(chartView);
    dataset = data.dataset;
    highestValue = data.highestValue;

    if (!yz) {
      y = y.domain([0, highestValue]);
      yz = y;
    }

    updateLine(yz, transition);
    updateBars(yz, dataset, transition);
    updateSelectors();
  };

  const updateYAxis = y => {
    gy.transition()
      .duration(500)
      .call(yAxis, y)
      .on('end', () => {
        updateZoom = false;
        svg.call(zoom);
        svg.call(zoom.scaleTo, 1);
      });
  };

  // call everything
  update(false);
  svg.call(zoom);
  body.node().scrollBy(0, 0);

  function zoomed(event) {
    const yz = event.transform.rescaleY(y);
    gy.call(yAxis, yz);

    if (updateZoom) {
      update(false, yz);
    }
    updateZoom = true;
  }

  function setChartView(to) {
    const view = to.split(':');
    chartView = view[0];
    subChartView = subChartView === view[1] ? undefined : view[1];

    update(true);
    updateYAxis(y);
  }

  window.addEventListener('load', () => BSN.initCallback(parent.node()));
}
