# Data Pipeline

## Publishing Scenarios

To publish scenario data, where `$scenario` is the name of a directory in `input/scenarios`, e.g. [2010](https://github.com/stamen/mtc/blob/master/data/input/scenarios/2010/), run:

```sh
$ ./publish_scenario.sh $scenario
```

This should download the requisite scenario files (assuming the scenario directory has a `Makefile`) and generate sorted versions of the time skims, e.g.:

```
input/scenarios/2010/TimeSkimsDatabaseEAdest.csv
```

After that, the shell script will run `publish_scenario.py`, which should generate paths that look like:

```
output/scenarios/{name}/time/AM/from/{1-1454}.csv
output/scenarios/{name}/time/EV/to/{1-1454}.csv
```

## Generate GeoJSON data files

This step will probably go away once we update the app to load home prices from separate files, but for now:

```sh
make clean all
```

## Symlinking to the docroot

Copy, move, or symlink the output directory to `../www/data` so that it's available relative to the docroot:

```sh
$ mv output ../www/data
# or:
$ cd ../www && ln -s data ../data/output
```
