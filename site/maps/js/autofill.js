function parseQuery(s) {
	var parts = s.split("&"),
			query = {};
	for (var i = 0; i < parts.length; i++) {
		var part = parts[i].split("=");
		if (part.length == 2) {
			query[part[0]] = unescape(part[1]).replace(/\+/g, " ");
		}
	}
	return query;
}

function makeQuery(q) {
	var s = [];
	for (var p in q) {
		s.push(p + "=" + escape(q[p])).replace(/%20/g, "+");
	}
	return s.join("&");
}

$(function() {
	var qs = location.search;
	if (qs.match(/^\?.+=/)) {
		var query = parseQuery(qs.substr(1));

		$("form.autofill input").each(function() {
			var input = this,
					value = query[input.name];

			if (typeof value != "undefined") {
				switch (input.type) {
					case "radio":
						input.checked = (value == input.value);
						break;

					case "hidden":
					case "text":
						input.value = value;
						break;
				}
			}
		});
	}
});
