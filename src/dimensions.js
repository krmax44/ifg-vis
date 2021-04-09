export default function (selector) {
  const margin = { top: 20, right: 20, bottom: 20, left: 20 };
  const innerX = { top: 0, right: 50, bottom: 30, left: 80 };
  const innerY = { top: 30, right: 80, bottom: 80, left: 30 };

  const containerWidth = document.querySelector(selector).offsetWidth;
  const width = Math.max(containerWidth, 1200) - margin.left - margin.right;
  const height = 468 - margin.top - margin.bottom;

  const innerXWidth = width - innerX.right - innerX.left;
  const innerYHeight = height - innerY.top - innerY.bottom;

  const translate = `translate(${innerX.left}, ${innerY.top})`;

  return {
    margin,
    innerX,
    innerY,
    containerWidth,
    width,
    height,
    innerXWidth,
    innerYHeight,
    translate
  };
}
