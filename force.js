var color = d3.scaleOrdinal(d3.schemeCategory20);
var svg = d3.select("svg"),
    width = +svg.attr("width"),
    height = +svg.attr("height");
    // Define the div for the tooltip
    var div = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);
var simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(function(d) { return d.id; }))
    .force("charge", d3.forceManyBody().strength( function( d){ return Math.min(-d.money/5000);}))
	.force("collide", d3.forceCollide().radius(20))
    .force("center", d3.forceCenter(width / 2, height / 3));


function drawForce(nodes, links){
var graph = {nodes:nodes, links:links};
var link = svg.append("g")
    .attr("class", "links")
  .selectAll("line")
  .data(graph.links)
  .enter().append("line")
    .attr("stroke-width", function(d) { return Math.sqrt(d.value); });

var node = svg.append("g")
    .attr("class", "nodes")
  .selectAll("g")
  .data(graph.nodes,function(d){return d.id;})
  .enter().append("g")

var circles = node.append("circle")
    .attr("r", moneyRadius)
    .attr("fill", function(d, i) {
  if( d.golfer) return color(0);
  return color(i);
  }).on("mouseover", function(n) {

  d3.select(this).style("stroke","red");
  var picks = d3.selectAll("circle").data(graph.nodes.filter(function(node){
    for( i in n.picks){
      if( n.picks[i].player_bio.last_name.toLowerCase().includes(node.id.toLowerCase()))
        return true;
    }
    return false;
  }), function(d){return d.id;});
  picks.style("stroke", "red");
  })
  .on("click", function(n){
  div.transition()
              .duration(200)
              .style("opacity", .8);
  var htmlContent ="<table>";
  for( var i in n.picks){
    var purse = n.picks[i].purse;
    if( !purse) purse = 0;
    htmlContent += "<tr><td>"+n.picks[i].player_bio.last_name+"</td><td>"+parseInt(purse)+"</td></tr>";
  }
  htmlContent +="<tr><td>total</td><td>"+parseInt(n.money)+"</td></tr>";
  htmlContent +="</table>";
          div	.html(htmlContent)
              .style("left", (d3.event.pageX) + "px")
              .style("top", (d3.event.pageY - 28) + "px");
  })
  .on("mouseout", function() {
  d3.select(this).style("stroke","white");
  var links = d3.selectAll("circle").data(graph.nodes);
  links.style("stroke", "white");

  })

    .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

var lables = node.append("text")
    .text(function(d) {
      return d.label;
    })
    .attr('x', 6)
    .attr('y', 3);


simulation
    .nodes(graph.nodes)
.force("collide", d3.forceCollide().strength(.5).radius(moneyRadius).iterations(1))

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
      })
}
}
function dragstarted(d) {
  if (!d3.event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(d) {
  d.fx = d3.event.x;
  d.fy = d3.event.y;
}

function dragended(d) {
  if (!d3.event.active) simulation.alphaTarget(0);
  d.fx = null;
  d.fy = null;
}
function moneyRadius( d ){
	var r = 2;
	if( d.money && d.money > 0)
		r =  Math.sqrt(d.money/1000)/2;
	return r;
}
