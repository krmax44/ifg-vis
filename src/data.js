import csv from './data/data.csv';
import { labels } from './config.json';
import { sumArray } from './utils';

export const intObj = obj =>
  Object.fromEntries(
    Object.entries(obj).map(d =>
      d[0] !== 'name' ? [d[0], parseInt(d[1], 10)] : d
    )
  );

const groupData = {};
const data = csv
  .map(intObj)
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
