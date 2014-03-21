# these are used to clean up after shapefile zip archives (see: "clean")
TAZ_SHAPEFILE = taz1454_clipurb2002
SHAPEFILE_EXTS = shp shx prj sbn sbx dbf

# Our "all" target makes:
# 1. the TAZ GeoJSON file
# 2. html assets
all: output/areas/taz1454.json output-html

# Unzip the TAZ boundaries and overwrite the SHP and SHX components with
# simplified geometries.
input/$(TAZ_SHAPEFILE).shp:
	@# echo "unzipping for $@"
	unzip -n -d input input/$(TAZ_SHAPEFILE).zip
	cp simplify/$(TAZ_SHAPEFILE)-simplified.shp input/$(TAZ_SHAPEFILE).shp
	cp simplify/$(TAZ_SHAPEFILE)-simplified.shx input/$(TAZ_SHAPEFILE).shx

# Convert the shapefile to GeoJSON
input/taz1454.json: input/$(TAZ_SHAPEFILE).shp
	ogr2ogr -f GeoJSON -t_srs EPSG:4326 $@ $<

output:
	mkdir -p $@

output/areas: output
	mkdir -p $@

output-html: output
	rsync -avrC html/ output/

# Merge fields from buildings_min.csv into the TAZ boundaries GeoJSON
output/areas/taz1454.json: input/taz1454.json input/home-counts.csv output/areas
	python merge_taz.py input/home-counts.csv input/taz1454.json > $@

# TODO: generate separate files for clipped urban areas!
output/areas/taz1454-clipurb.json: output/areas/taz1454.json
	cp $< $@

clean:
	rm -f input/*.json
	rm -f output/*.csv
	rm -f output/areas/*.json
	rm -f $(SHAPEFILE_EXTS:%=input/$(TAZ_SHAPEFILE).%)

dist-clean: clean
	rm -rf output
