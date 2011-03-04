/*
 * vim:et sts=2 sw=2 nocindent ai:
 */

function identity(n) { return n; }

function millionize(n) {
  return (n / 1000000) + " million";
}

function commize(n) {
  if (n >= 1000000 && (n % 100000) == 0) {
    return millionize(n);
  }
  var c = 3,
      o = Math.round(n).toString(),
      parts = [];
  while (o.length > c) {
    parts.unshift(o.substr(o.length - c));
    o = o.substr(0, o.length - c);
  }
  parts.unshift(o);
  return parts.join(',');
}

function capitalize(str, skip) {
	if (!skip) skip = ["of", "and", "the", "with", "for", "de"];
	var words = str.toLowerCase().split(/\s+/);
	return words.map(function(w, i) {
		// capitalize A&B, or a state abbeviation as the last word
		if (w.indexOf("&") > -1 || (i == (words.length - 1) && w.length == 2)) return w.toUpperCase();
		return (i == 0 || skip.indexOf(w) == -1) ? (w.substr(0, 1).toUpperCase() + w.substr(1)) : w;
	}).join(" ");
}

function capitalizeFirst(str) {
	return str.charAt(0).toUpperCase() + str.substr(1);
}

function fixed(n, precision) {
	if (arguments.length == 1) precision = 1;
	return (n % 1 == 0) ? n : n.toFixed(precision);
}

function percent(n) {
  return fixed(Math.min(n, 100)) + '%';
}

function uncommize(s) {
  return parseInt(s.split(',').join(''));
}

function getProp(o, prop) {
	if (prop.indexOf(".") > -1) {
		var parts = prop.split(".");
		while (parts.length > 0) {
			prop = parts.shift();
			o = o[prop];
			if (!o) return null;
		}
		return o;
	}
	return o[prop];
}

function setProp(o, prop, v) {
	if (prop.indexOf(".") > -1) {
		var parts = prop.split(".");
		while (parts.length > 1) {
			prop = parts.shift();
			o = o[prop];
			if (typeof o == "undefined") return null;
		}
		prop = parts.shift();
	}
	return (o[prop] = v);
}

function prop(name) {
	var p = {};
	p.name = name;
	p.get = function(o) {
		return getProp(o, p.name);
	};
	p.set = function(o, v) {
		return setProp(o, p.name, v);
	};
	return p;
};

function sortBy(prop) {
	if (typeof prop == "function") return prop;
	var dir = prop.charAt(0),
			rev = (dir == "-") ? -1 : 1;
	if (dir == "+" || dir == "-") {
		prop = prop.substr(1);
	}
  return function(a, b) {
    return rev * (getProp(a, prop) - getProp(b, prop));
  };
}

function multisort(props) {
	var sorts = props.map(sortBy);
	var len = sorts.length;
	return function (a, b) {
		var order = 0;
		for (var i = 0; i < len; i++) {
			order = sorts[i](a, b);
			if (order != 0) return order;
		}
		return order;
	};
}

function distance(a, b) {
  var dx = b.x - a.x,
      dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function mousePos(event, absolute) {
  if (absolute) {

    return {x: event.pageX,
            y: event.pageY};

  } else if (typeof event.offsetX == "undefined") {

    var offset = $(event.target).offset();
    return {x: event.pageX - offset.left,
            y: event.pageY - offset.top};

  }
  return {x: event.offsetX,
          y: event.offsetY};
}

function parseQueryString(str) {
	var q = {},
			parts = str.split("&");
	for (var i = 0; i < parts.length; i++) {
		var part = parts[i].split('=');
		if (part.length == 2) {
			q[part[0]] = part[1];
		}
	}
	return q;
}

function makeQueryString(q, sorted) {
	var parts = [];
	for (var k in q) {
		if (!k.match(/^[a-z]+$/)) continue; // FIXME: this shouldn't happen
		parts.push(k + '=' + encodeURIComponent(q[k]));
	}
	if (sorted) {
		parts = parts.sort();
	}
	return parts.join('&');
}

(function() {
	/**
	 * And now, for the Array methods missing in IE7...
	 */
	var array = Array.prototype;

	if (typeof array.map == "undefined") {
		array.map = function(fn, ctx) {
			var out = [];
			for (var i = 0; i < this.length; i++) {
				if (this.hasOwnProperty(i)) {
					out[i] = fn.apply(ctx, [this[i], i, this]);
				}
			}
			return out;
		};
	}

	if (typeof array.reduce == "undefine") {
		array.reduce = function(fn, initial) {
			if (this.length == 0 && arguments.length == 1) {
				throw new TypeError();
			}
			var len = this.length,
					k = 0,
					a;
			if (arguments.length >= 2) {
				a = initial;
			} else {
				while (true) {
					if (this.hasOwnProperty(k)) {
						a = this[k++];
						break;
					}
					if (++k >= len) {
						throw new TypeError();
					}
				}
			}

			while (k < len) {
				if (this.hasOwnProperty(k)) {
					a = fn.call(undefined, a, this[k], k, this);
				}
				k++;
			}
		};
	}

	if (typeof array.some == "undefined") {
		array.some = function(fn, ctx) {
			var out = [];
			for (var i = 0; i < this.length; i++) {
				if (this.hasOwnProperty(i) && fn.apply(ctx, [this[i], i, this])) {
					return true;
				}
			}
			return false;
		};
	}

	if (typeof array.forEach == "undefined") {
		array.forEach = function(fn, ctx) {
			for (var i = 0; i < this.length; i++) {
				fn.apply(ctx, [this[i], i, this]);
			}
		};
	}
})();

function min(a, getter) {
	if (getter) {
		return min(a.map(getter));
	}
	return Math.min.apply(Math, a);
}

function max(a, getter) {
	if (getter) {
		return max(a.map(getter));
	}
	return Math.max.apply(Math, a);
}

function sum(a) {
	return a.reduce(function(a, b) {
		return a + b;
	}, 0);
}

function average(a) {
	return sum(a) / a.length;
}

function replaceFragment(url, fragment) {
	var parts = url.split(/#+/);
	parts[1] = fragment;
	parts.splice(2);
	return parts.join((fragment.charAt(0) == "#") ? "" : "#");
}

function waterLevel(n, inlineText) {
	return ((n > 0) ? ("+" + Math.floor(n)) : n) + " ft";
}

