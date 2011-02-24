import sys, csv, simplejson
from optparse import OptionParser

parser = OptionParser(usage='usage: %prog [options] csv_file json_file\n' """
Merges data from a comma- (or tab-, pipe-, etc.) separated file into the
properties of GeoJSON features by joining on a foreign key, and prints the
resulting GeoJSON feature collection to stdout.""")
parser.add_option('-f', '--fk', dest='fk', default='id',
                  help='The CSV column and GeoJSON feature property name on '
                       'which to join. This may either be a single string, or '
                       'a colon-separated pair denoting the CSV column name and '
                       'GeoJSON feature property name, respectively. The '
                       'default is "%default".')
parser.add_option('-F', '--field-separator', dest='fs', default=',',
                  help='The CSV file field separator, default: %default')
parser.add_option('-q', '--field-quote', dest='fq', default='"',
                  help='The CSV file field quote character, default: %default')
parser.add_option('-p', '--props', dest='props', default='merge',
                  help='What to do with CSV column values: '
                       '"merge[:keys]" merges all column values into the joined '
                       'GeoJSON feature; "replace[:keys]" replaces GeoJSON '
                       'feature properties with those of the joined CSV row '
                       '(where "keys" is a comma-separated list of keys)')
parser.add_option('-i', '--indent', dest='indent', default='',
                  help='The string with which to indent the output GeoJSON, '
                       'defaults to none.')
parser.add_option('--limit', dest='limit', type='int', default=0,
                  help='Limit output to LIMIT features, useful for testing.')

options, args = parser.parse_args()
if len(args) != 2:
    parser.print_help()
    sys.exit(1)

input_csv, input_json = args

prop_parts = options.props.split(':')
if len(prop_parts) > 1:
    prop_names = prop_parts[1].split(',')
    def limit_keys(src):
        return dict([(k, src[k]) for k in src.keys() if k in prop_names])
else:
    limit_keys = lambda src: src

if options.props.startswith('replace'):
    def apply_props(row, feature):
        feature['properties'] = limit_keys(row)
elif options.props.startswith('merge'):
    def apply_props(row, feature):
        updates = limit_keys(row)
        # don't overwrite the value of the foreign key property, as this will
        # cause a string conversion
        if updates.has_key(json_fk):
            del updates[json_fk]
        feature['properties'].update(updates)
else:
    parser.print_help()
    sys.exit(1)

if ':' in options.fk:
    csv_fk, json_fk = options.fk.split(':')
else:
    csv_fk = options.fk
    json_fk = options.fk

csv_reader = csv.DictReader(open(input_csv), delimiter=options.fs, quotechar=options.fq)
rows = {}
for row in csv_reader:
    key = row.get(csv_fk)
    rows[key] = row
    if options.limit > 0 and len(rows) == options.limit:
        break
row_keys = set(rows.keys())
print >> sys.stderr, '%d row keys' % len(row_keys)

collection = simplejson.loads(open(input_json, 'r').read())
features = collection['features']
feature_keys = set(map(lambda feature: str(feature['properties'].get(json_fk)), features))
print >> sys.stderr, '%d feature keys' % len(feature_keys)

common_keys = row_keys.intersection(feature_keys)
print >> sys.stderr, '%d keys in common' % len(common_keys)

valid_features = []
for feature in features:
    key = str(feature['properties'].get(json_fk))
    if key in common_keys:
        row = rows.get(key)
        apply_props(row, feature)
        valid_features.append(feature)

collection['features'] = valid_features
print simplejson.dumps(collection, indent=options.indent)
