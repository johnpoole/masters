function initialize() {
  if (totalContributions = 0, renderLinks = [], cands = [], pacs = [],
    contr = []) {
    var a = {};

    var categoryNodes = Object.values( targetGroup).map(function(d){
      return {value:d.total, children: d.values}
    });

    a.children = categoryNodes,
    a.PTY = "root",
    nodes = bubble.nodes(a);
    var e = 0;
    nodes.forEach(function(a) {
      2 == a.depth &&
      (nodesById[a.CAND_ID] = a,//to be used by the chord links
        a.relatedLinks = [],
        a.Amount = Number(a.Amount),
        a.currentAmount = a.Amount,
        cands.push(a), e += a.Amount)
    }),
    pacs = pacsHouse,
    c_house.forEach(function(a) {
      contr.push(a)
    })
  }
  buildChords();
  contr.forEach(function(a) {
    nodesById[a.CAND_ID].relatedLinks.push(a),
    chordsById[a.CMTE_ID].relatedLinks.push(a)
  })
}

function node_onMouseOver(a, b) {
  var c = d3.event.pageX + 15;
  if (c + 250 > window.innerWidth && (c = d3.event.pageX - 280), "CAND" == b) {
    if (a.depth < 2) return;
    toolTip.transition().duration(200).style("opacity", ".9"),
    header1.text(""),
    header.text(a.CAND_ID),
    header2.text("Forecast Payout: " + formatCurrency(Number(a.Amount))),
    toolTip.style("left", c + "px").style("top",
    d3.event.pageY - 150 + "px").style("height", "100px"),
    highlightLinks(a, !0)
  }
  else
    "CONTRIBUTION" == b ? (toolTip.transition().duration(200).style("opacity", ".9"),
  header1.text(pacsById[ "_" + a.CMTE_ID].CMTE_NM),
  header.text(a.CAND_ID),
  header2.text(formatCurrency(Number(a.Monetary)) + " on " + a.Date_received ),
  toolTip.style("left", c + "px").style("top",
  d3.event.pageY - 150 + "px").style("height", "100px"),
  highlightLink(a, !0)) : "PAC" == b && (toolTip.transition().duration(200).style("opacity", ".9"),
  header1.text("Political Action Committee"),
  header.text(pacsById[ "_" + a.label].CMTE_NM),
  header2.text("Total Contributions: " + formatCurrency(pacsById[ "_" + a.label].Amount)),
  toolTip.style("left",
  d3.event.pageX + 15 + "px").style("top",
  d3.event.pageY - 75 + "px").style("height", "110px"),
  highlightLinks(chordsById[a.label], !0))
}

function node_onMouseOut(a, b) {
  "CAND" == b ? highlightLinks(a, !1) : "CONTRIBUTION" == b ? highlightLink(a, !1) : "PAC" == b && highlightLinks(chordsById[a.label], !1), toolTip.transition().duration(500).style("opacity", "0")
}

function highlightLinks(a, b) {
  a.relatedLinks.forEach(function(a) {
    highlightLink(a, b)
  })
}

function fetchData() {
  queue()
	.defer(d3.csv, 'short.csv')
	.await(process);
}
function bubbleProcess(nodes){
  var bubbleData = [];
  nodes.forEach( function(b){
    if( b.picks)
    b.picks.forEach( function (p){
      let r ={
        Postal_code: p.Player,
        Politicial_party:b.label,
        Recipient_last_name:b.label,
        Recipient_first_name:"",
        Date_received:null,
        Monetary: p.purse
      };
    //  console.log(p.player_bio.last_name+ " "+b.label+" "+p.purse )
      bubbleData.push(r);
    })
  })
  process(null, bubbleData)
}

function process(error, data) {
  let  contributions = data.filter( function(contribution){
    return ( +contribution.Monetary > 0  );
  });

  var contributors = {};

  contributions.forEach( function(cont){//group contributions
    let key = groupBy(cont);
    if( !contributors[key] ){
      contributors[key] = cont;
      contributors[key].Monetary = +cont.Monetary;
    }
    else{
  //    contributors[key].Monetary += +cont.Monetary;
    }
  });

  contributions = Object.keys(contributors).map( function(key){
    return contributors[key];
  });

  var targets = {};
  var sources ={};
  var categories = {};

   contributions.forEach( function(contribution){
      var value = Number(contribution.Monetary);//here
      var key = targetKey( contribution);
      contribution.targetKey = key;
      if( value > 0){
        if( !targets[key] ){
          targets[key] =
            { value:value,
              pty: category( contribution),
              name:contribution.Recipient_first_name+" "+contribution.Recipient_last_name};
        }
        else{
          targets[key].value += value;
        }
        var id = sourceKey(contribution);
        if( !sources[id] ){
          sources[id] = {value:value, pty: category(contribution)};
        }else{
          //sources[id].value += value;
        }

        var catvalue = category( contribution);
        if( !categories[catvalue] ){
          categories[catvalue] = 0;
        }
      }
    });

    var categoryList = Object.keys(categories).map( function(key){
      return key;
    }).sort();
  //  console.log(categoryList );
  //  partyColorScale.domain( categoryList );
    var candidates = Object.keys(targets).map( function(key){
      var target = targets[key];
      return {Amount:target.value, CAND_ID:key, CAND_NAME:target.name, PTY:target.pty}
    });

    var pacs =   Object.keys(sources).map( function(key){
         var source = sources[key];
         return {Amount:source.value,CMTE_ID:key,CMTE_NM:key}
    }).sort( function(a,b){
      return a.Amount - b.Amount;
    });
    //.filter(function(d){return d.Amount > 3000;});

    contributions =  contributions
    /*.filter( function( d){
        let f = false;
        pacs.forEach(function(pac){
          if( sourceKey(d) == pac.CMTE_ID)
            f = true;
        });
        return f;
      });*/
  onFetchCandidatesHouse(candidates);
  onFetchContributionsHouse(contributions);
  onFetchPacsHouse(pacs);
  main();
}

var targetGroup = {};

function onFetchCandidatesHouse(candidates) {//parties
  candidates.forEach( function (candidate){
    candidate.value = Number(candidate.Amount);

    if( !targetGroup[candidate.PTY] ){
      targetGroup[candidate.PTY] = {};
      targetGroup[candidate.PTY].values = [];
      targetGroup[candidate.PTY].total = 0;
    }
    targetGroup[candidate.PTY].values.push(candidate);
    targetGroup[candidate.PTY].total += candidate.value;
  })
}

function onFetchContributionsHouse(contributions) {
  contributions.forEach(function(contribution, b) {
    contribution.CAND_ID = contribution.targetKey;
    contribution.CMTE_ID = sourceKey(contribution);
    contribution.Key = "H" + b,
    contributions.push(contribution),
    c_house.push(contribution)
  })
}

function onFetchPacsHouse(a) {//postal codes
  pacsHouse = a;
  pacsHouse.forEach( function( p ){
    pacsById["_" + p.CMTE_ID] = p;
  })
}

function buildChords() {
  var a = [];
  labels = [], chords = [], labelChords = [];
  for (var b = 0; b < pacs.length; b++) {
    var c = {};
    c.index = b, c.label = "null", c.angle = 0, labels.push(c);
    var d = {};
    d.label = "null", d.source = {}, d.target = {}, chords.push(d)
  }
  buf_indexByName = indexByName, indexByName = [], nameByIndex = [], n = 0;

  pacs.forEach(function(a) {
    a = a.CMTE_ID, a in indexByName || (nameByIndex[n] = a, indexByName[a] = n++)
  }),

  pacs.forEach(function(b) {
    var c = indexByName[b.CMTE_ID],
      d = a[c];
    if (!d) {
      d = a[c] = [];
      for (var f = -1; ++f < n;)
        d[f] = 0
    }
    d[indexByName[b.CMTE_ID]] = Number(b.Amount)
  }),

  chord.matrix(a);
  chords = chord.chords();

  chords.forEach(function(a) {
    a.label = nameByIndex[a.source.index],
    a.angle = (a.source.startAngle + a.source.endAngle) / 2;

    var c = {};
    c.startAngle = a.source.startAngle,
    c.endAngle = a.source.endAngle,
     c.index = a.source.index,
     c.value = a.source.value,
     c.currentAngle = a.source.startAngle,
     c.currentLinkAngle = a.source.startAngle,
     c.Amount = a.source.value,
     c.source = a.source,
     c.relatedLinks = [],
     chordsById[a.label] = c;

    var d = {};
    d.startAngle = a.source.startAngle - Math.PI / 2 / 2,
    d.endAngle = a.source.endAngle + Math.PI / 2 / 2,
    d.angle = a.angle + Math.PI / 2,
    d.label = a.label,
    labelChords.push(d)
  })
}

function updateLinks(a) {
  function connections(a) {
    var b = {},
      c = {},
      d = {},
      e = {},
      f = {},
      g = chordsById[a.CMTE_ID],
      h = nodesById[a.CAND_ID],
      i = linkRadius,
      j = (i * Math.cos(g.currentLinkAngle - 1.57079633),
      i * Math.sin(g.currentLinkAngle - 1.57079633), g.currentLinkAngle - 1.57079633);

    g.currentLinkAngle = g.currentLinkAngle + Number(a.Monetary) / g.value * (g.endAngle - g.startAngle);
    var k = g.currentLinkAngle - 1.57079633;
    return c.x = i * Math.cos(j),
    c.y = i * Math.sin(j),
     b.x = h.x - (chordsTranslate - nodesTranslate),
      b.y = h.y - (chordsTranslate - nodesTranslate),
      f.x = i * Math.cos(k), f.y = i * Math.sin(k),
      d.source = c,
      d.target = b,
       e.source = b,
       e.target = f,
       [d, e]
  }
  linkGroup = linksSvg.selectAll("g.links").data(a, function(a, b) {
    return a.Key
  });
  var c = linkGroup.enter().append("g").attr("class", "links");
  linkGroup.transition();
  c.append("g").attr("class", "arc").append("path").attr("id", function(a) {
    return "a_" + a.Key
  }).style("fill", function(a) {
    return partyColor( a.Politicial_party )
  }).style("fill-opacity", .2).attr("d", function(a, b) {
    var c = {},
    d = chordsById[a.CMTE_ID];
    c.startAngle = d.currentAngle,
    d.currentAngle = d.currentAngle + Number(a.Monetary) / d.value * (d.endAngle - d.startAngle),
    c.endAngle = d.currentAngle,
    c.value = Number(a.Monetary);
    var e = d3.svg.arc(a, b).innerRadius(linkRadius).outerRadius(innerRadius);
    return totalContributions += c.value, total.text(formatCurrency(totalContributions)), e(c, b)
  }).on("mouseover", function(a) {
    node_onMouseOver(a, "CONTRIBUTION")
  }).on("mouseout", function(a) {
    node_onMouseOut(a, "CONTRIBUTION")
  }), c.append("path").attr("class", "link").attr("id", function(a) {
    return "l_" + a.Key
  }).attr("d", function(a, c) {
    a.links = connections(a);
    var d = diagonal(a.links[0], c);
    return d += "L" + String(diagonal(a.links[1], c)).substr(1), d += "A" + linkRadius + "," + linkRadius + " 0 0,0 " + a.links[0].source.x + "," + a.links[0].source.y
  }).style("stroke", function(a) {
    return partyColor( a.Politicial_party )
  }).style("stroke-opacity", .07).style("fill-opacity", .1).style("fill", function(a) {
    return partyColor( a.Politicial_party )
  }).on("mouseover", function(a) {
    node_onMouseOver(a, "CONTRIBUTION")
  }).on("mouseout", function(a) {
    node_onMouseOut(a, "CONTRIBUTION")
  }), c.append("g").attr("class", "node").append("circle").style("fill", function(a) {
    return partyColor( a.Politicial_party )
  }).style("fill-opacity", .2).style("stroke-opacity", 1).attr("r", function(a) {
    var b = nodesById[a.CAND_ID];
    b.currentAmount = b.currentAmount - Number(a.Monetary);
    var c = (b.Amount - b.currentAmount) / b.Amount;
    return b.r * c
  }).attr("transform", function(a, b) {
    return "translate(" + a.links[0].target.x + "," + a.links[0].target.y + ")"
  }), linkGroup.exit().remove()
}

function updateNodes() {
  var a = nodesSvg.selectAll("g.node").data(cands, function(a) {
      return a.CAND_ID
    }),
    b = a.enter().append("g").attr("class", "node").attr("transform", function(a) {
      return "translate(" + a.x + "," + a.y + ")"
    });
  b.append("circle").attr("r", function(a) {
    return a.r
  }).style("fill-opacity", function(a) {
    return a.depth < 2 ? 0 : .05
  }).style("stroke", function(a) {
    return partyColor( a.PTY )
  }).style("stroke-opacity", function(a) {
    return a.depth < 2 ? 0 : .2
  }).style("fill", function(a) {
    return partyColor( a.PTY )
  });
  var c = b.append("g").attr("id", function(a) {
    return "c_" + a.CAND_ID
  }).style("opacity", 0);
  c.append("circle").attr("r", function(a) {
    return a.r + 2
  }).style("fill-opacity", 0).style("stroke", "#FFF").style("stroke-width", 2.5).style("stroke-opacity", .7), c.append("circle").attr("r", function(a) {
    return a.r
  }).style("fill-opacity", 0).style("stroke", "#000").style("stroke-width", 1.5).style("stroke-opacity", 1).on("mouseover", function(a) {
    node_onMouseOver(a, "CAND")
  }).on("mouseout", function(a) {
    node_onMouseOut(a, "CAND")
  }), a.exit().remove().transition(500).style("opacity", 0)
}

function updateChords() {
  var a = chordsSvg.selectAll("g.arc").data(chords, function(a) {
      return a.label
    }),
    b = a.enter().append("g").attr("class", "arc"),
    c = defs.selectAll(".arcDefs").data(labelChords, function(a) {
      return a.label
    });
  c.enter().append("path").attr("class", "arcDefs").attr("id", function(a, b) {
    return "labelArc_" + a.label
  }), b.append("path").style("fill-opacity", 0).style("stroke", "#555").style("stroke-opacity", .4), b.append("text").attr("class", "chord").attr("id", function(a) {
    return "t_" + a.label
  }).on("mouseover", function(a) {
    node_onMouseOver(a, "PAC")
  }).on("mouseout", function(a) {
    node_onMouseOut(a, "PAC")
  }).style("font-size", "0px").style("fill", "#777").append("textPath").text(function(a) {
    return pacsById[ "_" + a.label].CMTE_NM
  }).attr("text-anchor", "middle").attr("startOffset", "50%").style("overflow", "visible").attr("xlink:href", function(a, b) {
    return "#labelArc_" + a.label
  }), c.attr("d", function(a, b) {
    var c = d3.svg.arc().innerRadius(1.05 * innerRadius).outerRadius(1.05 * innerRadius)(a),
      d = /[Mm][\d\.\-e,\s]+[Aa][\d\.\-e,\s]+/,
      e = d.exec(c)[0];
    return e
  }), a.transition().select("path").attr("d", function(a, b) {
    var c = d3.svg.arc(a, b).innerRadius(.95 * innerRadius).outerRadius(innerRadius);
    return c(a.source, b)
  }), c.exit().remove(), a.exit().remove()
}

function trimLabel(a) {
  return a.length > 25 ? String(a).substr(0, 25) + "..." : a
}

function getChordColor(a) {
  var b = nameByIndex[a];
  return void 0 == colorByName[b] && (colorByName[b] = fills(a)), colorByName[b]
}

function main() {
  initialize(), updateNodes(), updateChords(), intervalId = setInterval(onInterval, .01)
}

function onInterval() {
  if (0 == contr.length)
    clearInterval(intervalId);
  else {
    for (var a = 0; counter > a; a++)
      contr.length > 0 && renderLinks.push(contr.pop());
    counter = 30, updateLinks(renderLinks)
  }
}
var maxWidth = Math.max(600, Math.min(window.innerWidth, window.innerHeight)),
  outerRadius = maxWidth / 2,
  innerRadius = .9 * outerRadius,
  bubbleRadius = innerRadius - 50,
  linkRadius = .95 * innerRadius,
  nodesTranslate = outerRadius - innerRadius + (innerRadius - bubbleRadius),
  chordsTranslate = outerRadius;

d3.select(document.getElementById("mainDiv")).style("width", 2 * outerRadius + "px").style("height", 2 * outerRadius + "px"), d3.select(document.getElementById("bpg")).style("width", 2 * outerRadius + 100 + "px");
var svg = d3.select(document.getElementById("svgDiv")).style("width", 2 * outerRadius + 200 + "px").style("height", 2 * outerRadius + 200 + "px").append("svg").attr("id", "svg").style("width", 2 * outerRadius + 200 + "px").style("height", 2 * outerRadius + 200 + "px"),
  defs = svg.append("defs").append("g").attr("transform", "translate(" + chordsTranslate + "," + chordsTranslate + ")"),
  topMargin = .15 * innerRadius,
  chordsSvg = svg.append("g").attr("class", "chords").attr("transform", "translate(" + chordsTranslate + "," + (chordsTranslate + topMargin) + ")"),
  linksSvg = svg.append("g").attr("class", "links").attr("transform", "translate(" + chordsTranslate + "," + (chordsTranslate + topMargin) + ")"),
  highlightSvg = svg.append("g").attr("transform", "translate(" + chordsTranslate + "," + (chordsTranslate + topMargin) + ")").style("opacity", 0),
  highlightLink = highlightSvg.append("path"),
  nodesSvg = svg.append("g").attr("class", "nodes").attr("transform", "translate(" + nodesTranslate + "," + (nodesTranslate + topMargin) + ")"),
  bubble = d3.layout.pack().sort(null).size([2 * bubbleRadius, 2 * bubbleRadius]).padding(1.5),
  chord = d3.layout.chord().padding(.05).sortSubgroups(d3.descending).sortChords(d3.descending),
  diagonal = d3.svg.diagonal.radial(),
  arc = d3.svg.arc().innerRadius(innerRadius).outerRadius(innerRadius + 10),
  diameter = 960,
  format = d3.format(",d"),
  color = d3.scale.category20c(),
  toolTip = d3.select(document.getElementById("toolTip")),
  header = d3.select(document.getElementById("head")),
  header1 = d3.select(document.getElementById("header1")),
  header2 = d3.select(document.getElementById("header2")),
  total = d3.select(document.getElementById("totalDiv")),
  fills = d3.scale.ordinal().range(["#00AC6B", "#20815D", "#007046", "#35D699", "#60D6A9"]),
  linkGroup,
  cands = [],
  pacs = [],
  pacsHouse = [],
  contr = [],
  h_dems = [],
  h_reps = [],
  h_others = [],
  house = [];
  total_hDems = 0,  total_hReps = 0,  total_hOthers = 0,
  contributions = [],  c_house = [], pacs = [], pacsById = {}, chordsById = {}, nodesById = {}, chordCount = 20,
   pText = null, pChords = null, nodes = [], renderLinks = [], colorByName = {}, totalContributions = 0, delay = 2;
var formatNumber = d3.format(",.0f"),
  formatCurrency = function(a) {
    return "$" + formatNumber(a)
  },
  buf_indexByName = {},
  indexByName = {},
  nameByIndex = {},
  labels = [],
  chords = [];
highlightLink = function(a, b) {
  var c = 1 == b ? .6 : .1,
    d = d3.select(document.getElementById("l_" + a.Key));
  d.transition(1 == b ? 150 : 550).style("fill-opacity", c).style("stroke-opacity", c);
  var e = d3.select(document.getElementById("a_" + a.Key));
  e.transition().style("fill-opacity", 1 == b ? c : .2);
  var f = d3.select(document.getElementById("c_" + a.CAND_ID));
  f.transition(1 == b ? 150 : 550).style("opacity", 1 == b ? 1 : 0);
  var g = d3.select(document.getElementById("t_" + a.CMTE_ID));
  g.transition(1 == b ? 0 : 550).style("fill", 1 == b ? "#000" : "#777").style("font-size", 1 == b ? Math.round(.035 * innerRadius) + "px" : "0px")
};

var partyColorScale  = d3.scale.ordinal()
  .domain(["Bloc Québécois", "Christian Heritage Party of Canada", "Conservative Party of Canada", "Green Party of Canada", "Liberal Party of Canada", "Libertarian Party of Canada", "National Advancement Party of Canada", "New Democratic Party", "No Affiliation", "Progressive Canadian Party", "Rhinoceros Party"])
  .range(["#093c71","black","#0C6AAA","#3d9b35","#D71B1E", "black","black", "#F37022","black","black"]);

function partyColor( party){
  return partyColorScale( party);
}

function targetKey( object){
  return object.Recipient_first_name+" "+object.Recipient_last_name;
}
function sourceKey( object){
    //return source.City.toUpperCase();//
  return object.Postal_code.toUpperCase().substring(0,10)
  //return source.Contributor_last_name;
}

function groupBy( object){
 return object.Postal_code.toUpperCase().substring(0,1)+object.Politicial_party+object.Recipient_first_name+object.Recipient_last_name;
}

function category( object){
 return object.Politicial_party;
}

//fetchData();
var intervalId, counter = 2,
renderLinks = [];
