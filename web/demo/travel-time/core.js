
$LAB
.setOptions({AlwaysPreserveOrder: true})
.script("lib/polymaps.min.js")
.script("lib/jquery-1.5.min.js")
.script("lib/jquery-ui-1.8.10.custom.min.js")
.script("lib/protovis-r3.2.js")
.script("lib/utils.js")
// NOTE: this content is wrapped in a loadTaz() callback
.script("taz.js")
.wait(function() {
	try {
		initialize();
	} catch (e) {
		alert(e);
	}
});

var sourceTemplate = "http://geo.stamen.com/mtcscs/scenarios/2005/time/{period}/from/{taz}.csv";
var features, map;
function loadTaz(collection) {
	// console.log(["loadTaz()", collection]);
	features = collection.features;
}

function initialize() {
	var po = org.polymaps;

	var container = $("#map");
	map = po.map()
		.container(container[0].appendChild(po.svg("svg")));

	// TODO: click legend items to filter
	var legend = $('<div id="legend"/>')
		.appendTo(container);
	legend.append($("<label/>").text("Legend:"))
	function updateLegend(sc) {
		legend.children().not("label").remove();
		var keys = sc.domain(),
				values = sc.range(),
				len = keys.length;
		for (var i = 0; i < len; i++) {
			var k = keys[i], v = values[i];
			$("<span/>").text(k).css("background", v).appendTo(legend);
		}
	}
	
	map.center({lon: -122.2757, lat: 37.8355})
	map.zoom(10);
	map.zoomRange([9, 12]);

	var taz = po.geoJson()
		.url(null)
		.tile(false)
		.zoom(10); // map zoom +/- 2

	var base = po.image()
		.url("http://a.acetate.geoiq.com/tiles/acetate-base/{Z}/{X}/{Y}.png");
	var roads = po.image()
		.url("http://a.acetate.geoiq.com/tiles/acetate-roads/{Z}/{X}/{Y}.png");
	var labels = po.image()
		.url("http://a.acetate.geoiq.com/tiles/acetate-labels/{Z}/{X}/{Y}.png");

	map.add(base);
	map.add(taz);
	map.add(roads);
	map.add(labels);
	map.add(po.interact());
	map.add(po.compass()
	    .pan("none"));
	map.add(po.hash());

	$(roads.container())
		.css("opacity", .5)
		.css("-webkit-opacity", .5)
		.css("-moz-opacity", .5);
	$(roads.container())
		.css("pointer-events", "none");
	$(labels.container())
		.css("pointer-events", "none");

	var config = {};
	config.mapColors = ["white", "rgb(158,202,225)", "red"];	
	var scale = pv.Scale.linear()
		.domain(0,1000000)
		.range(config.mapColors[0],  config.mapColors[2])
		.by(price);

	updateLegend(scale);

	var thresholdMin = 0;
	var thresholdMax = 1000000;

	function update() {
		$("#price .min").text(formatPrice(thresholdMin));
		$("#price .max").text(formatPrice(thresholdMax));
		var count = taz.features().filter(inBounds).length;
		$("#price .count").text(commize(count));

		// var t = timer().start();
		taz.reshow();
		// var took = t.end();
		// $("#timer").text("(took " + took + "ms)");
		return false;
	}
	
	function setSlider(min, max, step){
		var _options = {};
		_options.min = min;
		_options.max = max;
		_options.values = [ thresholdMin , thresholdMax ];
		_options.step = step;
		_options.disabled = false;
		$( "#price .slider" ).slider( "option", _options );
	}
	
	function inBounds(feature) {
		var p = price(feature);
		return p >= thresholdMin && p <= thresholdMax;
	}

	function price(feature) {
		return feature.properties.average_value_per_unit;
	}

	function formatPrice(p) {
		return "$" + commize(p);
	}

	function tazid(feature) {
		return "taz" + feature.properties["TAZ1454"];
	}

	var style = po.stylist();
	style.attr("id", tazid)
	style.title(function(feature) {
		return feature.properties["TAZ1454"] + ": " + formatPrice(price(feature));
	});
	
	// color code fill based on home price value
	style.attr("fill", function(feature) {
		if (inBounds(feature)) {
			var color = scale(feature).color;
			// console.log(value + " -> " + color);
			return color;
		} else {
			return "#ccc";
		}
	});
	
	
	//hide features that don't meet our critera
	style.attr("display", function(feature) {
		if (inBounds(feature)) {
			return "";
		} else {
			return "none";
		}
	});
	
	
	/* SLIDER INIT */
	$( "#price .slider" ).slider({
		range: true,
		slide: function( event, ui ) {
			thresholdMin = ui.values[0];
			thresholdMax = ui.values[1];
			update();
		} 
	});

	// style these only once
	taz.on("load", po.stylist()
		.attr("stroke", "#999")
		.attr("stroke-width", .2));

	taz.on("load", function(e) {
		var features = e.features,
				len = e.features.length;
		for (var i = 0; i < len; i++) {
			var element = e.features[i].element,
					feature = e.features[i].data,
					a = po.svg("a");
			var id = tazid(feature);
			feature.id = id.replace(/^taz/, '');
			a.setAttributeNS(po.ns.xlink, "href", "#" + id);
			element.parentNode.insertBefore(a, element);
			a.appendChild(element);
		}
	});

	taz.on("show", style);

	$("#status").attr("class", "loading").text("Loading...");

	// console.log(["loaded!", features.length]);

	features = features.filter(price); // filter out zeros
	// features.pop();
	// console.log(features.map(price));

	var len = features.length;

	var min = pv.min(features, price),
			median = pv.median(features, price),
			max = pv.max(features, price);

	$("#status").attr("class", "loaded").text("Loaded " + commize(len) + " TAZs");

	var step = 100000;
	function priceGroup(feature) {
		return Math.round(price(feature) / step) * step;
	}
	
	var priceGroups = {};
	for (var i = 0; i < len; i++) {
		var g = features[i].properties.priceGroup = priceGroup(features[i]);
		if (typeof priceGroups[g] != "undefined") {
			priceGroups[g]++;
		} else {
			priceGroups[g] = 1;
		}
	}
	priceGroups = pv.entries(priceGroups)
		.map(function(entry) {
			return {min: parseInt(entry.key),
							max: parseInt(entry.key) + step,
							count: entry.value};
		})
		.sort(function(a, b) {
			return a.min - b.min;
		});
	// console.log(priceGroups);

	/*
	var table = $("#controls .groups tbody");
	for (var i = 0; i < priceGroups.length; i++) {
		var group = priceGroups[i],
				row = $("<tr/>").appendTo(table),
				key = $("<td/>").appendTo(row),
				value = $("<td/>").appendTo(row);
		key.text("<= " + formatPrice(group.max));
		value.text(group.count);
	}
	*/

	var container = $("#price .graph div.canvas");
	var size = {x: container.innerWidth(), y: 80},
			graph = new pv.Panel()
				.canvas(container[0])
				.width(size.x)
				.height(size.y);

	var x = pv.Scale.ordinal(pv.keys(priceGroups)).by(pv.index).splitBanded(0, size.x),
			h = pv.Scale.linear(priceGroups, prop("count").get).range(1, size.y - 15);

	var c = scale.by(pv.identity);

	var bars = graph.add(pv.Bar)
		.data(priceGroups)
		.fillStyle(function(g) {
				// console.log(g);
			return c(g.min + (g.max - g.min) / 2);
		})
		.left(x)
		.bottom(15)
		.width(x.range().band - 1)
		.height(function(g) { return h(g.count); });

	x = pv.Scale.linear(min, max).range(0, size.x - 1);
	var rules = graph.add(pv.Rule)
		.data([median])
		.strokeStyle("#999")
		.left(x)
		.top(0)
		.height(size.y - 13)
		.anchor("bottom")
			.add(pv.Label)
			.text(formatPrice)
			.textStyle("white")
			.textMargin(2)
			.textAlign(function(v) {
				switch (v) {
					case min:
					case median:
						return "left";
					case max:
						return "right";
				}
				return "center";
			})
			.textBaseline("top");

	graph.render();

	thresholdMin = min;
	thresholdMax = max;

	scale.domain(min, max);
	scale.nice();

	taz.features(features);
	setSlider(min, max, step);
	update();
	initGeocoding();

	/**
	 * Travel time
	 */
	$(taz.container()).click(function(e) {
		var target = e.target.id;
		loadTazData(target.replace(/^taz/, ''))
	});

	var travelTimes = {},
			mode = $("#mode").val(),
			period = $("#period").val();

	var NULL_VALUE = -999.0,
			selected;

	$("#mode").change(function() {
		mode = $(this).val();
		updateTravelTimes();
	});

	$("#period").change(function() {
		period = $(this).val();
		updateDataTemplate();
	});

	var dataTemplate;
	function updateDataTemplate() {
		dataTemplate = sourceTemplate.replace("{period}", period);
		if (selected) {
			loadTazData(selected.id.replace(/^taz/, ''));
		}
	}

	updateDataTemplate();

	function updateTravelTimes(times) {
		if (times) travelTimes = times;
		else if (!selected) return;

		function time(feature) {
			var t = travelTimes[feature.id];
			if (!t) {
				// console.log(["no entry for", id, feature]);
				throw new Error();
			}
			return t ? t[mode] : NULL_VALUE;
		}

		var values = features.map(time).filter(function(n) {
			return n != NULL_VALUE;
		});

		var min = pv.min(values),
				median = pv.median(values),
				max = pv.max(values);
		// console.log([min, median, max]);

		min = 15;
		median = 30;
		max = 60;

		scale = pv.Scale.linear()
			.domain(NULL_VALUE, min, median, max)
			.range("rgba(255,255,255,.1)", "#006837", "#78C679", "#FFFFCC")
			.by(time);

		updateLegend(scale);

		update();
	}

	function loadTazData(id) {
		var url = dataTemplate.replace("{taz}", id);

		if (selected) {
			selected.setAttribute("stroke", "#999");
			selected.setAttribute("stroke-width", .2);
		}
		// FIXME: find another way to get the selected element
		selected = $("#taz" + id)[0]
		if (selected) {
			selected.setAttribute("stroke", "#ff0");
			selected.setAttribute("stroke-width", 1.5);
			selected.parentNode.appendChild(selected);
		}

		$.ajax(url, {
			dataType: "text",
			error: function(req, stat, text) {
				// console.log([url, "ERROR:", stat, text]);
			},
			success: function(text) {
				var rows = parseCSV(text),
						len = rows.length,
						times = {};
				for (var i = 0; i < len; i++) {
					var row = rows[i];
					times[row.dest] = row;
				}
				updateTravelTimes(times);
			}
		});
	}

	loadTazData(1);
}

/* GEOCODING STUFF 
 *
 * TODO: validate returned address is within bounds
*/
function initGeocoding() {
	var geocoder = new google.maps.Geocoder();
	var _statusElm = $("#geocoder .status");
	
	var addr = $("#geocoder input.address"),
			prompt = addr.val();
	addr.focus(function() {
		if (addr.val() == prompt) {
			addr.val("");
		} else {
			// addr.select();
		}
	});
	addr.blur(function() {
		if (addr.val() == "") {
			addr.val(prompt);
		}
	});

	$("#geocoder").submit(function(e) {
		// e.preventDefault();
		var _address = addr.val();
		if(_address && _address.length) {
			findMe(_address);
		}
		return false;
	});
	

	function findMe(address) {
		geocoder.geocode({"address": address}, function(results, status) {
			if (status == google.maps.GeocoderStatus.OK) {					
				var result = results[0],
					xx = null,
					yy = null,
					found = null;

				if(result.geometry.bounds){
					xx = result.geometry.bounds.P,
					yy = result.geometry.bounds.W;
				}else if(result.geometry.viewport){
					xx = result.geometry.viewport.P,
					yy = result.geometry.viewport.W;
				}else{}
				
				if(xx && yy){
					found = result.formatted_address;
				}else{
					found = "Found but couldn't get info..."
				}

				// zoom to the extent
				map.extent([
					{lon: xx.d, lat: yy.b},
					{lon: xx.b, lat: yy.d}
				]);
				// then floor the zoom
				map.zoom(Math.floor(map.zoom()));
				$(_statusElm).text("Found: " + found);
			} else {
				$(_statusElm).text("Error: " + status);
			}
			setTimeout(function(){
				$(_statusElm).fadeOut().text("");
			},3000);
		});
	}
}
