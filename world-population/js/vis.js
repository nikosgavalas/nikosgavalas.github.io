// map

const map = {};

map.svg = d3.select("#mapArea").append("svg");
map.aspectRatio = 1.3;
map.width = document.getElementById("mapArea").clientWidth;
map.height = map.width / map.aspectRatio;

map.svg.attr("width", map.width).attr("height", map.height);

map.projection = d3
  .geoNaturalEarth1()
  .scale(map.width / 1.5 / Math.PI)
  .translate([map.width / 2.3, map.height / 2.3]);

map.path = d3.geoPath().projection(map.projection);

map.colorRange = d3.scaleLinear([50, 75], ["#000080", "white"]);

map.onMouseOver = function (d) {
  d3.selectAll(".country").transition().duration(200).style("opacity", 0.5);
  d3.select(this)
    .transition()
    .duration(200)
    .style("opacity", 1)
    .style("stroke", "black");

  // small hack to get the id, I don't know a better way
  var idSelected = d3.select(this)._groups[0][0].id;
  var countryId = idSelected.split("-")[1];

  d3.selectAll(".scatter-circle")
    .transition()
    .duration(200)
    .style("opacity", 0.2);
  d3.select(`#scatter-circle-${countryId}`)
    .transition()
    .duration(200)
    .style("opacity", 1)
    .style("stroke-width", 1);
};

map.onMouseLeave = function (d) {
  d3.selectAll(".country")
    .transition()
    .duration(200)
    .style("opacity", 1)
    .style("stroke", "transparent");
  d3.selectAll(".scatter-circle")
    .transition()
    .duration(200)
    .style("opacity", 0.9)
    .style("stroke-width", 0.5);
};

var renderedMap = map.svg
  .append("g")
  .selectAll("path")
  .data(geojson.features)
  .join("path")
  .attr("d", map.path)
  .attr("class", (d) => "country")
  .attr("id", (d) => `country-${d.id}`)
  .on("mouseover", map.onMouseOver)
  .on("mouseleave", map.onMouseLeave);

const scatter = {};

scatter.margin = { top: 10, right: 30, bottom: 30, left: 40 };
scatter.aspectRatio = 1.3;
scatter.width =
  document.getElementById("scatterArea").clientWidth -
  scatter.margin.left -
  scatter.margin.right;
scatter.height =
  scatter.width / scatter.aspectRatio -
  scatter.margin.top -
  scatter.margin.bottom;

scatter.svg = d3
  .select("#scatterArea")
  .append("svg")
  .attr("width", scatter.width + scatter.margin.left + scatter.margin.right)
  .attr("height", scatter.height + scatter.margin.top + scatter.margin.bottom)
  .append("g")
  .attr(
    "transform",
    "translate(" + scatter.margin.left + "," + scatter.margin.top + ")"
  );

scatter.svg.attr("width", scatter.width).attr("height", scatter.height);

// scatter

var x = d3.scaleLog([30, 200000], [0, scatter.width]);
scatter.svg
  .append("g")
  .attr("transform", "translate(0," + scatter.height + ")")
  .call(d3.axisBottom(x).tickSize(-scatter.height).ticks());
scatter.svg
  .append("text")
  .attr("class", "chart-label")
  .attr("text-anchor", "end")
  .attr("x", scatter.width / 2 + scatter.margin.left)
  .attr("y", scatter.height + scatter.margin.top + 15)
  .text("GDP per capita (USD)");

var y = d3.scaleLinear([-2, 4.5], [scatter.height, 0]);
scatter.svg.append("g").call(d3.axisLeft(y).tickSize(-scatter.width).ticks());
scatter.svg
  .append("text")
  .attr("class", "chart-label")
  .attr("text-anchor", "end")
  .attr("transform", "rotate(-90)")
  .attr("y", -scatter.margin.left + 12)
  .attr("x", -scatter.margin.top - scatter.height / 3)
  .text("Population Growth Rate (%)");

var radius = d3.scaleLinear([0, 2000000000], [3, 70]);

scatter.svg.selectAll(".tick line").attr("stroke", "lightgray");

scatter.onMouseOver = function (d) {
  d3.selectAll(".scatter-circle")
    .transition()
    .duration(200)
    .style("opacity", 0.2);
  d3.select(this).transition().duration(200).style("opacity", 1);

  d3.selectAll(".country").transition().duration(200).style("opacity", 0.5);

  // small hack to get the id, I don't know a better way
  var idSelected = d3.select(this)._groups[0][0].id;
  var countryId = idSelected.split("-")[2];
  d3.select(`#country-${countryId}`)
    .transition()
    .duration(200)
    .style("opacity", 1)
    .style("stroke-width", 1)
    .style("stroke", "black");
};

scatter.onMouseLeave = function (d) {
  d3.selectAll(".country")
    .transition()
    .duration(200)
    .style("opacity", 1)
    .style("stroke", "transparent");
  d3.selectAll(".scatter-circle")
    .transition()
    .duration(200)
    .style("opacity", 0.9)
    .style("stroke-width", 0.5);
};

var renderedScatter = scatter.svg
  .append("g")
  .selectAll("circle")
  .data(Object.keys(data))
  .enter()
  .append("circle")
  .attr("class", (d) => "scatter-circle")
  .attr("id", (d) => `scatter-circle-${d}`)
  .style("stroke", "black")
  .style("stroke-width", 0.5)
  .style("opacity", 0.9)
  .on("mouseover", scatter.onMouseOver)
  .on("mouseleave", scatter.onMouseLeave);

// time updates

function updateTime(inp) {
  var idx = inp - 1960;
  renderedScatter
    .transition()
    .duration(1000)
    .attr("cx", (d, i) => {
      return x(parseFloat(data[d]["gdp-per-capita"][idx]));
    })
    .attr("cy", (d, i) => {
      return y(parseFloat(data[d]["population-growth"][idx]));
    })
    .attr("r", (d, i) => {
      var x = data[d]["gdp-per-capita"][idx];
      var y = data[d]["population-growth"][idx];
      var r = radius(data[d]["population-total"][idx]);
      if (x == ".." || y == ".." || r == "..") {
        return 0;
      }
      return r;
    })
    .style("fill", (d, i) => {
      var w = data[d]["population-working-age"][idx];
      if (w == "..") {
        return "white";
      }
      return map.colorRange(w);
    });
  renderedMap.attr("fill", (d, i) => {
    var value = d.id in data ? data[d.id]["population-working-age"][idx] : 0;
    if (value == "..") {
      value = 0;
    }
    return map.colorRange(value);
  });
}

updateTime(2020);

d3.select("#timeSlider").on("input", function (d) {
  updateTime(this.value);
});

// responsiveness

// function resize() {
//   map.width = document.getElementById("mapArea").clientWidth;
//   map.height = map.width / map.aspectRatio;
//   map.svg.attr("width", map.width).attr("height", map.height);
//   scatter.width = document.getElementById("scatterArea").clientWidth;
//   scatter.height = scatter.width / scatter.aspectRatio;
//   scatter.svg.attr("width", scatter.width).attr("height", scatter.height);
// }

// window.onresize = resize;
