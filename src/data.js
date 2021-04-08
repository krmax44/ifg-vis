import csv from './data/data.csv';
import { labels } from './config.json';
import { sumArray } from './utils';

const groupData = {};
const data = csv
  .map(d => {
    d.year = parseInt(d.year, 10);
    d.count = parseInt(d.count, 10);
    d.transparency = parseInt(d.transparency, 10);
    return d;
  })
  .filter(d => d.count > 0)
  .sort((a, b) => a.year - b.year);

for (const key in labels) {
  if (key === '⌀') {
    const years = data.reduce((years, d) => {
      if (!years[d.year]) years[d.year] = [];
      years[d.year].push(d);
      return years;
    }, {});

    groupData[key] = Object.entries(years).map(([year, d]) => {
      console.log('d', year, d);
      const granted = sumArray(d, 'granted');
      const not_granted = sumArray(d, 'not_granted');
      const count = sumArray(d, 'count');
      const filed_requests = sumArray(d, 'filed_requests');
      const sum = granted + not_granted;
      const transparency = Math.round((granted / sum) * 100);

      return {
        name: key,
        year,
        granted,
        not_granted,
        count,
        transparency,
        filed_requests
      };
    });
  } else {
    groupData[key] = data.filter(d => d.name === key);
  }
}

export { groupData, data };
