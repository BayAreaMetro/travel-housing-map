$(function() {
	var po = org.polymaps,
			map = po.map()
				.container($("#map")[0].appendChild(po.svg("svg")));
	
	map.center({lon: -122.2757, lat: 37.8355})
	map.zoom(9);
	map.zoomRange([8, 12]);

	var taz = po.geoJson()
		.url(null)
		.tile(false)
		.zoom(map.zoom() + 2);

	var base = po.image()
		.url("http://a.acetate.geoiq.com/tiles/acetate-base/{Z}/{X}/{Y}.png");

	var labels = po.image()
		.url("http://a.acetate.geoiq.com/tiles/acetate-labels/{Z}/{X}/{Y}.png");

	map.add(base);
	map.add(taz);
	map.add(labels);
	map.add(po.interact());
	map.add(po.hash());

	$(labels.container())
		.css("pointer-events", "none");
		
	var scale = pv.Scale.linear()
		.domain(0, 250000, 1000000)
		.range("rgb(233,163,201)", "white", "rgb(161,215,106)");

	var thresholdMin = 0;
	var thresholdMax = 1000000;

	function update() {
		var _out = "LOW:<span> $"+commize(thresholdMin)+"</span>HI:<span> $"+commize(thresholdMax)+"</span>";
		$("#control_header p").html(_out);
		// console.log("threshold: " + commize(threshold));
		//var t = timer().start();
		taz.reshow();
		
		//var took = t.end();
		//$("#timer").text("(took " + took + "ms)");
		return false;
	}

	function price(feature) {
		return feature.properties.average_value_per_unit;
	}

	function formatPrice(p) {
		return "$" + commize(p);
	}
	
	function setSlider(min,max){
		var _options = {};
		_options.min = min;
		_options.max = max;
		_options.values = [ thresholdMin , thresholdMax ];
		$( "#slider" ).slider( "option", _options );
	}

	var style = po.stylist();
	style.attr("stroke", "#999");
	style.attr("stroke-width", .5);
	style.title(function(feature) {
		return feature.properties["TAZ1454"] + ": " + formatPrice(price(feature));
	});
	
	// color code fill based on home price value
	style.attr("fill", function(feature) {
		if (price(feature) >= thresholdMin && price(feature) <= thresholdMax) {
			var value = price(feature);
			var color = scale(value).color;
			// console.log(value + " -> " + color);
			return color;
		} else {
			return "#ccc";
		}
	});
	
	//hide features that don't meet our critera
	style.attr("display", function(feature) {
		if (price(feature) >= thresholdMin && price(feature) <= thresholdMax) {
			return "";
		} else {
			return "none";
		}
	});
	
	/* SLIDER INIT */
	$( "#slider" ).slider({
		range: true,
		change: function( event, ui ) {
					thresholdMin = ui.values[0];
					thresholdMax = ui.values[1];
					update();
						//updateOutput(output,ui.value);
				}
	});
	

	taz.on("show", style);

	$("#status").attr("class", "loading").text("Loading...");

	$.ajax("taz.js", {
		dataType: "jsonp",
		jsonpCallback: "loadTaz",
		error: function(req, text, e) {
			$("#status").attr("class", "error").text("Error: " + text);
		},
		success: function(collection) {

			var features = collection.features;

			var min = pv.min(features, price),
					median = pv.median(features, price),
					max = pv.max(features, price);

			var step = 100000;
			function priceGroup(feature) {
				return Math.round(price(feature) / step) * step;
			}
			
			var priceGroups = pv.nest(features)
				.key(priceGroup)
				.rollup(function(group) { return group.length; });
			// [{key: 100000, value: 10}, ...]
			console.log(priceGroups);
			/*
			priceGroups.forEach(function(group) {
				var entry = $("<div/>").text(group.key + ": " + group.value);
				$("#controls").append(entry);
			});
			*/

			thresholdMin = median;
			thresholdMax = max;
			
			scale.domain(min, median, max);
			
			$("#status").attr("class", "loaded").text("Loaded " + features.length + " TAZs; median: " + formatPrice(median));

			taz.features(features);
			setSlider(min,max);
		}
	});
	
});