// These should be replaced with actual attribute names from your dataset
const categoricalAttributes = [
  "neighbourhood_group",
  "neighbourhood",
  "room_type",
];
const numericalAttributes = [
  "price",
  "minimum_nights",
  "number_of_reviews",
  "reviews_per_month",
  "availability_365",
];
const excludedAttributes = [
  "id",
  "host_name",
  "host_id",
  "latitude",
  "longitude",
  "last_review",
  "name",
  "calculated_host_listings_count",
];

let abnbData = null; // Global variable to store the data
document.addEventListener("DOMContentLoaded", function () {
  fetch("/api/pcp")
    .then((response) => response.json())
    .then((data) => {
      drawPCP("#pcp-chart", data.data, data.cluster_labels);
    });
});

document.addEventListener("DOMContentLoaded", function () {
  fetch("/api/attributes")
    .then((response) => response.json())
    .then((data) => {
      abnbData = data; // Store data globally

      const ul = document.getElementById("attribute-list-ul");
      if (abnbData.length > 0) {
        // Assume that the first row has all the headers we need
        const headers = Object.keys(abnbData[0]);
        headers.forEach((header) => {
          if (!excludedAttributes.includes(header)) {
            const li = document.createElement("li");
            li.textContent = header;
            li.onclick = () => {
              highlight(li);

              if (numericalAttributes.includes(header)) {
                drawHistogram(header, abnbData);
              } else if (categoricalAttributes.includes(header)) {
                drawBarGraph(header, abnbData);
                drawPieChart(header, abnbData);
              }
            };
            ul.appendChild(li);
          }
        });
      }
    });
});

function highlight(element) {
  // Remove highlight from all other elements
  document.querySelectorAll("#attribute-list-ul li").forEach((el) => {
    el.classList.remove("highlighted");
  });
  // Add highlight to the clicked element
  element.classList.add("highlighted");
}
function drawBarGraph(selectedHeader, data) {
  // Clear the previous graph
  const graphContainer = d3.select("#histogram");
  graphContainer.selectAll("*").remove();
  let isNeighbourhood = selectedHeader === "neighbourhood";

  // Setup for tooltip
  const tooltip = d3
    .select("body")
    .append("div")
    .attr("id", "tooltip")
    .style("position", "absolute")
    .style("display", "none")
    .style("padding", "3px")
    .style("background", "rgba(0, 0, 0, 0.6)")
    .style("border-radius", "5px")
    .style("color", "#fff")
    .style("text-align", "center");

  // Set up SVG and scales
  const margin = { top: 20, right: 20, bottom: 120, left: 60 };
  const width = 600 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  const svg = graphContainer
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Filter and count data
  data = data.filter(
    (d) => d[selectedHeader] !== null && d[selectedHeader] !== ""
  );
  let counts = {};
  data.forEach((d) => {
    let category = d[selectedHeader];
    counts[category] = (counts[category] || 0) + 1;
  });
  const barData = Object.keys(counts).map((key) => ({
    key,
    value: counts[key],
  }));

  // Sort data
  barData.sort((a, b) => d3.descending(a.value, b.value));

  // Create scales
  const xScale = d3
    .scaleBand()
    .range([0, width])
    .domain(barData.map((d) => d.key))
    .padding(0.1);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(barData, (d) => d.value)])
    .range([height, 0]);

  // Append the rectangles for the bar chart
  svg
    .selectAll(".bar")
    .data(barData)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", (d) => xScale(d.key))
    .attr("y", (d) => yScale(d.value))
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => height - yScale(d.value))
    .attr("fill", "#69b3a2")
    .on("mouseover", function (e, d) {
      tooltip
        .style("display", "inline-block")
        .style("font-size", "10px")
        .html(`Category: ${d.key}<br>Count: ${d.value}`)
        .style("left", e.pageX + 10 + "px")
        .style("top", e.pageY - 10 + "px");
    })
    .on("mouseout", function () {
      tooltip.style("display", "none");
    });

  // Add the X Axis
  let xAxis = svg
    .append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(xScale));

  // If the selected category is 'neighbourhood', modify the tick frequency
  if (isNeighbourhood) {
    xAxis.call(
      d3.axisBottom(xScale).tickValues(
        xScale.domain().filter(function (d, i) {
          return !(i % 7);
        }) // Show only every 10th label
      )
    );
  }

  // Rotate the labels if necessary
  xAxis
    .selectAll("text")
    .style("text-anchor", "end")
    .attr("dx", "-.8em")
    .attr("dy", ".15em")
    .attr("transform", "rotate(-40)");

  // Add the Y Axis
  svg.append("g").call(d3.axisLeft(yScale));

  // svg
  //   .append("text")
  //   .style("size", "0.1px")
  //   .attr("text-anchor", "end")
  //   .attr("x", width / 2 + margin.left)
  //   .attr("y", height + margin.top + 10)
  //   .text(selectedHeader);

  // // Add Y Axis label:
  svg
    .append("text")
    .style("size", "0px")
    .attr("text-anchor", "end")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 20)
    .attr("x", -margin.top - height / 2 + 20)
    .text("Count");
}

function drawHistogram(selectedHeader, data) {
  // Clear any previous graphs
  const graphContainer = d3.select("#histogram");
  graphContainer.selectAll("*").remove();

  // Setup for tooltip
  const tooltip = d3
    .select("body")
    .append("div")
    .attr("id", "tooltip")
    .style("position", "absolute")
    .style("display", "none")
    .style("padding", "10px")
    .style("background", "rgba(0, 0, 0, 0.6)")
    .style("border-radius", "5px")
    .style("color", "#fff")
    .style("text-align", "center");

  // Set up SVG and scales
  const margin = { top: 20, right: 20, bottom: 90, left: 60 };
  const width = 600 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  const svg = graphContainer
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Process the data: extract values and filter out undefined or null
  let values = data.map((d) => d[selectedHeader]).filter((v) => v != null);

  // Generate bins
  const xScale = d3
    .scaleLinear()
    .domain(d3.extent(values)) // Use the extent of the data for the x-scale domain
    .range([0, width]);

  const histogramGenerator = d3
    .histogram()
    .value((d) => d)
    .domain(xScale.domain()) // Set the domain of the generator to match the scale
    .thresholds(xScale.ticks(40)); // Create approximately 40 bins

  const bins = histogramGenerator(values);

  // Y scale will use the number of items in each bin
  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(bins, (d) => d.length)])
    .range([height, 0]);

  // Bars: draw each bin as a rectangle
  svg
    .selectAll("rect")
    .data(bins)
    .enter()
    .append("rect")
    .attr("x", (d) => xScale(d.x0)) // x0 is the lower bound of the bin
    .attr("width", (d) => Math.max(0, xScale(d.x1) - xScale(d.x0) - 1))
    .attr("y", (d) => yScale(d.length))
    .attr("height", (d) => height - yScale(d.length))
    .style("fill", "#69b3a2")
    .on("mouseover", function (e, d) {
      tooltip
        .style("display", "inline-block")
        .html(`Range: ${d.x0} - ${d.x1}<br>Count: ${d.length}`)
        .style("left", e.pageX + 10 + "px")
        .style("top", e.pageY - 10 + "px");
    })
    .on("mouseout", function () {
      tooltip.style("display", "none");
    });

  // Add the X Axis
  svg
    .append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(xScale));

  // Add the Y Axis
  svg.append("g").call(d3.axisLeft(yScale));

  svg
    .append("text")
    .style("size", "0.1px")
    .attr("text-anchor", "end")
    .attr("x", width / 2 + margin.left)
    .attr("y", height + margin.top + 10)
    .text(selectedHeader);

  // Add Y Axis label:
  svg
    .append("text")
    .style("size", "0.1px")
    .attr("text-anchor", "end")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 30)
    .attr("x", -margin.top - height / 2 + 30)
    .text("Count");
}

function drawPieChart(selectedHeader, data, isNumerical = false) {
  // Filter out invalid data
  data = data.filter(
    (d) => d != null && d[selectedHeader] != null && d[selectedHeader] !== ""
  );

  // Aggregate the data into categories and count them
  let counts = {};
  data.forEach((d) => {
    counts[d[selectedHeader]] = (counts[d[selectedHeader]] || 0) + 1;
  });

  // Convert counts to a data array suitable for D3 pie chart
  let pieData;

  if (isNumerical) {
    // For numerical data, first bin the data
    const thresholds = d3.range(
      d3.min(data),
      d3.max(data),
      (d3.max(data) - d3.min(data)) / 10
    ); // Example: create 10 bins
    const bin = d3
      .bin()
      .thresholds(thresholds)
      .value((d) => d[selectedHeader]);
    const bins = bin(data);

    // Transform bins into pieData format
    pieData = bins.map((b) => ({
      category: `${b.x0} to ${b.x1}`,
      value: b.length,
    }));
  } else {
    // For categorical data, count the occurrences of each category
    let counts = {};
    data.forEach((d) => {
      counts[d[selectedHeader]] = (counts[d[selectedHeader]] || 0) + 1;
    });

    pieData = Object.keys(counts).map((key) => ({
      category: key,
      value: counts[key],
    }));
  }

  // Set up dimensions and radius of the chart
  const width = 550;
  const height = 420;
  const radius = Math.min(width, height) / 2;

  // Remove any previous svg to avoid overlaps
  const pieContainer = d3.select("#pie-chart");
  pieContainer.selectAll("svg").remove();

  const svgPaddingRight = 150; // Additional space on the right for the legend

  // Create SVG container for the pie chart with enough space for the legend
  const svgWidth = width + svgPaddingRight; // Add extra width for the legend
  const svgHeight = height;

  const svg = pieContainer
    .append("svg")
    .attr("width", svgWidth)
    .attr("height", svgHeight)
    .append("g")
    // Move the center of the pie chart to the left to make space for the legend
    .attr("transform", `translate(${radius},${svgHeight / 2})`);

  // Create the pie layout function
  const pie = d3.pie().value((d) => d.value);

  // Define the arc for the pie slices
  const arc = d3.arc().innerRadius(0).outerRadius(radius);

  // Create a tooltip
  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("display", "none")
    .style("position", "absolute")
    .style("padding", "10px")
    .style("background", "white")
    .style("border", "1px solid")
    .style("border-radius", "5px");

  // Draw the pie slices
  svg
    .selectAll("path")
    .data(pie(pieData))
    .enter()
    .append("path")
    .attr("d", arc)
    .attr("fill", (d, i) => d3.schemeCategory10[i % 10]) // Assign color
    .on("mouseover", function (e, d) {
      tooltip
        .style("display", "inline-block")
        .html(`Category: ${d.data.category}<br/>Count: ${d.data.value}`)
        .style("left", e.pageX + 10 + "px")
        .style("top", e.pageY - 10 + "px");
    })
    .on("mouseout", function () {
      tooltip.style("display", "none");
    });

  // Create a legend for the pie chart
  const legendRectSize = 12; // Size of the legend marker
  const legendSpacing = 4; // Space between the legend markers

  // Select the SVG to add the legend
  const legend = svg
    .selectAll(".legend")
    .data(pie(pieData))
    .enter()
    .append("g")
    .attr("class", "legend")
    .attr("transform", function (d, idx) {
      const height = legendRectSize + legendSpacing;
      const offset = (height * pieData.length) / 2;
      const horz = -2 * legendRectSize + 250;
      const vert = idx * height - offset - 80;
      return "translate(" + horz + "," + vert + ")";
    });

  // Add the colored squares to the legend
  legend
    .append("rect")
    .attr("width", legendRectSize)
    .attr("height", legendRectSize)
    .style("fill", (d, i) => d3.schemeCategory10[i % 10]) // Use the same color scheme as the pie slices
    .style("stroke", (d, i) => d3.schemeCategory10[i % 10]);

  // Add the text to the legend
  legend
    .append("text")
    .style("size", "1px")
    .style("overflow", "visible")
    .attr("x", legendRectSize + legendSpacing)
    .attr("y", legendRectSize - legendSpacing)
    .text((d) => d.data.category);
}

function drawPCP(selector, data, clusters) {
  const margin = { top: 30, right: 30, bottom: 10, left: 30 },
    width = 1200 - margin.left - margin.right,
    height = 450 - margin.top - margin.bottom;
  d3.select(selector).select("svg").remove();

  const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

  const svg = d3
    .select(selector)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  let dimensions = Object.keys(data[0]);
  const x = d3.scalePoint().range([0, width]).padding(1).domain(dimensions);

  const y = {};
  dimensions.forEach((dimension) => {
    const extent = d3.extent(data, (d) => d[dimension]);
    y[dimension] =
      typeof data[0][dimension] === "number"
        ? d3.scaleLinear().domain(extent).range([height, 0])
        : d3
            .scalePoint()
            .domain(data.map((d) => d[dimension]))
            .range([height, 0])
            .padding(1);
  });

  const line = d3
    .line()
    .x((d) => x(d.dimension))
    .y((d) => {
      const dimension = d.dimension;
      const scale = y[dimension];
      return scale(d.value);
    });

  const path = svg
    .selectAll(".line")
    .data(data)
    .enter()
    .append("path")
    .attr("class", "line")
    .attr("d", (d) =>
      line(dimensions.map((p) => ({ dimension: p, value: d[p] })))
    )
    .style("fill", "none")
    .style("stroke", (d, i) => colorScale(clusters[i]))
    .style("opacity", 0.5);

  const axis = svg
    .selectAll(".axis")
    .data(dimensions)
    .enter()
    .append("g")
    .attr("class", "axis")
    .attr("transform", (d) => `translate(${x(d)},0)`)
    .each(function (d) {
      d3.select(this).call(d3.axisLeft(y[d]));
    });

  axis
    .append("text")
    .style("text-anchor", "middle")
    .attr("y", -9)
    .text((d, i) => (d === "neighbourhood" && i != 0 && i % 10 !== 0 ? "" : d)) // Show every 10th label only for 'neighbourhood'
    .style("fill", "black");

  dimensions.forEach((dimension) => {
    const brush = d3
      .brushY()
      .extent([
        [-8, 0],
        [8, height],
      ])
      .on("brush end", (event) => brushmoved(event, dimension));

    svg
      .append("g")
      .attr("class", "brush")
      .attr("transform", `translate(${x(dimension)},0)`)
      .call(brush);
  });

  function brushmoved(event, dimension) {
    const selection = event.selection;
    if (!selection) {
      path.style("stroke-opacity", 0.5);
      return;
    }

    const [y0, y1] = selection;
    const isNumeric = typeof data[0][dimension] === "number";

    path.style("stroke-opacity", (d) => {
      if (!isNumeric) {
        const domain = y[dimension].domain();
        const range = y[dimension].range();
        const scale = d3.scalePoint().domain(domain).range(range);
        const index = domain.indexOf(d[dimension]);
        return index >= 0 &&
          scale(domain[index]) >= y0 &&
          scale(domain[index]) <= y1
          ? 1
          : 0.1;
      }
      const value = y[dimension](d[dimension]);
      return value >= y0 && value <= y1 ? 1 : 0.1;
    });
  }

  // Drag and drop functionality
  const drag = d3
    .drag()
    .on("start", function (event) {
      // Start drag
    })
    .on("drag", function (event, d) {
      // Drag functionality
    })
    .on("end", function (event, d) {
      const dropX = event.x - margin.left;
      const newIndex = Math.max(
        0,
        Math.min(
          dimensions.length - 1,
          Math.floor((dropX / width) * dimensions.length)
        )
      );

      dimensions.splice(dimensions.indexOf(d), 1);
      dimensions.splice(newIndex, 0, d);

      x.domain(dimensions);

      svg
        .selectAll(".axis")
        .transition()
        .duration(500)
        .attr("transform", (d) => `translate(${x(d)},0)`)
        .each(function (d) {
          d3.select(this).call(d3.axisLeft(y[d]));
        });

      svg
        .selectAll(".line")
        .transition()
        .duration(500)
        .attr("d", (d) =>
          line(dimensions.map((p) => ({ dimension: p, value: d[p] })))
        );
    });

  svg.selectAll(".axis").call(drag);
}

document.addEventListener("DOMContentLoaded", function () {
  var map = L.map("chart-2").setView([40.7128, -74.006], 10);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap",
  }).addTo(map);

  async function loadData() {
    const response = await fetch("/api/map");
    const data = await response.json();

    L.geoJSON(data, {
      style: function (feature) {
        return {
          fillColor: getColor(feature.properties.counts),
          weight: 2,
          opacity: 1,
          color: "white",
          fillOpacity: 0.7,
        };
        //return { color: "red" };
      },
    }).addTo(map);
  }

  function getColor(d) {
    return d > 1000
      ? "#800026"
      : d > 500
      ? "#BD0026"
      : d > 200
      ? "#E31A1C"
      : d > 100
      ? "#FC4E2A"
      : d > 50
      ? "#FD8D3C"
      : d > 20
      ? "#FEB24C"
      : d > 10
      ? "#FED976"
      : "#FFEDA0";
  }

  loadData();
});
