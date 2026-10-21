/* Chart helpers: palette tokens, recessive chrome, theme-aware rebuilds. Requires Chart.js + core.js */
(function () {
  'use strict';
  function v(n) { return window.ESC.cssVar(n); }
  function series(i) { return v('--s' + ((i % 8) + 1)); }
  function wash(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function base(opts) {
    opts = opts || {};
    var ink2 = v('--ink-2'), muted = v('--muted'), grid = v('--grid'), axis = v('--axis');
    return {
      responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
      interaction: { mode: opts.mode || 'index', intersect: false },
      plugins: {
        legend: { display: !!opts.legend, position: 'top', align: 'start', labels: { color: ink2, boxWidth: 12, boxHeight: 12, usePointStyle: true, pointStyle: 'rectRounded' } },
        tooltip: { backgroundColor: v('--surface'), titleColor: v('--ink'), bodyColor: v('--ink'), borderColor: axis, borderWidth: 1, padding: 10, boxPadding: 4, usePointStyle: true,
          callbacks: opts.tooltipCallbacks || {} }
      },
      scales: {
        x: Object.assign({ grid: { color: grid, drawTicks: false }, border: { color: axis }, ticks: { color: muted, padding: 6, maxRotation: 0, autoSkipPadding: 12 },
          title: { display: !!opts.xTitle, text: opts.xTitle || '', color: ink2 } }, opts.x || {}),
        y: Object.assign({ grid: { color: grid, drawTicks: false }, border: { display: false }, ticks: { color: muted, padding: 6 },
          title: { display: !!opts.yTitle, text: opts.yTitle || '', color: ink2 } }, opts.y || {})
      }
    };
  }
  // make(canvas, builder) — builder() returns a Chart config; rebuilt when the theme changes
  function make(canvas, builder) {
    var holder = { chart: null };
    function build() {
      if (holder.chart) holder.chart.destroy();
      holder.chart = new window.Chart(canvas.getContext('2d'), builder());
    }
    build();
    window.ESC.onTheme(build);
    holder.rebuild = build;
    return holder;
  }
  var lineDs = function (label, data, i, extra) {
    return Object.assign({ label: label, data: data, borderColor: series(i), backgroundColor: series(i), borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, tension: 0 }, extra || {});
  };
  var barDs = function (label, data, i, extra) {
    return Object.assign({ label: label, data: data, backgroundColor: series(i), borderRadius: 4, borderSkipped: 'start', maxBarThickness: 24, borderColor: v('--surface'), borderWidth: 0 }, extra || {});
  };
  window.ESCChart = { v: v, series: series, wash: wash, base: base, make: make, lineDs: lineDs, barDs: barDs };
})();
