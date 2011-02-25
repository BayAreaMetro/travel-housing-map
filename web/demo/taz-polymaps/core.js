$(function() {
	var po = org.polymaps,
			map = po.map()
				.container($("#map")[0].appendChild(po.svg("svg")));
	
	map.center({lon: -122.2757, lat: 37.8355})
	map.zoom(9);
	map.zoomRange([9, 12]);

	var taz = po.geoJson()
		.url(null)
		.tile(false)
		.zoom(10); // map zoom +/- 2

	var base = po.image()
		.url("http://a.acetate.geoiq.com/tiles/acetate-base/{Z}/{X}/{Y}.png");

	var labels = po.image()
		.url("http://a.acetate.geoiq.com/tiles/acetate-labels/{Z}/{X}/{Y}.png");

	map.add(base);
	map.add(taz);
	map.add(labels);
	map.add(po.interact());
	map.add(po.compass()
	    .pan("none"));
	map.add(po.hash());

	$(labels.container())
		.css("pointer-events", "none");
		
	var scale = pv.Scale.linear()
		.domain(0, 250000, 1000000)
		.range("rgb(222,235,247)", "rgb(158,202,225)", "rgb(255,69,148)");

	var thresholdMin = 0;
	var thresholdMax = 1000000;

	function inBounds(feature) {
		var p = price(feature);
		return p >= thresholdMin && p <= thresholdMax;
	}

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

	function price(feature) {
		return feature.properties.average_value_per_unit;
	}

	function formatPrice(p) {
		return "$" + commize(p);
	}
	
	function setSlider(min, max, step){
		var _options = {};
		_options.min = min;
		_options.max = max;
		_options.values = [ thresholdMin , thresholdMax ];
		_options.step = step;
		_options.disabled = false;
		$( "#price .slider" ).slider( "option", _options );
		// $( "#slider" ).css("opacity",1);
	}

	var style = po.stylist();
	style.attr("stroke", "#999");
	style.attr("stroke-width", .2);
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
		} // ,
		// create: function(event, ui) { $( "#slider" ).css("opacity",.3); }
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
			var features = collection.features,
					len = features.length;

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

			var container = $("#price .graph div.canvas"),
			var size = {x: container.innerWidth(), y: 80},
					graph = new pv.Panel()
						.canvas(container[0])
						.width(size.x)
						.height(size.y);

			var x = pv.Scale.ordinal(pv.keys(priceGroups)).by(pv.index).splitBanded(0, size.x),
					h = pv.Scale.linear(priceGroups, prop("count").get).range(1, size.y - 15);

			var bars = graph.add(pv.Bar)
				.data(priceGroups)
				.fillStyle("#ff0")
				.left(x)
				.bottom(15)
				.width(x.range().band - 1)
				.height(function(g) { return h(g.count); });

			x = pv.Scale.linear(min, max).range(0, size.x - 1);
			var rules = graph.add(pv.Rule)
				.data([min, median, max])
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

			scale.domain(min, median, max);
			scale.nice();

			taz.features(features);
			setSlider(min, max, step);
			update();
			initGeocoding();
		}
	});
	
	/* GEOCODING STUFF 
	 *
	 * TODO: validate returned address is within bounds
	*/
	function initGeocoding() {
		var geocoder = new google.maps.Geocoder();
		
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
							xx = result.geometry.bounds.P,
							yy = result.geometry.bounds.W,
							found = result.formatted_address;
					// zoom to the extent
					map.extent([
						{lon: xx.d, lat: yy.b},
						{lon: xx.b, lat: yy.d}
					]);
					// then floor the zoom
					map.zoom(Math.floor(map.zoom()));
					$("#geocoder .status").text("Found: " + found);
				} else {
					$("#geocoder .status").text("Error: " + status);
				}
			});
		}
	}
	
});
