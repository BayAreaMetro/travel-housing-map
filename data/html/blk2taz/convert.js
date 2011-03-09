function blk2url(blk) {
	var url = [],
			step = 3;
	for (var i = 0; i < blk.length; i += step) {
		url.push(blk.substr(i, i + step));
	}
	return "http://move.onebayarea.org/data/blk2taz/" + url.join("/");
}

function blk2taz(block, options) {
	var opts = $.extend(options, {
		dataType: "text"
	});
	var url = blk2url(block);
	return $.ajax(url, opts);
}

function address2taz(addr, callback) {
}

function location2taz(loc, callback) {
}
