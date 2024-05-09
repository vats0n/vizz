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
  "tag",
];

let abnbData = null; // Global variable to store the data
let globalMapData = { geoJson: {}, countsData: {} };
let globalY = {};
let pcp_data = {};
let pcp_clusters = {};
let pcp_filters = {};

document.addEventListener("DOMContentLoaded", function () {
  fetch("/api/pcp")
    .then((response) => response.json())
    .then((data) => {
      pcp_data = data.data;
      pcp_clusters = data.cluster_labels;
      drawPCP("#pcp-chart", pcp_data, pcp_clusters, pcp_filters);
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
                //drawHistogram(header, abnbData);
                drawViolinPlot(header, abnbData);
              } else if (categoricalAttributes.includes(header)) {
                //drawBarGraph(header, abnbData);
                drawPieChart(header, abnbData);
              }
            };
            ul.appendChild(li);
          }
        });
      }
    });
  plotChoropleth();
});

document.addEventListener("DOMContentLoaded", function () {
  fetch("/api/mds_variables")
    .then((response) => response.json())
    .then((data) => {
      console.log(data.nodes);
      console.log(data.links);
      drawMDSPlot(data);
    })
    .catch((error) => {
      console.error("Error loading MDS data:", error);
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
  const width = 750;
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
    .attr("transform", `translate(${width / 2 - 100}, ${svgHeight / 2})`);

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
    .style("font-size", "12px")
    .style("overflow", "visible")
    .attr("x", legendRectSize + legendSpacing)
    .attr("y", legendRectSize - legendSpacing)
    .text((d) => d.data.category);
}

function drawPCP(selector, ndata, clusters, filters = {}) {
  const margin = { top: 30, right: 30, bottom: 10, left: 0 },
    width = 1000 - margin.left - margin.right,
    height = 450 - margin.top - margin.bottom;
  d3.select(selector).select("svg").remove();

  ndata =
    filters.length > 0 ? ndata.filter((d) => filters.includes(d.tag)) : ndata;

  const data = ndata.map((obj) => {
    // Create a copy of the object to avoid modifying the original
    const newObj = { ...obj };
    // Delete the 'tag' property from the copied object
    delete newObj.tag;
    // Return the modified object
    return newObj;
  });

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
  globalY = y;
  let brushes = {};
  let activeBrushes = {};

  dimensions.forEach((dimension) => {
    brushes[dimension] = d3
      .brushY()
      .extent([
        [-8, 0],
        [8, height],
      ])
      .on("brush end", (event) => brushmoved(event, dimension));

    svg
      .append("g")
      .attr("class", `brush brush-${dimension}`)
      .attr("transform", `translate(${x(dimension)},0)`)
      .call(brushes[dimension]);

    // ** Step 3: Add Double-Click Event Handler to Clear Brush **
    svg.selectAll(`.brush-${dimension}`).on("dblclick", function () {
      delete activeBrushes[dimension];
      svg.selectAll(`.brush-${dimension}`).call(brushes[dimension].move, null);
    });
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

  function constructFiltersForAPI(activeBrushes) {
    const filters = {};
    Object.entries(activeBrushes).forEach(([dimension, range]) => {
      // Check if the dimension uses a numerical scale or is categorical
      if (y[dimension].invert) {
        // Assuming invertibility implies a numerical scale
        // Apply the scaling function to each range limit for numerical data
        const [y0, y1] = range;
        const scaledMin = y[dimension].invert(y0);
        const scaledMax = y[dimension].invert(y1);
        filters[dimension] = [scaledMin, scaledMax];
      } else {
        // For categorical data, range will be an array of selected categories
        filters[dimension] = range;
      }
    });
    return filters;
  }

  function brushmoved(event, dimension) {
    const selection = event.selection;

    // If selection is null, the brush is cleared
    if (!selection) {
      if (activeBrushes.hasOwnProperty(dimension)) {
        delete activeBrushes[dimension]; // Remove the dimension from active brushes
        svg
          .selectAll(`.brush-${dimension}`)
          .call(brushes[dimension].move, null); // Clear the visual brush
      }
    } else {
      activeBrushes[dimension] = selection; // Update active brushes with new range
    }

    // Apply the "AND" filtering logic across all dimensions with active brushes
    path.style("stroke-opacity", (d) => {
      return Object.entries(activeBrushes).every(([key, range]) => {
        const [y0, y1] = range;
        const value = y[key](d[key]);
        return value >= y0 && value <= y1;
      })
        ? 0.7
        : 0; // Only show lines that meet all active brush criteria
    });
    const filters = constructFiltersForAPI(activeBrushes);

    // Update choropleth map with filtered data
    updateChoropleth(filters);
    plotBubbleChart(filters);
  }
  function brushStart(event, dimension) {
    // Optional: Actions to perform when brush starts
    // For example, you might want to highlight the axis or display some information
  }

  function brushEnded(event, dimension) {
    if (!event.selection) {
      // Clear the brush for this dimension if there is no selection
      svg.select(`.brush-${dimension}`).call(brushes[dimension].move, null);
      svg.selectAll(".line").style("opacity", 0.5); // Reset opacity for all lines
    } else {
      // Continue to apply any filtering or visual changes needed when a brush is active
      const [y1, y0] = event.selection; // Get the selection bounds
      svg.selectAll(".line").style("opacity", (d) => {
        const dimValue = d[dimension];
        const scale = y[dimension]; // Ensure 'y' is accessible here
        return scale(dimValue) >= y0 && scale(dimValue) <= y1 ? 1 : 1;
      });
      const filters = constructFiltersForAPI(activeBrushes);

      // Update choropleth map with filtered data
      updateChoropleth(filters);
      plotBubbleChart(filters);
    }
  }

  function assignBrushes() {
    svg.selectAll(".brush").remove(); // Remove existing brushes to avoid duplicates

    dimensions.forEach((dimension) => {
      const brush = d3
        .brushY()
        .extent([
          [-8, 0],
          [8, height],
        ])
        .on("start", (event) => brushStart(event, dimension))
        .on("brush", (event) => brushmoved(event, dimension))
        .on("end", (event) => brushEnded(event, dimension));

      svg
        .append("g")
        .attr("class", `brush brush-${dimension}`)
        .attr("transform", `translate(${x(dimension)}, 0)`)
        .call(brush);
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

      svg.selectAll(".brush").remove();
      assignBrushes();
    });

  svg.selectAll(".axis").call(drag);
}

function plotChoropleth(filters = {}) {
  Promise.all([
    d3.json("/static/data/nyc.geojson"),
    d3.json("/api/airbnb_counts"), // Assuming initial data loading API endpoint
  ]).then(function ([geoJson, count]) {
    globalMapData.geoJson = geoJson;
    globalMapData.countsData = count;

    updateChoropleth(); // Initial plot based on full dataset
    plotBubbleChart();
  });
}

function updateChoropleth(filters = {}) {
  const width = 1000,
    height = 420;
  d3.select("#map").selectAll("svg").remove();
  const svg = d3
    .select("#map")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const projection = d3
    .geoAlbers()
    .center([0, 40.66])
    .rotate([74, 0])
    .parallels([38, 42])
    .scale(50000)
    .translate([width / 2, height / 2]);

  const path = d3.geoPath().projection(projection);

  const filteredData = abnbData.filter((record) => {
    return Object.entries(filters).every(([key, range]) => {
      if (!record.hasOwnProperty(key) || record[key] === null) {
        return false; // Ensure the record has the key and it's not null
      }
      let recordValue;
      if (!globalY[key].invert) recordValue = globalY[key](record[key]);
      else recordValue = record[key];
      const maxRange = parseFloat(range[0]);
      const minRange = parseFloat(range[1]);
      return (
        recordValue >= Math.min(minRange, maxRange) &&
        recordValue <= Math.max(maxRange, minRange)
      );
    });
  });

  const counts = filteredData.reduce((acc, curr) => {
    const borough = curr.neighbourhood_group; // Assuming 'borough' is the property name in the dataset
    acc[borough] = (acc[borough] || 0) + 1;
    return acc;
  }, {});

  const colorScale = d3
    .scaleQuantize()
    .domain([0, d3.max(Object.values(counts))])
    .range(d3.schemeBlues[9]);

  const paths = svg.selectAll("path").data(globalMapData.geoJson.features);

  paths
    .enter()
    .append("path")
    .merge(paths)
    .attr("d", path)
    .attr("fill", (d) =>
      counts[d.properties.name] ? colorScale(counts[d.properties.name]) : "#ccc"
    )
    .attr("stroke", "#000")
    .attr("stroke-width", "1.5")
    .on("mouseover", function (event, d) {
      const tooltip = d3.select("#tooltip");
      tooltip
        .style("display", "block")
        .html(
          `<strong>Borough:</strong> ${
            d.properties.name
          }<br><strong>Count:</strong> ${counts[d.properties.name] || 0}`
        )
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY + 10 + "px");
    })
    .on("mousemove", function (event) {
      d3.select("#tooltip")
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY + 10 + "px");
    })
    .on("mouseout", function () {
      d3.select("#tooltip").style("display", "none");
    });

  paths.exit().remove();
}

function aggregateDataByTag(filters) {
  const counts = {};
  const filteredData = abnbData.filter((record) => {
    return Object.entries(filters).every(([key, range]) => {
      if (!record.hasOwnProperty(key) || record[key] === null) {
        return false; // Ensure the record has the key and it's not null
      }
      let recordValue;
      if (!globalY[key].invert) recordValue = globalY[key](record[key]);
      else recordValue = record[key];
      const maxRange = parseFloat(range[0]);
      const minRange = parseFloat(range[1]);
      return (
        recordValue >= Math.min(minRange, maxRange) &&
        recordValue <= Math.max(maxRange, minRange)
      );
    });
  });
  filteredData.forEach((record) => {
    counts[record.tag] = (counts[record.tag] || 0) + 1;
  });
  const sortedCounts = Object.entries(counts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
  return sortedCounts;
}

function plotBubbleChart(filters = {}) {
  let activeTags = new Set(); // Use a Set to store unique active tags

  var bubData = aggregateDataByTag(filters);
  const width = 600,
    height = 400;
  d3.select("#bubs").selectAll("svg").remove();
  const svg = d3
    .select("#bubs")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  // Create a tooltip
  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("display", "none")
    .style("position", "absolute")
    .style("padding", "5px")
    .style("background", "white")
    .style("border", "1px solid")
    .style("border-radius", "4px");

  const pack = d3.pack().size([width, height]).padding(2);

  const root = d3.hierarchy({ children: bubData }).sum((d) => d.count); // Set the size of bubbles based on the count of tags

  const bubbles = pack(root).leaves();

  const color = d3.scaleOrdinal(d3.schemeCategory10);

  svg
    .selectAll("circle")
    .data(bubbles)
    .enter()
    .append("circle")
    .attr("cx", (d) => d.x)
    .attr("cy", (d) => d.y)
    .attr("r", (d) => d.r)
    .style("fill", (d) => color(d.data.tag))
    .on("mouseover", function (e, d) {
      tooltip
        .style("display", "inline-block")
        .html(`Category: ${d.data.tag}<br/>Count: ${d.data.count}`)
        .style("left", e.pageX + 10 + "px")
        .style("top", e.pageY - 10 + "px")
        .style("font-size", "10px");
    })
    .on("mouseout", function () {
      tooltip.style("display", "none");
    })
    .on("click", function (e, d) {
      // Toggle class for highlighting
      console.log("Clicked");
      const isActive = d3.select(this).classed("active");
      d3.select(this)
        .classed("active", !isActive)
        .style("stroke-width", isActive ? 0 : 5) // Increased stroke width for highlight
        .style("stroke", isActive ? "black" : "blue");
      if (!isActive) {
        activeTags.add(d.data.tag); // Add tag to active filters
      } else {
        activeTags.delete(d.data.tag); // Remove tag from active filters
      }

      drawPCP("#pcp-chart", pcp_data, pcp_clusters, Array.from(activeTags));
    });

  svg
    .selectAll("text")
    .data(bubbles)
    .enter()
    .append("text")
    .attr("x", (d) => d.x - 15)
    .attr("y", (d) => d.y + 4) // Adjust y position to be more centered
    .text((d) => d.data.tag)
    .style("font-size", "9px");
}

function drawMDSPlot(data) {
  const height = 400; // Adjusted height
  const width = 450; // Adjusted width
  const svg = d3
    .select("#mds-container")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const nodeIds = new Set(data.nodes.map((node) => node.id));
  const isEveryLinkValid = data.links.every(
    (link) => nodeIds.has(link.source) && nodeIds.has(link.target)
  );

  if (!isEveryLinkValid) {
    console.error("Some links refer to non-existent nodes");
    return; // It's good practice to halt execution if the data is not valid.
  }

  const simulation = d3
    .forceSimulation(data.nodes)
    .force(
      "link",
      d3
        .forceLink(data.links)
        .id((d) => d.id)
        .distance(60)
    )
    .force("charge", d3.forceManyBody().strength(-3000))
    .force("center", d3.forceCenter(width / 2 - 50, height / 2));

  const links = svg
    .selectAll("line")
    .data(data.links)
    .enter()
    .append("line")
    .attr("stroke", "#ddd")
    .attr("stroke-opacity", 0.6)
    .attr("stroke-width", (d) => Math.sqrt(Math.abs(d.value)) * 2);

  const nodes = svg
    .selectAll("circle")
    .data(data.nodes)
    .enter()
    .append("circle")
    .attr("r", 5)
    .attr("fill", "#fd5c63")
    .style("cursor", "pointer")
    .call(drag(simulation));

  const labels = svg
    .selectAll("text")
    .data(data.nodes)
    .enter()
    .append("text")
    .text((d) => d.name)
    .attr("font-size", "12px")
    .style("fill", "black")
    .attr("dx", 10) // Offset the label by 10 units right
    .attr("dy", 4); // Offset the label by 4 units down

  // Update positions on each tick of the simulation
  simulation.on("tick", () => {
    links
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    nodes.attr("cx", (d) => d.x).attr("cy", (d) => d.y);

    labels.attr("x", (d) => d.x + 10).attr("y", (d) => d.y + 4);
  });
}

function drag(simulation) {
  return d3
    .drag()
    .on("start", function (event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    })
    .on("drag", function (event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    })
    .on("end", function (event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    });
}

function drawViolinPlot(selectedHeader, data) {
  const container = d3.select("#pie-chart");
  container.selectAll("*").remove();

  const margin = { top: 30, right: 30, bottom: 70, left: 60 },
    width = 700 - margin.left - margin.right, // Increased width
    height = 400 - margin.top - margin.bottom;

  const svg = container
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Create the x-scale for the violin plot
  const x = d3
    .scaleBand()
    .range([0, width])
    .domain(data.map((d) => d.neighbourhood_group))
    .padding(0.1);

  svg
    .append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x));

  // Adjusting y-scale to focus on data within 1.5 IQR to reduce impact of outliers
  const scores = data.map((d) => +d[selectedHeader]);
  const q1 = d3.quantile(scores.sort(d3.ascending), 0.25);
  const q3 = d3.quantile(scores, 0.75);
  const iqr = q3 - q1;
  const min = q1 - 1.5 * iqr;
  const max = q3 + 1.5 * iqr;

  const y = d3
    .scaleLinear()
    .domain([Math.max(min, d3.min(scores)), Math.min(max, d3.max(scores))])
    .range([height, 0]);

  svg.append("g").call(d3.axisLeft(y));

  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0)
    .style("position", "absolute")
    .style("text-align", "center")
    .style("width", "160px")
    .style("height", "50px")
    .style("padding", "2px")
    .style("font", "12px sans-serif")
    .style("background", "lightsteelblue")
    .style("border", "0px")
    .style("border-radius", "8px")
    .style("pointer-events", "none");

  // Group data by neighbourhood_group and compute density
  const grouped = data.reduce((acc, d) => {
    acc[d.neighbourhood_group] = acc[d.neighbourhood_group] || [];
    acc[d.neighbourhood_group].push(+d[selectedHeader]);
    return acc;
  }, {});

  const densityData = Object.keys(grouped).map((group) => {
    const stats = calculateStatistics(grouped[group]);
    return {
      key: group,
      value: kernelDensityEstimator(
        kernelEpanechnikov(7),
        y.ticks(40)
      )(grouped[group]),
      median: stats.median,
      q1: stats.q1,
      q3: stats.q3,
    };
  });

  // Assuming each 'g' element already contains the full data object from 'densityData'
  svg
    .selectAll("myViolin")
    .data(densityData)
    .enter()
    .append("g")
    .attr("transform", (d) => `translate(${x(d.key) + x.bandwidth() / 2},0)`)
    .each(function (d) {
      // Store stats as data attributes
      d3.select(this).attr("data-median", d.median);
      d3.select(this).attr("data-q1", d.q1);
      d3.select(this).attr("data-q3", d.q3);
    })
    .append("path")
    .datum((d) => d.value) // Bind the 'value' (density data) specifically here
    .attr(
      "d",
      d3
        .area()
        .x0((v) => -x.bandwidth() * v[1] * 3)
        .x1((v) => x.bandwidth() * v[1] * 3)
        .y((v) => y(v[0]))
        .curve(d3.curveCatmullRom)
    )
    .style("fill", "red") // Uniform red color
    .style("opacity", 0.7);

  // Adding box plot elements within each violin for median and interquartile range
  densityData.forEach((group) => {
    const median = d3.median(grouped[group.key]);
    const q1 = d3.quantile(grouped[group.key].sort(d3.ascending), 0.25);
    const q3 = d3.quantile(grouped[group.key], 0.75);

    // Adding median line
    svg
      .append("line")
      .attr("x1", x(group.key) + x.bandwidth() / 2 - 10)
      .attr("x2", x(group.key) + x.bandwidth() / 2 + 10)
      .attr("y1", y(median))
      .attr("y2", y(median))
      .attr("stroke", "black")
      .attr("stroke-width", 2); // Highlight median

    // Adding box for IQR
    svg
      .append("rect")
      .attr("x", x(group.key) + x.bandwidth() / 2 - 10)
      .attr("width", 20)
      .attr("y", y(q3))
      .attr("height", y(q1) - y(q3))
      .attr("stroke", "black")
      .style("fill", "#d62728")
      .style("opacity", 0.5)
      .on("mouseover", (event, d) => {
        tooltip.transition().duration(200).style("opacity", 0.9);
        tooltip
          .html(`Median: ${median}<br>Q1: ${q1}<br>Q3: ${q3}`)
          .style("left", event.pageX + "px")
          .style("top", event.pageY - 28 + "px");
      })
      .on("mouseout", () => {
        tooltip.transition().duration(500).style("opacity", 0);
      });
  });

  // Helper functions for kernel density estimator
  function kernelDensityEstimator(kernel, X) {
    return function (V) {
      return X.map((x) => [x, d3.mean(V, (v) => kernel(x - v))]);
    };
  }

  function kernelEpanechnikov(k) {
    return (v) => (Math.abs((v /= k)) <= 1 ? (0.75 * (1 - v * v)) / k : 0);
  }

  function calculateStatistics(values) {
    const sorted = values.slice().sort(d3.ascending);
    return {
      median: d3.quantile(sorted, 0.5),
      q1: d3.quantile(sorted, 0.25),
      q3: d3.quantile(sorted, 0.75),
    };
  }
}
