export const margin = { top: 20, right: 20, bottom: 20, left: 20 };
export const innerX = { top: 0, right: 50, bottom: 30, left: 80 };
export const innerY = { top: 30, right: 80, bottom: 80, left: 30 };

export const containerWidth = document.querySelector('.vis').offsetWidth;
export const width =
  Math.max(containerWidth, 1200) - margin.left - margin.right;
export const height = 468 - margin.top - margin.bottom;

export const innerXWidth = width - innerX.right - innerX.left;
export const innerYHeight = height - innerY.top - innerY.bottom;

export const translate = `translate(${innerX.left}, ${innerY.top})`;
