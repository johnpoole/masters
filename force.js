var color = d3.scaleOrdinal(d3.schemeTableau10);

function drawForce(nodes, links) {
    var svg = d3.select("svg#forceGraph"),
        width = +svg.attr("width"),
        height = +svg.attr("height");

    var div = d3.select("div.tooltip");

    var simulation = d3.forceSimulation()
        .force("link", d3.forceLink().id(function(d) { return d.id; }))
        .force("charge", d3.forceManyBody().strength(function(d) {
            return Math.min(-100, -d.money / 5000);
        }))
        .force("collide", d3.forceCollide().radius(function(d) {
            return moneyRadius(d) + 2;
        }))
        .force("center", d3.forceCenter(width / 2, height / 3));

    var graph = { nodes: nodes, links: links };

    var link = svg.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(graph.links)
        .enter().append("line")
        .attr("stroke-width", function(d) { return Math.sqrt(d.value); });

    var node = svg.append("g")
        .attr("class", "nodes")
        .selectAll("g")
        .data(graph.nodes, function(d) { return d.id; })
        .enter().append("g");

    var circles = node.append("circle")
        .attr("r", moneyRadius)
        .attr("fill", function(d, i) {
            if (d.golfer) return color(0);
            return color(i % 10);
        })
        .on("mouseover", function(event, n) {
            d3.select(this).style("stroke", "red");
            if (!n.picks) return;
            var pickNames = n.picks.map(function(p) {
                return p.Player.toLowerCase();
            });
            d3.selectAll("circle").each(function(d) {
                if (d && pickNames.some(function(name) {
                    return d.id && d.id.toLowerCase().includes(name);
                })) {
                    d3.select(this).style("stroke", "red");
                }
            });
        })
        .on("click", function(event, n) {
            if (!n.picks) return;
            div.transition()
                .duration(200)
                .style("opacity", 0.8);
            var htmlContent = "<table>";
            n.picks.forEach(function(p) {
                var purse = p.purse || 0;
                htmlContent += "<tr><td>" + p.Player + "</td><td>$" + parseInt(purse) + "</td></tr>";
            });
            htmlContent += "<tr><td><b>Total</b></td><td><b>$" + parseInt(n.money) + "</b></td></tr>";
            htmlContent += "</table>";
            div.html(htmlContent)
                .style("left", (event.pageX) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).style("stroke", "white");
            d3.selectAll(".nodes circle").style("stroke", "white");
        })
        .call(d3.drag()
            .on("start", function(event, d) {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on("drag", function(event, d) {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on("end", function(event, d) {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            }));

    node.append("text")
        .text(function(d) { return d.label; })
        .attr("x", 6)
        .attr("y", 3);

    simulation
        .nodes(graph.nodes)
        .force("collide", d3.forceCollide().strength(0.5).radius(moneyRadius).iterations(1))
        .on("tick", ticked);

    simulation.force("link")
        .links(graph.links);

    function ticked() {
        link
            .attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });

        node
            .attr("transform", function(d) {
                return "translate(" + d.x + "," + d.y + ")";
            });
    }
}

function moneyRadius(d) {
    var r = 2;
    if (d.money && d.money > 0)
        r = Math.sqrt(d.money / 1000) / 2;
    return Math.max(r, 2);
}
