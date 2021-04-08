export function sumArray(arr, key) {
  return arr.reduce((c, v) => c + parseInt(v[key]), 0);
}
