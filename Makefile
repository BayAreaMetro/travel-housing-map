s3cmd ?= s3cmd -c .s3cfg -P
host ?= s3://maps.onebayarea.org

all: sync

sync: sync-scenarios

sync-scenarios:
	$(s3cmd) put -r data/output/scenarios/* $(host)/data/scenarios/
