# Data Pipeline

1. `make clean all` to generate JSON data files

2. publish the scenario data, where `$scenario` is the name of a directory in `input/scenarios`, e.g. [2010](https://github.com/stamen/mtc/blob/master/data/input/scenarios/2010/).

```sh
$ ./publish_scenario.sh $scenario
```

This should download the requisite scenario files (assuming the scenario directory has a `Makefile`) and generate sorted versions of the time skims, e.g.:

```
input/scenarios/2010/TimeSkimsDatabaseEAdest.csv
```

After that, the shell script runs `publish_scenario.py`, which should generate paths that look like:

```
output/scenarios/{name}/time/AM/from/{1-1454}.csv
output/scenarios/{name}/time/EV/to/{1-1454}.csv
```

3. Copy, move, or symlink the output directory to ../site/data:

```sh
$ mv output ../site/data
# or:
$ cd ../site && ln -s data ../data/output
```
