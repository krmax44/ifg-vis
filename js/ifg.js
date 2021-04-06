/* jshint strict: true, quotmark: false, es3: true */
/* global jQuery: false, d3: false, Backbone: false, IFGVis: false */

// IFG-Anfragen Vis
// (c) 2013 Stefan Wehrmeyer

(function($){
  "use strict";

  var isTouch = ('ontouchstart' in window) || window.DocumentTouch && document instanceof window.DocumentTouch;


  var margin = {top: 20, right: 20, bottom: 20, left: 20};
  var innerX = {top: 0, right: 50, bottom: 30, left: 80};
  var innerY = {top: 30, right: 80, bottom: 80, left: 30};

  d3.selection.prototype.moveToFront = function() {
    return this.each(function() {
      this.parentNode.appendChild(this);
    });
  };

  var containerWidth = document.getElementById('vis').offsetWidth;

  var width = Math.max(containerWidth, 768) - margin.left - margin.right,
      height = 468 - margin.top - margin.bottom;

  var parseYear = d3.time.format("%Y").parse;


  var innerXWidth = width - innerX.right - innerX.left;
  var x = d3.time.scale()
      .range([0, innerXWidth]);

  var innerYHeight = height - innerY.top - innerY.bottom;
  var y = d3.scale.linear()
      .domain([0, 100])
      .range([innerYHeight, 0]);

  var yAxis = d3.svg.axis()
      .scale(y)
      .tickSize(-width, 0, 0)
      .ticks(5)
      .tickFormat(function(d){ return d + '%'; })
      .orient("left");

  var xAxis = d3.svg.axis()
      .scale(x)
      .tickSize(-height + innerY.bottom, 0, 0)
      .tickPadding(6)
      .orient("top");

  var circleRadius = d3.scale.sqrt()
      .rangeRound([1, IFGVis.maxDotSize]);

  var connectionLine = d3.svg.line()
    .x(function(d) { return d.x; })
    .y(function(d) { return d.y; })
    .interpolate("basis")
    .defined(function(d){
      return d.defined;
    });


  var svg = d3.select("#vis").append("svg:svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

  svg = svg.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  svg.append("g")
    .attr("class", "y axis")
    .attr('transform', 'translate(' + innerY.left + ',' + innerY.top + ')')
    .call(yAxis);

  svg.select('.y.axis .major line').classed('bottomline', true);

  var activeGroups = 0;

  var activateGroup = function(key) {
    return function(){
      var obj = groups[key];
      obj.group.moveToFront();
      svg.selectAll("." + key).style("fill", IFGVis.colors[key]).classed('active', true);
      obj.group.select('.line').style('display', 'block');
      if (stack[stack.length - 1] === key) {
        svg.select('#label')
          .attr('transform', 'translate(' + (innerXWidth + innerX.left + 40) + ',' + (obj.labelpos + 12) + ')')
          .style('display', 'block');
        svg.select('#label-triangle')
          .attr('transform', 'translate(' + (innerXWidth + innerX.left) + ',' + (obj.labelpos + 22) + ')');
        svg.select('#label-text')
          .text(IFGVis.labels[key])
          .style('fill', IFGVis.colors[key]);
        var bbox = svg.select('#label-text').node().getBBox();
        svg.select('#label-rect')
          .attr('transform', 'translate(' + (-bbox.width - 5) + ',' + (-20) + ')')
          .attr('width', bbox.width + 10)
          .attr('height', bbox.height + 5);
        svg.selectAll('.label').style('display', 'block');
        obj.group.selectAll('.circle-number').style('display', 'block');
      } else {
        obj.group.selectAll('.circle-number').style('display', 'none');
      }
      activeInForeground();
    };
  };

  var permanentlyActivateGroup = function(key){
    return function(){
      var obj = groups[key];
      obj.isActive = !obj.isActive;
      if (obj.isActive) {
        activateGroup(key)();
      } else {
        deactivateGroup(key)();
      }
    };
  };

  var deactivateGroup = function(key) {
    return function() {
      var obj = groups[key];
      if (obj.isActive) { return; }
      obj.group.select('.line').style('display', 'none');
      svg.selectAll("." + key).style("fill", "").classed('active', false);
      obj.group.selectAll('.circle-number').style('display', 'none');
      refreshAllActiveGroups();
    };
  };

  var activeInForeground = function(){
    for (var key in groups){
      if (groups[key].isActive){
        groups[key].group.moveToFront();
      }
    }
    if (stack.length > 0) {
      groups[stack[stack.length - 1]].group.moveToFront();
    }
    svg.selectAll('.label').moveToFront();
  };


  var refreshAllActiveGroups = function(){
    for (var key in groups){
      if (groups[key].isActive){
        activateGroup(key)();
      }
    }
    activeInForeground();
  };

  var groups = {};

  var getLineData = function(groupData){
    var newData = [], d, rad, dist;
    for (var i = 0; i < groupData.length; i += 1){
      if (i < groupData.length - 1) {
        dist = x(groupData[1].year) - x(groupData[0].year);
        dist = Math.round((dist - 50) / 2);
      }
      rad = dist;
      if (i > 0){
        d = $.extend({}, groupData[i]);
        d.rad = rad;
        d.x = x(d.year) - rad;
        d.y = y(d.transparency);
        d.defined = true;
        newData.push(d);
      }
      d = $.extend({}, groupData[i]);
      d.x = x(d.year);
      d.y = y(d.transparency);
      d.defined = true;
      newData.push(d);
      if (i < groupData.length - 1) {
        d = $.extend({}, groupData[i]);
        d.x = x(d.year) + rad;
        d.y = y(d.transparency);
        d.defined = true;
        newData.push(d);
      }
    }

    return newData;
  };

  var makeTriangle = (function() {
    var t = d3.svg.symbol();
    t.size(100);
    return t;
  }());

  var makeGroup = function(key, groupData){
    var group = svg.append('g')
      .attr('transform', 'translate(' + innerX.left + ',' + innerY.top + ')')
      .attr('class', 'group ' + key);

    var connectionData = getLineData(groupData);

    group.append("svg:path")
        .attr('class', 'line')
        .style('stroke', IFGVis.colors[key])
        .style('display', 'none')
        .attr("d", connectionLine(connectionData));

    var groupSelect = group
      .selectAll("." + key)
      .data(groupData);

    var circleGroup = groupSelect
      .enter().append("g");

    circleGroup.append('path')
      .attr('d', makeTriangle.type('triangle-up')())
      .attr('class', 'triangle circle-number label-background')
      .attr('transform', function(d){
        return 'translate(' + (x(d.year)) + ',' + (y(d.transparency) + 8) + ')';
      })
      .style('display', 'none');

    var circleGroupText = circleGroup.append('g')
      .attr('class', 'circle-number');

    circleGroupText.append('rect')
        .attr('width', '70')
        .attr('class', 'label-background')
        .attr('height', '70')
        .attr('transform', function(d){
          return 'translate(' + (x(d.year) - 35) + ',' + (y(d.transparency) + 12) + ')';
        });

    var t = circleGroupText.append('text')
      .attr('class', 'circle-number highlight')
      .style('fill', IFGVis.colors[key])
      .attr('transform', function(d){
        return 'translate(' + (x(d.year)) + ',' + (y(d.transparency) + 31) + ')';
      })
      .style('display', 'none')
      .attr('text-anchor', 'middle');

    t.append('tspan')
      .attr('x', 0)
      .text(function(d){
          return d.transparency + '%';
      });
    t.append('tspan')
      .attr('x', 0)
      .attr('dy', 15)
      .text(function(d){
          return 'von ' + d.count;
      });
    t.append('tspan')
      .attr('x', 0)
      .attr('dy', 15)
      .text(function(d){
        return d.count === 1 ? 'Antrag' : 'Anträgen';
      });
    t.append('tspan')
      .attr('x', 0)
      .attr('dy', 15)
      .text('bewilligt');


    if (isTouch){
      group.data(groupData)
        .on("touchstart", navigateToKey(key));
    } else {
      group.data(groupData)
        .on("mouseover", activateGroup(key, true))
        .on("mouseout", deactivateGroup(key))
        .on("click", navigateToKey(key));
    }

    var lastBubble = groupData[groupData.length - 1];
    var labelpos = y(lastBubble.transparency);

    return {
      labelpos: labelpos,
      group: group,
      isActive: false
    };
  };

  var dataLoaded = function(error, data) {
    data.forEach(function(d) {
      d.year = parseYear(d.year);
      d.count = parseInt(d.count, 10);
      d.transparency = parseInt(d.transparency, 10);
    });
    data = data.filter(function(d){
      return d.count > 0;
    })
    .sort(function(a, b){
      return a.year - b.year;
    });

    x.domain(d3.extent(data, function(d) { return d.year; }));

    svg.append("g")
      .attr("class", "x axis")
      .attr('transform', 'translate(' + innerX.left + ',' + innerX.top + ')')
      .call(xAxis);

    var label = svg.append('g')
      .attr('id', 'label')
      .attr('class', 'label')
      .style('display', 'none');

    label.append('rect')
      .attr('id', 'label-rect')
      .attr('class', 'label-background')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 1)
      .attr('height', 1);
    svg.append('path')
      .attr('id', 'label-triangle')
      .attr('d', makeTriangle.type('triangle-down')())
      .attr('class', 'triangle label label-background');
    label.append('text')
      .attr('id', 'label-text')
      .attr('text-anchor', 'end');

    circleRadius.domain(d3.extent(data, function(d) { return d.count; }));

    var filterFunc = function(key){
      return function(d){ return d.name === key; };
    };


    // Add Circles independent from group
    var circleData = data.slice();
    circleData.sort(function(a, b){
      return b.count - a.count;
    });
    svg.selectAll('.dot')
      .data(circleData)
      .enter()
      .append('circle')
      .attr("class", function(d){
        return "dot circle " + d.name;
      })
      .attr("r", function(d) {
        return circleRadius(d.count);
      });

    var helpCircleData = circleData.slice().filter(function(d, i){
      return circleRadius(d.count) <= IFGVis.dotSizeNeedsHelp;
    });
    svg.selectAll('.helpdot')
      .data(helpCircleData)
      .enter()
      .append('circle')
      .attr("r", IFGVis.helpDotSize)
      .attr("class", "helpdot circle");

    svg.selectAll('.circle')
      .attr('transform', 'translate(' + innerX.left + ',' + innerY.top + ')')
      .attr("cx", function(d) { return x(d.year); })
      .attr("cy", function(d) { return y(d.transparency); });

    if (isTouch){
      svg.selectAll('.circle')
        .on("touchstart", function(d){
          navigateToKey(d.name)();
        });
    } else {
      svg.selectAll('.circle')
        .on("mouseover", function(d){
          activateGroup(d.name, true)();
        })
        .on("mouseout", function(d){
          deactivateGroup(d.name)();
        })
        .on("click", function(d){
          navigateToKey(d.name)();
        });
    }

    for (var key in IFGVis.colors) {
      groups[key] = makeGroup(key, data.filter(filterFunc(key)));
    }

    init();
  };

  var initial = true, stack = [];

  var WorkspaceRouter = Backbone.Router.extend({
    routes: {
      "*args": "show"
    },

    show: function(args) {
      if (initial && args === "") {
        router.navigate(IFGVis.defaultInstitution, {trigger: true});
        initial = false;
        return;
      }
      initial = false;
      args = args.split('&');
      $('.label').hide();
      $('input').prop('checked', false);
      for (var key in groups){
        groups[key].isActive = false;
        deactivateGroup(key)();
      }
      activeGroups = 0;
      stack = [];
      for (var i = 0; i < args.length; i += 1) {
        if (groups[args[i]] !== undefined) {
          stack.push(args[i]);
          $('input[value="' + args[i] + '"]').prop('checked', true);
          activeGroups += 1;
          permanentlyActivateGroup(args[i])();
        }
      }
      refreshAllActiveGroups();
    }

  });

  var init = function(){
    Backbone.history.start();
  };

  var router = new WorkspaceRouter();

  var navigateToKey = function(key){
    return function(){
      var checked = $('input[value="' + key + '"]').prop('checked');
      $('input[value="' + key + '"]').prop('checked', !checked);
      toggleOnStack(key, !checked);
      updateNav();
    };
  };

  var toggleOnStack = function(key, add){
    if (add) {
      stack.push(key);
    } else {
      stack = stack.filter(function(el){
        return el !== key;
      });
    }
  };

  var updateNav = function(){
    var url;
    if (stack.length > 0) {
      url = stack.join('&');
    } else {
      url = '!';
    }
    router.navigate(url, {trigger: true});
  };

  $(function(){
    $('#auswahl-button').on('click touchstart', function(e){
      e.preventDefault();
      $('#auswahl').slideToggle();
    });
    $('#choose-all').on('click touchstart', function(e){
      e.preventDefault();
      $('.auswahl-liste input').prop('checked', true);
      stack = [];
      $('.auswahl-liste input').each(function(i, el){
        stack.push($(el).val());
      });
      updateNav();
    });
    $('#choose-none').on('click touchstart', function(e){
      e.preventDefault();
      $('.auswahl-liste input').prop('checked', false);
      stack = [];
      updateNav();
    });
    $('.auswahl-liste input').change(function(){
      toggleOnStack($(this).val(), $(this).prop('checked'));
      updateNav();
    });
    $('.close').on('click touchstart', function(e){
      e.preventDefault();
      $('#auswahl').slideUp();
    });
  });

  d3.csv('data.csv', dataLoaded);

}(jQuery));
