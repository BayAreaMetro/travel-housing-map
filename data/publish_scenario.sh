#!/bin/sh
INPUT=input/scenarios/$1
OUTPUT=output/scenarios/$1
cd $INPUT && unzip -u "*.zip"
cd -
for CSV in $INPUT/*.csv
do
	echo "${CSV%%.*}" | grep "dest\$" > /dev/null 2>&1
	if [ $? -eq "0" ]; then
		echo "Skipped $CSV..."
		continue
	fi
	DEST="${CSV%%.*}dest.${CSV##*.}"
	if [ ! -f $DEST ]; then
		echo "Creating $DEST from $CSV..."
		sort -b -n -k 2 -t , $CSV > $DEST
	fi
done
python publish_scenario.py $INPUT/*.csv $OUTPUT
