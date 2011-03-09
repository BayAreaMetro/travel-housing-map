import csv, sys, os.path

# Our MTC CSV dialect has no quotes or escape chars, but should skip initial
# white space (as this is easier to do from within DictReader than calling
# strip() on all the values)
class MTCDialect(csv.Dialect):
	delimiter = ','
	doublequote = False
	escapechar = None
	skipinitialspace = True
	quoting = csv.QUOTE_NONE
	quotechar = None
	lineterminator = '\n'

# recursively make dirs for a given file path
def prepdirs(dirname):
	if not os.path.isdir(dirname):
		print >> sys.stderr, "  * makedirs(): %s" % dirname
		os.makedirs(dirname)
		return True
	return False
