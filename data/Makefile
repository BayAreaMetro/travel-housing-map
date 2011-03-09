SHAPEFILE_EXTS = shp shx prj sbn sbx dbf

all: output/taz1454.json output/blk2taz/060971543024999.txt

output/blk2taz/060971543024999.txt:
	python publish_blk2taz.py input/BLK00_MTCTAZ.csv $(dir $@)

output:
	mkdir -p output

input/taz1454.shp:
	unzip -d input $(basename $@).zip
	cp $(basename $@)-simplified.shp $(basename $@).shp
	cp $(basename $@)-simplified.shx $(basename $@).shx

input/buildings_min.csv: input/buildings.csv
	cat $< | cut -d , -f 1,3,11 > $@
	perl -pi -e 's/:i4//g' $@

input/taz1454.json: input/taz1454.shp
	ogr2ogr -f GeoJSON -t_srs EPSG:4326 $@ $<

output/taz1454.json: input/taz1454.json input/buildings_min.csv output
	python merge_taz.py input/buildings_min.csv $< > $@

clean:
	rm -f input/taz1454.json
	rm -f output/*.csv
	rm -f output/*.json
	rm -f $(SHAPEFILE_EXTS:%=input/taz1454.%)

really-clean: clean
	rm -rf output
